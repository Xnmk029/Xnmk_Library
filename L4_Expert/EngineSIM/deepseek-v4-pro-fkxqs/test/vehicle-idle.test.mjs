/**
 * Phase 2 - standing still: idle stability, creep, stall resistance, neutral.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CROSSPLANE_V8 } from "../src/audio/engine-config.js";
import { collectNonFinite, drive, makeVehicle } from "./helpers/drive.mjs";

test("the car idles in gear without moving and without stalling", () => {
  const vehicle = makeVehicle();
  drive(vehicle, 8, { throttle: 0, brake: 0 });
  const telemetry = vehicle.telemetry();
  assert.deepEqual(collectNonFinite(telemetry), []);
  assert.ok(
    Math.abs(telemetry.rpm - CROSSPLANE_V8.limits.idleRpm) < 60,
    `idle rpm was ${telemetry.rpm.toFixed(0)}`,
  );
  assert.ok(telemetry.speedKph < 3, `the car crept to ${telemetry.speedKph.toFixed(2)} km/h`);
  assert.equal(telemetry.ignitionCut, false);
  assert.ok(telemetry.clutchEngagement < 0.35, "a real clutch is barely engaged at idle");
  assert.equal(vehicle.recoveries, 0, "no state had to be recovered");
});

test("idle is steady over time (no hunting, no drift)", () => {
  const vehicle = makeVehicle();
  drive(vehicle, 5, { throttle: 0 });
  let min = Infinity;
  let max = -Infinity;
  drive(vehicle, 6, { throttle: 0 }, (car) => {
    min = Math.min(min, car.powertrain.rpm);
    max = Math.max(max, car.powertrain.rpm);
  });
  assert.ok(max - min < 60, `idle band was ${(max - min).toFixed(1)} rpm`);
});

test("holding the brake at idle keeps the car exactly still", () => {
  const vehicle = makeVehicle();
  drive(vehicle, 6, { throttle: 0, brake: 1 });
  const telemetry = vehicle.telemetry();
  assert.equal(telemetry.speedMps, 0);
  assert.equal(vehicle.omegaFront, 0);
  assert.ok(Math.abs(telemetry.rpm - CROSSPLANE_V8.limits.idleRpm) < 60);
  assert.ok(Math.abs(vehicle.x) < 0.5 && Math.abs(vehicle.y) < 0.5, "the car must not slide while parked");
});

test("neutral disconnects the driveline but the engine still revs", () => {
  const vehicle = makeVehicle();
  vehicle.selectGear(1); // neutral
  drive(vehicle, 3, { throttle: 1 });
  const telemetry = vehicle.telemetry();
  assert.equal(telemetry.gearLabel, "N");
  assert.ok(telemetry.speedKph < 1, "neutral must not drive the car");
  assert.ok(telemetry.rpm > 3000, "a free-revving engine climbs quickly");
  assert.ok(telemetry.rpm <= CROSSPLANE_V8.limits.maxRpm);
  assert.equal(collectNonFinite(telemetry).length, 0);
});

test("the engine cannot be stalled by dumping the clutch at rest", () => {
  const vehicle = makeVehicle();
  let minRpm = Infinity;
  drive(vehicle, 4, { throttle: 0, brake: 1, clutch: 0 }, (car) => {
    minRpm = Math.min(minRpm, car.powertrain.rpm);
  });
  assert.ok(minRpm > CROSSPLANE_V8.limits.stallRpm, `rpm dropped to ${minRpm.toFixed(0)}`);
  assert.equal(vehicle.telemetry().engineLoad > 0, true);
});

test("idle rpm recovers after being dragged up by an engine-braking phase", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 30 }, gearIndex: 4, autoShift: false });
  drive(vehicle, 6, { throttle: 0, brake: 0.35 });
  drive(vehicle, 6, { throttle: 0, brake: 1, clutch: 1 });
  const telemetry = vehicle.telemetry();
  assert.ok(telemetry.speedKph < 1);
  assert.ok(Math.abs(telemetry.rpm - CROSSPLANE_V8.limits.idleRpm) < 80, `rpm settled at ${telemetry.rpm.toFixed(0)}`);
});
