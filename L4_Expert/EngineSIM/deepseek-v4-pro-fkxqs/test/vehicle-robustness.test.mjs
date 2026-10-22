/**
 * Phase 2 - robustness: the state must stay finite and bounded no matter what
 * the driver, the host or the surface does.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { Xorshift32 } from "../src/audio/dsp/random.js";
import { TrackLayout } from "../src/track/track-layout.js";
import { VehicleModel } from "../src/vehicle/vehicle-model.js";
import { magicFormula, tireForces } from "../src/vehicle/tire-model.js";
import { collectNonFinite, drive, makeVehicle } from "./helpers/drive.mjs";

test("random input fuzzing keeps every state finite and plausible", () => {
  const rng = new Xorshift32(0xc0ffee);
  const track = new TrackLayout();
  const vehicle = new VehicleModel({ surfaceAt: (x, y) => track.surfaceAt(x, y) });
  const start = track.startPose();
  vehicle.reset({ x: start.x, y: start.y, heading: start.heading, speedMps: 10 });
  let worstSpeed = 0;
  let worstYaw = 0;
  for (let i = 0; i < 24000; i++) {
    if (i % 30 === 0) {
      vehicle.setInput({
        throttle: rng.nextUnit(),
        brake: rng.nextUnit() > 0.75 ? rng.nextUnit() : 0,
        steer: rng.nextBipolar(),
        handbrake: rng.nextUnit() > 0.95 ? 1 : 0,
        clutch: rng.nextUnit() > 0.9 ? rng.nextUnit() : 0,
      });
    }
    if (i % 900 === 0) {
      if (rng.nextUnit() > 0.5) vehicle.shiftUp();
      else vehicle.shiftDown();
    }
    vehicle.update(1 / 120);
    const telemetry = vehicle.telemetry();
    const problems = collectNonFinite(telemetry);
    assert.deepEqual(problems, [], `non-finite state at step ${i}: ${problems.join(", ")}`);
    worstSpeed = Math.max(worstSpeed, telemetry.speedMps);
    worstYaw = Math.max(worstYaw, Math.abs(telemetry.yawRate));
  }
  assert.ok(worstSpeed < 120, `speed reached ${worstSpeed.toFixed(1)} m/s`);
  assert.ok(worstYaw < 25, `yaw rate reached ${worstYaw.toFixed(1)} rad/s`);
  assert.equal(vehicle.recoveries, 0, "no state clamp should have been needed");
});

test("hostile inputs are clamped, not propagated", () => {
  const vehicle = makeVehicle();
  const hostile = [
    { throttle: NaN, brake: NaN, steer: NaN },
    { throttle: Infinity, brake: -Infinity, steer: 1e9 },
    { throttle: -5, brake: 12, steer: -1e9, clutch: NaN, handbrake: NaN },
  ];
  for (const input of hostile) {
    vehicle.setInput(input);
    for (const [key, value] of Object.entries(vehicle.input)) {
      assert.ok(Number.isFinite(value), `input ${key} became ${value}`);
      if (key === "steer") assert.ok(value >= -1 && value <= 1);
      else assert.ok(value >= 0 && value <= 1);
    }
    drive(vehicle, 0.5, input);
    assert.deepEqual(collectNonFinite(vehicle.telemetry()), []);
  }
});

test("a huge or zero time step cannot destabilise the integrator", () => {
  const vehicle = makeVehicle({ pose: { speedMps: 25 }, gearIndex: 4, autoShift: false });
  vehicle.setInput({ throttle: 1, steer: 0.4 });
  for (const dt of [0, -1, NaN, 1e6, 0.5, 1 / 1000]) {
    vehicle.update(dt);
    assert.deepEqual(collectNonFinite(vehicle.telemetry()), [], `dt=${dt} broke the state`);
  }
  assert.ok(vehicle.telemetry().speedMps < 120);
});

test("the result barely depends on the caller's frame rate", () => {
  const run = (frameDt) => {
    const vehicle = makeVehicle({ pose: { speedMps: 20 }, gearIndex: 4, autoShift: false });
    const steps = Math.round(6 / frameDt);
    for (let i = 0; i < steps; i++) {
      vehicle.setInput({ throttle: 0.8, steer: 0.25 });
      vehicle.update(frameDt);
    }
    return vehicle.telemetry();
  };
  const at60 = run(1 / 60);
  const at30 = run(1 / 30);
  const at144 = run(1 / 144);
  const speeds = [at60.speedKph, at30.speedKph, at144.speedKph];
  const spread = Math.max(...speeds) - Math.min(...speeds);
  assert.ok(spread < 3, `speed spread across frame rates was ${spread.toFixed(2)} km/h (${speeds.map((s) => s.toFixed(1)).join(", ")})`);
  const yawSpread = Math.max(at60.yawRate, at30.yawRate, at144.yawRate) - Math.min(at60.yawRate, at30.yawRate, at144.yawRate);
  assert.ok(yawSpread < 0.05, `yaw rate spread was ${yawSpread.toFixed(4)} rad/s`);
});

test("driving off the road costs grip but never breaks the model", () => {
  const track = new TrackLayout();
  const vehicle = new VehicleModel({ surfaceAt: (x, y) => track.surfaceAt(x, y) });
  const start = track.startPose();
  vehicle.reset({ x: start.x, y: start.y, heading: start.heading + 0.45, speedMps: 45 });
  const surfaces = new Set();
  drive(vehicle, 8, { throttle: 1, steer: 0.05 }, (car) => {
    surfaces.add(car.telemetry().surface);
    assert.deepEqual(collectNonFinite(car.telemetry()), []);
  });
  assert.ok(surfaces.size > 1, `expected to leave the asphalt, only saw ${[...surfaces].join(",")}`);
  assert.ok(vehicle.telemetry().speedMps >= 0);
});

test("the tyre model itself is bounded, signed correctly and load sensitive", () => {
  // Peak of the normalised magic formula is exactly at slip = 1.
  assert.ok(Math.abs(magicFormula(1) - 1) < 1e-9);
  assert.ok(magicFormula(0) === 0);
  assert.ok(magicFormula(3) < 1, "force must fall away past the peak");
  assert.ok(magicFormula(0.5) > 0.5, "the rise must be steeper than linear");

  const driving = tireForces({ slipRatio: 0.1, slipAngleRad: 0, verticalLoadN: 6000 });
  assert.ok(driving.fx > 0, "positive slip ratio must push the car forward");
  const braking = tireForces({ slipRatio: -0.1, slipAngleRad: 0, verticalLoadN: 6000 });
  assert.ok(braking.fx < 0);
  const cornering = tireForces({ slipRatio: 0, slipAngleRad: 0.1, verticalLoadN: 6000 });
  assert.ok(cornering.fy < 0, "a positive slip angle must produce a restoring force");

  // Friction circle: combined demand cannot exceed the pure-slip magnitude.
  const pure = tireForces({ slipRatio: 0.115, slipAngleRad: 0, verticalLoadN: 6000 });
  const combined = tireForces({ slipRatio: 0.115, slipAngleRad: 0.13, verticalLoadN: 6000 });
  const pureMagnitude = Math.hypot(pure.fx, pure.fy);
  const combinedMagnitude = Math.hypot(combined.fx, combined.fy);
  assert.ok(combinedMagnitude <= pureMagnitude * 1.02, "combined slip must share one friction budget");
  assert.ok(Math.abs(combined.fx) < Math.abs(pure.fx), "asking for lateral grip must cost longitudinal grip");

  // Load sensitivity: doubling the load gives less than double the force.
  const light = tireForces({ slipRatio: 0.115, slipAngleRad: 0, verticalLoadN: 4000 });
  const heavy = tireForces({ slipRatio: 0.115, slipAngleRad: 0, verticalLoadN: 8000 });
  assert.ok(Math.abs(heavy.fx) < Math.abs(light.fx) * 2, "grip must not scale linearly with load");
  assert.ok(Math.abs(heavy.fx) > Math.abs(light.fx));

  // Degenerate inputs.
  for (const input of [
    { slipRatio: NaN, slipAngleRad: 0, verticalLoadN: 5000 },
    { slipRatio: 0, slipAngleRad: NaN, verticalLoadN: 5000 },
    { slipRatio: 1e9, slipAngleRad: 1e9, verticalLoadN: 1e9 },
    { slipRatio: 0.1, slipAngleRad: 0.1, verticalLoadN: 0 },
    { slipRatio: 0.1, slipAngleRad: 0.1, verticalLoadN: -500 },
    { slipRatio: -1e9, slipAngleRad: -1e9, verticalLoadN: 5000 },
  ]) {
    const forces = tireForces(input);
    const label = JSON.stringify(input);
    assert.ok(Number.isFinite(forces.fx) && Number.isFinite(forces.fy), label);
    // The force can never exceed the friction available for that load, whatever
    // nonsense the slips contain (mu stays below 2 for every load).
    const bound = 2 * Math.max(0, input.verticalLoadN) + 1;
    assert.ok(Math.hypot(forces.fx, forces.fy) <= bound, `${label} produced ${Math.hypot(forces.fx, forces.fy)}`);
    assert.ok(forces.frictionLimitN >= 0 && Number.isFinite(forces.frictionLimitN));
  }
});
