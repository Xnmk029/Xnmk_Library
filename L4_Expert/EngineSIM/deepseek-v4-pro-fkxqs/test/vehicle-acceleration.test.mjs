/**
 * Phase 2 - acceleration: launch, gearing, traction control, rev limiter.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CROSSPLANE_V8 } from "../src/audio/engine-config.js";
import { MUSCLE_CAR } from "../src/vehicle/vehicle-model.js";
import { collectNonFinite, drive, makeVehicle } from "./helpers/drive.mjs";

test("a standing start reaches 100 km/h in a plausible time and keeps accelerating", () => {
  const vehicle = makeVehicle();
  const marks = {};
  const gears = new Set();
  let previousSpeed = -1;
  let dips = 0;
  drive(vehicle, 25, { throttle: 1 }, (car) => {
    const telemetry = car.telemetry();
    for (const target of [50, 100, 150, 200]) {
      if (marks[target] === undefined && telemetry.speedKph >= target) marks[target] = telemetry.time;
    }
    gears.add(telemetry.gearLabel);
    if (telemetry.speedKph < previousSpeed - 0.5) dips++;
    previousSpeed = telemetry.speedKph;
  });
  assert.ok(marks[100] !== undefined, "the car must reach 100 km/h");
  assert.ok(marks[100] > 3.2 && marks[100] < 7.5, `0-100 km/h took ${marks[100].toFixed(2)} s`);
  assert.ok(marks[200] !== undefined && marks[200] < 22, `0-200 km/h took ${marks[200]?.toFixed(2)} s`);
  assert.ok(marks[50] < marks[100] && marks[100] < marks[150], "the marks must be ordered");
  assert.ok(gears.size >= 4, `only used gears ${[...gears].join(",")}`);
  assert.ok(dips === 0, `speed dropped ${dips} times during a full-throttle run`);
  assert.deepEqual(collectNonFinite(vehicle.telemetry()), []);
});

test("traction control keeps the driven axle near its peak slip", () => {
  const vehicle = makeVehicle();
  let maxSlip = 0;
  let interventions = 0;
  drive(vehicle, 6, { throttle: 1 }, (car) => {
    const telemetry = car.telemetry();
    maxSlip = Math.max(maxSlip, Math.abs(telemetry.slipRatioRear));
    if (telemetry.tractionControl > 0.05) interventions++;
  });
  assert.ok(interventions > 20, "traction control must intervene on a full-throttle launch");
  assert.ok(maxSlip < 1.2, `rear slip reached ${maxSlip.toFixed(2)} even with traction control`);
});

test("with traction control disabled the same launch spins the wheels far more", () => {
  const withTc = makeVehicle();
  let slipWith = 0;
  drive(withTc, 4, { throttle: 1 }, (car) => {
    slipWith = Math.max(slipWith, Math.abs(car.telemetry().slipRatioRear));
  });

  const noTc = makeVehicle({ car: { ...MUSCLE_CAR, tractionControl: false } });
  let slipWithout = 0;
  drive(noTc, 4, { throttle: 1 }, (car) => {
    slipWithout = Math.max(slipWithout, Math.abs(car.telemetry().slipRatioRear));
  });
  assert.ok(
    slipWithout > slipWith * 1.5,
    `slip without TC (${slipWithout.toFixed(2)}) should clearly exceed slip with TC (${slipWith.toFixed(2)})`,
  );
  assert.equal(noTc.telemetry().tractionControl, 0);
  assert.deepEqual(collectNonFinite(noTc.telemetry()), []);
});

test("the rev limiter catches the engine in gear and the car keeps driving", () => {
  const vehicle = makeVehicle({ gearIndex: 2, autoShift: false });
  let sawCut = false;
  let peakRpm = 0;
  drive(vehicle, 12, { throttle: 1 }, (car) => {
    const telemetry = car.telemetry();
    peakRpm = Math.max(peakRpm, telemetry.rpm);
    if (telemetry.ignitionCut) sawCut = true;
  });
  assert.ok(sawCut, "first gear at full throttle must hit the limiter");
  assert.ok(peakRpm <= CROSSPLANE_V8.limits.maxRpm);
  assert.ok(peakRpm > CROSSPLANE_V8.limits.redlineRpm);
  assert.ok(vehicle.telemetry().speedKph > 60, "the car should still be moving quickly");
});

test("upshifts and downshifts are sequential, rate limited and rpm-sane", () => {
  const vehicle = makeVehicle({ autoShift: false });
  const seen = [];
  drive(vehicle, 14, { throttle: 1 }, (car) => {
    const telemetry = car.telemetry();
    if (!telemetry.shifting && telemetry.rpm > 6100 && car.powertrain.gearIndex < car.powertrain.topGearIndex) {
      car.shiftUp();
      seen.push({ gear: car.powertrain.gearIndex, rpm: telemetry.rpm });
    }
  });
  assert.ok(seen.length >= 3, `expected several upshifts, saw ${seen.length}`);
  for (let i = 1; i < seen.length; i++) {
    assert.equal(seen[i].gear, seen[i - 1].gear + 1, "gears must be taken in order");
  }
  // Immediately after an upshift the engine must be below the limiter.
  assert.ok(vehicle.telemetry().rpm < CROSSPLANE_V8.limits.revLimitRpm);
  assert.equal(vehicle.powertrain.shiftDown(), true);
});

test("reverse gear drives the car backwards and reports negative speed", () => {
  const vehicle = makeVehicle();
  vehicle.selectGear(0);
  drive(vehicle, 4, { throttle: 0.6 });
  const telemetry = vehicle.telemetry();
  assert.equal(telemetry.gearLabel, "R");
  assert.ok(telemetry.forwardSpeedMps < -2, `reverse speed was ${telemetry.forwardSpeedMps.toFixed(2)} m/s`);
  assert.ok(telemetry.forwardSpeedMps > -20, "reverse must stay slow");
  assert.deepEqual(collectNonFinite(telemetry), []);
});

test("a low-grip surface reduces acceleration without breaking the model", () => {
  const dry = makeVehicle();
  drive(dry, 5, { throttle: 1 });
  const wet = makeVehicle({
    surfaceAt: () => ({ name: "wet", friction: 0.55, rollingScale: 1.1, kerb: 0, offTrack: false }),
  });
  drive(wet, 5, { throttle: 1 });
  assert.ok(
    wet.telemetry().speedKph < dry.telemetry().speedKph * 0.9,
    `wet run reached ${wet.telemetry().speedKph.toFixed(1)} vs dry ${dry.telemetry().speedKph.toFixed(1)} km/h`,
  );
  assert.deepEqual(collectNonFinite(wet.telemetry()), []);
  assert.equal(wet.recoveries, 0);
});
