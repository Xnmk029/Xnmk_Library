// engine-dsp.mjs — 引擎声音 DSP 核心（自包含、零依赖）
//
// 同一份代码服务三个运行环境：
//   1. AudioWorklet：以 module 方式 addModule，注册 'engine-dsp' Processor；
//   2. ScriptProcessor 兜底：打包进 sim.bundle.js 后直接用 EngineDSP 逐块跑；
//   3. Node 离线渲染/单测：import { EngineDSP }。
//
// 建模思路（参照 engine-sim 公开原理的简化实现）：
//   - 每缸按真实点火顺序每 720° 曲轴角触发排气/进气事件（90° 等间隔）；
//   - 排气门开启产生宽带脉冲（一次管共振 165Hz + 收集器共振 95Hz + 湍流噪声），
//     汇入该缸所在排气管边（左/右）；
//   - 等长芭蕉 = 每侧一条四分之一波谐振延迟线（符号翻转反馈 → 只保留奇次模，
//     理论共振 c/(4L)，偶次模被抑制）；
//   - X-pipe 部分合并两排气边 + 右岸尾管略长（真实双出排气的不对称）：
//     十字曲轴（每岸 270°/90°/180°/180° 不均发火）自然涌现煮水声 2 阶分量，
//     平轴（每岸 180° 均匀发火）则几乎为零 —— 不设任何“burble 强度”参数；
//   - 消音器低通 + 尾管延迟 → 立体声输出；
//   - 进气脉冲（集气箱带通）+ 节气门嘶吼、气门机械嗒声、皮带声；
//   - 8×8 FDN 混响（Hadamard 正交反馈 + 互质延迟线 + 预延迟 + 早反射 +
//     立体声去相关），8 组空间预设，全部参数一阶平滑 → 切换零点击；
//   - 断油（滑行/限速器火花切断）、回火放炮、熄火；
//   - 输出安全：DC 阻断 + tanh 软限幅 + NaN/Inf 防护。

'use strict';

// ---------- 默认配置（与 engine-config.mjs 保持一致，内联保证自包含） ----------
const DEFAULT_CFG = {
  firingOrder: [1, 8, 4, 3, 6, 5, 7, 2],
  firingAngles: [0, 90, 180, 270, 360, 450, 540, 630],
  // 十字曲轴：左岸 {1,4,6,7} 发火角 {0,180,360,540} 每边均匀 180°
  // → 每边 2 阶基波强；X-pipe 部分合并后每声道保留 (1−2x) 的 2 阶残差
  // → 煮水声自然涌现（半阶/4 阶 ≈ 0.09）
  bankLeft: [1, 4, 6, 7],
  bankRight: [8, 3, 5, 2],
  idleRpm: 700, redlineRpm: 6400,
  valve: { evo: 300, evc: 370, ivo: 350, ivc: 590 },
  exhaust: {
    primaryLength: 0.52, primaryFeedback: 0.82,
    collectorLength: 0.9, xpipeCross: 0.492,
    mufflerFreq: 1050, tailpipeLength: 2.2, bankTailExtra: 0.12, pulseNoise: 1.0,
  },
  intake: { plenumFreq: 320, throttleHiss: 1.0 },
  mechanical: { valveTick: 0.35, beltWhine: 0.12 },
};

const REVERB_PRESETS = {
  studio:  { preDelay: 0.012, early: 0.18, decay: 0.62, size: 0.55, wet: 0.14 },
  open:    { preDelay: 0.030, early: 0.10, decay: 0.35, size: 1.00, wet: 0.10 },
  garage:  { preDelay: 0.018, early: 0.24, decay: 0.55, size: 0.72, wet: 0.22 },
  tunnel:  { preDelay: 0.025, early: 0.20, decay: 0.80, size: 0.90, wet: 0.32 },
  hall:    { preDelay: 0.045, early: 0.16, decay: 0.85, size: 0.95, wet: 0.30 },
  canyon:  { preDelay: 0.060, early: 0.08, decay: 0.75, size: 1.00, wet: 0.24 },
  pitlane: { preDelay: 0.020, early: 0.20, decay: 0.70, size: 0.80, wet: 0.26 },
  cabin:   { preDelay: 0.006, early: 0.30, decay: 0.45, size: 0.40, wet: 0.10 },
};
const FDN_DELAYS_MS = [29.7, 37.3, 41.9, 53.1, 59.3, 67.7, 73.1, 83.9];

