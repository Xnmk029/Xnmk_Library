'use strict';

const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('./harness.cjs');
const DSP = require('../src/engine-dsp.js');

const FS = 48000;

function allFinite(xs) {
  for (let i = 0; i < xs.length; i++) {
    if (!Number.isFinite(xs[i])) return false;
  }
  return true;
}

function rms(xs) {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i] * xs[i];
  return Math.sqrt(s / Math.max(1, xs.length));
}

test('dsp: 十字曲轴 burble 由点火顺序自然涌现（0.5 阶/4 阶 ≈ 0.09）', () => {
  const a = DSP.internal.analyzeBurble('crossplane', { rpm: 6000, sampleRate: FS, seconds: 4 });
  assert.ok(a.halfOrderAmp > 1e-6, `0.5 阶幅度应为正，got ${a.halfOrderAmp}`);
  assert.ok(a.ratio >= 0.04 && a.ratio <= 0.2, `crossplane ratio=${a.ratio} 应在 0.04~0.2`);
});

test('dsp: 平轴 burble 极弱且与十字曲轴差 ≥15 倍', () => {
  const c = DSP.internal.analyzeBurble('crossplane', { rpm: 6000, sampleRate: FS, seconds: 4 });
  const f = DSP.internal.analyzeBurble('flatplane', { rpm: 6000, sampleRate: FS, seconds: 4 });
  assert.ok(f.ratio < 0.02, `flatplane ratio=${f.ratio} 应 < 0.02`);
  assert.ok(c.ratio / Math.max(f.ratio, 1e-6) >= 15, `cross/flat=${c.ratio / Math.max(f.ratio, 1e-6)} 应 ≥ 15`);
});

test('dsp: 等长芭蕉延迟线只有 1/3/5 奇次模（基频 ≈164.6Hz）', () => {
  const N = DSP.internal.exhaustCombLength(FS, 0.5212);
  const f0 = FS / (2 * N);
  assert.ok(Math.abs(f0 - 164.6) / 164.6 < 0.02, `f0=${f0} 应接近 164.6Hz`);
  // 冲激响应 h = [1, 0.., -1]，FFT 验证奇次模为峰、偶次模被抑制
  const n = 4096;
  const x = new Float64Array(n);
  x[0] = 1;
  const y = DSP.internal.runComb(x, N);
  const mag = DSP.internal.fftMag(y);
  const df = FS / n;
  const oddMag = [];
  const evenMag = [];
  for (let k = 1; k <= 8; k++) {
    const bin = Math.round(k * f0 / df);
    if (k % 2 === 1) oddMag.push(mag[bin]); else evenMag.push(mag[bin]);
  }
  const peakOdd = Math.max(...oddMag);
  const peakEven = Math.max(...evenMag);
  assert.ok(peakOdd > 1.9, `奇次模峰值应为 2 量级，got ${peakOdd}`);
  assert.ok(peakEven < 0.05 * peakOdd, `偶次模峰值 ${peakEven} 应被抑制（<5% 奇次峰值 ${peakOdd}）`);
});

test('dsp: FDN 冲激响应稳定衰减、无 NaN', () => {
  const resp = DSP.internal.fdnResponse(FS, 'hall', 3);
  assert.ok(allFinite(resp), 'FDN 响应含 NaN/Inf');
  const half = Math.floor(resp.length / 2);
  let e1 = 0, e2 = 0;
  for (let i = 0; i < half; i++) { e1 += resp[i] * resp[i]; e2 += resp[half + i] * resp[half + i]; }
  assert.ok(e2 < e1, '后半程能量应小于前半程（衰减）');
  const tail = resp.slice(Math.floor(resp.length * 0.9));
  let peak = 0;
  for (let i = 0; i < resp.length; i++) peak = Math.max(peak, Math.abs(resp[i]));
  assert.ok(rms(tail) < 0.02 * peak, '尾部能量应衰减到峰值的 2% 以下');
});

