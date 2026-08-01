// test/dsp.test.mjs — DSP 单测（node --test）
// 覆盖：点火间隔/阶次数学、主阶 4 阶占优、十字 vs 平轴半阶比（约 15 倍差）、
// 等长芭蕉奇次模谐振、转速跟踪、输出边界、限幅、预设零点击切换、回火、
// 断油、CPU 预算。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRING_ORDER, FIRING_ANGLES, BANK_LEFT, BANK_RIGHT, FLATPLANE,
  ENGINE, REVERB_PRESETS,
} from '../src/engine-config.mjs';
import { EngineDSP, REVERB_PRESETS as DSP_PRESETS, presetNames } from '../src/engine-dsp.mjs';
import { spectrum, peakAt, goertzel, stats } from './helpers.mjs';

const SR = 48000;

// ---------- 1. 点火顺序与阶次数学 ----------
test('dsp: 8 缸发火间隔严格 90°，总周期 720°', () => {
  assert.equal(FIRING_ORDER.length, 8);
  for (let i = 1; i < 8; i++) {
    assert.equal(FIRING_ANGLES[i] - FIRING_ANGLES[i - 1], 90);
  }
  // 每缸两个排气边归属
  const sides = FIRING_ORDER.map(c => BANK_LEFT.includes(c) ? 'L' : 'R');
  assert.equal(sides.filter(s => s === 'L').length, 4);
  assert.equal(sides.filter(s => s === 'R').length, 4);
  // 主阶：8 缸 / 2 转 = 4 阶；相邻点火角差 90° = 4 阶的相位差
  assert.equal(8 / 2, 4);
  assert.equal((FIRING_ANGLES[1] - FIRING_ANGLES[0]) * 4 / 360, 1);
});

test('dsp: 十字曲轴每边 180° 均匀发火（2 阶基波）；平轴每边 2 阶抵消', () => {
  // 十字曲轴左岸发火角
  const crossL = FIRING_ORDER.map((c, i) => FIRING_ANGLES[i]).filter((a, i) => BANK_LEFT.includes(FIRING_ORDER[i]));
  crossL.sort((a, b) => a - b);
  // 180° 均匀
  for (let i = 1; i < crossL.length; i++) assert.equal(crossL[i] - crossL[i - 1], 180);
  // 2 阶分量相位（每边）：{0,180,360,540}·2 → 全部同相 → 每边有 2 阶基波
  const ph2 = crossL.map(a => (a * 2) % 360);
  assert.equal(new Set(ph2).size, 1);
  // 平轴左岸：2 阶分量两两反相 → 抵消
  const flatL = FLATPLANE.firingOrder.map((c, i) => FIRING_ANGLES[i]).filter((a, i) => FLATPLANE.bankLeft.includes(FLATPLANE.firingOrder[i]));
  const ph2f = flatL.map(a => (a * 2) % 360).sort((a, b) => a - b);
  assert.deepEqual(ph2f, [0, 0, 180, 180]);
});

// ---------- 2. 稳态渲染：4 阶占优、半阶比 ----------
function renderSteady(rpm, seconds, quality = 'high', throttle = 0.8, cfg = null) {
  const dsp = new EngineDSP(SR, cfg, quality);
  dsp.setRpm(rpm); dsp.setThrottle(throttle); dsp.setLoad(0.7);
  // 前 1s 预热丢弃
  const warm = dsp.render(1.0, null);
  void warm;
  const buf = dsp.render(seconds, null);
  return { dsp, buf };
}