// ---------- 工具 ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TAU = Math.PI * 2;
function lpCoeff(freq, sr) { return 1 - Math.exp(-TAU * freq / sr); }

// Sylvester-Hadamard（正交，÷√n）
function hadamard(n) {
  let H = [[1]];
  while (H.length < n) {
    const N = H.length * 2, H2 = [];
    for (let i = 0; i < N; i++) {
      const row = [];
      for (let j = 0; j < N; j++)
        row.push(H[i % H.length][j % H.length] * (i < H.length ? 1 : (j < H.length ? 1 : -1)));
      H2.push(row);
    }
    H = H2;
  }
  const s = 1 / Math.sqrt(n);
  return H.map(r => r.map(v => v * s));
}
const H8 = hadamard(8);
const H4 = hadamard(4);

// 环形延迟线
class DelayLine {
  constructor(maxLen) {
    this.buf = new Float64Array(Math.max(8, Math.ceil(maxLen) + 4));
    this.len = Math.max(1, Math.floor(maxLen));
    this.w = 0;
  }
  setLength(l) { this.len = Math.max(1, Math.min(this.buf.length - 4, Math.floor(l))); }
  push(x) { this.buf[this.w] = x; this.w = (this.w + 1) % this.buf.length; }
  // back ∈ [0, len]：0=刚推入，len=len 个样本前
  read(back) {
    const b = Math.min(this.len, Math.max(0, Math.floor(back)));
    return this.buf[(this.w - 1 - b + this.buf.length) % this.buf.length];
  }
  readFrac(back) {
    const b = Math.min(this.len, Math.max(0, back));
    const i0 = Math.floor(b), fr = b - i0;
    const a = this.read(i0), c = this.read(i0 + 1);
    return a + (c - a) * fr;
  }
}

