/**
 * Phase 1 - output safety: finiteness, headroom, clipping, click-free control.
 *
 * The brief forbids NaN, infinities, sustained clipping and audible parameter
 * jumps. Those are properties of the renderer, so they are tested as properties:
 * hostile inputs, extreme operating points and abrupt control steps.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CROSSPLANE_V8 } from "../src/audio/engine-config.js";
import { EngineSynth } from "../src/audio/engine-synth.js";
import { VehicleAmbience } from "../src/audio/vehicle-ambience.js";
import { spacePresetNames } from "../src/audio/dsp/reverb.js";
import { maxSampleDelta, renderStereo, signalStats, warmup } from "../src/audio/analysis/order-analysis.js";

const SAMPLE_RATE = 48000;

function synthAt({ rpm, throttle, space = "trackside", cabin = 0, master = 1 }) {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE, space });
  const load = 0.06 + 0.94 * throttle;
  synth.setControls({ rpm, throttle, load, combustion: load, cabin, master });
  return synth;
}

test("every operating point is finite, inside full scale and free of clipping", () => {
  const points = [
    { rpm: 0, throttle: 0 },
    { rpm: 300, throttle: 0 },
    { rpm: 820, throttle: 0.05 },
    { rpm: 1500, throttle: 0.35 },
    { rpm: 3000, throttle: 1 },
    { rpm: 5000, throttle: 1 },
    { rpm: 6800, throttle: 1 },
    { rpm: 7400, throttle: 1 },
  ];
  for (const point of points) {
    const synth = synthAt(point);
    warmup(synth, 0.4);
    const { left, right } = renderStereo(synth, 1.5);
    const stats = signalStats(left, right);
    assert.equal(stats.nonFinite, 0, `non-finite samples at ${point.rpm} rpm`);
    assert.ok(stats.peak < 1, `peak ${stats.peak.toFixed(4)} at ${point.rpm} rpm must stay below full scale`);
    assert.equal(stats.clipped, 0, `${stats.clipped} clipped samples at ${point.rpm} rpm`);
    assert.equal(synth.getDiagnostics().nonFiniteSamples, 0);
  }
});

test("loudness rises with load but the bus keeps headroom in every space", () => {
  const measured = [];
  for (const space of spacePresetNames()) {
    for (const [rpm, throttle] of [[850, 0.05], [3200, 1], [6600, 1]]) {
      const synth = synthAt({ rpm, throttle, space, master: 1 });
      warmup(synth, 0.5);
      const stats = signalStats(...Object.values(pick(renderStereo(synth, 1.2))));
      assert.ok(stats.peak < 0.96, `${space} @ ${rpm} rpm peaked at ${stats.peak.toFixed(3)}`);
      assert.equal(stats.clipped, 0);
      assert.ok(stats.rmsDb > -45 && stats.rmsDb < -6, `${space} @ ${rpm} rpm rms ${stats.rmsDb.toFixed(1)} dBFS`);
      if (space === "trackside") measured.push({ rpm, rmsDb: stats.rmsDb });
    }
  }
  assert.ok(measured[1].rmsDb > measured[0].rmsDb + 4, "wide open throttle must be clearly louder than idle");
  assert.ok(measured[2].rmsDb > measured[0].rmsDb + 4, "redline must be clearly louder than idle");
});

test("an insane master gain is absorbed by the limiter instead of clipping", () => {
  const synth = synthAt({ rpm: 5200, throttle: 1, master: 4, space: "tunnel" });
  warmup(synth, 0.6);
  const { left, right } = renderStereo(synth, 2);
  const stats = signalStats(left, right);
  assert.equal(stats.nonFinite, 0);
  assert.equal(stats.clipped, 0);
  assert.ok(stats.peak < 1);
  assert.ok(synth.limiter.reduction > 0.05, "the limiter must actually be working here");
});

test("hostile control values cannot produce NaN or unbounded output", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  const hostile = [
    { rpm: NaN, throttle: NaN, load: NaN, combustion: NaN },
    { rpm: Infinity, throttle: Infinity, master: Infinity },
    { rpm: -12000, throttle: -4, load: -1, wet: -3 },
    { rpm: 1e12, throttle: 1e9, master: 1e9, overrun: 1e9 },
    { rpm: 4000, throttle: 0.7, cabin: NaN, exhaustGain: NaN, intakeGain: NaN },
  ];
  for (const controls of hostile) {
    synth.setControls(controls);
    const { left, right } = renderStereo(synth, 0.35);
    const stats = signalStats(left, right);
    assert.equal(stats.nonFinite, 0, `non-finite output for ${JSON.stringify(controls)}`);
    assert.ok(stats.peak < 1, `peak ${stats.peak} for ${JSON.stringify(controls)}`);
    for (const [key, value] of Object.entries(synth.controls)) {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `control ${key} became ${value}`);
    }
  }
});

test("abrupt control steps do not click (no sample-to-sample discontinuity)", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE, space: "cockpit" });
  synth.setControls({ rpm: 820, throttle: 0.05, load: 0.06, combustion: 0.06, cabin: 1, master: 0.4 });
  warmup(synth, 0.6);
  const before = renderStereo(synth, 0.6);
  const baselineLow = Math.max(maxSampleDelta(before.left), maxSampleDelta(before.right));

  // Slam everything at once: rpm x8, full throttle, new space, 5x master gain.
  synth.setControls({ rpm: 6600, throttle: 1, load: 1, combustion: 1, cabin: 0, master: 2, space: "tunnel" });
  const during = renderStereo(synth, 0.6);
  const after = renderStereo(synth, 0.6);
  const baselineHigh = Math.max(maxSampleDelta(after.left), maxSampleDelta(after.right));
  const jump = Math.max(maxSampleDelta(during.left), maxSampleDelta(during.right));
  const baseline = Math.max(baselineLow, baselineHigh);
  assert.ok(Number.isFinite(jump) && jump > 0);
  assert.ok(
    jump < baseline * 2.5,
    `step change produced a ${jump.toFixed(4)} jump against a ${baseline.toFixed(4)} steady-state baseline`,
  );

  // And the reverse direction (lift off, back to the cabin, quiet again).
  synth.setControls({ rpm: 900, throttle: 0, load: 0.06, combustion: 0.06, cabin: 1, master: 0.4, space: "cockpit" });
  const back = renderStereo(synth, 0.6);
  const jumpBack = Math.max(maxSampleDelta(back.left), maxSampleDelta(back.right));
  assert.ok(jumpBack < baseline * 2.5, `lift-off produced a ${jumpBack.toFixed(4)} jump`);
  assert.equal(signalStats(back.left, back.right).nonFinite, 0);
});

test("ignition cut and overrun crackle stay bounded and audible", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  synth.setControls({ rpm: 4200, throttle: 1, load: 1, combustion: 1 });
  warmup(synth, 0.5);
  const fired = renderStereo(synth, 0.8);
  const firedStats = signalStats(fired.left, fired.right);

  synth.setControls({ throttle: 0, load: 0.06, combustion: 0, ignitionCut: true, overrun: 0.9 });
  synth.resetDiagnostics();
  const cut = renderStereo(synth, 0.8);
  const cutStats = signalStats(cut.left, cut.right);
  const diagnostics = synth.getDiagnostics();

  assert.ok(diagnostics.firingEvents > 100, "the crank keeps turning during a cut");
  assert.ok(diagnostics.crackles > 5, "overrun must produce crackle events");
  assert.ok(cutStats.rmsDb < firedStats.rmsDb - 3, "cutting fuel must make the engine quieter");
  assert.equal(cutStats.nonFinite, 0);
  assert.equal(cutStats.clipped, 0);
  assert.ok(cutStats.peak < 1);
});

test("vehicle ambience is self-bounded and cannot make the mix clip", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE, space: "tunnel" });
  synth.setControls({ rpm: 6600, throttle: 1, load: 1, combustion: 1, master: 3 });
  const ambience = new VehicleAmbience({ sampleRate: SAMPLE_RATE });
  ambience.setControls({ speedMps: 75, slip: 1, surface: 0.2, brake: 1, kerb: 1, gain: 2 });
  const frames = SAMPLE_RATE;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  synth.render(left, right, frames);
  ambience.addInto(left, right, frames);
  const stats = signalStats(left, right);
  assert.equal(stats.nonFinite, 0);
  assert.equal(stats.clipped, 0, `${stats.clipped} clipped samples in the full mix`);
  assert.ok(stats.peak < 1);
  const diagnostics = ambience.getDiagnostics();
  assert.equal(diagnostics.nonFinite, 0);
  assert.ok(diagnostics.peak <= diagnostics.ceiling + 1e-6, `ambience peaked at ${diagnostics.peak}`);

  // Ambience alone must also be silent when the car is parked.
  const idleLeft = new Float32Array(2048);
  const idleRight = new Float32Array(2048);
  const parked = new VehicleAmbience({ sampleRate: SAMPLE_RATE });
  parked.setControls({ speedMps: 0, slip: 0, brake: 0, kerb: 0 });
  parked.addInto(idleLeft, idleRight, 2048);
  assert.ok(signalStats(idleLeft, idleRight).peak < 0.02, "a parked car makes no road noise");
});

test("rendering is deterministic for a given seed", () => {
  const make = () => {
    const synth = new EngineSynth({ sampleRate: SAMPLE_RATE, seed: 12345 });
    synth.setControls({ rpm: 3500, throttle: 0.8, load: 0.8, combustion: 0.8 });
    warmup(synth, 0.2);
    return renderStereo(synth, 0.5);
  };
  const a = make();
  const b = make();
  assert.deepEqual(Array.from(a.left.subarray(0, 4096)), Array.from(b.left.subarray(0, 4096)));
  assert.deepEqual(Array.from(a.right.subarray(0, 4096)), Array.from(b.right.subarray(0, 4096)));

  const different = new EngineSynth({ sampleRate: SAMPLE_RATE, seed: 999 });
  different.setControls({ rpm: 3500, throttle: 0.8, load: 0.8, combustion: 0.8 });
  warmup(different, 0.2);
  const c = renderStereo(different, 0.5);
  let differs = false;
  for (let i = 0; i < 4096; i++) {
    if (Math.abs(c.left[i] - a.left[i]) > 1e-9) {
      differs = true;
      break;
    }
  }
  assert.ok(differs, "a different seed must produce different turbulence");
});

test("a long render keeps its state warm without leaking (no per-sample allocation)", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  synth.setControls({ rpm: 4000, throttle: 0.9, load: 0.9, combustion: 0.9 });
  const block = 128;
  const left = new Float32Array(block);
  const right = new Float32Array(block);
  for (let i = 0; i < 2000; i++) synth.render(left, right, block);
  if (typeof globalThis.gc === "function") globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  const blocks = Math.round((SAMPLE_RATE * 10) / block);
  for (let i = 0; i < blocks; i++) synth.render(left, right, block);
  const growth = process.memoryUsage().heapUsed - before;
  assert.ok(growth < 4 * 1024 * 1024, `heap grew by ${(growth / 1024).toFixed(0)} KiB over 10 s of audio`);
  assert.equal(synth.getDiagnostics().nonFiniteSamples, 0);
  assert.ok(CROSSPLANE_V8.cylinderCount === 8);
});

function pick({ left, right }) {
  return { left, right };
}
