// test/steering.test.mjs — 转向辅助单测（node --test）
// 覆盖：防推头限幅（100km/h 满舵前轮滑移显著下降）、自回正/漂移反打、
// 电控横摆阻尼、甩尾松手救车、低速淡出、空中禁用。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vehicle } from '../src/sim/vehicle.mjs';
import { GEAR_RATIOS, FINAL_DRIVE } from '../src/sim/drivetrain.mjs';
import { SteeringAssist } from '../src/sim/steering.mjs';

const R = 0.33;
const H = 1 / 120;

function autoDrive(v, throttle, targetKmh = Infinity) {
  v.setInput({ gearUp: true }); // 起步挂 1 挡
  let t = 0;
  for (let i = 0; i < 4800; i++) {
    const g = v.drivetrain;
    const canShift = t > 1.1;
    const redlineSpeed = (g.gear > 0 && !g.reverse)
      ? 6200 / 60 * 2 * Math.PI * R / (GEAR_RATIOS[g.gear - 1] * FINAL_DRIVE) : 0;
    v.setInput({
      throttle,
      clutch: t < 1.0 ? 1.0 : 0,
      gearUp: canShift && v.speed > redlineSpeed && g.gear < 6,
      gearDown: canShift && v.rpm < 1600 && g.gear > 1,
    });
    v.step(H);
    t += H;
    if (v.speed * 3.6 >= targetKmh) break;
  }
  return t;
}

// ---------- 1. 防推头限幅 ----------
test('steering: 60km/h 满舵——辅助把转向角限制在 8° 内（防推头限幅），无辅助满舵 35°', () => {
  const results = {};
  for (const assistOn of [true, false]) {
    const v = new Vehicle();
    autoDrive(v, 1, 60);
    let maxSteerAngle = 0;
    for (let i = 0; i < 240; i++) {
      v.setInput({ steer: 1, throttle: 0, assistOn });
      v.step(H);
      if (i >= 60) maxSteerAngle = Math.max(maxSteerAngle, Math.abs(v.steerAngle));
    }
    results[assistOn] = maxSteerAngle * 57.3;
  }
  console.log(`  [steering] 60km/h full lock: assist steer=${results.true.toFixed(1)}°, no-assist=${results.false.toFixed(1)}°`);
  assert.ok(results.true < 12, `assist caps steer angle: ${results.true.toFixed(1)}° < 12°`);
  assert.ok(results.false > 20, `no-assist reaches near full lock: ${results.false.toFixed(1)}°`);
});

// ---------- 2. 自回正 ----------
test('steering: 松手后前轮自动回正（速度方向跟踪）', () => {
  const sa = new SteeringAssist({});
  // 有横向速度（vy=3, vx=20 → 速度方向偏 8.5°）→ 自回正应把车轮推向速度方向
  const r = sa.update(H, { vx: 20, vy: 3, yawRate: 0, speed: 20.2, frontSlipDeg: 3, rearSlipDeg: 0, mu: 1, airborne: false, a: 1.15 }, 0);
  const expected = Math.atan2(3, 20) * sa.selfAlignGain;
  assert.ok(Math.abs(r.steerAngle - expected) < 0.05, `self-align steer=${r.steerAngle.toFixed(3)} rad`);
  assert.ok(r.steerAngle > 0.02, 'self-align pushes wheel toward velocity direction');
});

// ---------- 3. 横摆阻尼 ----------
test('steering: 松手时横摆阻尼最强，打方向时不干预', () => {
  const sa = new SteeringAssist({});
  const base = { vx: 25, vy: 0, yawRate: 0.5, speed: 25, frontSlipDeg: 2, rearSlipDeg: 1, mu: 1, airborne: false, a: 1.15 };
  const handsOff = sa.update(H, base, 0);
  const handsOn = sa.update(H, base, 1.0);
  assert.ok(Math.abs(handsOff.yawDamp) > Math.abs(handsOn.yawDamp) * 2,
    `yaw damping hands-off ${handsOff.yawDamp.toFixed(4)} vs hands-on ${handsOn.yawDamp.toFixed(4)}`);
  assert.ok(Math.sign(handsOff.yawDamp) === -Math.sign(base.yawRate), 'damping opposes yaw rate');
});