// 二阶带通
class BiquadBP {
  constructor(freq, Q, sr) {
    const w = TAU * freq / sr, alpha = Math.sin(w) / (2 * Q);
    const a0 = 1 + alpha;
    this.b0 = alpha / a0; this.b1 = 0; this.b2 = -alpha / a0;
    this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - alpha) / a0;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// ---------- 引擎 DSP ----------
export class EngineDSP {
  constructor(sampleRate = 48000, cfg = null, quality = 'high') {
    this.sr = sampleRate;
    this.cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    this.cfg.exhaust = Object.assign({}, DEFAULT_CFG.exhaust, (cfg || {}).exhaust || {});
    this.cfg.valve = Object.assign({}, DEFAULT_CFG.valve, (cfg || {}).valve || {});
    this.cfg.intake = Object.assign({}, DEFAULT_CFG.intake, (cfg || {}).intake || {});
    this.cfg.mechanical = Object.assign({}, DEFAULT_CFG.mechanical, (cfg || {}).mechanical || {});
    this.setQuality(quality);

    const c = this.cfg, sr = sampleRate;
    this.c = 343;

    // 运行状态
    this.rpm = c.idleRpm;
    this.throttle = 0;
    this.load = 0;
    this.ignition = true;
    this.fuelCut = false;
    this.stall = false;
    this._rpmTarget = c.idleRpm;
    this._thrTarget = 0;
    this._loadTarget = 0;
    this._preset = 'garage';
    this._presetState = Object.assign({}, REVERB_PRESETS.garage);
    this._presetOld = null;
    this._presetFade = 1;
    this._backfireTimer = 0;
    this._rng = mulberry32(0xC0FFEE);
    this._frame = 0;

    // 每缸事件状态（由 setCrankKind / 构造时初始化）
    this._cyl = null;
    this._samplesPerRev = 60 / c.idleRpm * sr;
    this._reinitCylinders();

    // 排气管边：四分之一波谐振器（每侧），反馈环内带高频损耗低通
    // （管壁摩擦衰减高次模，物理合理；一次管共振 c/(4L)=164.9Hz 保留）
    const Dp = Math.max(4, Math.round(2 * c.exhaust.primaryLength / this.c * sr));
    this._bankRes = [new DelayLine(Dp + 8), new DelayLine(Dp + 8)];
    this._bankResD = Dp;
    this._bankResG = c.exhaust.primaryFeedback;
    this._resLp = [0, 0];
    this._resLpA = lpCoeff(850, sr);
    const Dc = Math.max(4, Math.round(2 * c.exhaust.collectorLength / this.c * sr));
    this._colRes = [new DelayLine(Dc + 8), new DelayLine(Dc + 8)];
    this._colResG = 0.55;
    // 尾管（单向延迟，右岸 +bankTailExtra）
    const Dt = Math.max(4, Math.round(c.exhaust.tailpipeLength / this.c * sr));
    const DtR = Math.max(4, Math.round((c.exhaust.tailpipeLength + c.exhaust.bankTailExtra) / this.c * sr));
    this._tail = [new DelayLine(Dt + 8), new DelayLine(DtR + 8)];
    this._muf = [0, 0];
    this._mufA = lpCoeff(c.exhaust.mufflerFreq, sr);

    // 进气
    this._intBp = new BiquadBP(c.intake.plenumFreq, 3.5, sr);
    this._hissLp = [0, 0];

    // 输出链
    this._dc = [0, 0, 0, 0];

    // 混响
    this._fdnInit();

    // 块缓冲
    this._bL = new Float64Array(0);
    this._bR = new Float64Array(0);
    this._bI = new Float64Array(0);
  }

  setQuality(q) {
    this.quality = q === 'lite' ? 'lite' : 'high';
    this.reverbLines = this.quality === 'lite' ? 4 : 8;
  }

  _reinitCylinders() {
    const c = this.cfg;
    const cyc = this._samplesPerRev * 2; // 720°
    this._cyl = [];
    for (let i = 0; i < 8; i++) {
      const cylNo = c.firingOrder[i];
      const fire = c.firingAngles[i];
      const bank = c.bankLeft.includes(cylNo) ? 0 : 1;
      const eAng = fire + c.valve.evo, iAng = fire + c.valve.ivo;
      const mk = (ang) => {
        const a = ((ang % 720) + 720) % 720;
        const k = Math.floor(ang / 720);
        return { a, k };
      };
      const E = mk(eAng), I = mk(iAng);
      this._cyl.push({
        cylNo, fire, bank,
        Ea: E.a, Ek: E.k,   // 排气事件角度（720° 内）+ 周期序号
        Ia: I.a, Ik: I.k,   // 进气事件角度 + 周期序号
        // 脉冲槽（每缸 2 个：排气/进气），跨块连续
        slotE: { active: false, startAbs: 0, len: 0, amp: 0, p: 0, ph1: 0, ph2: 0, w1: 0, w2: 0, noise: 0, noiseAmt: 0, bank },
        slotI: { active: false, startAbs: 0, len: 0, amp: 0, p: 0, ph: 0, w: 0, bank },
      });
    }
  }

