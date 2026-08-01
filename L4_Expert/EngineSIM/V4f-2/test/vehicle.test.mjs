// test/vehicle.test.mjs — 车辆物理单测（node --test）
// 覆盖：稳定怠速、0-100 加速、制动距离、稳态弯道、直线稳定性、限速器、
// 随机滥用（0 NaN、横摆率有界）、姿态符号、车轮旋转方向、转向响应。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vehicle } from '../src/sim/vehicle.mjs';
import { GEAR_RATIOS, FINAL_DRIVE, torqueAt } from '../src/sim/drivetrain.mjs';

const R = 0.33;
const H = 1 / 120;

// 自动换挡驾驶辅助（按挡位红线速度换挡）
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
    if (!Number.isFinite(v.speed)) break;
  }
  return t;
}

// ---------- 1. 稳定怠速 ----------
test('vehicle: 怠速稳定在 600-900 rpm，不熄火不滑行', () => {
  const v = new Vehicle();
  for (let i = 0; i < 600; i++) v.step(H);
  assert.ok(v.rpm > 600 && v.rpm < 900, `idle rpm=${v.rpm.toFixed(0)}`);
  assert.equal(v.drivetrain.stall, false);
  assert.ok(v.speed < 0.5, `no creep: ${v.speed.toFixed(3)} m/s`);
  assert.ok(Number.isFinite(v.rpm));
});

// ---------- 2. 0-100 加速（TC 开） ----------
test('vehicle: 0-100 km/h ≤ 7.0s（TC 开），且全程有限', () => {
  const v = new Vehicle();
  const t = autoDrive(v, 1, 100);
  assert.ok(t <= 7.0, `0-100 took ${t.toFixed(2)}s`);
  assert.ok(v.speed * 3.6 >= 100);
  assert.ok(Number.isFinite(v.speed) && Number.isFinite(v.rpm));
});

// ---------- 3. 制动距离 ----------
test('vehicle: 100→1 km/h 制动 ≤ 45m（ABS 开）', () => {
  const v = new Vehicle();
  autoDrive(v, 1, 100);
  const x0 = v.x;
  for (let i = 0; i < 2400; i++) {
    v.setInput({ brake: 1, throttle: 0 });
    v.step(H);
    if (v.speed * 3.6 <= 1) break;
  }
  const dist = Math.abs(v.x - x0);
  assert.ok(dist <= 45, `braking distance ${dist.toFixed(1)}m`);
  assert.ok(dist > 25, `braking not absurdly short: ${dist.toFixed(1)}m`);
});

// ---------- 4. 稳态弯道 ----------
test('vehicle: 60 km/h 满舵弯道侧向加速度 ≥ 0.75g', () => {
  const v = new Vehicle();
  autoDrive(v, 1, 60);
  let peak = 0;
  for (let i = 0; i < 900; i++) {
    v.setInput({ throttle: 0.12, steer: 1 });
    v.step(H);
    peak = Math.max(peak, Math.abs(v.gLat));
  }
  assert.ok(peak >= 0.75, `peak lateral g = ${peak.toFixed(2)}`);
  assert.ok(Number.isFinite(v.speed));
});

// ---------- 5. 直线稳定性 ----------
test('vehicle: 100 km/h 直线 5s 无横向漂移', () => {
  const v = new Vehicle();
  autoDrive(v, 1, 100);
  const y0 = v.y;
  for (let i = 0; i < 600; i++) { v.setInput({ throttle: 0.5 }); v.step(H); }
  assert.ok(Math.abs(v.y - y0) < 0.5, `lateral drift ${Math.abs(v.y - y0).toFixed(3)}m`);
  assert.ok(Math.abs(v.vy) < 0.5, `vy=${v.vy.toFixed(3)}`);
  assert.ok(Math.abs(v.yaw) < 0.02, `yaw=${v.yaw.toFixed(4)}`);
});

// ---------- 6. 限速器火花切断 ----------
test('vehicle: 限速器把转速限制在 6700 rpm 内且触发断油', () => {
  const v = new Vehicle();
  v.setInput({ gearUp: true, throttle: 1, clutch: 1 });
  let maxRpm = 0, cutSeen = false;
  for (let i = 0; i < 1200; i++) {
    v.step(H);
    maxRpm = Math.max(maxRpm, v.rpm);
    if (v.drivetrain.limiterActive) cutSeen = true;
  }
  assert.ok(maxRpm <= 6700, `max rpm ${maxRpm.toFixed(0)}`);
  assert.ok(cutSeen, 'limiter cut engaged');
});

