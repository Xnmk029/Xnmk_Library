'use strict';

const assert = require('node:assert');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { test } = require('./harness.cjs');

const METRICS = pathToFileURL(path.join(__dirname, '..', 'tools', 'experiments', 'vehicle-metrics.mjs')).href;
let M = null;

// SteeringAssist 是 ESM 模块，用动态 import 拿构造函数
async function assist(opts) {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'sim', 'steering.mjs')).href);
  return new mod.SteeringAssist(opts);
}

test('steer: 100km/h 满舵前轮饱和滑移大幅下降（4.46→2.24 量级）且峰值 g 保持', async () => {
  M = M || (await import(METRICS));
  const no = M.fullLockSlipTest(false);
  const as = M.fullLockSlipTest(true);
  assert.ok(no.steadyPeakFrontSlip >= 10, `无辅助稳态滑移 ${no.steadyPeakFrontSlip.toFixed(2)}° 应明显饱和`);
  assert.ok(as.steadyPeakFrontSlip <= 5, `辅助稳态滑移 ${as.steadyPeakFrontSlip.toFixed(2)}° 应 ≤5°`);
  assert.ok(as.steadyPeakFrontSlip < no.steadyPeakFrontSlip * 0.5,
    `辅助滑移 ${as.steadyPeakFrontSlip.toFixed(2)}° 应不足无辅助 ${no.steadyPeakFrontSlip.toFixed(2)}° 的一半`);
  assert.ok(as.peakG >= 0.9, `辅助满舵峰值 g ${as.peakG.toFixed(3)} 应保持 ≥0.9`);
});

test('steer: 80km/h 甩尾松手快速救回且偏航累积小', async () => {
  M = M || (await import(METRICS));
  const no = M.snapOversteerTest(false);
  const as = M.snapOversteerTest(true);
  assert.ok(as.recoveredAt > 0 && as.recoveredAt <= 0.6, `辅助恢复时间 ${as.recoveredAt}s 应 ≤0.6s`);
  assert.ok(as.yawAtRec <= 0.25, `恢复时偏航累积 ${as.yawAtRec.toFixed(3)}rad 应 ≤0.25rad`);
  assert.ok(as.recoveredAt < no.recoveredAt * 0.5,
    `辅助 ${as.recoveredAt}s 应明显快于无辅助 ${no.recoveredAt}s`);
});

test('steer: 防推头限幅自适应——学习滑移有界 2°~14°，限幅 ±35%', async () => {
  const a = await assist({});
  for (let i = 0; i < 6000; i++) {
    a.step(27.78, 1, 0.45, 0, 20, 0, false, 1 / 240, 1.02); // 高前轮滑移 → 学习上升
  }
  assert.ok(a.learnedSlip >= 2 && a.learnedSlip <= 14, `学习滑移 ${a.learnedSlip.toFixed(2)}° 应在 2~14°`);
  assert.ok(a.learnedSlip > 10, `持续高滑移后学习值 ${a.learnedSlip.toFixed(2)}° 应上升`);
  // 限幅自适应：capLow 与理论 thetaMax*capResponse 之比在 ±35% 内
  const thetaMax = Math.atan(2.946 / (27.78 * 27.78 / (1.02 * 9.81)));
  const ratio = a.capLow / (thetaMax * 0.95);
  assert.ok(ratio >= 0.65 && ratio <= 1.35, `自适应限幅比 ${ratio.toFixed(3)} 应在 ±35%`);
});

test('steer: 状态融合——后轴滑移 2°~5° 且反打时限幅放宽到满舵', async () => {
  const a = await assist({});
  // 左转（input>0）而横摆向右（r<0）→ 反打 → 放宽
  let out1 = 0;
  for (let i = 0; i < 600; i++) out1 = a.step(30, 0.5, 0.225, -0.4, 2, 3.5, false, 1 / 240, 1.02);
  assert.ok(a.limiterActive === false, '反打融合时应取消限幅');
  assert.ok(Math.abs(out1) > 0.2, `反打融合后应能输出较大转向 ${out1.toFixed(3)}`);
  // 同向（非反打）→ 限幅生效
  const b = await assist({});
  for (let i = 0; i < 600; i++) b.step(30, 0.5, 0.225, 0.4, 2, 3.5, false, 1 / 240, 1.02);
  assert.ok(b.limiterActive === true, '非反打时防推头限幅应生效');
});

test('steer: <15km/h 整体淡出、空中禁用', async () => {
  const a = await assist({});
  const stopped = a.step(0.5, 1, 0.45, 0, 0, 0, false, 1 / 240, 1.02);
  assert.strictEqual(stopped, 0, '接近静止时辅助应完全关闭');
  const slow = a.step(8, 0.05, 0.0225, 0, 0, 0, false, 1 / 240, 1.02);
  const fast = a.step(30, 0.05, 0.0225, 0, 0, 0, false, 1 / 240, 1.02);
  assert.ok(Math.abs(slow) < Math.abs(fast) * 0.9, '低速辅助幅度应小于高速（淡出）');
  const b = await assist({});
  const air = b.step(30, 1, 0.45, 0.8, 5, 8, true, 1 / 240, 1.02);
  assert.strictEqual(air, 0, '空中辅助应完全禁用');
  const c = await assist({});
  const normal = c.step(30, 0, 0, 0.5, 0, 0, false, 1 / 240, 1.02);
  assert.ok(Math.abs(normal) > 0, '正常行驶时辅助应输出（阻尼方向）');
});

test('steer: 电控横摆阻尼与自回正方向正确，且按 (1-|input|) 加权', async () => {
  const a = await assist({});
  // 松手（input=0）+ 左横摆（r>0）→ 阻尼应输出右转（负）
  const damp = a.step(30, 0, 0, 0.5, 0, 0, false, 1 / 240, 1.02);
  assert.ok(damp < 0, `横摆阻尼方向应反向（got ${damp.toFixed(4)}）`);
  // 前轮滑移角为正（速度偏左）→ 自回正推向左侧（正）
  const b = await assist({});
  const align = b.step(30, 0, 0, 0, 0.1 * 180 / Math.PI, 0, false, 1 / 240, 1.02);
  assert.ok(align > 0, `自回正应把车轮推向速度方向（got ${align.toFixed(4)}）`);
  // 玩家主动打方向（input=1）→ 自回正/阻尼按 (1-|input|) 归零
  const c = await assist({});
  const full = c.step(30, 1, 0.45, 0.5, 0.1 * 180 / Math.PI, 8, false, 1 / 240, 1.02);
  const d = await assist({});
  const handsOff = d.step(30, 0, 0, 0.5, 0.1 * 180 / Math.PI, 8, false, 1 / 240, 1.02);
  assert.ok(Math.abs(full) < Math.abs(handsOff) * 0.15,
    `主动打方向时辅助应被抑制（full=${full.toFixed(4)}, handsOff=${handsOff.toFixed(4)}）`);
});