  // 十字曲轴 ⇄ 平轴切换（V 键）
  // 平轴采用真实 Ford Voodoo 布局：点火 1-5-4-8-6-3-7-2，
  // 左岸 {1,2,3,4} 发火角 {0,90,450,540} → 每边 2 阶分量精确抵消
  // → 合并后几乎纯 4 阶（半阶/4 阶 ≈ 0.006），与十字相差约 15 倍
  setCrankKind(kind) {
    const c = this.cfg;
    if (kind === 'flat') {
      c.firingOrder = [1, 5, 4, 8, 6, 3, 7, 2];
      c.bankLeft = [1, 2, 3, 4];
      c.bankRight = [5, 6, 7, 8];
    } else {
      c.firingOrder = [1, 8, 4, 3, 6, 5, 7, 2];
      c.bankLeft = [1, 4, 6, 7];
      c.bankRight = [8, 3, 5, 2];
    }
    this._reinitCylinders();
  }

  _fdnInit() {
    const sr = this.sr;
    this._fdnDelays = FDN_DELAYS_MS.map(ms => new DelayLine(ms / 1000 * sr + 8));
    this._fdnState = new Float64Array(8);
    this._fdnDamp = new Float64Array(8);
    this._fdnOut = new Float64Array(8);
    this._fdnFeed = new Float64Array(8);
    this._preDelay = new DelayLine(0.09 * sr + 8);
    this._preDelayLen = this._presetState.preDelay * sr;
    this._preDelayLenTarget = this._preDelayLen;
    this._earlyBase = [0.0021, 0.0043, 0.0087, 0.0131];
    this._earlyTaps = this._earlyBase.map(v => v * (0.6 + 0.8 * this._presetState.size));
    this._earlyGains = [0.5, 0.4, 0.28, 0.2];
    this._wet = 0; this._wetTarget = this._presetState.wet;
    this._decay = this._presetState.decay; this._decayTarget = this._presetState.decay;
    this._size = this._presetState.size; this._sizeTarget = this._presetState.size;
    const fd0 = Math.pow(this._presetState.decay, 0.5);
    for (let i = 0; i < 8; i++) this._fdnFeed[i] = fd0 * (0.85 + 0.15 * (i % 3));
    this._fdnGain = 1;
  }

  // ---------- 参数接口（消息/直调共用） ----------
  setRpm(v) { this._rpmTarget = Math.max(0, Math.min(12000, v)); }
  setThrottle(v) { this._thrTarget = Math.max(0, Math.min(1, v)); }
  setLoad(v) { this._loadTarget = Math.max(0, Math.min(1.5, v)); }
  setIgnition(on) { this.ignition = !!on; if (!on) { this._rpmTarget = 0; this.fuelCut = true; } }
  setFuelCut(v) { this.fuelCut = !!v; }
  setStall(v) { this.stall = !!v; }
  triggerBackfire() { this._backfireTimer = Math.max(this._backfireTimer, 0.3); }
  setPreset(name) {
    if (!REVERB_PRESETS[name] || name === this._preset) return;
    this._presetOld = Object.assign({}, this._presetState);
    this._presetState = Object.assign({}, REVERB_PRESETS[name]);
    this._presetFade = 0;
    this._preDelayLenTarget = this._presetState.preDelay * this.sr;
    this._wetTarget = this._presetState.wet;
    this._decayTarget = this._presetState.decay;
    this._sizeTarget = this._presetState.size;
    for (let i = 0; i < 4; i++) this._earlyTaps[i] = this._earlyBase[i] * (0.6 + 0.8 * this._presetState.size);
  }
  getPreset() { return this._preset; }

