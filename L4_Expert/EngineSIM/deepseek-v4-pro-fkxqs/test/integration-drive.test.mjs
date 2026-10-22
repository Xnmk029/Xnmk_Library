/**
 * Phase 2 - integration: the car drives the engine, the engine drives the audio.
 *
 * This is the test that proves the modules really are one product: the rpm the
 * tyres and gearbox produce is the rpm the synthesiser tracks, the audio stays
 * inside its bounds while the car is being thrown around, and the whole stack
 * (physics + audio) still fits in a real-time budget.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { EngineSynth } from "../src/audio/engine-synth.js";
import { VehicleAmbience } from "../src/audio/vehicle-ambience.js";
import {
  ambienceControlsFromTelemetry,
  engineControlsFromTelemetry,
  spaceForCamera,
} from "../src/audio/telemetry-mapping.js";
import { measureOrderFrequency, signalStats } from "../src/audio/analysis/order-analysis.js";
import { LapTimer, TrackLayout } from "../src/track/track-layout.js";
import { AutoDriver } from "../src/vehicle/auto-driver.js";
import { VehicleModel } from "../src/vehicle/vehicle-model.js";
import { collectNonFinite } from "./helpers/drive.mjs";

const SAMPLE_RATE = 48000;
const PHYSICS_DT = 1 / 120;
const BLOCK = 128;

/** Build a complete stack: track + car + driver + engine audio + ambience. */
function createStack({ space = "trackside" } = {}) {
  const track = new TrackLayout();
  const vehicle = new VehicleModel({ surfaceAt: (x, y) => track.surfaceAt(x, y) });
  const start = track.startPose();
  vehicle.reset({ x: start.x, y: start.y, heading: start.heading, speedMps: 14 });
  const driver = new AutoDriver(track);
  const timer = new LapTimer(track);
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE, space });
  const ambience = new VehicleAmbience({ sampleRate: SAMPLE_RATE });
  return { track, vehicle, driver, timer, synth, ambience };
}

/**
 * Run the stack for `seconds`, rendering audio in blocks and stepping physics
 * exactly like the browser app does.
 */
function runStack(stack, seconds, { camera = "chase", onFrame = null, record = true } = {}) {
  const { vehicle, driver, timer, track, synth, ambience } = stack;
  const frames = Math.round(seconds * SAMPLE_RATE);
  const left = record ? new Float32Array(frames) : new Float32Array(BLOCK);
  const right = record ? new Float32Array(frames) : new Float32Array(BLOCK);
  const blockL = new Float32Array(BLOCK);
  const blockR = new Float32Array(BLOCK);
  const blockSeconds = BLOCK / SAMPLE_RATE;
  const rpmTrace = [];
  let physicsAccumulator = 0;
  for (let offset = 0; offset < frames; offset += BLOCK) {
    physicsAccumulator += blockSeconds;
    while (physicsAccumulator >= PHYSICS_DT) {
      driver.drive(vehicle, PHYSICS_DT);
      physicsAccumulator -= PHYSICS_DT;
    }
    const telemetry = vehicle.telemetry();
    const near = track.nearest(vehicle.x, vehicle.y);
    timer.update(blockSeconds, near.distance, { valid: Math.abs(near.lateral) < near.halfWidth * 3 });
    synth.setControls(engineControlsFromTelemetry(telemetry, { camera }));
    ambience.setControls(ambienceControlsFromTelemetry(telemetry, { camera }));
    const count = Math.min(BLOCK, frames - offset);
    synth.render(blockL, blockR, count);
    ambience.addInto(blockL, blockR, count);
    if (record) {
      left.set(blockL.subarray(0, count), offset);
      right.set(blockR.subarray(0, count), offset);
    }
    rpmTrace.push(telemetry.rpm);
    if (onFrame) onFrame(telemetry, near);
  }
  return { left, right, rpmTrace };
}