// ---------- 7. 随机滥用 ----------
test('vehicle: 30s 随机输入 0 NaN/Inf，|yawRate| ≤ 1.5 rad/s，状态有限', () => {
  const v = new Vehicle();
  v.setInput({ gearUp: true });
  let seed = 20260731;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let t = 0, maxR = 0;
  for (let i = 0; i < 3600; i++) {
    v.setInput({
      throttle: rnd(),
      brake: rnd() * 0.9,
      steer: rnd() * 2 - 1,
      clutch: t < 1 ? 1 : 0,
      gearUp: i % 137 === 0,
      gearDown: i % 139 === 0,
    });
    v.step(H);
    t += H;
    maxR = Math.max(maxR, Math.abs(v.yawRate));
    const s = v.snapshot();
    for (const k of ['vx', 'vy', 'yawRate', 'rpm', 'x', 'y']) {
      assert.ok(Number.isFinite(s[k]), `non-finite ${k} at t=${t.toFixed(1)}`);
    }
  }
  assert.ok(maxR <= 1.5, `max |yawRate| ${maxR.toFixed(2)} rad/s`);
});

// ---------- 8. 渲染姿态符号 ----------
test('vehicle: 姿态符号——加速翘头、刹车点头、转向向外侧倾', () => {
  const v = new Vehicle();
  // 加速：pitchTarget 与 ax 反号（车头上扬）
  autoDrive(v, 1, 30);
  assert.ok(v.ax > 1, `accelerating ax=${v.ax.toFixed(2)}`);
  assert.ok(v.pitchTarget < 0, `accel pitch=${v.pitchTarget.toFixed(4)} (should be nose-up/negative)`);
  // 刹车：点头（等 0.5s 进入稳定制动后再断言）
  v.setInput({ brake: 1, throttle: 0 });
  for (let i = 0; i < 90; i++) v.step(H);
  assert.ok(v.ax < -1, `braking ax=${v.ax.toFixed(2)}`);
  assert.ok(v.pitchTarget > 0, `brake pitch=${v.pitchTarget.toFixed(4)} (should be nose-dive/positive)`);
  // 左转（ay>0）：rollTarget 与 ay 反号（车身向外=右侧倾）
  autoDrive(v, 0.5, 40);
  const vy0 = v.vy;
  for (let i = 0; i < 60; i++) { v.setInput({ steer: -1, throttle: 0.3 }); v.step(H); }
  assert.ok(Math.abs(v.rollTarget) > 1e-4, `roll active: ${v.rollTarget.toFixed(4)}`);
  assert.ok(Math.sign(v.rollTarget) === -Math.sign(v.ay) || Math.abs(v.ay) < 0.1,
    `roll opposes lateral accel: ay=${v.ay.toFixed(2)}, roll=${v.rollTarget.toFixed(4)}`);
  void vy0;
});

// ---------- 9. 车轮旋转方向 ----------
test('vehicle: 前进时驱动轮 ω>0（视觉正方向），滑移有界', () => {
  const v = new Vehicle();
  autoDrive(v, 1, 50);
  assert.ok(v.wheelOmega[2] > 0, `rear omega=${v.wheelOmega[2].toFixed(1)} > 0 forward`);
  assert.ok(Math.abs(v.wheelOmega[2] * R - v.vx) < 6, 'wheel surface speed tracks vx');
  for (let i = 0; i < 4; i++) {
    assert.ok(Number.isFinite(v.wheelSlipRatio[i]), `slip finite wheel ${i}`);
  }
});

// ---------- 10. 转向响应 ----------
test('vehicle: 右打方向（steer>0）→ 横摆率负向（three.js 约定：右转 = 负 yaw）', () => {
  const v = new Vehicle();
  autoDrive(v, 1, 50);
  const r0 = v.yawRate;
  for (let i = 0; i < 60; i++) { v.setInput({ steer: 0.6, throttle: 0.3 }); v.step(H); }
  assert.ok(v.yawRate - r0 < -0.01, `yawRate response: ${r0.toFixed(3)} -> ${v.yawRate.toFixed(3)} (right turn = negative)`);
  assert.ok(v.steerAngle > 0, `steerAngle=${v.steerAngle.toFixed(3)} > 0`);
});

// ---------- 11. 扭矩曲线 ----------
test('vehicle: 扭矩曲线单调合理（峰值在 4000-4600 rpm）', () => {
  let peakRpm = 0, peakT = 0;
  for (let rpm = 700; rpm <= 6600; rpm += 100) {
    const T = torqueAt(rpm);
    if (T > peakT) { peakT = T; peakRpm = rpm; }
  }
  assert.ok(peakRpm >= 4000 && peakRpm <= 4600, `torque peak at ${peakRpm} rpm`);
  assert.ok(peakT >= 600, `peak torque ${peakT.toFixed(0)} Nm`);
});

// ---------- 12. 熄火与点火恢复 ----------
test('vehicle: 熄火后无法加速；重新点火+离合可恢复', () => {
  const v = new Vehicle();
  v.setInput({ gearUp: true, ignition: false });
  for (let i = 0; i < 720; i++) v.step(H);
  assert.equal(v.drivetrain.stall || v.rpm < 100, true, 'engine dead with ignition off');
  v.setInput({ ignition: true, clutch: 1, throttle: 0.5 });
  for (let i = 0; i < 300; i++) v.step(H);
  assert.ok(v.rpm > 500, `rpm recovered ${v.rpm.toFixed(0)}`);
});