  // ---------- 核心：逐块处理 ----------
  process(blockSize, outL, outR) {
    const c = this.cfg, sr = this.sr;
    const n = Math.min(blockSize, outL.length, outR.length);
    if (n <= 0) return 0;

    // 参数平滑（防爆音；按块等效每样本时间常数）
    const aRpm = 1 - Math.exp(-n / (sr * 0.012));
    const aSm = 1 - Math.exp(-n / (sr * 0.02));
    this.rpm += (this._rpmTarget - this.rpm) * aRpm;
    this.throttle += (this._thrTarget - this.throttle) * aSm;
    this.load += (this._loadTarget - this.load) * aSm;
    const rpm = Math.max(1, this.rpm);
    this._samplesPerRev = 60 / rpm * sr;
    const samplesPerRev = this._samplesPerRev;
    const cycle = samplesPerRev * 2;
    const secPerRev = 60 / rpm;

    // 块累积缓冲
    let bL = this._bL, bR = this._bR, bI = this._bI;
    if (bL.length < n) { bL = new Float64Array(n + 64); bR = new Float64Array(n + 64); bI = new Float64Array(n + 64); this._bL = bL; this._bR = bR; this._bI = bI; }
    bL.fill(0, 0, n); bR.fill(0, 0, n); bI.fill(0, 0, n);

    const combustion = this.ignition && !this.fuelCut && !this.stall;
    const running = this.ignition && !this.stall;
    const rpmF = Math.min(1, rpm / c.redlineRpm);
    const thrF = 0.15 + 0.85 * this.throttle;
    const pulseMaxLen = Math.max(8, Math.round(0.09 * sr));
    const tickAmp = 0.06 * c.mechanical.valveTick * Math.min(1, rpm / 3000);

    // —— 事件调度 + 脉冲启动（事件时间 = k·cycle + 角度偏移，
    //    转速变化时所有事件按同一比例重排 → 90° 网格始终锁定） ——
    const frame = this._frame;
    const f1 = this.c / (4 * c.exhaust.primaryLength);
    const f2 = this.c / (4 * c.exhaust.collectorLength);
    for (let ci = 0; ci < 8; ci++) {
      const cyl = this._cyl[ci];
      // 排气事件
      if (combustion) {
        let nextE = cyl.Ek * cycle + cyl.Ea / 360 * samplesPerRev;
        while (nextE < frame + n) {
          const off = Math.round(nextE - frame);
          if (off >= 0 && off < n) {
            const slot = cyl.slotE;
            const evoDur = (c.valve.evc - c.valve.evo) / 360 * secPerRev;
            const tau = Math.max(0.0006, evoDur / 3.5);
            slot.active = true;
            slot.startAbs = nextE;
            slot.len = Math.min(pulseMaxLen, Math.max(6, Math.round(tau * 5 * sr)));
            slot.amp = (0.35 + 1.1 * rpmF) * thrF * (0.7 + 0.5 * this.load);
            slot.p = Math.exp(-1 / (tau * sr));
            slot.w1 = TAU * f1 / sr; slot.w2 = TAU * f2 / sr;
            // 载波相位恒定（所有缸相同阀门过程 → 波形一致），
            // 阶次结构完全由事件时间决定（90° 均匀 → 纯 4k 阶）
            slot.ph1 = 0;
            slot.ph2 = 0;
            slot.noise = 0;
            slot.noiseAmt = (0.30 + 0.55 * this.throttle) * c.exhaust.pulseNoise;
          }
          cyl.Ek += 1;
          nextE = cyl.Ek * cycle + cyl.Ea / 360 * samplesPerRev;
        }
      }
      // 进气事件（断油时保留）；事件同时注入气门机械嗒声
      if (running) {
        let nextI = cyl.Ik * cycle + cyl.Ia / 360 * samplesPerRev;
        while (nextI < frame + n) {
          const off = Math.round(nextI - frame);
          if (off >= 0 && off < n) {
            const slot = cyl.slotI;
            const ivoDur = (c.valve.ivc - c.valve.ivo) / 360 * secPerRev;
            const tau = Math.max(0.0006, ivoDur / 4);
            slot.active = true;
            slot.startAbs = nextI;
            slot.len = Math.min(pulseMaxLen, Math.max(6, Math.round(tau * 4 * sr)));
            slot.amp = (0.10 + 0.5 * this.throttle) * (0.5 + 0.8 * rpmF);
            slot.p = Math.exp(-1 / (tau * sr));
            slot.w = TAU * c.intake.plenumFreq / sr;
            slot.ph = 0;
            // 气门嗒声（机械）
            if (c.mechanical.valveTick > 0) {
              bI[off] += tickAmp * (this._rng() * 2 - 1);
            }
          }
          cyl.Ik += 1;
          nextI = cyl.Ik * cycle + cyl.Ia / 360 * samplesPerRev;
        }
      }
    }

    // —— 逐样本：脉冲合成 → 谐振 → X-pipe → 消音 → 尾管 → 干声 + 混响 → 输出 ——
    const Dp = this._bankResD, gRes = this._bankResG, gCol = this._colResG;
    const xp = c.exhaust.xpipeCross;
    const mufA = this._mufA;
    const res0 = this._bankRes[0], res1 = this._bankRes[1];
    const col0 = this._colRes[0], col1 = this._colRes[1];
    const tail0 = this._tail[0], tail1 = this._tail[1];
    let resLp0 = this._resLp[0], resLp1 = this._resLp[1];
    const resLpA = this._resLpA;
    let m0 = this._muf[0], m1 = this._muf[1];
    let dcL = this._dc[0], dcR = this._dc[1], dcL1 = this._dc[2], dcR1 = this._dc[3];

    // 混响状态
    const fdState = this._fdnState, fdDamp = this._fdnDamp, fdOut = this._fdnOut;
    const fdDelays = this._fdnDelays, fdnFeed = this._fdnFeed;
    const preD = this._preDelay;
    const earlyGains = this._earlyGains;
    let wet = this._wet, decay = this._decay, size = this._size;
    let preLen = this._preDelayLen;
    const et0t = this._earlyBase[0] * (0.6 + 0.8 * size), et1t = this._earlyBase[1] * (0.6 + 0.8 * size),
          et2t = this._earlyBase[2] * (0.6 + 0.8 * size), et3t = this._earlyBase[3] * (0.6 + 0.8 * size);
    const lines = this.reverbLines;
    const H = lines === 8 ? H8 : H4;
    const pSm = 1 - Math.exp(-1 / (sr * 0.04));
    const fSm = 1 - Math.exp(-1 / (sr * 0.12));
    const fdInGain = 0.035;

    const hissAmp = c.intake.throttleHiss * this.throttle * this.throttle * (0.4 + 0.8 * rpmF);
    const hissLP = lpCoeff(5200, sr);
    let hiss0 = this._hissLp[0], hiss1 = this._hissLp[1];
    const beltW = TAU * (rpm / 60 * 2.3) / sr;
    let beltPh = this._beltPhase || 0;
    const beltAmp = c.mechanical.beltWhine * Math.min(1, rpm / 4000) * 0.08;
    const intBp = this._intBp;

    const slots = [];
    for (let ci = 0; ci < 8; ci++) { slots.push(this._cyl[ci].slotE, this._cyl[ci].slotI); }

    for (let s = 0; s < n; s++) {
      // 1) 脉冲合成（跨块连续）
      let eL = 0, eR = 0, eI = 0;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot.active) continue;
        const t = frame + s - slot.startAbs;
        if (t < 0) continue;
        if (t >= slot.len) { slot.active = false; continue; }
        const env = slot.amp * Math.pow(slot.p, t);
        if (i % 2 === 0) {
          // 排气槽（偶下标）
          slot.ph1 += slot.w1; slot.ph2 += slot.w2;
          slot.noise += hissLP * (this._rng() * 2 - 1 - slot.noise);
          const v = env * (Math.sin(slot.ph1) * 0.9 + 0.45 * Math.sin(slot.ph2) + slot.noiseAmt * slot.noise * 0.8);
          if (slot.bank === 0) eL += v; else eR += v;
        } else {
          // 进气槽
          slot.ph += slot.w;
          eI += env * Math.sin(slot.ph);
        }
      }
      // 2) 排气边谐振（四分之一波，符号翻转反馈 → 奇次模；
      //    反馈路径低通 → 高次模被管壁损耗抑制）
      const x0 = eL, x1 = eR;
      const yD0 = res0.read(Dp);
      resLp0 += resLpA * (yD0 - resLp0);
      const y0 = x0 + resLp0 * -gRes;
      res0.push(y0);
      const yD1 = res1.read(Dp);
      resLp1 += resLpA * (yD1 - resLp1);
      const y1 = x1 + resLp1 * -gRes;
      res1.push(y1);
      // 收集器谐振
      const c0 = col0.read(col0.len - 1) * -gCol;
      const z0 = y0 + c0;
      col0.push(z0);
      const c1 = col1.read(col1.len - 1) * -gCol;
      const z1 = y1 + c1;
      col1.push(z1);
      // X-pipe 部分合并
      const xL = (1 - xp) * z0 + xp * z1;
      const xR = xp * z0 + (1 - xp) * z1;
      // 消音器低通
      m0 += mufA * (xL - m0);
      m1 += mufA * (xR - m1);
      // 尾管延迟（右岸略长 → 双出不对称，保留煮水声残差）
      tail0.push(m0); tail1.push(m1);
      const tL = tail0.read(tail0.len);
      const tR = tail1.read(tail1.len);

