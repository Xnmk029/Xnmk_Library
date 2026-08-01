/**
 * vehicle.test.mjs -- dual-track chassis validation.
 *
 *   node --test test/vehicle.test.mjs
 *
 * Verifies: launch acceleration + traction control, braking distance,
 * cornering grip, straight-line stability, rev limiter, gearbox logic and
 * NaN-free behaviour under 30 s of abusive random controls.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vehicle, MUSCLE_CAR } from '../src/sim/vehicle.mjs';
import { Engine } from '../src/sim/engine.mjs';
import { Drivetrain, MUSCLE_DRIVETRAIN } from '../src/sim/drivetrain.mjs';
import { CROSSPLANE_V8, FLATPLANE_V8 } from '../src/engine-config.mjs';

const DT = 1 / 120;
const ENV = { gripAt: () => 1 };
const NO_CTRL = { throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0 };

function fresh(engineDef = CROSSPLANE_V8) {
  const v = new Vehicle(engineDef, MUSCLE_CAR);
  v.engine.startCranking();
  // Let the starter spin the engine up.
  v.update(0.05, NO_CTRL, ENV);
  return v;
}

function setRolling(v, speedKph, rpm = 4000) {
  v.engine.running = true;
  v.engine.rpm = rpm;
  v.engine.omega = (rpm * 2 * Math.PI) / 60;
  v.vx = speedKph / 3.6;
  const w = v.vx / MUSCLE_CAR.wheelRadius;
  v.wheelOmega = [w, w, w, w];
}

test('0-100 km/h launch: traction control on is fast, off smokes the rears', () => {
  const v = fresh();
  let t = 0;
  let t100 = -1;
  let maxSlip = 0;
  while (t < 15) {
    v.update(DT, { ...NO_CTRL, throttle: 1 }, ENV);
    maxSlip = Math.max(maxSlip, Math.abs(v.wheelSlip[2]), Math.abs(v.wheelSlip[3]));
    if (t100 < 0 && v.speedKph >= 100) t100 = t;
    t += DT;
  }
  console.log(`  TC on:  0-100 = ${t100.toFixed(2)} s, max rear slip ${maxSlip.toFixed(2)}`);
  assert.ok(t100 > 3.5 && t100 < 7.5, `plausible 0-100 with TC (got ${t100.toFixed(2)} s)`);
  assert.ok(maxSlip < 0.8, `TC should keep rear slip modest (got ${maxSlip.toFixed(2)})`);

  const v2 = fresh();
  v2.assists.tc = false;
  t = 0;
  maxSlip = 0;
  while (t < 15) {
    v2.update(DT, { ...NO_CTRL, throttle: 1 }, ENV);
    maxSlip = Math.max(maxSlip, Math.abs(v2.wheelSlip[2]), Math.abs(v2.wheelSlip[3]));
    t += DT;
  }
  console.log(`  TC off: 0-100 = ${v2.speedKph >= 100 ? 'n/a' : ''}... max rear slip ${maxSlip.toFixed(2)}`);
  assert.ok(maxSlip > 0.8, `without TC a 645 Nm V8 must spin the rears (got ${maxSlip.toFixed(2)})`);
});

test('braking from 100 km/h lands in the 30-55 m window', () => {
  const v = fresh();
  setRolling(v, 100);
  let dist = 0;
  let t = 0;
  while (t < 15 && v.speedKph > 1) {
    v.update(DT, { ...NO_CTRL, brake: 1 }, ENV);
    dist += Math.abs(v.vx) * DT;
    t += DT;
  }
  console.log(`  100->1 km/h: ${dist.toFixed(1)} m in ${t.toFixed(2)} s`);
  assert.ok(dist > 30 && dist < 55, `braking distance plausible (got ${dist.toFixed(1)} m)`);
});

test('cornering reaches the tyre peak (>= 0.85 g) and stays stable', () => {
  // Full lock: the steering assist trims the input to exactly the front
  // grip limit, so the tyres still reach their peak without being buried
  // deep past it the way an uncapped full-lock input would.
  const run = (assistOn) => {
    const v = fresh();
    setRolling(v, 100);
    v.assists.steer = assistOn;
    let peak = 0;
    let sat = 0;
    let t = 0;
    while (t < 6) {
      v.update(DT, { ...NO_CTRL, throttle: 0.25, steer: 1 }, ENV);
      peak = Math.max(peak, Math.abs(v.lateralG));
      sat = Math.max(sat, v.tires[0].saturation, v.tires[1].saturation);
      assert.ok(Math.abs(v.r) < 4, `yaw rate must stay sane (got ${Math.abs(v.r).toFixed(2)} rad/s)`);
      t += DT;
    }
    return { peak, sat, v };
  };
  const on = run(true);
  const off = run(false);
  console.log(
    `  peak lateral g at 100 km/h: assist ${on.peak.toFixed(2)} (front sat ${on.sat.toFixed(2)}) / ` +
      `raw ${off.peak.toFixed(2)} (front sat ${off.sat.toFixed(2)})`
  );
  const peak = on.peak;
  assert.ok(peak >= 0.85, `tyres with mu 1.08/1.16 should exceed 0.85 g (got ${peak.toFixed(2)})`);
  assert.ok(on.sat < off.sat, `anti-push cap must keep the front nearer its peak (${on.sat.toFixed(2)} vs ${off.sat.toFixed(2)})`);
});

test('straight-line stability: no lateral drift at 100 km/h', () => {
  const v = fresh();
  setRolling(v, 100);
  let maxVy = 0;
  let t = 0;
  while (t < 5) {
    v.update(DT, { ...NO_CTRL, throttle: 0.2 }, ENV);
    maxVy = Math.max(maxVy, Math.abs(v.vy));
    t += DT;
  }
  console.log(`  |vy| max ${(maxVy * 3.6).toFixed(2)} km/h, yaw drift ${(v.yaw * 57.3).toFixed(2)} deg`);
  assert.ok(maxVy < 1, `straight line should stay straight (got ${maxVy.toFixed(3)} m/s)`);
  assert.ok(Math.abs(v.yaw) < 0.02, `yaw drift negligible (got ${v.yaw.toFixed(4)} rad)`);
});

test('rev limiter: spark cuts and rpm never runs away', () => {
  const e = new Engine(CROSSPLANE_V8);
  e.running = true;
  e.rpm = CROSSPLANE_V8.limiterRpm - 100;
  e.omega = (e.rpm * 2 * Math.PI) / 60;
  let maxRpm = 0;
  let sawCut = false;
  for (let i = 0; i < 12000; i++) {
    e.throttlePedal = 1;
    e.update(1 / 1000, 0);
    maxRpm = Math.max(maxRpm, e.rpm);
    sawCut ||= e.sparkCut;
  }
  console.log(`  limiter: max rpm ${maxRpm.toFixed(0)}, spark cut seen: ${sawCut}`);
  assert.ok(sawCut, 'limiter must cut spark');
  assert.ok(maxRpm < CROSSPLANE_V8.limiterRpm + 900, `rpm runaway (got ${maxRpm.toFixed(0)})`);
});

test('gearbox: ratios, shift sequencing and reverse', () => {
  const dt = new Drivetrain(MUSCLE_DRIVETRAIN, CROSSPLANE_V8);
  assert.equal(dt.gearLabel(), '1');
  assert.ok(dt.ratio(2) > dt.ratio(3), 'gears get taller');
  assert.ok(dt.ratio(-1) < 0, 'reverse is negative');
  dt.requestGear(4);
  const s = {
    engineOmega: 300,
    wheelOmega: 40,
    throttle: 0.5,
    speed: 20,
    brake: 0,
    engineInertia: CROSSPLANE_V8.inertia,
    axleInertia: MUSCLE_CAR.wheelInertiaRear * 2,
  };
  for (let i = 0; i < 200; i++) dt.update(1 / 1000, s);
  assert.equal(dt.gear, 4, 'gear engages after the shift window');
  assert.ok(Number.isFinite(dt.wheelTorque), 'wheel torque finite');
});

test('30 s of abusive random controls: finite, bounded, no explosion', () => {
  const v = fresh();
  v.assists.tc = false;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let bad = 0;
  let maxR = 0;
  let maxSpeed = 0;
  let t = 0;
  while (t < 30) {
    const c = {
      throttle: rnd(),
      brake: rnd() * 0.8,
      steer: (rnd() - 0.5) * 1.2,
      handbrake: rnd() > 0.9 ? 1 : 0,
      clutch: 0,
    };
    v.update(1 / 60, c, ENV);
    for (const q of [v.x, v.z, v.vx, v.vy, v.r, v.engine.rpm, ...v.wheelOmega]) {
      if (!Number.isFinite(q)) bad++;
    }
    maxR = Math.max(maxR, Math.abs(v.r));
    maxSpeed = Math.max(maxSpeed, v.speedKph);
    t += 1 / 60;
  }
  console.log(`  abuse: bad ${bad}, max yaw rate ${(maxR * 57.3).toFixed(0)} deg/s, max speed ${maxSpeed.toFixed(0)} km/h`);
  assert.equal(bad, 0, 'no NaN/Inf under abuse');
  assert.ok(maxR < 15, `yaw rate bounded by tyre saturation (got ${maxR.toFixed(2)} rad/s)`);
});

test('flat-plane crank still drives (same chassis, different soundtrack)', () => {
  const v = fresh(FLATPLANE_V8);
  let t = 0;
  let t100 = -1;
  while (t < 15) {
    v.update(DT, { ...NO_CTRL, throttle: 1 }, ENV);
    if (t100 < 0 && v.speedKph >= 100) t100 = t;
    t += DT;
  }
  console.log(`  flat-plane 0-100 = ${t100.toFixed(2)} s`);
  assert.ok(t100 > 3.5 && t100 < 8.5, 'flat-plane config drives plausibly too');
});
