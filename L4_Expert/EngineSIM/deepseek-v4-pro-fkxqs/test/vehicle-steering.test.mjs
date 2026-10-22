/**
 * Phase 2 - steering and lateral behaviour: steady-state cornering, balance,
 * friction limits, symmetry and steering-rate limits.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { MUSCLE_CAR } from "../src/vehicle/vehicle-model.js";
import { MUSCLE_TIRE } from "../src/vehicle/tire-model.js";
import { collectNonFinite, drive, makeVehicle } from "./helpers/drive.mjs";

const GRAVITY = 9.80665;

/** Hold a constant steering input at a constant-ish speed and report the steady state. */
function steadyCorner({ steer, speedMps = 25, seconds = 8, throttle = 0.3 }) {
  const vehicle = makeVehicle({ pose: { speedMps }, gearIndex: 5, autoShift: false });
  let peakLateralG = 0;
  drive(vehicle, seconds, { throttle, steer }, (car) => {
    peakLateralG = Math.max(peakLateralG, Math.abs(car.telemetry().lateralG));
  });
  const telemetry = vehicle.telemetry();
  const radius = Math.abs(telemetry.yawRate) > 1e-4 ? telemetry.speedMps / Math.abs(telemetry.yawRate) : Infinity;
  return { vehicle, telemetry, radius, peakLateralG };
}

test("steering left yaws left, steering right yaws right", () => {
  const left = steadyCorner({ steer: 0.35 });
  const right = steadyCorner({ steer: -0.35 });
  assert.ok(left.telemetry.yawRate > 0.05, `left yaw rate was ${left.telemetry.yawRate.toFixed(3)}`);
  assert.ok(right.telemetry.yawRate < -0.05, `right yaw rate was ${right.telemetry.yawRate.toFixed(3)}`);
  assert.ok(left.telemetry.lateralG > 0, "left turn must produce a leftward lateral force");
  assert.ok(right.telemetry.lateralG < 0);
  // The car is symmetric, so mirrored input must give a mirrored response.
  assert.ok(Math.abs(left.telemetry.yawRate + right.telemetry.yawRate) < 0.05);
  assert.ok(Math.abs(left.radius - right.radius) < 3, `radii ${left.radius.toFixed(1)} vs ${right.radius.toFixed(1)} m`);
});

test("more steering gives a tighter radius, monotonically", () => {
  const radii = [0.15, 0.3, 0.5, 0.8].map((steer) => steadyCorner({ steer }).radius);
  for (let i = 1; i < radii.length; i++) {
    assert.ok(radii[i] < radii[i - 1], `radius did not shrink: ${radii.map((r) => r.toFixed(1)).join(" -> ")}`);
  }
  assert.ok(radii[radii.length - 1] < 60, "full lock at speed should give a tight corner");
  for (const radius of radii) assert.ok(Number.isFinite(radius) && radius > 5);
});

test("lateral acceleration never exceeds what the tyres can produce", () => {
  const worst = [0.3, 0.6, 1].map((steer) => steadyCorner({ steer, speedMps: 40, throttle: 0.5 }));
  for (const entry of worst) {
    assert.ok(
      entry.peakLateralG < MUSCLE_TIRE.peakFriction * 1.12,
      `peak lateral ${entry.peakLateralG.toFixed(2)} g exceeds the tyre's ${MUSCLE_TIRE.peakFriction} mu`,
    );
    assert.deepEqual(collectNonFinite(entry.telemetry), []);
  }
  const best = Math.max(...worst.map((entry) => entry.peakLateralG));
  assert.ok(best > 0.85, `the car should be able to pull at least 0.85 g, saw ${best.toFixed(2)}`);
});

test("the car understeers: the front axle carries more slip than the rear", () => {
  const corner = steadyCorner({ steer: 0.5, speedMps: 30, throttle: 0.35, seconds: 10 });
  const front = Math.abs(corner.telemetry.slipAngleFront);
  const rear = Math.abs(corner.telemetry.slipAngleRear);
  assert.ok(front > rear, `front slip ${(front * 57.3).toFixed(1)} deg vs rear ${(rear * 57.3).toFixed(1)} deg`);
  // Understeer gradient: measured steer must exceed the Ackermann angle.
  const ackermann = MUSCLE_CAR.wheelbaseM / corner.radius;
  assert.ok(
    Math.abs(corner.telemetry.steerAngleRad) > ackermann,
    `steer ${corner.telemetry.steerAngleRad.toFixed(4)} rad vs Ackermann ${ackermann.toFixed(4)} rad`,
  );
});

