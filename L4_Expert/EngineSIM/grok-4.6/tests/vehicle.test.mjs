import assert from 'node:assert/strict';
import test from 'node:test';
import { Vehicle, VEHICLE_SPEC, torqueCurveNm, frictionCircle } from '../vehicle.mjs';

function settle(vehicle, input, seconds, dt) {
  const step = dt || 1 / 120;
  vehicle.setInput(input);
  const n = Math.round(seconds / step);
  for (let i = 0; i < n; i++) vehicle.step(step);
  return vehicle.getState();
}

function allFinite(st) {
  const keys = ['x', 'y', 'yaw', 'vx', 'vy', 'yawRate', 'rpm', 'speedMs', 'load', 'clutch'];
  return keys.every((k) => Number.isFinite(st[k]));
}

test('bicycle model spec is front-mid two-axle single-track', () => {
  assert.equal(VEHICLE_SPEC.layout, 'front-mid');
  assert.ok(VEHICLE_SPEC.a > 0 && VEHICLE_SPEC.b > 0);
  assert.ok(Math.abs(VEHICLE_SPEC.a + VEHICLE_SPEC.b - VEHICLE_SPEC.wheelbase) < 1e-6);
  const circle = frictionCircle(10000, 10000, 8000);
  assert.ok(Math.hypot(circle.fx, circle.fy) <= 8000 + 1e-6);
  assert.ok(torqueCurveNm(4500) > torqueCurveNm(900));
});

test('stable idle while braked', () => {
  const v = new Vehicle();
  const st = settle(v, { throttle: 0, brake: 1, steer: 0, fuelCut: false }, 4);
  assert.ok(st.rpm > 700 && st.rpm < 980, `idle rpm ${st.rpm}`);
  assert.ok(st.speedKmh < 1.5, `speed ${st.speedKmh}`);
  assert.equal(st.finite, true);
  assert.equal(allFinite(st), true);
});

test('throttle accelerates from rest', () => {
  const v = new Vehicle();
  settle(v, { throttle: 0, brake: 1, steer: 0 }, 0.6);
  const before = settle(v, { throttle: 0, brake: 0, steer: 0 }, 0.1);
  const after = settle(v, { throttle: 1, brake: 0, steer: 0 }, 3.5);
  assert.ok(after.speedMs > before.speedMs + 8, `speed ${before.speedMs} -> ${after.speedMs}`);
  assert.ok(after.rpm > VEHICLE_SPEC.idleRpm + 200, `rpm ${after.rpm}`);
  assert.equal(allFinite(after), true);
});

test('braking reduces speed', () => {
  const v = new Vehicle();
  const fast = settle(v, { throttle: 1, brake: 0, steer: 0 }, 3.2);
  const slow = settle(v, { throttle: 0, brake: 1, steer: 0 }, 1.8);
  assert.ok(fast.speedMs > 10, `pre-brake ${fast.speedMs}`);
  assert.ok(slow.speedMs < fast.speedMs * 0.55, `braked ${slow.speedMs}`);
  assert.equal(allFinite(slow), true);
});

test('steering produces yaw on the bicycle model', () => {
  const v = new Vehicle();
  settle(v, { throttle: 1, brake: 0, steer: 0 }, 2.2);
  const yaw0 = v.yaw;
  const st = settle(v, { throttle: 0.45, brake: 0, steer: 1 }, 1.4);
  assert.ok(Math.abs(st.yaw - yaw0) > 0.12, `yaw change ${st.yaw - yaw0}`);
  assert.ok(Math.abs(st.yawRate) > 0.05, `yawRate ${st.yawRate}`);
  assert.equal(allFinite(st), true);
});

test('states stay finite across mixed inputs including fuel cut', () => {
  const v = new Vehicle();
  const script = [
    { t: 0.8, throttle: 0, brake: 1, steer: 0, fuelCut: false },
    { t: 1.5, throttle: 1, brake: 0, steer: 0.4, fuelCut: false },
    { t: 0.6, throttle: 0, brake: 0, steer: -1, fuelCut: true },
    { t: 0.8, throttle: 0.3, brake: 0.4, steer: 0.2, fuelCut: false },
  ];
  for (const s of script) settle(v, s, s.t);
  const st = v.getState();
  assert.equal(allFinite(st), true);
  assert.ok(st.rpm >= 480 && st.rpm <= VEHICLE_SPEC.redlineRpm + 260);
  assert.ok(st.gear >= 1 && st.gear <= VEHICLE_SPEC.gears.length);
  assert.ok(st.fuelCut === true || st.fuelCut === false);
});