test("the auto driver completes laps on the road with a finite state", () => {
  const stack = createStack();
  let worstLateral = 0;
  let offTrackFrames = 0;
  let frames = 0;
  const problems = [];
  runStack(stack, 170, {
    record: false,
    onFrame: (telemetry, near) => {
      frames++;
      worstLateral = Math.max(worstLateral, Math.abs(near.lateral));
      if (telemetry.offTrack) offTrackFrames++;
      if (problems.length === 0) problems.push(...collectNonFinite(telemetry));
    },
  });
  const snapshot = stack.timer.snapshot();
  assert.deepEqual(problems, []);
  assert.ok(snapshot.lapCount >= 1, `completed ${snapshot.lapCount} laps`);
  assert.ok(snapshot.bestLapTime > 40 && snapshot.bestLapTime < 150, `best lap ${snapshot.bestLapTime.toFixed(2)} s`);
  assert.ok(worstLateral < stack.track.halfWidthM + 4, `ran ${worstLateral.toFixed(2)} m from the centreline`);
  assert.ok(offTrackFrames / frames < 0.05, `off track for ${((offTrackFrames / frames) * 100).toFixed(1)}% of the run`);
  assert.equal(stack.vehicle.recoveries, 0);
});

test("audio driven by the car stays inside its bounds for a whole lap", () => {
  const stack = createStack();
  const { left, right } = runStack(stack, 30, { camera: "chase" });
  const stats = signalStats(left, right);
  assert.equal(stats.nonFinite, 0);
  assert.equal(stats.clipped, 0, `${stats.clipped} clipped samples`);
  assert.ok(stats.peak < 1);
  assert.ok(stats.rmsDb > -30 && stats.rmsDb < -6, `mix rms ${stats.rmsDb.toFixed(1)} dBFS`);
  const diagnostics = stack.synth.getDiagnostics();
  assert.equal(diagnostics.nonFiniteSamples, 0);
  assert.ok(diagnostics.firingEvents > 1000);
  assert.equal(stack.ambience.getDiagnostics().nonFinite, 0);
});

test("the 4th order in the audio follows the rpm the gearbox produces", () => {
  // Cruise control in top gear: a nearly constant rpm makes the spectrum sharp.
  const track = new TrackLayout();
  const vehicle = new VehicleModel({ surfaceAt: (x, y) => track.surfaceAt(x, y) });
  const start = track.startPose();
  vehicle.reset({ x: start.x, y: start.y, heading: start.heading, speedMps: 45 });
  vehicle.setAutoShift(false);
  vehicle.powertrain.gearIndex = 7;
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  const targetSpeed = 45;
  let throttle = 0.3;

  const step = (seconds, buffer) => {
    const frames = Math.round(seconds * SAMPLE_RATE);
    const blockL = new Float32Array(BLOCK);
    const blockR = new Float32Array(BLOCK);
    const rpms = [];
    for (let offset = 0; offset < frames; offset += BLOCK) {
      // Simple cruise controller so the rpm holds still while we measure.
      throttle = Math.min(1, Math.max(0, throttle + (targetSpeed - vehicle.vx) * 0.004));
      vehicle.setInput({ throttle, steer: 0 });
      vehicle.update(BLOCK / SAMPLE_RATE);
      const telemetry = vehicle.telemetry();
      synth.setControls(engineControlsFromTelemetry(telemetry, { camera: "chase" }));
      const count = Math.min(BLOCK, frames - offset);
      synth.render(blockL, blockR, count);
      if (buffer) {
        buffer.left.set(blockL.subarray(0, count), offset);
        buffer.right.set(blockR.subarray(0, count), offset);
      }
      rpms.push(telemetry.rpm);
    }
    return rpms;
  };

  step(3, null); // settle the cruise and the pipes
  const frames = Math.round(2.5 * SAMPLE_RATE);
  const buffer = { left: new Float32Array(frames), right: new Float32Array(frames) };
  const rpms = step(2.5, buffer);
  const meanRpm = rpms.reduce((a, b) => a + b, 0) / rpms.length;
  const drift = (Math.max(...rpms) - Math.min(...rpms)) / meanRpm;
  assert.ok(drift < 0.04, `rpm drifted ${(drift * 100).toFixed(2)}% during the measurement`);

  const mono = new Float64Array(frames);
  for (let i = 0; i < frames; i++) mono[i] = (buffer.left[i] + buffer.right[i]) * 0.5;
  const measurement = measureOrderFrequency(mono, SAMPLE_RATE, meanRpm, 4, 0.05);
  assert.ok(
    Math.abs(measurement.relativeError) < 0.02,
    `order 4 was at ${measurement.measuredHz.toFixed(2)} Hz, expected ${measurement.expectedHz.toFixed(2)} Hz for ${meanRpm.toFixed(0)} rpm`,
  );
  // And the audio is still clean at cruise.
  const stats = signalStats(buffer.left, buffer.right);
  assert.equal(stats.nonFinite, 0);
  assert.equal(stats.clipped, 0);
});