test('dsp: 预设切换零点击（系数平滑 + 预延迟交叉淡化）', () => {
  const eng = DSP.createEngine({ sampleRate: FS, seed: 42 });
  const ids = ['zero', 'hall', 'tunnel', 'church'];
  const dur = 3;
  const total = dur * FS;
  const switchTimes = [1.0, 1.5, 2.0];
  const win = 0.05 * FS;
  let prev = 0;
  let steadyMax = 0;
  let switchMax = 0;
  let si = 0;
  let lastSwitch = -1;
  for (let i = 0; i < total; i++) {
    const t = i / FS;
    if (si < switchTimes.length && t >= switchTimes[si]) {
      eng.update({ preset: ids[(si + 1) % ids.length] });
      lastSwitch = i;
      si++;
    }
    eng.update({ rpm: 3000, throttle: 0.7, noiseGain: 0 });
    const s = eng.processSample();
    assert.ok(Number.isFinite(s[0]) && Number.isFinite(s[1]));
    const d = Math.abs(s[0] - prev);
    prev = s[0];
    if (lastSwitch >= 0 && Math.abs(i - lastSwitch) <= win) {
      if (d > switchMax) switchMax = d;
    } else {
      if (d > steadyMax) steadyMax = d;
    }
  }
  assert.ok(steadyMax > 1e-4, `稳态应有信号，steadyMax=${steadyMax}`);
  assert.ok(switchMax <= steadyMax * 2 + 1e-9,
    `切换窗口最大跳变 ${switchMax} 不应明显超过稳态 ${steadyMax}`);
});

test('dsp: 离线渲染 20s 立体声有效，lite 开销低于 high', () => {
  const t0 = Date.now();
  const hi = DSP.renderOffline({ sampleRate: FS, duration: 20, quality: 'high', seed: 7,
    script: () => ({ rpm: 6000, throttle: 1, noiseGain: 0.2 }) });
  const t1 = Date.now();
  const lo = DSP.renderOffline({ sampleRate: FS, duration: 20, quality: 'lite', seed: 7,
    script: () => ({ rpm: 6000, throttle: 1, noiseGain: 0.2 }) });
  const t2 = Date.now();
  const hiSec = (t1 - t0) / 1000;
  const loSec = (t2 - t1) / 1000;
  assert.ok(allFinite(hi.left) && allFinite(hi.right), 'high 输出含 NaN');
  assert.ok(allFinite(lo.left) && allFinite(lo.right), 'lite 输出含 NaN');
  assert.ok(rms(hi.left) > 0.005 && rms(hi.right) > 0.005, 'high 输出不应静音');
  assert.ok(rms(lo.left) > 0.005, 'lite 输出不应静音');
  let peak = 0;
  for (let i = 0; i < hi.left.length; i++) {
    peak = Math.max(peak, Math.abs(hi.left[i]), Math.abs(hi.right[i]));
  }
  assert.ok(peak <= 1.0, `峰值 ${peak} 不应削顶溢出`);
  let diff = 0;
  for (let i = 0; i < hi.left.length; i++) diff += Math.abs(hi.left[i] - hi.right[i]);
  assert.ok(diff / hi.left.length > 1e-4, '左右声道应去相关（立体声）');
  assert.ok(loSec <= hiSec * 1.5, `lite(${loSec}s) 应不慢于 high(${hiSec}s)`);
  assert.ok(loSec / 20 < 0.5, `lite CPU 占比 ${(loSec / 20 * 100).toFixed(1)}% 应 < 50%`);
  assert.ok(hiSec / 20 < 1.0, `high CPU 占比 ${(hiSec / 20 * 100).toFixed(1)}% 应 < 100%`);
});

test('dsp: 30s 参数滥用无 NaN/Inf 且输出有界', () => {
  let state = 12345;
  const rnd = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const presets = DSP.REVERB_PRESETS.map((p) => p.id);
  const eng = DSP.createEngine({ sampleRate: FS, seed: 99 });
  const total = 30 * FS;
  const out = new Float32Array(total);
  let maxAbs = 0;
  let lastPreset = 0;
  for (let i = 0; i < total; i++) {
    const t = i / FS;
    const p = {
      rpm: 900 + 5800 * Math.abs(Math.sin(t * 1.7)) + rnd() * 300,
      throttle: Math.abs(Math.sin(t * 2.3)),
      ignition: Math.floor(t / 2.1) % 2 === 0,
      cutoff: Math.floor(t / 3.7) % 3 === 0,
      quality: Math.floor(t / 4.3) % 2 === 0 ? 'lite' : 'high',
      firingOrder: Math.floor(t / 5.1) % 2 === 0 ? 'crossplane' : 'flatplane',
      noiseGain: rnd()
    };
    if (Math.floor(t / 0.7) !== lastPreset) {
      lastPreset = Math.floor(t / 0.7);
      p.preset = presets[lastPreset % presets.length];
    }
    eng.update(p);
    const s = eng.processSample();
    if (!Number.isFinite(s[0]) || !Number.isFinite(s[1])) {
      throw new Error(`第 ${i} 样本出现 NaN/Inf`);
    }
    out[i] = s[0];
    maxAbs = Math.max(maxAbs, Math.abs(s[0]), Math.abs(s[1]));
  }
  assert.ok(maxAbs <= 1.05, `输出应有界，maxAbs=${maxAbs}`);
  assert.ok(rms(out) > 0.001, '滥用渲染不应完全静音');
});