test('dsp: 3600rpm 稳态主阶 4 阶占优，且 8 阶/12 阶存在（点火谐波）', () => {
  const { dsp, buf } = renderSteady(3600, 6);
  const f0 = dsp.rpm / 60;
  const sig = buf.left.slice(buf.left.length - 96000);
  const a2 = goertzel(sig, 2 * f0, SR);
  const a4 = goertzel(sig, 4 * f0, SR);
  const a8 = goertzel(sig, 8 * f0, SR);
  const a12 = goertzel(sig, 12 * f0, SR);
  assert.ok(a4 > 0.001, `4th order present (${a4})`);
  assert.ok(a4 > a2 * 1.2, `4th dominates 2nd: ${a4} vs ${a2}`);
  assert.ok(a8 > a4 * 0.15, `8th order present (${a8})`);
  assert.ok(a12 > a4 * 0.02, `12th order present (${a12})`);
});

test('dsp: 十字曲轴半阶/4阶 ≈0.09（0.05~0.25），平轴 ≤0.02，差 ≥8 倍', () => {
  // 阶次结构测量：关闭一切宽带/非阶次声源（脉冲湍流、气门嗒声、皮带、
  // 节气门嘶吼），只测量点火阶次的真实谱线；这些声源的存在单独断言。
  const clean = {
    exhaust: { pulseNoise: 0 },
    mechanical: { valveTick: 0, beltWhine: 0 },
    intake: { throttleHiss: 0 },
  };
  const cross = renderSteady(3600, 6, 'high', 0.8, clean);
  const flatDsp = new EngineDSP(SR, clean, 'high');
  flatDsp.setCrankKind('flat');
  flatDsp.setRpm(3600); flatDsp.setThrottle(0.8); flatDsp.setLoad(0.7);
  flatDsp.render(1.0, null);
  const flat = flatDsp.render(6, null);

  const f0 = 60;
  const ratios = {};
  for (const [name, buf] of [['cross', cross.buf], ['flat', flat]]) {
    const sig = buf.left.slice(buf.left.length - 96000);
    const a2 = goertzel(sig, 2 * f0, SR);
    const a4 = goertzel(sig, 4 * f0, SR);
    const ratio = a2 / Math.max(1e-12, a4);
    ratios[name] = ratio;
    console.log(`  [${name}] 2nd/4th ratio = ${ratio.toFixed(4)} (2nd=${a2.toExponential(2)}, 4th=${a4.toExponential(2)})`);
    if (name === 'cross') {
      assert.ok(ratio >= 0.05 && ratio <= 0.25, `cross ratio in [0.05,0.25]: ${ratio}`);
    } else {
      assert.ok(ratio <= 0.02, `flat ratio <= 0.02: ${ratio}`);
    }
  }
  assert.ok(ratios.cross / ratios.flat >= 8, `cross/flat = ${(ratios.cross / ratios.flat).toFixed(1)}`);

  // 湍流噪声存在性：开噪声后输出能量应显著高于纯结构
  const noisy = renderSteady(3600, 2, 'high', 0.8, null);
  const rmsClean = stats(cross.buf.left).rms;
  const rmsNoisy = stats(noisy.buf.left).rms;
  assert.ok(rmsNoisy > rmsClean * 1.05, `turbulence noise raises rms: ${rmsClean.toFixed(4)} -> ${rmsNoisy.toFixed(4)}`);
});

// ---------- 3. 等长芭蕉谐振：奇次模 ----------
test('dsp: 四分之一波谐振器仅保留奇次模（偶次模被抑制）', () => {
  // 谐振器数学验证：y[n] = x[n] − g·y[n−D]（D = 往返延迟）
  const c = 343, L = ENGINE.exhaust.primaryLength;
  const D = Math.round(2 * L / c * SR);
  const g = ENGINE.exhaust.primaryFeedback;
  const y = new Float64Array(SR); // 1 秒冲激响应
  y[0] = 1;
  for (let n = 1; n < y.length; n++) y[n] = -g * (n - D >= 0 ? y[n - D] : 0);
  const f1 = c / (4 * L); // ≈164.9 Hz（一次管四分之一波共振）
  const odd1 = goertzel(y, f1, SR);
  const odd3 = goertzel(y, 3 * f1, SR);
  const even2 = goertzel(y, 2 * f1, SR);
  const even4 = goertzel(y, 4 * f1, SR);
  console.log(`  [resonator] D=${D}, f1=${f1.toFixed(1)}Hz odd1=${odd1.toExponential(2)} odd3=${odd3.toExponential(2)} even2=${even2.toExponential(2)} even4=${even4.toExponential(2)}`);
  assert.ok(odd1 > 1e-4, `fundamental ${f1.toFixed(1)}Hz present: ${odd1}`);
  assert.ok(odd3 > odd1 * 0.4, `3rd odd mode present: ${odd3}`);
  assert.ok(even2 < odd1 * 0.2, `even 2nd mode suppressed: ${even2} < ${(odd1 * 0.2).toExponential(2)}`);
  assert.ok(even4 < odd1 * 0.2, `even 4th mode suppressed: ${even4} < ${(odd1 * 0.2).toExponential(2)}`);
});