test("lifting off after a hard pull produces overrun crackle, upshifts cut ignition", () => {
  const stack = createStack();
  const { vehicle, synth } = stack;
  vehicle.setAutoShift(true);
  const blockL = new Float32Array(BLOCK);
  const blockR = new Float32Array(BLOCK);
  let cutFrames = 0;
  let overrunPeak = 0;
  for (let i = 0; i < 900; i++) {
    const throttle = i < 500 ? 1 : 0;
    vehicle.setInput({ throttle, brake: 0, steer: 0 });
    vehicle.update(BLOCK / SAMPLE_RATE);
    const telemetry = vehicle.telemetry();
    if (telemetry.ignitionCut) cutFrames++;
    overrunPeak = Math.max(overrunPeak, telemetry.overrun);
    synth.setControls(engineControlsFromTelemetry(telemetry));
    synth.render(blockL, blockR, BLOCK);
  }
  const diagnostics = synth.getDiagnostics();
  assert.ok(cutFrames > 5, "closing the throttle at speed must cut fuel");
  assert.ok(overrunPeak > 0.2, `overrun intensity only reached ${overrunPeak.toFixed(2)}`);
  assert.ok(diagnostics.crackles > 3, `only ${diagnostics.crackles} crackles`);
  assert.equal(diagnostics.nonFiniteSamples, 0);
});

test("physics plus audio together fit the real-time budget", () => {
  const stack = createStack();
  runStack(stack, 2, { record: false }); // warm up
  const seconds = 6;
  const start = process.hrtime.bigint();
  runStack(stack, seconds, { record: false });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  const fraction = elapsedMs / (seconds * 1000);
  console.log(`    full stack: ${(fraction * 100).toFixed(2)}% of one core (physics 120 Hz + stereo audio 48 kHz)`);
  assert.ok(fraction < 0.45, `the whole stack used ${(fraction * 100).toFixed(1)}% of one core`);
});

test("the telemetry -> audio mapping clamps hostile values", () => {
  const hostile = {
    rpm: NaN,
    throttle: 5,
    engineLoad: -2,
    combustion: NaN,
    overrun: Infinity,
    speedMps: NaN,
    tyreUtilisation: Infinity,
    wheelSlip: -3,
    surfaceFriction: NaN,
    brake: 12,
    kerb: NaN,
    ignitionCut: "yes",
  };
  const engine = engineControlsFromTelemetry(hostile, { camera: "cockpit", master: NaN });
  for (const [key, value] of Object.entries(engine)) {
    if (typeof value === "number") assert.ok(Number.isFinite(value), `${key} became ${value}`);
  }
  assert.equal(engine.throttle, 1);
  assert.equal(engine.load, 0);
  assert.equal(engine.rpm, 0);
  assert.equal(engine.cabin, 1);
  assert.equal(engine.ignitionCut, true);
  assert.equal(engine.master, 1);

  const ambience = ambienceControlsFromTelemetry(hostile, { gain: NaN });
  for (const [key, value] of Object.entries(ambience)) {
    assert.ok(Number.isFinite(value), `${key} became ${value}`);
  }
  assert.ok(ambience.slip >= 0 && ambience.slip <= 1);
  assert.equal(ambience.brake, 1);
  assert.equal(ambience.speedMps, 0);

  assert.equal(spaceForCamera("cockpit"), "cockpit");
  assert.equal(spaceForCamera("chase"), "trackside");
  assert.equal(spaceForCamera("nonsense"), "trackside");
  assert.equal(spaceForCamera("chase", { tunnel: true }), "tunnel");

  // A synth must survive being fed the clamped output of hostile telemetry.
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  synth.setControls(engine);
  const l = new Float32Array(BLOCK);
  const r = new Float32Array(BLOCK);
  for (let i = 0; i < 50; i++) synth.render(l, r, BLOCK);
  assert.equal(signalStats(l, r).nonFinite, 0);
});