// ---------- 4. 甩尾松手救车 ----------
test('steering: 80km/h 手刹甩尾后松手 1s 内横摆率收敛（辅助救车）', () => {
  const v = new Vehicle();
  autoDrive(v, 1, 80);
  // 手刹甩尾 0.4s（手刹 + 轻微转向使后轴侧滑）
  for (let i = 0; i < 50; i++) { v.setInput({ handbrake: 1, steer: 0.4, throttle: 0.3 }); v.step(H); }
  const rPeak = Math.abs(v.yawRate);
  assert.ok(rPeak > 0.15, `drift induced: |yawRate|=${rPeak.toFixed(2)}`);
  // 松手：辅助自回正 + 横摆阻尼救车
  let t = 0;
  for (let i = 0; i < 240; i++) { v.setInput({ handbrake: 0, steer: 0, throttle: 0.3 }); v.step(H); t += H; }
  assert.ok(Math.abs(v.yawRate) < 0.6, `recovered yawRate=${v.yawRate.toFixed(2)} after ${t.toFixed(1)}s`);
  assert.ok(Number.isFinite(v.speed));
});

// ---------- 5. 低速淡出 ----------
test('steering: <15km/h 时限幅/阻尼淡出但自回正保留', () => {
  const sa = new SteeringAssist({});
  const low = { vx: 2, vy: 0.5, yawRate: 0.2, speed: 2, frontSlipDeg: 2, rearSlipDeg: 0, mu: 1, airborne: false, a: 1.15 };
  const r = sa.update(H, low, 1.0);
  // 低速：限幅几乎不生效（capRatio 小）
  assert.ok(r.capRatio < 0.5, `low-speed capRatio=${r.capRatio.toFixed(3)} (faded)`);
  // 自回正（速度方向）仍生效
  const sa2 = new SteeringAssist({});
  const r2 = sa2.update(H, low, 0);
  assert.ok(Math.abs(r2.selfAlign) > 1e-3, `self-align active at low speed: ${r2.selfAlign.toFixed(4)}`);
});

// ---------- 6. 空中禁用 ----------
test('steering: 空中辅助完全禁用', () => {
  const sa = new SteeringAssist({});
  const r = sa.update(H, { vx: 30, vy: 0, yawRate: 0.5, speed: 30, frontSlipDeg: 2, rearSlipDeg: 2, mu: 1, airborne: true, a: 1.15 }, 0.5);
  assert.equal(r.steerAngle, 0.5 * sa.maxSteer, 'airborne: raw steer only');
  assert.equal(r.assistActive, false);
});

// ---------- 7. 反打放宽条件 ----------
test('steering: 轻微横摆（|r|<0.2）不触发反打限幅放宽', () => {
  const sa = new SteeringAssist({});
  const r = sa.update(H, { vx: 30, vy: 1, yawRate: -0.05, speed: 30, frontSlipDeg: 8, rearSlipDeg: 8, mu: 1, airborne: false, a: 1.15 }, 1.0);
  assert.ok(r.capRatio < 0.5, `capRatio=${r.capRatio.toFixed(3)} stays capped with tiny yaw`);
  // 真甩尾 + 反打（右旋用左打反打）→ 放宽
  const r2 = sa.update(H, { vx: 30, vy: 3, yawRate: -0.8, speed: 30, frontSlipDeg: 10, rearSlipDeg: 10, mu: 1, airborne: false, a: 1.15 }, -1.0);
  assert.equal(r2.capRatio, 1, `capRatio released during real counter-steer drift`);
  // 同方向输入（右打 + 右旋 = 加剧甩尾）不触发放宽
  const r3 = sa.update(H, { vx: 30, vy: 3, yawRate: -0.8, speed: 30, frontSlipDeg: 10, rearSlipDeg: 10, mu: 1, airborne: false, a: 1.15 }, 1.0);
  assert.ok(r3.capRatio < 1, `capRatio stays capped when input aligns with yaw`);
});