      // 3) 进气：脉冲 → 集气箱带通 + 节气门嘶吼
      const iF = intBp.run(eI) + bI[s];      const hn = this._rng() * 2 - 1;
      hiss0 += hissLP * (hn - hiss0);
      hiss1 += hissLP * (hn - hiss1);
      const hiss = hiss0 * hissAmp * 0.9;

      // 4) 干声（立体声）
      const belt = Math.sin(beltPh) * beltAmp;
      beltPh += beltW;
      const dryL = tL * 0.95 + iF * 0.30 + hiss * 0.5 + belt;
      const dryR = tR * 0.95 + iF * 0.30 + hiss * 0.5 + belt + (hiss1 - hiss0) * 0.02;

      // 5) 混响 FDN
      wet += pSm * (this._wetTarget - wet);
      decay += fSm * (this._decayTarget - decay);
      size += fSm * (this._sizeTarget - size);
      preLen += pSm * (this._preDelayLenTarget - preLen);
      this._wet = wet; this._decay = decay; this._size = size; this._preDelayLen = preLen;
      const reverbIn = (dryL + dryR) * 0.5;
      preD.push(reverbIn);
      const preOut = preD.readFrac(preLen);
      let er = 0;
      for (let i = 0; i < 4; i++) {
        const target = this._earlyBase[i] * (0.6 + 0.8 * size);
        const tap = this._earlyTaps[i] += pSm * (target - this._earlyTaps[i]);
        er += preD.readFrac(tap) * earlyGains[i];
      }
      const fdIn = preOut + er;
      const fd0 = Math.pow(decay, 0.5);
      for (let i = 0; i < lines; i++) {
        const d = fdDelays[i];
        const feedT = fd0 * (0.85 + 0.15 * (i % 3));
        fdnFeed[i] += pSm * (feedT - fdnFeed[i]);
        d.push(fdIn * fdInGain + fdState[i] * fdnFeed[i]);
        fdState[i] = d.read(d.len - 1);
        fdDamp[i] += 0.15 * (fdState[i] - fdDamp[i]);
      }
      for (let i = 0; i < lines; i++) {
        let acc = 0;
        const row = H[i];
        for (let j = 0; j < lines; j++) acc += row[j] * fdDamp[j];
        fdOut[i] = acc;
      }
      let revL = 0, revR = 0;
      for (let i = 0; i < lines; i++) {
        const d = fdDelays[i];
        revL += fdOut[i] * d.read(0);
        revR += fdOut[i] * d.read((i % 3) + 1);
      }
      const wetScale = 0.5 / lines * wet * size;
      const wL = revL * wetScale, wR = revR * wetScale;