test("the steady-state radius agrees with the kinematic bicycle relation", () => {
  const corner = steadyCorner({ steer: 0.3, speedMps: 25, throttle: 0.3, seconds: 10 });
  const { steerAngleRad, slipAngleFront, slipAngleRear } = corner.telemetry;
  // delta = L/R + alphaF - alphaR for a single-track model in steady state.
  const predicted = MUSCLE_CAR.wheelbaseM / corner.radius + Math.abs(slipAngleFront) - Math.abs(slipAngleRear);
  assert.ok(
    Math.abs(Math.abs(steerAngleRad) - predicted) < 0.02,
    `steer ${Math.abs(steerAngleRad).toFixed(4)} vs prediction ${predicted.toFixed(4)} rad`,
  );
});

test("steering is rate limited and speed sensitive", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 20 }, gearIndex: 4, autoShift: false });
  const rates = [];
  let previous = 0;
  drive(vehicle, 1, { throttle: 0.2, steer: 1 }, (car) => {
    rates.push(Math.abs(car.steerAngle - previous) / (1 / 120));
    previous = car.steerAngle;
  });
  const worst = Math.max(...rates);
  assert.ok(worst <= MUSCLE_CAR.steerRateRadPerSec * 1.05, `steering moved at ${worst.toFixed(2)} rad/s`);

  const slow = makeVehicle({ pose: { speedMps: 5 }, gearIndex: 2, autoShift: false });
  drive(slow, 2, { throttle: 0.1, steer: 1 });
  const fast = makeVehicle({ pose: { speedMps: 55 }, gearIndex: 6, autoShift: false });
  drive(fast, 2, { throttle: 0.1, steer: 1 });
  assert.ok(
    Math.abs(fast.steerAngle) < Math.abs(slow.steerAngle),
    `speed-sensitive lock: ${fast.steerAngle.toFixed(3)} at 55 m/s vs ${slow.steerAngle.toFixed(3)} at 5 m/s`,
  );
  // At walking pace the driver gets (almost) the whole mechanical lock; the
  // remaining loss is exactly the speed-sensitivity term.
  assert.ok(
    Math.abs(slow.steerAngle - slow.steerAuthorityRad()) < 0.01,
    `slow-speed lock ${slow.steerAngle.toFixed(4)} vs authority ${slow.steerAuthorityRad().toFixed(4)}`,
  );
  assert.ok(slow.steerAuthorityRad() > MUSCLE_CAR.maxSteerAngleRad * 0.9);
  assert.ok(fast.steerAuthorityRad() < MUSCLE_CAR.maxSteerAngleRad * 0.6);
});

test("the steering-angle inverse used by the auto driver is consistent", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 30 }, gearIndex: 5, autoShift: false });
  const authority = vehicle.steerAuthorityRad();
  for (const angle of [-0.4, -0.1, 0, 0.05, 0.3]) {
    const input = vehicle.steerInputForAngle(angle);
    assert.ok(Math.abs(input) <= 1);
    if (Math.abs(angle) < authority) {
      assert.ok(Math.abs(input * authority - angle) < 1e-9, "the inverse must be exact inside the lock range");
    }
  }
});

test("a slide is survivable: extreme input leaves the state finite and bounded", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 35 }, gearIndex: 3, autoShift: false });
  drive(vehicle, 6, (t) => ({ throttle: 1, steer: t > 1 ? Math.sin(t * 3) : 1, handbrake: t > 4 ? 1 : 0 }));
  const telemetry = vehicle.telemetry();
  assert.deepEqual(collectNonFinite(telemetry), []);
  assert.ok(Math.abs(telemetry.yawRate) < 25);
  assert.ok(Math.abs(telemetry.lateralG) < 3);
  assert.ok(telemetry.speedMps >= 0 && telemetry.speedMps < 120);
  assert.ok(Math.abs(telemetry.position.x) < 1e5 && Math.abs(telemetry.position.y) < 1e5);
});

test("cornering at the limit slows the car (tyres share one friction budget)", () => {
  const straight = makeVehicle({ pose: { speedMps: 40 }, gearIndex: 6, autoShift: false });
  drive(straight, 4, { throttle: 0.45, steer: 0 });
  const cornering = makeVehicle({ pose: { speedMps: 40 }, gearIndex: 6, autoShift: false });
  drive(cornering, 4, { throttle: 0.45, steer: 0.55 });
  assert.ok(
    cornering.telemetry().speedMps < straight.telemetry().speedMps - 1,
    `cornering ${cornering.telemetry().speedKph.toFixed(1)} vs straight ${straight.telemetry().speedKph.toFixed(1)} km/h`,
  );
  assert.ok(cornering.telemetry().tyreUtilisation > straight.telemetry().tyreUtilisation);
});
