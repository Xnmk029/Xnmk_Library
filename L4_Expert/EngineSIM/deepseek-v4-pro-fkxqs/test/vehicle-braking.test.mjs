/**
 * Phase 2 - braking: stopping distance, deceleration limits, ABS, handbrake.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { MUSCLE_CAR } from "../src/vehicle/vehicle-model.js";
import { collectNonFinite, drive, makeVehicle } from "./helpers/drive.mjs";

function brakeToStop(vehicle, { brake = 1, clutch = 1, maxSeconds = 12, monitor = null } = {}) {
  const startX = vehicle.x;
  const startY = vehicle.y;
  let stopTime = -1;
  let peakDecel = 0;
  let stopX = vehicle.x;
  let stopY = vehicle.y;
  drive(vehicle, maxSeconds, { throttle: 0, brake, clutch }, (car) => {
    const telemetry = car.telemetry();
    peakDecel = Math.min(peakDecel, telemetry.longitudinalG);
    if (monitor) monitor(telemetry, car);
    if (stopTime < 0 && telemetry.speedMps < 0.05) {
      stopTime = telemetry.time;
      stopX = car.x;
      stopY = car.y;
    }
  });
  return {
    distance: Math.hypot(stopX - startX, stopY - startY),
    stopTime,
    peakDecel,
  };
}

test("100-0 km/h stops in a realistic distance at a realistic deceleration", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 27.78 }, gearIndex: 4, autoShift: false });
  const result = brakeToStop(vehicle);
  assert.ok(result.stopTime > 0, "the car must come to a stop");
  assert.ok(result.distance > 26 && result.distance < 48, `stopping distance was ${result.distance.toFixed(1)} m`);
  assert.ok(result.peakDecel < -0.9, `peak deceleration was only ${result.peakDecel.toFixed(2)} g`);
  assert.ok(result.peakDecel > -1.6, "deceleration must respect the friction limit");
  assert.equal(vehicle.telemetry().speedMps, 0);
  assert.deepEqual(collectNonFinite(vehicle.telemetry()), []);
});

test("stopping distance grows with the square of speed", () => {
  const distances = [];
  for (const speed of [15, 25, 35]) {
    const vehicle = makeVehicle({ pose: { speedMps: speed }, gearIndex: 5, autoShift: false });
    distances.push({ speed, ...brakeToStop(vehicle, { maxSeconds: 15 }) });
  }
  for (let i = 1; i < distances.length; i++) {
    assert.ok(distances[i].distance > distances[i - 1].distance, "faster means further");
  }
  // Compare against the constant-deceleration prediction v^2/(2a) with a ~ 1.15 g.
  for (const entry of distances) {
    const ideal = (entry.speed * entry.speed) / (2 * 1.15 * 9.80665);
    const ratio = entry.distance / ideal;
    assert.ok(ratio > 0.75 && ratio < 1.6, `${entry.speed} m/s: distance ratio ${ratio.toFixed(2)}`);
  }
});

test("ABS modulates brake pressure instead of locking the wheels", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 30 }, gearIndex: 5, autoShift: false });
  let minAbs = 1;
  let worstSlip = 0;
  drive(vehicle, 3, { throttle: 0, brake: 1, clutch: 1 }, (car) => {
    const telemetry = car.telemetry();
    minAbs = Math.min(minAbs, telemetry.absFront, telemetry.absRear);
    if (telemetry.speedMps > 3) worstSlip = Math.min(worstSlip, telemetry.slipRatioFront);
  });
  assert.ok(minAbs < 0.9, "the ABS must actually release pressure");
  assert.ok(worstSlip > -0.75, `front slip reached ${worstSlip.toFixed(2)} - the wheel locked solid`);
});

test("with ABS disabled the wheels lock, and ABS stops at least as short", () => {
  const abs = makeVehicle({ pose: { speedMps: 30 }, gearIndex: 5, autoShift: false });
  const absResult = brakeToStop(abs);

  const locked = makeVehicle({
    pose: { speedMps: 30 },
    gearIndex: 5,
    autoShift: false,
    car: { ...MUSCLE_CAR, antiLockBrakes: false },
  });
  let lockedSlip = 0;
  const lockedResult = brakeToStop(locked, {
    monitor: (telemetry) => {
      if (telemetry.speedMps > 3) lockedSlip = Math.min(lockedSlip, telemetry.slipRatioFront);
    },
  });

  assert.ok(lockedSlip < -0.7, `without ABS the wheel should lock (worst slip ${lockedSlip.toFixed(2)})`);
  assert.ok(lockedResult.stopTime > 0, "the locked car must still stop");
  assert.ok(
    absResult.distance <= lockedResult.distance + 1,
    `ABS (${absResult.distance.toFixed(1)} m) should not be worse than locked wheels (${lockedResult.distance.toFixed(1)} m)`,
  );
  assert.equal(locked.telemetry().absFront, 1, "a car without ABS never releases pressure");
});

test("engine braking alone slows the car down", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 30 }, gearIndex: 4, autoShift: false });
  drive(vehicle, 6, { throttle: 0, brake: 0, clutch: 0 });
  const telemetry = vehicle.telemetry();
  assert.ok(telemetry.speedMps < 26, `engine braking left the car at ${telemetry.speedKph.toFixed(1)} km/h`);
  assert.ok(telemetry.speedMps > 2, "engine braking must not stop the car dead");
  assert.equal(telemetry.cutReason === "overrun" || telemetry.cutReason === "none", true);
});

test("the handbrake locks the rear axle and the car stays finite", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 18 }, gearIndex: 3, autoShift: false });
  drive(vehicle, 4, { throttle: 0, handbrake: 1, clutch: 1, steer: 0.3 });
  const telemetry = vehicle.telemetry();
  assert.ok(telemetry.speedKph < 40);
  assert.deepEqual(collectNonFinite(telemetry), []);
  assert.ok(Math.abs(telemetry.yawRate) < 12);
});

test("a braked car does not roll backwards or creep", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 8 }, gearIndex: 2, autoShift: false });
  brakeToStop(vehicle, { maxSeconds: 6 });
  const stoppedX = vehicle.x;
  drive(vehicle, 4, { throttle: 0, brake: 1 });
  assert.ok(Math.abs(vehicle.x - stoppedX) < 0.05, "a car on the brakes must stay put");
  assert.ok(vehicle.telemetry().forwardSpeedMps >= 0, "it must never roll backwards under braking");
});