      // 6) 回火放炮
      let pop = 0;
      if (this._backfireTimer > 0) {
        this._backfireTimer -= 1 / sr;
        pop = Math.sin(this._rng() * TAU) * 0.9 * Math.min(1, this._backfireTimer * 8) * (0.4 + 0.6 * this.throttle);
      }

      // 7) 输出：DC 阻断 + tanh 软限幅 + NaN 防护
      const rawL = dryL * 0.9 + wL + pop;
      const rawR = dryR * 0.9 + wR + pop;
      const dcb = 0.995;
      const uL = rawL - dcL + dcb * dcL1; dcL = rawL; dcL1 = uL;
      const uR = rawR - dcR + dcb * dcR1; dcR = rawR; dcR1 = uR;
      let oL = Math.tanh(uL * 1.15) * 0.92;
      let oR = Math.tanh(uR * 1.15) * 0.92;
      if (!Number.isFinite(oL)) oL = 0;
      if (!Number.isFinite(oR)) oR = 0;
      outL[s] = oL; outR[s] = oR;
    }
    this._muf = [m0, m1];
    this._dc = [dcL, dcR, dcL1, dcR1];
    this._hissLp = [hiss0, hiss1];
    this._beltPhase = beltPh;
    this._resLp = [resLp0, resLp1];
    this._frame += n;
    let maxAbs = 0;
    for (let s = 0; s < n; s++) {
      const a = Math.abs(outL[s]); if (a > maxAbs) maxAbs = a;
      const b = Math.abs(outR[s]); if (b > maxAbs) maxAbs = b;
    }
    return maxAbs;
  }

  // ---------- 离线渲染（Node 测试 / 出 WAV） ----------
  render(durationSec, paramFn, blockSize = 512) {
    const n = Math.ceil(durationSec * this.sr);
    const outL = new Float64Array(n), outR = new Float64Array(n);
    const bl = new Float64Array(blockSize), br = new Float64Array(blockSize);
    let idx = 0;
    while (idx < n) {
      const k = Math.min(blockSize, n - idx);
      if (paramFn) paramFn(this, idx / this.sr);
      this.process(k, bl, br);
      outL.set(bl.subarray(0, k), idx);
      outR.set(br.subarray(0, k), idx);
      idx += k;
    }
    return { left: outL, right: outR };
  }
}

