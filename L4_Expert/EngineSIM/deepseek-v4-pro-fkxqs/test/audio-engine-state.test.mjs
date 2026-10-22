/**
 * Phase 1 - engine operating states: idle, throttle response, load, rev limiter
 * ignition cut and deceleration fuel cut.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CROSSPLANE_V8 } from "../src/audio/engine-config.js";
import { EngineController, throttleToLoad, torqueShape } from "../src/audio/engine-state.js";

const DT = 1 / 240;

function run(controller, seconds, inputs) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) controller.stepStandalone(DT, inputs);
  return controller;
}

test("idle is stable and lands on the configured idle speed", () => {
  const engine = new EngineController(CROSSPLANE_V8);
  run(engine, 8, { throttle: 0 });
  const target = CROSSPLANE_V8.limits.idleRpm;
  assert.ok(Math.abs(engine.rpm - target) < 25, `idle rpm ${engine.rpm} should be within 25 of ${target}`);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 240 * 4; i++) {
    engine.stepStandalone(DT, { throttle: 0 });
    min = Math.min(min, engine.rpm);
    max = Math.max(max, engine.rpm);
  }
  assert.ok(max - min < 20, `idle must not hunt (band was ${(max - min).toFixed(1)} rpm)`);
  assert.ok(engine.effectiveThrottle > 0.01 && engine.effectiveThrottle < 0.2, "idle governor uses a small bypass");
  assert.equal(engine.ignitionCut, false);
  assert.equal(engine.stalled, false);
});

test("idle recovers from being dragged up or down", () => {
  for (const startRpm of [350, 2600]) {
    const engine = new EngineController(CROSSPLANE_V8);
    engine.rpm = startRpm;
    run(engine, 10, { throttle: 0 });
    assert.ok(Math.abs(engine.rpm - CROSSPLANE_V8.limits.idleRpm) < 30, `failed to recover from ${startRpm}`);
  }
});

test("idle survives a parasitic load without stalling", () => {
  const engine = new EngineController(CROSSPLANE_V8);
  run(engine, 10, { throttle: 0, loadTorqueNm: 60 });
  assert.ok(engine.rpm > CROSSPLANE_V8.limits.idleRpm - 40, "governor must hold idle under load");
  assert.ok(engine.effectiveThrottle > 0.1, "governor must open the bypass further under load");
  assert.equal(engine.stalled, false);
});

test("torque curve is finite, positive and peaks where the config says", () => {
  const engine = new EngineController(CROSSPLANE_V8);
  let best = { rpm: 0, torque: -Infinity };
  for (let rpm = 700; rpm <= CROSSPLANE_V8.limits.maxRpm; rpm += 50) {
    const t = engine.indicatedTorqueAt(rpm, 1);
    assert.ok(Number.isFinite(t) && t > 0);
    assert.ok(Number.isFinite(engine.frictionTorqueAt(rpm, 1)));
    if (t > best.torque) best = { rpm, torque: t };
  }
  assert.ok(Math.abs(best.rpm - CROSSPLANE_V8.torque.peakTorqueRpm) < 400);
  assert.ok(torqueShape(CROSSPLANE_V8, CROSSPLANE_V8.limits.maxRpm) < torqueShape(CROSSPLANE_V8, CROSSPLANE_V8.torque.peakTorqueRpm));
  // Throttle -> load mapping: closed plate still leaks, wide open is 1.0.
  assert.ok(throttleToLoad(0) > 0 && throttleToLoad(0) < 0.05);
  assert.equal(throttleToLoad(1), 1);
  assert.ok(throttleToLoad(0.5) < 0.5, "throttle response is progressive, not linear");
});

test("wide open throttle revs to the limiter and the limiter cuts ignition", () => {
  const engine = new EngineController(CROSSPLANE_V8);
  run(engine, 2, { throttle: 0 });
  let sawCut = false;
  let peak = 0;
  let toggles = 0;
  let previous = false;
  for (let i = 0; i < 240 * 6; i++) {
    engine.stepStandalone(DT, { throttle: 1 });
    peak = Math.max(peak, engine.rpm);
    if (engine.ignitionCut) sawCut = true;
    if (engine.ignitionCut !== previous) {
      toggles++;
      previous = engine.ignitionCut;
    }
  }
  assert.ok(sawCut, "the rev limiter must cut ignition");
  assert.ok(peak <= CROSSPLANE_V8.limits.maxRpm, "rpm must never exceed the hard maximum");
  assert.ok(peak > CROSSPLANE_V8.limits.redlineRpm, "wide open throttle must reach past the redline");
  assert.ok(toggles > 6, "a rev limiter bounces (cut/uncut) rather than latching");
  assert.equal(engine.cutReason === "rev-limiter" || engine.cutReason === "none", true);
});

test("closing the throttle at speed triggers deceleration fuel cut and overrun", () => {
  const engine = new EngineController(CROSSPLANE_V8);
  engine.rpm = 4200;
  engine.update(DT, { throttle: 1, rpm: 4200 });
  for (let i = 0; i < 30; i++) engine.update(DT, { throttle: 1, rpm: 4200 });
  assert.equal(engine.fuelCut, false);
  let overrunPeak = 0;
  for (let i = 0; i < 240; i++) {
    engine.update(DT, { throttle: 0, rpm: 4200 });
    overrunPeak = Math.max(overrunPeak, engine.overrunIntensity);
  }
  assert.equal(engine.fuelCut, true);
  assert.equal(engine.cutReason, "overrun");
  assert.equal(engine.indicatedTorqueNm, 0, "no fuel means no indicated torque");
  assert.ok(engine.netTorqueNm < 0, "overrun must brake the engine");
  assert.ok(overrunPeak > 0.2, "overrun crackle intensity must build up");
  // Re-opening the throttle restores combustion immediately.
  engine.update(DT, { throttle: 0.5, rpm: 4200 });
  assert.equal(engine.fuelCut, false);
  assert.ok(engine.combustionEnergy > 0.2);
});

test("controller state stays finite under hostile inputs", () => {
  const engine = new EngineController(CROSSPLANE_V8);
  const hostile = [
    { throttle: NaN, rpm: NaN },
    { throttle: Infinity, rpm: -5000 },
    { throttle: -3, rpm: 1e9 },
    { throttle: 0.5, rpm: undefined },
  ];
  for (const inputs of hostile) {
    for (let i = 0; i < 50; i++) engine.update(DT, inputs);
    const snapshot = engine.snapshot();
    for (const [key, value] of Object.entries(snapshot)) {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `${key} became ${value}`);
    }
    assert.ok(engine.rpm >= 0 && engine.rpm <= CROSSPLANE_V8.limits.maxRpm);
  }
});