test('dsp: 点火顺序相位表（十字曲轴每侧 270/180/90/180，平轴恒 180）', () => {
  const cross = DSP.internal.firingTables(DSP.FIRING_ORDERS.crossplane);
  const flat = DSP.internal.firingTables(DSP.FIRING_ORDERS.flatplane);
  const fracToDeg = (xs) => xs.map((e) => e.frac * 720);
  const intervals = (deg) => deg.map((d, i) => (deg[(i + 1) % deg.length] - d + 720) % 720);
  assert.deepStrictEqual(fracToDeg(cross.L), [0, 270, 450, 540]);
  assert.deepStrictEqual(fracToDeg(cross.R), [90, 180, 360, 630]);
  assert.deepStrictEqual(intervals(fracToDeg(cross.L)), [270, 180, 90, 180]);
  assert.deepStrictEqual(intervals(fracToDeg(cross.R)), [90, 180, 270, 180]);
  assert.deepStrictEqual(intervals(fracToDeg(flat.L)), [180, 180, 180, 180]);
  assert.deepStrictEqual(intervals(fracToDeg(flat.R)), [180, 180, 180, 180]);
  assert.deepStrictEqual(cross.L.map((e) => e.cyl), [1, 3, 5, 7]);
  assert.deepStrictEqual(cross.R.map((e) => e.cyl), [8, 4, 6, 2]);
});

test('dsp: 输出主频跟踪 4 阶转速（6000rpm → ~400Hz）', () => {
  const eng = DSP.createEngine({ sampleRate: FS, seed: 3 });
  const total = 4 * FS;
  const winStart = 2 * FS;
  const winLen = 1.5 * FS;
  const win = new Float64Array(winLen);
  for (let i = 0; i < total; i++) {
    const t = i / FS;
    eng.update({ rpm: t < 2 ? 2000 : 6000, throttle: 1, noiseGain: 0, preset: 'zero' });
    const s = eng.processSample();
    if (i >= winStart && i < winStart + winLen) win[i - winStart] = s[0] + s[1];
  }
  // 补零到 2 的幂做 FFT
  const n = 1 << 17; // 131072
  const buf = new Float64Array(n);
  buf.set(win);
  const mag = DSP.internal.fftMag(buf);
  const df = FS / n;
  let best = 0, bestF = 0;
  for (let f = 50; f < 900; f += df) {
    const b = Math.round(f / df);
    if (mag[b] > best) { best = mag[b]; bestF = f; }
  }
  assert.ok(Math.abs(bestF - 400) < 45, `主峰 ${bestF.toFixed(1)}Hz 应接近 4 阶 400Hz`);
});

test('dsp: engine-config 与 engine-dsp 配置一致性（防止双份常量漂移）', async () => {
  const cfg = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'engine-config.mjs')).href);
  assert.deepStrictEqual(cfg.FIRING_ORDERS.crossplane, DSP.FIRING_ORDERS.crossplane);
  assert.deepStrictEqual(cfg.FIRING_ORDERS.flatplane, DSP.FIRING_ORDERS.flatplane);
  assert.strictEqual(cfg.BANK_OF[1], DSP.BANK_OF[1]);
  assert.strictEqual(cfg.BANK_OF[2], DSP.BANK_OF[2]);
  assert.strictEqual(cfg.REVERB_PRESETS.length, DSP.REVERB_PRESETS.length);
  for (let i = 0; i < cfg.REVERB_PRESETS.length; i++) {
    assert.strictEqual(cfg.REVERB_PRESETS[i].id, DSP.REVERB_PRESETS[i].id);
    assert.strictEqual(cfg.REVERB_PRESETS[i].name, DSP.REVERB_PRESETS[i].name);
    assert.strictEqual(cfg.REVERB_PRESETS[i].wet, DSP.REVERB_PRESETS[i].wet);
    assert.strictEqual(cfg.REVERB_PRESETS[i].fdbk, DSP.REVERB_PRESETS[i].fdbk);
  }
  assert.strictEqual(cfg.EXHAUST_RUNNER_LENGTH_M, DSP.DEFAULT_CONFIG.exhaustRunnerLengthM);
  assert.strictEqual(cfg.SOUND_SPEED, DSP.DEFAULT_CONFIG.soundSpeed);
  assert.strictEqual(cfg.LIMITER_RPM, DSP.DEFAULT_CONFIG.limiterRpm);
  assert.strictEqual(cfg.IDLE_RPM, DSP.DEFAULT_CONFIG.idleRpm);
  assert.deepStrictEqual(cfg.QUALITY_LEVELS, ['lite', 'high']);
});