// ---------- AudioWorklet Processor ----------
const BaseProcessor = typeof AudioWorkletProcessor !== 'undefined' ? AudioWorkletProcessor : class {};
export class EngineDSPProcessor extends BaseProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    const sr = opts.sampleRate || 48000;
    const quality = opts.quality || 'high';
    this.dsp = new EngineDSP(sr, null, quality);
    this.port.onmessage = (e) => this._onMessage(e.data);
  }
  _onMessage(msg) {
    if (!msg) return;
    switch (msg.type) {
      case 'param':
        if (msg.key === 'rpm') this.dsp.setRpm(msg.value);
        else if (msg.key === 'throttle') this.dsp.setThrottle(msg.value);
        else if (msg.key === 'load') this.dsp.setLoad(msg.value);
        else if (msg.key === 'ignition') this.dsp.setIgnition(msg.value);
        else if (msg.key === 'fuelCut') this.dsp.setFuelCut(msg.value);
        else if (msg.key === 'stall') this.dsp.setStall(msg.value);
        break;
      case 'crank': this.dsp.setCrankKind(msg.value); break;
      case 'preset': this.dsp.setPreset(msg.value); break;
      case 'quality': this.dsp.setQuality(msg.value); break;
      case 'backfire': this.dsp.triggerBackfire(); break;
    }
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length < 2) return true;
    this.dsp.process(out[0].length, out[0], out[1]);
    return true;
  }
}

if (typeof registerProcessor !== 'undefined') {
  registerProcessor('engine-dsp', EngineDSPProcessor);
}

export { REVERB_PRESETS, FDN_DELAYS_MS };
export function presetNames() { return Object.keys(REVERB_PRESETS); }
