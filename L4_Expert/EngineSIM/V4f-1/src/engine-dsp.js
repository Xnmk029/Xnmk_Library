/*!
 * V4f Engine DSP — 通用单文件实现（无 import/export）。
 *
 * 同一份文件可用在三种上下文：
 *   1. 页面经典脚本：<script src="src/engine-dsp.js"> → 定义 window.EngineDSP；
 *   2. AudioWorklet 模块：audioWorklet.addModule(new URL('./src/engine-dsp.js', document.baseURI))
 *      → 注册 'engine-dsp' 处理器（文件没有 import/export，作为模块求值合法）；
 *   3. Node（CommonJS）：require('./src/engine-dsp.js') → module.exports = EngineDSP。
 *
 * 设计要点（与 PROJECT_PROMPT.md 对齐）：
 *   - 十字曲轴 V8 的 burble 只来自真实点火顺序 + 单侧排气歧管（等长芭蕉），
 *     不存在任何 “burble 强度” 参数；量化指标见 internal.analyzeBurble。
 *   - 等长芭蕉 = 每侧一根延迟线：y[n] = x[n] - x[n-N]，N = round(2L/c * fs)，
 *     闭端反相反射构成差分梳状：基频 c/(4L) = 164.6 Hz 处为峰，
 *     奇次模（1/3/5...）保留、偶次模被抑制。
 *   - 混响为 8×8 FDN：Hadamard 正交反馈矩阵、互质素数延迟线、早期反射 +
 *     预延迟 + 立体声去相关（Hadamard 行作为左右声道权重）；8 组空间预设，
 *     切换时所有系数按 25ms 指数平滑、预延迟用交叉淡化 → 零点击。
 *   - 断油/回火/进气嘶吼/气门机械声保留；lite/high 两档质量。
 *   - 浏览器与 Node 离线渲染共用本文件；30s 参数滥用不得出现 NaN/Inf。
 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.EngineDSP = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TAU = Math.PI * 2;
  var DEFAULT_SR = 48000;
  var SOUND_SPEED = 343.15;
  var EXHAUST_LENGTH_M = 0.5212; // c/(4L) = 164.6 Hz
  var PRE_BUF_SIZE = 16384; // 覆盖最大早期反射 150ms（教堂）
  // 早期反射固定时刻（ms）：预设切换只改变增益，延迟线长度不变 → 零点击
  var FIXED_EARLY_TAPS_MS = [12, 30, 65, 110];

  var FIRING_ORDERS = {
    crossplane: [1, 8, 4, 3, 6, 5, 7, 2],
    flatplane: [1, 8, 3, 6, 5, 2, 7, 4]
  };

  // LS 风格缸组：1/3/5/7 左列，2/4/6/8 右列。
  var BANK_OF = { 1: 'L', 2: 'R', 3: 'L', 4: 'R', 5: 'L', 6: 'R', 7: 'L', 8: 'R' };

  var REVERB_PRESETS = [
    { id: 'zero',    name: '零延迟', preDelayMs: 0,  early: [0, 0, 0, 0],                  fdbk: 0.00, damp: 0.00, wet: 0.00, sizeMs: 2 },
    { id: 'small',   name: '小房间', preDelayMs: 3,  early: [0.5, 0.35, 0.2, 0],           fdbk: 0.55, damp: 0.18, wet: 0.35, sizeMs: 12 },
    { id: 'garage',  name: '车库',   preDelayMs: 8,  early: [0.6, 0.4, 0.25, 0],           fdbk: 0.62, damp: 0.22, wet: 0.45, sizeMs: 18 },
    { id: 'hall',    name: '大厅',   preDelayMs: 18, early: [0.7, 0.5, 0.32, 0.2],         fdbk: 0.72, damp: 0.28, wet: 0.55, sizeMs: 40 },
    { id: 'tunnel',  name: '隧道',   preDelayMs: 12, early: [0.75, 0.6, 0.45, 0],          fdbk: 0.78, damp: 0.12, wet: 0.65, sizeMs: 58 },
    { id: 'church',  name: '教堂',   preDelayMs: 28, early: [0.6, 0.45, 0.3, 0.18],        fdbk: 0.80, damp: 0.30, wet: 0.70, sizeMs: 85 },
    { id: 'stadium', name: '体育场', preDelayMs: 24, early: [0.6, 0.45, 0.32, 0],          fdbk: 0.83, damp: 0.35, wet: 0.75, sizeMs: 120 },
    { id: 'outdoor', name: '开阔地', preDelayMs: 10, early: [0.3, 0.15, 0, 0],             fdbk: 0.35, damp: 0.40, wet: 0.22, sizeMs: 30 }
  ];

  var DEFAULT_CONFIG = {
    idleRpm: 800,
    maxRpm: 6800,
    limiterRpm: 6800,
    softLimitRpm: 6400,
    soundSpeed: SOUND_SPEED,
    exhaustRunnerLengthM: EXHAUST_LENGTH_M,
    firingOrder: FIRING_ORDERS.crossplane.slice(),
    bankOf: BANK_OF,
    quality: 'high',
    preset: 'hall',
    noiseGain: 1,
    masterGain: 0.9
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function isPrime(v) {
    if (v < 2) return false;
    if (v % 2 === 0) return v === 2;
    for (var i = 3; i * i <= v; i += 2) if (v % i === 0) return false;
    return true;
  }

  // 生成 count 个互质素数延迟长度（从约 target 起向上取连续素数）。
  function coprimeLineLengths(count, target) {
    var out = [];
    var v = Math.max(2, Math.floor(target));
    if (v % 2 === 0) v += 1;
    while (out.length < count) {
      if (isPrime(v)) out.push(v);
      v += 2;
    }
    return out;
  }

  // Sylvester 构造 8×8 Hadamard 并归一化（正交反馈矩阵）。
  function hadamard8() {
    var h2 = [[1, 1], [1, -1]];
    function kron(a, b) {
      var m = a.length, n = a[0].length, p = b.length, q = b[0].length;
      var r = [];
      for (var i = 0; i < m * p; i++) {
        r[i] = new Float64Array(n * q);
        for (var j = 0; j < n * q; j++) {
          r[i][j] = a[(i / p) | 0][(j / q) | 0] * b[i % p][j % q];
        }
      }
      return r;
    }
    var h4 = kron(h2, h2);
    var h8 = kron(h4, h2);
    var s = 1 / Math.sqrt(8);
    for (var i = 0; i < 8; i++) for (var j = 0; j < 8; j++) h8[i][j] *= s;
    return h8;
  }

  function firingTables(order) {
    var L = [], R = [];
    for (var i = 0; i < 8; i++) {
      var cyl = order[i];
      var entry = { frac: i / 8, cyl: cyl };
      if (BANK_OF[cyl] === 'L') L.push(entry); else R.push(entry);
    }
    function byFrac(a, b) { return a.frac - b.frac; }
    L.sort(byFrac);
    R.sort(byFrac);
    return { L: L, R: R };
  }

  // 等长芭蕉延迟线长度：N = round(2L/c * fs)。
  function exhaustCombLength(fs, lengthM) {
    if (lengthM == null) lengthM = EXHAUST_LENGTH_M;
    return Math.max(1, Math.round((2 * lengthM / SOUND_SPEED) * fs));
  }

  // 迭代 radix-2 FFT，返回幅度谱 [0 .. n/2]。
  function fftMag(x) {
    var n = x.length;
    var re = new Float64Array(n), im = new Float64Array(n);
    for (var i = 0; i < n; i++) re[i] = x[i];
    for (var i2 = 1, j = 0; i2 < n; i2++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i2 < j) {
        var tr = re[i2]; re[i2] = re[j]; re[j] = tr;
        var ti = im[i2]; im[i2] = im[j]; im[j] = ti;
      }
    }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = -TAU / len;
      var wr = Math.cos(ang), wi = Math.sin(ang);
      for (var i3 = 0; i3 < n; i3 += len) {
        var cwr = 1, cwi = 0;
        for (var k = 0; k < len / 2; k++) {
          var ux = re[i3 + k], uy = im[i3 + k];
          var vx = re[i3 + k + len / 2] * cwr - im[i3 + k + len / 2] * cwi;
          var vy = re[i3 + k + len / 2] * cwi + im[i3 + k + len / 2] * cwr;
          re[i3 + k] = ux + vx; im[i3 + k] = uy + vy;
          re[i3 + k + len / 2] = ux - vx; im[i3 + k + len / 2] = uy - vy;
          var nwr = cwr * wr - cwi * wi;
          cwi = cwr * wi + cwi * wr;
          cwr = nwr;
        }
      }
    }
    var mag = new Float64Array(n / 2 + 1);
    for (var i4 = 0; i4 <= n / 2; i4++) mag[i4] = Math.sqrt(re[i4] * re[i4] + im[i4] * im[i4]);
    return mag;
  }

  function biquadCoeffs(type, f, q, fs) {
    var w0 = TAU * f / fs;
    var c = Math.cos(w0), s = Math.sin(w0), alpha = s / (2 * q);
    var b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass') {
      b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2;
      a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    } else if (type === 'highpass') {
      b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2;
      a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    } else { // bandpass
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    }
    var inv = 1 / a0;
    return [b0 * inv, b1 * inv, b2 * inv, -a1 * inv, -a2 * inv];
  }

  function makeBiquad() {
    return { coeffs: [1, 0, 0, 0, 0], x1: 0, x2: 0, y1: 0, y2: 0 };
  }

  function biquadStep(bq, x) {
    var k = bq.coeffs;
    var y = k[0] * x + k[1] * bq.x1 + k[2] * bq.x2 + k[3] * bq.y1 + k[4] * bq.y2;
    bq.x2 = bq.x1; bq.x1 = x;
    bq.y2 = bq.y1; bq.y1 = y;
    return y;
  }

  // ---------------- 8×8 FDN ----------------
  function FDN(fs) {
    this.fs = fs;
    this.H = hadamard8();
    var base = coprimeLineLengths(8, Math.round(0.040 * fs));
    this.lengths = base;
    this.lines = [];
    this.idx = new Int32Array(8);
    for (var i = 0; i < 8; i++) this.lines.push(new Float64Array(base[i]));
    this.scratch = new Float64Array(8);
    this.outs = new Float64Array(8);
    this.curFb = 0; this.curDamp = 0; this.curWetL = 0; this.curWetR = 0;
    this.tgtFb = 0; this.tgtDamp = 0; this.tgtWetL = 0; this.tgtWetR = 0;
    this.kSmooth = 1 - Math.exp(-1 / (0.025 * fs));
    this.presetIndex = 0;
  }

  FDN.prototype.setPreset = function (preset, direct) {
    var p = preset;
    this.tgtFb = p.fdbk;
    this.tgtDamp = p.damp;
    this.tgtWetL = p.wet;
    this.tgtWetR = p.wet;
    if (direct) {
      this.curFb = p.fdbk; this.curDamp = p.damp; this.curWetL = p.wet; this.curWetR = p.wet;
    }
  };

  // 返回 [wetL, wetR]。x 为预延迟后的发送信号；direct 用于离线测量。
  FDN.prototype.process = function (x, direct) {
    if (direct) {
      this.curFb = this.tgtFb; this.curDamp = this.tgtDamp;
      this.curWetL = this.tgtWetL; this.curWetR = this.tgtWetR;
    } else {
      this.curFb += (this.tgtFb - this.curFb) * this.kSmooth;
      this.curDamp += (this.tgtDamp - this.curDamp) * this.kSmooth;
      this.curWetL += (this.tgtWetL - this.curWetL) * this.kSmooth;
      this.curWetR += (this.tgtWetR - this.curWetR) * this.kSmooth;
    }
    var H = this.H, fb = this.curFb, damp = this.curDamp;
    var i, j, acc = this.scratch, outs = this.outs;
    for (i = 0; i < 8; i++) {
      outs[i] = this.lines[i][this.idx[i]];
      acc[i] = 0;
    }
    for (i = 0; i < 8; i++) {
      var oi = outs[i];
      var row = H[i];
      for (j = 0; j < 8; j++) acc[i] += row[j] * outs[j];
      var input = x + fb * acc[i];
      this.lines[i][this.idx[i]] = oi + damp * (input - oi);
      this.idx[i]++;
      if (this.idx[i] >= this.lengths[i]) this.idx[i] = 0;
    }
    var wL = 0, wR = 0;
    for (j = 0; j < 8; j++) {
      wL += H[0][j] * outs[j];
      wR += H[1][j] * outs[j];
    }
    return [wL * this.curWetL, wR * this.curWetR];
  };

  // ---------------- 引擎（每样本处理） ----------------
  function Engine(opts) {
    opts = opts || {};
    this.fs = opts.sampleRate || DEFAULT_SR;
    this.quality = opts.quality === 'lite' ? 'lite' : 'high';
    this.seed = opts.seed == null ? 20260731 : opts.seed;
    this.randState = (this.seed * 2654435761) >>> 0 || 1;
    this.noiseState = (this.seed ^ 0x9e3779b9) >>> 0 || 7;

    this.rpm = 800; this.rpmTarget = 800;
    this.throttle = 0; this.throttleTarget = 0;
    this.ignition = true; this.cutoff = false;
    this.noiseGain = 1; this.noiseGainTarget = 1;
    this.masterGain = 0.9;
    this.combGain = 1;

    this.firingType = 'crossplane';
    this.tables = firingTables(FIRING_ORDERS.crossplane);
    this.combN = exhaustCombLength(this.fs, EXHAUST_LENGTH_M);

    this.banks = [
      this._makeBank('L'),
      this._makeBank('R')
    ];
    this.pops = [];
    this.sampleCount = 0;

    this.fdn = new FDN(this.fs);
    this.presetIndex = 3; // hall
    this.curEarly = new Float64Array(4);
    this.tgtEarly = new Float64Array(4);
    this.earlyTaps = [0, 0, 0, 0];
    this.earlyGains = [0, 0, 0, 0];
    this._applyPresetTargets(REVERB_PRESETS[3]);
    this.kFast = 1 - Math.exp(-1 / (0.008 * this.fs));
    this.kSmooth = 1 - Math.exp(-1 / (0.020 * this.fs));
    this.kFade = 1 - Math.exp(-1 / (0.025 * this.fs));

    this.preBuf = new Float64Array(PRE_BUF_SIZE);
    this.preIdx = 0;
    this.preReadA = 0; this.preReadB = 0; this.preFade = -1;
    this.preCurrent = this._preSamples(REVERB_PRESETS[3]);
    this.preFadeDur = Math.round(0.025 * this.fs);

    this.body = makeBiquad();
    this.intake = makeBiquad();
    this.block = 0;

    // 常量（避免每样本 exp）
    this.dt = 1 / this.fs;
    this.decayPulse = Math.exp(-this.dt / 0.0055);
    this.decayClick = Math.exp(-this.dt / 0.0009);
    this.decayPop = Math.exp(-this.dt / 0.018);
    this.rpmUpRate = 12000;   // rpm/s
    this.rpmDownRate = 15000; // rpm/s

    // 每缸幅度微差（真实发动机缸间不平衡，确定性）
    this.cylVar = [1.05, 0.97, 1.02, 0.94];
    this._updateFilters(true);
  }

  Engine.prototype._makeBank = function (side) {
    var b = {
      side: side,
      phase: 0, idx: 0,
      fracs: [], cyls: [],
      t: 0, pulseAmp: 0, pulseFreq: 55, pulsePhase: 0,
      clickAmp: 0, clickT: 0,
      popAmp: 0, popT: 0, popFreq: 45, popNoise: 0.3,
      comb: new Float64Array(this.combN + 1), combIdx: 0,
      lp: 0,
      xDelay: new Float64Array(4), xIdx: 0
    };
    var tab = this.tables[side];
    for (var i = 0; i < tab.length; i++) {
      b.fracs.push(tab[i].frac);
      b.cyls.push(tab[i].cyl);
    }
    return b;
  };

  Engine.prototype.setFiringOrder = function (type) {
    if (type !== 'crossplane' && type !== 'flatplane') return;
    if (type === this.firingType) return;
    this.firingType = type;
    this.tables = firingTables(FIRING_ORDERS[type]);
    for (var i = 0; i < 2; i++) {
      var b = this.banks[i];
      b.fracs = []; b.cyls = []; b.idx = 0; b.phase = Math.min(b.phase, 0.9999);
      var tab = this.tables[b.side];
      for (var j = 0; j < tab.length; j++) {
        b.fracs.push(tab[j].frac);
        b.cyls.push(tab[j].cyl);
      }
    }
  };

  Engine.prototype.setPreset = function (id) {
    var idx = -1;
    for (var i = 0; i < REVERB_PRESETS.length; i++) {
      if (REVERB_PRESETS[i].id === id) { idx = i; break; }
    }
    if (idx < 0) return;
    if (idx !== this.presetIndex) {
      // 预延迟切换：交叉淡化
      this.preReadA = this.preCurrent;
      this.preReadB = this._preSamples(REVERB_PRESETS[idx]);
      this.preCurrent = this.preReadB;
      this.preFade = this.preFadeDur;
      this.presetIndex = idx;
    }
    this._applyPresetTargets(REVERB_PRESETS[idx]);
  };

  Engine.prototype._preSamples = function (preset) {
    return Math.round(preset.preDelayMs * this.fs / 1000);
  };

  Engine.prototype._applyPresetTargets = function (preset) {
    this.fdn.setPreset(preset);
    this.tgtEarly.fill(0);
    for (var i = 0; i < 4; i++) {
      this.earlyTaps[i] = Math.round(FIXED_EARLY_TAPS_MS[i] * this.fs / 1000);
      this.tgtEarly[i] = preset.early[i] || 0;
    }
  };

  Engine.prototype._rand = function () {
    this.randState = (this.randState * 1664525 + 1013904223) >>> 0;
    return this.randState / 4294967296;
  };

  Engine.prototype._noise = function () {
    this.noiseState = (this.noiseState * 1103515245 + 12345) >>> 0;
    return (this.noiseState / 2147483648) - 1;
  };

  Engine.prototype._fire = function (bank, bankIdx, eventIdx) {
    var rpmNorm = clamp((this.rpm - 600) / 6200, 0, 1);
    var amp = 0.55 * this.cylVar[eventIdx % 4] * this.combGain;
    bank.pulseAmp += amp;
    bank.pulseFreq = 50 + 70 * rpmNorm + 25 * this.throttle;
    bank.pulsePhase = 0;
    bank.t = 0;
    if (this.quality === 'high') {
      bank.clickAmp += 0.05 + 0.05 * rpmNorm;
      bank.clickT = 0;
    }
  };

  Engine.prototype._schedulePop = function (gainScale) {
    if (this.pops.length >= 8) return;
    this.pops.push({
      at: this.sampleCount + Math.round((0.015 + 0.035 * this._rand()) * this.fs),
      amp: (0.15 + 0.12 * this._rand()) * (gainScale || 1),
      freq: 38 + 24 * this._rand(),
      noise: 0.2 + 0.25 * this._rand()
    });
  };

  Engine.prototype._updateFilters = function (force) {
    if (!force && (this.block++ % 64 !== 0)) return;
    var rpmNorm = clamp((this.rpm - 600) / 6200, 0, 1);
    this.body.coeffs = biquadCoeffs('lowpass', 65 + 45 * rpmNorm, 1.2, this.fs);
    this.intake.coeffs = biquadCoeffs('bandpass', 320 + 780 * rpmNorm, 1.1, this.fs);
  };

  Engine.prototype.update = function (p) {
    if (!p) return;
    if (p.rpm != null) this.rpmTarget = clamp(p.rpm, 0, 9000);
    if (p.throttle != null) {
      var prev = this.throttleTarget;
      this.throttleTarget = clamp(p.throttle, 0, 1);
      if (this.ignition && !this.cutoff && this.rpmTarget > 3500 &&
          this.throttleTarget - prev < -0.35 && this._rand() < 0.5) {
        this._schedulePop(1);
      }
    }
    if (p.ignition != null) {
      var wasOn = this.ignition;
      this.ignition = !!p.ignition;
      if (!wasOn && this.ignition) this._schedulePop(0.6);
    }
    if (p.cutoff != null) this.cutoff = !!p.cutoff;
    if (p.preset != null) this.setPreset(p.preset);
    if (p.quality != null && (p.quality === 'lite' || p.quality === 'high')) this.quality = p.quality;
    if (p.noiseGain != null) this.noiseGainTarget = clamp(p.noiseGain, 0, 1);
    if (p.masterGain != null) this.masterGain = clamp(p.masterGain, 0, 1.5);
    if (p.firingOrder != null) this.setFiringOrder(p.firingOrder);
    if (p.inject != null) this.injectImpulse = (p.inject || 0);
  };

  Engine.prototype._slew = function (cur, tgt, up, down) {
    var d = tgt - cur;
    var lim = d >= 0 ? up : down;
    if (d > lim) return cur + lim;
    if (d < -lim) return cur - lim;
    return tgt;
  };

  Engine.prototype.processSample = function () {
    var dt = this.dt;
    var fs = this.fs;

    // 参数平滑
    this.rpm = this._slew(this.rpm, this.rpmTarget, this.rpmUpRate * dt, this.rpmDownRate * dt);
    this.throttle += (this.throttleTarget - this.throttle) * this.kSmooth;
    this.noiseGain += (this.noiseGainTarget - this.noiseGain) * this.kSmooth;
    var rpmNorm = clamp((this.rpm - 600) / 6200, 0, 1);
    var ignited = this.ignition && !this.cutoff;
    this.combGain += ((ignited ? 1 : 0) - this.combGain) * this.kFast;

    // 到期回火
    if (this.pops.length && this.sampleCount >= this.pops[0].at) {
      var pop = this.pops.shift();
      var bank = this.banks[this._rand() < 0.5 ? 0 : 1];
      bank.popAmp += pop.amp;
      bank.popT = 0;
      bank.popFreq = pop.freq;
      bank.popNoise = pop.noise;
    }

    // 点火事件
    var cycleRate = this.rpm / (120 * fs);
    for (var bi = 0; bi < 2; bi++) {
      var b = this.banks[bi];
      b.phase += cycleRate;
      if (b.phase >= 1) { b.phase -= 1; b.idx = 0; }
      while (b.idx < 4 && b.fracs[b.idx] <= b.phase) {
        this._fire(b, bi, b.idx);
        b.idx++;
      }
      b.t += dt;
      b.pulseAmp *= this.decayPulse;
      b.pulsePhase += TAU * b.pulseFreq * dt;
      b.clickAmp *= this.decayClick;
      b.clickT += dt;
      b.popAmp *= this.decayPop;
      b.popT += dt;
    }

    // 每侧排气总线 → 等长芭蕉延迟线 → 集管低通 → 3 样本交叉管延迟
    var lpL = 0, lpR = 0, xdL = 0, xdR = 0;
    for (bi = 0; bi < 2; bi++) {
      b = this.banks[bi];
      var pulse = b.pulseAmp * Math.sin(b.pulsePhase);
      if (this.quality === 'high') pulse += b.pulseAmp * 0.25 * Math.sin(2 * b.pulsePhase);
      var click = this.quality === 'high' ? b.clickAmp * Math.sin(TAU * 2600 * b.clickT) : 0;
      var pop = b.popAmp * (Math.sin(TAU * b.popFreq * b.popT) + b.popNoise * this._noise());
      var bus = pulse + click + pop;
      b.comb[b.combIdx] = bus;
      // 差分梳状：y[n] = x[n] - x[n-N]（等长芭蕉，偶次模被抑制）
      var combOut = bus - b.comb[(b.combIdx + 1) % b.comb.length];
      b.combIdx = (b.combIdx + 1) % b.comb.length;
      var fc = 260 + 460 * rpmNorm + 240 * this.throttle;
      var al = 1 - Math.exp(-TAU * fc * dt);
      b.lp += al * (combOut - b.lp);
      b.xDelay[b.xIdx] = b.lp;
      var d = b.xDelay[(b.xIdx + 1) % 4];
      b.xIdx = (b.xIdx + 1) % 4;
      if (bi === 0) { lpL = b.lp; xdL = d; } else { lpR = b.lp; xdR = d; }
    }
    var xL = lpL + 0.35 * xdR;
    var xR = lpR + 0.35 * xdL;

    // 车身/亥姆霍兹共振（低频加浓）
    this._updateFilters(false);
    var body = biquadStep(this.body, (xL + xR) * 0.5);
    var dryL = xL + 0.45 * body;
    var dryR = xR + 0.45 * body;

    // 进气嘶吼（噪声 + 带通，随转速/油门）
    var intake = biquadStep(this.intake, this._noise()) * (0.05 * this.throttle + 0.02 * rpmNorm);
    intake *= this.noiseGain * (ignited ? 1 : 0);
    dryL += 0.35 * intake;
    dryR += 0.35 * intake;

    // 混响发送（排气 + 进气）
    var send = (xL + xR) * 0.5 * 0.35 + intake * 0.2;

    // 预延迟 + 交叉淡化 + 早期反射
    this.preBuf[this.preIdx] = send;
    var pre = 0;
    if (this.preFade >= 0) {
      var k = 1 - this.preFade / this.preFadeDur;
      var a = this.preBuf[(this.preIdx - this.preReadA + PRE_BUF_SIZE) % PRE_BUF_SIZE];
      var bb = this.preBuf[(this.preIdx - this.preReadB + PRE_BUF_SIZE) % PRE_BUF_SIZE];
      pre = a * (1 - k) + bb * k;
      this.preFade--;
      if (this.preFade < 0) { this.preReadA = this.preReadB; this.preReadB = 0; }
    } else {
      pre = this.preBuf[(this.preIdx - this.preReadA + PRE_BUF_SIZE) % PRE_BUF_SIZE];
    }
    this.preIdx = (this.preIdx + 1) % PRE_BUF_SIZE;

    for (var ei = 0; ei < 4; ei++) {
      this.curEarly[ei] += (this.tgtEarly[ei] - this.curEarly[ei]) * this.kFade;
    }
    var earlyL = 0, earlyR = 0;
    for (ei = 0; ei < 4; ei++) {
      if (this.curEarly[ei] === 0) continue;
      var tap = this.preBuf[(this.preIdx - this.earlyTaps[ei] + PRE_BUF_SIZE) % PRE_BUF_SIZE];
      var g = this.curEarly[ei];
      earlyL += tap * g;
      earlyR += tap * g;
    }

    var wet = this.fdn.process(pre);
    var wetL = earlyL + wet[0];
    var wetR = earlyR + wet[1];

    // 主输出（软限幅）
    var mL = dryL * 0.85 + wetL;
    var mR = dryR * 0.85 + wetR;
    var oL = Math.tanh(1.15 * mL) / 1.15 * this.masterGain;
    var oR = Math.tanh(1.15 * mR) / 1.15 * this.masterGain;
    this.sampleCount++;
    this.outL = oL;
    this.outR = oR;
    return [oL, oR];
  };

  Engine.prototype.processBlock = function (n) {
    var out = new Float32Array(n * 2);
    for (var i = 0; i < n; i++) {
      var s = this.processSample();
      out[i * 2] = s[0];
      out[i * 2 + 1] = s[1];
    }
    return out;
  };

  // ---------------- 离线渲染 ----------------
  function renderOffline(opts) {
    opts = opts || {};
    var fs = opts.sampleRate || DEFAULT_SR;
    var dur = opts.duration || 5;
    var script = opts.script || function (t) {
      return { rpm: 3000, throttle: 0.7 };
    };
    var engine = new Engine(opts);
    var total = Math.floor(dur * fs);
    var L = new Float32Array(total);
    var R = new Float32Array(total);
    for (var i = 0; i < total; i++) {
      var p = script(i / fs, i);
      if (p) engine.update(p);
      var s = engine.processSample();
      L[i] = s[0];
      R[i] = s[1];
    }
    return { sampleRate: fs, duration: dur, left: L, right: R, engine: engine };
  }

  // ---------------- 内部测量工具（测试用） ----------------
  function runComb(x, N) {
    var n = x.length;
    var y = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      y[i] = x[i] - (i >= N ? x[i - N] : 0);
    }
    return y;
  }

  // 双缸组脉冲列车（单位冲激），用于验证“点火顺序 → burble”机制本身。
  function bankTrains(type, rpm, seconds, fs) {
    var order = FIRING_ORDERS[type] || FIRING_ORDERS.crossplane;
    var tables = firingTables(order);
    var n = Math.floor(seconds * fs);
    var L = new Float64Array(n), R = new Float64Array(n);
    var ph = { L: 0, R: 0 }, idx = { L: 0, R: 0 };
    var cycleRate = rpm / (120 * fs);
    for (var i = 0; i < n; i++) {
      for (var s = 0; s < 2; s++) {
        var side = s === 0 ? 'L' : 'R';
        var tb = tables[side];
        ph[side] += cycleRate;
        if (ph[side] >= 1) { ph[side] -= 1; idx[side] = 0; }
        while (idx[side] < tb.length && tb[idx[side]].frac <= ph[side]) {
          (side === 'L' ? L : R)[i] += 1;
          idx[side]++;
        }
      }
    }
    return { left: L, right: R };
  }

  // burble 量化：真实点火顺序 + 单侧等长芭蕉 + 72Hz 二阶高通（模拟排气系统对
  // 极低频的衰减），测量单侧歧管输出通道的 0.5 阶 / 4 阶幅度比。
  // 十字曲轴约 0.09，平轴约 0.006（差约 15 倍）。注意：两侧求和后 0.5 阶会
  // 相消（总点火仍是均匀 90°），因此必须按“单侧排气歧管”测量。
  function analyzeBurble(type, opts) {
    opts = opts || {};
    var fs = opts.sampleRate || DEFAULT_SR;
    var rpm = opts.rpm || 6000;
    var secs = opts.seconds || 4;
    var N = exhaustCombLength(fs, EXHAUST_LENGTH_M);
    var trains = bankTrains(type, rpm, secs, fs);
    var src = (opts.side || 'L') === 'R' ? trains.right : trains.left;
    var line = runComb(src, N);

    // Hann 窗 + 二阶 Butterworth 高通（72 Hz）
    var hp = biquadCoeffs('highpass', 72, 0.707, fs);
    var bq = makeBiquad();
    bq.coeffs = hp;
    // radix-2 FFT：补零到 2 的幂
    var n = 1;
    while (n < line.length) n <<= 1;
    var win = new Float64Array(n);
    for (var i = 0; i < line.length; i++) {
      var h = 0.5 - 0.5 * Math.cos(TAU * i / (line.length - 1));
      win[i] = biquadStep(bq, line[i]) * h;
    }
    var mag = fftMag(win);
    var revs = rpm / 60;
    var bin = function (f) { return Math.round(f * n / fs); };
    var aHalf = mag[bin(0.5 * revs)];
    var aFourth = mag[bin(4 * revs)];
    return {
      halfOrderAmp: aHalf,
      fourthOrderAmp: aFourth,
      ratio: aFourth > 1e-9 ? aHalf / aFourth : Infinity
    };
  }

  // FDN 冲激响应（稳定性/衰减测试）。
  function fdnResponse(fs, presetId, seconds) {
    fs = fs || DEFAULT_SR;
    var preset = null;
    for (var i = 0; i < REVERB_PRESETS.length; i++) {
      if (REVERB_PRESETS[i].id === presetId) { preset = REVERB_PRESETS[i]; break; }
    }
    if (!preset) preset = REVERB_PRESETS[3];
    var fdn = new FDN(fs);
    fdn.setPreset(preset, true);
    var n = Math.floor(seconds * fs);
    var out = new Float64Array(n);
    for (var i2 = 0; i2 < n; i2++) {
      var x = i2 === 0 ? 1 : 0;
      var w = fdn.process(x, true);
      out[i2] = (w[0] + w[1]) * 0.5;
    }
    return out;
  }

  // ---------------- AudioWorklet 处理器 ----------------
  if (typeof AudioWorkletProcessor !== 'undefined' && typeof registerProcessor !== 'undefined') {
    var EngineDSPProcessor = (function () {
      var klass = function () {
        var self = this;
        this.engine = new Engine({ sampleRate: typeof sampleRate !== 'undefined' ? sampleRate : DEFAULT_SR, quality: 'high' });
        this.port.onmessage = function (e) { self.engine.update(e.data || {}); };
      };
      klass.prototype.process = function (inputs, outputs, parameters) {
        var out = outputs[0];
        var chL = out[0];
        var chR = out[1] || out[0];
        var n = chL.length;
        var rpm = parameters.rpm;
        var thr = parameters.throttle;
        for (var i = 0; i < n; i++) {
          this.engine.update({
            rpm: rpm.length > 1 ? rpm[i] : rpm[0],
            throttle: thr.length > 1 ? thr[i] : thr[0]
          });
          var s = this.engine.processSample();
          chL[i] = s[0];
          chR[i] = s[1];
        }
        return true;
      };
      klass.parameterDescriptors = [
        { name: 'rpm', defaultValue: 800, minValue: 0, maxValue: 9000, automationRate: 'a-rate' },
        { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' }
      ];
      return klass;
    })();
    // 以模块方式被 addModule 加载时：注册处理器
    if (typeof registerProcessor === 'function') {
      registerProcessor('engine-dsp', EngineDSPProcessor);
    }
  }

  var api = {
    version: '1.0.0',
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    FIRING_ORDERS: FIRING_ORDERS,
    BANK_OF: BANK_OF,
    REVERB_PRESETS: REVERB_PRESETS,
    Engine: Engine,
    FDN: FDN,
    createEngine: function (opts) { return new Engine(opts); },
    renderOffline: renderOffline,
    internal: {
      firingTables: firingTables,
      exhaustCombLength: exhaustCombLength,
      coprimeLineLengths: coprimeLineLengths,
      hadamard8: hadamard8,
      fftMag: fftMag,
      bankTrains: bankTrains,
      runComb: runComb,
      analyzeBurble: analyzeBurble,
      fdnResponse: fdnResponse
    }
  };

  return api;
});
