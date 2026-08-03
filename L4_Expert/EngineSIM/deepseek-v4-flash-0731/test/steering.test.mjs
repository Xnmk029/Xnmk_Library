/**
 * steering.test.mjs -- steering assist validation.
 *
 * Covers the three behaviours that make keyboard/gamepad driving feel
 * controllable: the anti-push grip cap, hands-off spin recovery and the
 * low-speed pass-through that keeps parking untouched.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SteeringAssist } from '../src/sim/steering.mjs';
import { Vehicle, MUSCLE_CAR } from '../src/sim/vehicle.mjs';
import { CROSSPLANE_V8 } from '../src/engine-config.mjs';

const RAD = Math.PI / 180;
const DT = 1 / 120;
const ENV = { gripAt: () => 1 };

function state(over = {}) {
  return {
    vx: 20,
    vy: 0,
    r: 0,
    frontAxle: 1.414,
    rearAxle: 1.532,
    wheelbase: 2.946,
    maxSteer: 0.55,
    frontMu: 1.08,
    frontSat: 0,
    steer: 0,
    airborne: false,
    ...over,
  };
}

test('low speed: assist passes the raw input through untouched', () => {
  const a = new SteeringAssist();
  const s = state({ vx: 0.3, vy: 0.05, r: 0.1 });
  for (const raw of [-1, -0.5, 0, 0.5, 1]) {
    assert.equal(a.update(s, raw, DT), raw);
  }
  assert.equal(a.update(state({ airborne: true, vx: 30 }), 0.8, DT), 0.8);
});

test('high speed: full-lock input is capped near the front grip limit', () => {
  const a = new SteeringAssist();
  const s = state({ vx: 27.8, frontMu: 1.08 });
  let out = 0;
  for (let i = 0; i < 400; i++) out = a.update(s, 1, DT);
  const gripAcc = 1.08 * 9.81;
  const theta = Math.atan2(2.946, (27.8 * 27.8) / gripAcc);
  const expected = (theta / 0.55) * 0.9;
  console.log(`  cap=${a.cap.toFixed(3)} expected=${expected.toFixed(3)} out=${out.toFixed(3)}`);
  assert.ok(Math.abs(a.cap - expected) < 0.02, 'cap settles near the physical limit');
  assert.ok(out > 0.02 && out < 0.15, `full lock must be trimmed hard at 100 km/h (got ${out.toFixed(3)})`);
});

test('straight line: no phantom steering when hands are off', () => {
  const a = new SteeringAssist();
  const s = state({ vx: 25, vy: 0.01, r: 0 });
  let out = 0;
  for (let i = 0; i < 60; i++) out = a.update(s, 0, DT);
  assert.ok(Math.abs(out) < 0.01, `straight-line drift from assist (got ${out.toFixed(3)})`);
});

test('spin recovery: assist catches a yaw-off before it becomes a 360', () => {
  const spin = (assistOn) => {
    const v = new Vehicle(CROSSPLANE_V8, MUSCLE_CAR);
    v.engine.running = true;
    v.engine.rpm = 4000;
    v.engine.omega = (4000 * 2 * Math.PI) / 60;
    v.vx = 22;
    v.vy = -3;
    v.r = 1.0;
    const w = v.vx / MUSCLE_CAR.wheelRadius;
    v.wheelOmega = [w, w, w, w];
    v.assists.steer = assistOn;
    const yaw0 = v.yaw;
    let t = 0;
    let rec = -1;
    let maxDev = 0;
    while (t < 5) {
      v.update(DT, { throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0 }, ENV);
      const dev = Math.abs(((v.yaw - yaw0 + Math.PI) % (2 * Math.PI)) - Math.PI);
      maxDev = Math.max(maxDev, dev);
      if (rec < 0 && Math.abs(v.r) < 0.25 && t > 0.3) rec = t;
      t += DT;
    }
    return { rec, maxDev };
  };
  const on = spin(true);
  const off = spin(false);
  console.log(
    `  assist on: ${on.rec.toFixed(2)}s / ${on.maxDev.toFixed(2)} rad; ` +
      `off: ${off.rec.toFixed(2)}s / ${off.maxDev.toFixed(2)} rad`
  );
  assert.ok(on.rec < 1, `assist must catch the spin fast (got ${on.rec.toFixed(2)}s)`);
  assert.ok(on.maxDev < 0.5, `assist must not sweep the car (got ${on.maxDev.toFixed(2)} rad)`);
  assert.ok(on.rec < off.rec, 'hands-off recovery must be faster with the assist');
});

test('counter-steer widens the anti-push cap', () => {
  const a = new SteeringAssist();
  const straight = state({ vx: 27.8 });
  for (let i = 0; i < 400; i++) a.update(straight, 0, DT);
  const capBefore = a.cap;
  const drift = state({ vx: 20, vy: -3, r: 1.2, frontSat: 1.0, steer: -0.2 });
  let out = 0;
  // Counter-steering right (input -1) against a leftward yaw (+r).
  for (let i = 0; i < 200; i++) out = a.update(drift, -1, DT);
  console.log(`  cap ${capBefore.toFixed(3)} -> output ${out.toFixed(3)}`);
  assert.ok(Math.abs(out) > capBefore, 'counter-steer output must exceed the grip cap');
});

test('slip-angle learner stays bounded and finite', () => {
  const a = new SteeringAssist();
  const s = state({ vx: 20, frontSat: 1.1, steer: 0.3, vy: -1.5, r: 0.6 });
  for (let i = 0; i < 1200; i++) a.update(s, 0, DT);
  console.log(`  learned=${(a.learned / RAD).toFixed(1)} deg cap=${a.cap.toFixed(3)}`);
  assert.ok(a.learned >= 2 * RAD && a.learned <= 14 * RAD, 'learner must stay inside its window');
  assert.ok(Number.isFinite(a.cap) && Number.isFinite(a.learned));
});