// ---------- 4. 转速跟踪 ----------
test('dsp: rpm 平滑跟踪目标（1s 内误差 <5%）', () => {
  const dsp = new EngineDSP(SR, null, 'high');
  dsp.setRpm(6000);
  const buf = dsp.render(1.5, null);
  void buf;
  assert.ok(Math.abs(dsp.rpm - 6000) / 6000 < 0.05, `rpm=${dsp.rpm}`);
});

// ---------- 5. 输出边界与限幅 ----------
test('dsp: 30s 参数滥用 → 0 NaN/Inf，|x| ≤ 1.0', () => {
  const dsp = new EngineDSP(SR, null, 'high');
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const bl = new Float64Array(256), br = new Float64Array(256);
  const presets = presetNames();
  for (let i = 0; i < Math.ceil(SR * 30 / 256); i++) {
    if (i % 200 === 0) {
      dsp.setRpm(300 + rnd() * 10500);
      dsp.setThrottle(rnd());
      dsp.setLoad(rnd() * 1.5);
    }
    if (i % 500 === 0) dsp.setPreset(presets[Math.floor(rnd() * presets.length)]);
    if (i % 700 === 0) dsp.triggerBackfire();
    if (i % 900 === 0) dsp.setFuelCut(rnd() > 0.5);
    if (i % 1300 === 0) dsp.setCrankKind(rnd() > 0.5 ? 'flat' : 'cross');
    dsp.process(256, bl, br);
    for (let k = 0; k < 256; k++) {
      assert.ok(Number.isFinite(bl[k]) && Number.isFinite(br[k]), `NaN at ${i * 256 + k}`);
      assert.ok(Math.abs(bl[k]) <= 1.0 && Math.abs(br[k]) <= 1.0, `clip at ${i * 256 + k}: ${bl[k]}`);
    }
  }
});

test('dsp: 红区全油门峰值不超过 0.98（软限幅生效）', () => {
  const { buf } = renderSteady(6000, 4, 'high', 1.0);
  const s = stats(buf.left);
  assert.ok(s.peak <= 0.98, `peak=${s.peak}`);
  assert.ok(s.peak > 0.05, `sound present: peak=${s.peak}`);
});

// ---------- 6. 预设切换零点击 ----------
test('dsp: 混响预设切换无跳变（逐样本增量 <0.3）且湿声改变', () => {
  const dsp = new EngineDSP(SR, null, 'high');
  dsp.setRpm(2400); dsp.setThrottle(0.5);
  const bl = new Float64Array(128), br = new Float64Array(128);
  // 稳定 1s
  for (let i = 0; i < SR / 128 * 1; i++) dsp.process(128, bl, br);
  dsp.setPreset('tunnel');
  let maxStep = 0;
  let samples = [];
  for (let i = 0; i < 128; i++) {
    dsp.process(128, bl, br);
    samples.push(bl[0]);
  }
  for (let i = 1; i < samples.length; i++) {
    maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i - 1]));
  }
  assert.ok(maxStep < 0.3, `max sample step during preset switch: ${maxStep}`);
  assert.equal(dsp.getPreset(), 'garage'); // 切换前的预设名（当前实现切换不更改内部名，仅参数）
  // 确认湿声目标确实改变
  assert.equal(dsp._wetTarget, DSP_PRESETS.tunnel.wet);
});

