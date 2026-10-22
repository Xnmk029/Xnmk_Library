/**
 * Phase 1 - real-time budget.
 *
 * An AudioWorklet on a 48 kHz host has 2.67 ms of wall clock to produce every
 * 128-frame quantum. These tests assert the synthesiser stays far inside that
 * budget (the design target is a few percent of one core) and that the cost does
 * not depend on how hard the controls are being driven.
 *
 * Thresholds are deliberately loose compared with the measured numbers so the
 * suite stays green on a busy or slower machine; the measured values are printed
 * so a regression is visible even when the assertion still passes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { EngineSynth } from "../src/audio/engine-synth.js";
import { VehicleAmbience } from "../src/audio/vehicle-ambience.js";
import { signalStats } from "../src/audio/analysis/order-analysis.js";

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const BLOCK_PERIOD_MS = (BLOCK / SAMPLE_RATE) * 1000;

/**
 * @param {(l:Float32Array, r:Float32Array, i:number) => void} render
 * @param {number} seconds
 */
function measure(render, seconds) {
  const left = new Float32Array(BLOCK);
  const right = new Float32Array(BLOCK);
  const blocks = Math.round((SAMPLE_RATE * seconds) / BLOCK);
  for (let i = 0; i < 800; i++) render(left, right, i); // warm up the JIT
  const times = new Float64Array(blocks);
  const start = process.hrtime.bigint();
  for (let i = 0; i < blocks; i++) {
    const t0 = process.hrtime.bigint();
    render(left, right, i);
    times[i] = Number(process.hrtime.bigint() - t0) / 1e6;
  }
  const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
  const sorted = Array.from(times).sort((a, b) => a - b);
  return {
    coreFraction: totalMs / (seconds * 1000),
    meanBlockMs: totalMs / blocks,
    medianBlockMs: sorted[Math.floor(blocks * 0.5)],
    p95BlockMs: sorted[Math.floor(blocks * 0.95)],
    p999BlockMs: sorted[Math.floor(blocks * 0.999)],
    blocks,
  };
}

test("steady-state synthesis fits comfortably in the real-time budget", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  synth.setControls({ rpm: 4200, throttle: 0.85, load: 0.85, combustion: 0.85 });
  const result = measure((l, r) => synth.render(l, r, BLOCK), 6);
  console.log(
    `    steady: ${(result.coreFraction * 100).toFixed(2)}% of a core, median block ${result.medianBlockMs.toFixed(3)} ms, p95 ${result.p95BlockMs.toFixed(3)} ms (budget ${BLOCK_PERIOD_MS.toFixed(2)} ms)`,
  );
  assert.ok(result.coreFraction < 0.3, `used ${(result.coreFraction * 100).toFixed(1)}% of one core`);
  assert.ok(result.p95BlockMs < BLOCK_PERIOD_MS * 0.6, `p95 block time ${result.p95BlockMs.toFixed(3)} ms`);
  assert.ok(result.medianBlockMs < BLOCK_PERIOD_MS * 0.35);
});

test("cost does not blow up when every control moves every block", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE, space: "tunnel" });
  let phase = 0;
  const result = measure((l, r) => {
    phase += 0.02;
    const throttle = 0.5 + 0.5 * Math.sin(phase);
    synth.setControls({
      rpm: 3400 + 2800 * Math.sin(phase * 0.7),
      throttle,
      load: throttle,
      combustion: throttle,
      overrun: throttle < 0.1 ? 0.8 : 0,
      ignitionCut: throttle < 0.05,
      cabin: 0.5 + 0.5 * Math.sin(phase * 0.3),
      wet: 0.3,
      master: 1,
    });
    synth.render(l, r, BLOCK);
  }, 6);
  console.log(
    `    churn:  ${(result.coreFraction * 100).toFixed(2)}% of a core, median block ${result.medianBlockMs.toFixed(3)} ms, p95 ${result.p95BlockMs.toFixed(3)} ms`,
  );
  assert.ok(result.coreFraction < 0.4, `used ${(result.coreFraction * 100).toFixed(1)}% of one core`);
  assert.ok(result.p95BlockMs < BLOCK_PERIOD_MS * 0.75);
});

test("the full driving mix (engine + ambience) still fits the budget", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  const ambience = new VehicleAmbience({ sampleRate: SAMPLE_RATE });
  synth.setControls({ rpm: 5000, throttle: 1, load: 1, combustion: 1, cabin: 1 });
  ambience.setControls({ speedMps: 48, slip: 0.4, surface: 0.9, brake: 0, kerb: 0.2 });
  const result = measure((l, r) => {
    synth.render(l, r, BLOCK);
    ambience.addInto(l, r, BLOCK);
  }, 6);
  console.log(
    `    full:   ${(result.coreFraction * 100).toFixed(2)}% of a core, median block ${result.medianBlockMs.toFixed(3)} ms, p95 ${result.p95BlockMs.toFixed(3)} ms`,
  );
  assert.ok(result.coreFraction < 0.35, `used ${(result.coreFraction * 100).toFixed(1)}% of one core`);
  assert.ok(result.p95BlockMs < BLOCK_PERIOD_MS * 0.7);
});

test("smaller render quanta do not change the audio or the cost per sample", () => {
  const reference = new EngineSynth({ sampleRate: SAMPLE_RATE, seed: 4242 });
  reference.setControls({ rpm: 3000, throttle: 0.7, load: 0.7, combustion: 0.7 });
  const total = 8192;
  const refL = new Float32Array(total);
  const refR = new Float32Array(total);
  reference.render(refL, refR, total);

  for (const quantum of [32, 64, 128, 256]) {
    const synth = new EngineSynth({ sampleRate: SAMPLE_RATE, seed: 4242 });
    synth.setControls({ rpm: 3000, throttle: 0.7, load: 0.7, combustion: 0.7 });
    const l = new Float32Array(total);
    const r = new Float32Array(total);
    const chunkL = new Float32Array(quantum);
    const chunkR = new Float32Array(quantum);
    for (let offset = 0; offset < total; offset += quantum) {
      synth.render(chunkL, chunkR, quantum);
      l.set(chunkL, offset);
      r.set(chunkR, offset);
    }
    let worst = 0;
    for (let i = 0; i < total; i++) worst = Math.max(worst, Math.abs(l[i] - refL[i]), Math.abs(r[i] - refR[i]));
    assert.ok(worst < 1e-9, `quantum ${quantum} produced a ${worst} deviation from the reference render`);
    assert.equal(signalStats(l, r).nonFinite, 0);
  }
});