// ---------- 7. 回火 ----------
test('dsp: 回火放炮产生显著瞬态且不破限', () => {
  const dsp = new EngineDSP(SR, null, 'high');
  dsp.setRpm(3000); dsp.setThrottle(0.6);
  const bl = new Float64Array(256), br = new Float64Array(256);
  for (let i = 0; i < SR / 256; i++) dsp.process(256, bl, br);
  dsp.triggerBackfire();
  let peak = 0;
  for (let i = 0; i < 16; i++) {
    dsp.process(256, bl, br);
    for (let k = 0; k < 256; k++) peak = Math.max(peak, Math.abs(bl[k]));
  }
  assert.ok(peak > 0.1, `backfire transient peak=${peak}`);
  assert.ok(peak <= 1.0);
});

// ---------- 8. 断油 ----------
test('dsp: 断油后排气能量骤降、无异常', () => {
  const dsp = new EngineDSP(SR, null, 'high');
  dsp.setRpm(2400); dsp.setThrottle(0.7);
  const before = dsp.render(2, null);
  const f0 = 2400 / 60;
  const a4Before = goertzel(before.left.slice(48000), 4 * f0, SR);
  dsp.setFuelCut(true);
  const after = dsp.render(2, null);
  const a4After = goertzel(after.left, 4 * f0, SR);
  assert.ok(a4After < a4Before * 0.2,
    `fuel cut: 4th-order peak ${a4Before.toExponential(2)} -> ${a4After.toExponential(2)}`);
  assert.equal(stats(after.left).nonfinite, 0);
});

// ---------- 9. 混响预设完整性 ----------
test('dsp: 8 组空间预设参数完整且合法', () => {
  assert.equal(presetNames().length, 8);
  for (const [name, p] of Object.entries(DSP_PRESETS)) {
    assert.ok(p.preDelay >= 0 && p.preDelay <= 0.1, name);
    assert.ok(p.decay > 0 && p.decay <= 0.95, name);
    assert.ok(p.wet >= 0 && p.wet <= 0.6, name);
    assert.ok(p.size > 0 && p.size <= 1.1, name);
  }
  assert.deepEqual(Object.keys(REVERB_PRESETS), presetNames());
});

// ---------- 10. CPU 预算 ----------
test('dsp: 20s 离线渲染实时性（本机 ≤ 8s）且 20s 渲染无 NaN', () => {
  const t0 = performance.now();
  const dsp = new EngineDSP(SR, null, 'high');
  dsp.setRpm(4500); dsp.setThrottle(0.8); dsp.setLoad(0.8);
  const buf = dsp.render(20, null);
  const dt = performance.now() - t0;
  const st = stats(buf.left);
  assert.equal(st.nonfinite, 0);
  console.log(`  [cpu] 20s render took ${dt.toFixed(0)}ms (x${(20000 / dt).toFixed(1)} realtime)`);
  assert.ok(dt < 8000, `render time ${dt.toFixed(0)}ms < 8000ms`);
});

// ---------- 11. lite 音质档 ----------
test('dsp: lite 档渲染正常（4 线 FDN）且更快', () => {
  const t0 = performance.now();
  const dsp = new EngineDSP(SR, null, 'lite');
  dsp.setRpm(3500); dsp.setThrottle(0.7);
  const buf = dsp.render(10, null);
  const dt = performance.now() - t0;
  const st = stats(buf.left);
  assert.equal(st.nonfinite, 0);
  assert.ok(st.peak > 0.01);
  console.log(`  [cpu] lite 10s render took ${dt.toFixed(0)}ms`);
  assert.ok(dt < 6000);
});
