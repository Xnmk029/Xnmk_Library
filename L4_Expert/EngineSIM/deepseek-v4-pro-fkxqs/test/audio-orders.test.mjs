/**
 * Phase 1 - engine orders and rpm tracking (the objective acceptance criteria).
 *
 * "Order n" means n * rpm / 60 Hz. For a four-stroke V8 the firing frequency is
 * the 4th order, so every combustion harmonic must sit at an exact integer
 * multiple of it, and it must follow rpm without drift.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CROSSPLANE_V8, FLATPLANE_V8 } from "../src/audio/engine-config.js";
import { EngineSynth } from "../src/audio/engine-synth.js";
import { firingFrequencyHz, orderToHz } from "../src/audio/firing.js";
import {
  dominantOrder,
  dominantPeakAsFiringMultiple,
  halfOrderEnergyDb,
  measureOrderFrequency,
  orderLevelsDb,
  renderStereo,
  warmup,
} from "../src/audio/analysis/order-analysis.js";

const SAMPLE_RATE = 48000;

/** Render a steady operating point after letting the pipes settle. */
function steady({ rpm, throttle = 1, config = CROSSPLANE_V8, seconds = 3, sampleRate = SAMPLE_RATE, space = "trackside" }) {
  const synth = new EngineSynth({ sampleRate, config, space });
  const load = 0.06 + 0.94 * throttle;
  synth.setControls({ rpm, throttle, load, combustion: load, wet: 0.2 });
  warmup(synth, 0.7);
  const rendered = renderStereo(synth, seconds);
  return { synth, ...rendered, diagnostics: synth.getDiagnostics() };
}

test("firing frequency reported by the synth is rpm/15 (4th order) for a V8", () => {
  for (const rpm of [900, 2400, 5000]) {
    const { diagnostics } = steady({ rpm, seconds: 0.2 });
    assert.ok(Math.abs(diagnostics.firingHz - rpm / 15) < 0.5, `firing Hz ${diagnostics.firingHz} vs ${rpm / 15}`);
    assert.ok(Math.abs(diagnostics.mainOrderHz - orderToHz(4, rpm)) < 0.5);
  }
});

test("the 4th order dominates the low-order band at every operating point", () => {
  const points = [
    { rpm: 850, throttle: 0.06 },
    { rpm: 1400, throttle: 1 },
    { rpm: 2200, throttle: 1 },
    { rpm: 3000, throttle: 1 },
    { rpm: 4000, throttle: 0.6 },
    { rpm: 5200, throttle: 1 },
    { rpm: 6300, throttle: 1 },
  ];
  for (const point of points) {
    const { mono } = steady(point);
    const levels = orderLevelsDb(mono, SAMPLE_RATE, point.rpm);
    const best = dominantOrder(levels, 0.5, 6);
    assert.equal(best.order, 4, `at ${point.rpm} rpm the strongest order below the 6th was ${best.order}`);
    // ... and it must be clearly above the neighbouring non-harmonic content.
    const reference = Math.max(levels.get(3.5), levels.get(4.5));
    assert.ok(best.db - reference > 8, `4th order only ${(best.db - reference).toFixed(1)} dB above its sidebands`);
  }
});

test("the loudest component below 1.2 kHz is always an exact firing harmonic", () => {
  for (const point of [
    { rpm: 1000, throttle: 0.5 },
    { rpm: 1800, throttle: 1 },
    { rpm: 2600, throttle: 1 },
    { rpm: 3400, throttle: 0.8 },
    { rpm: 4600, throttle: 1 },
    { rpm: 5800, throttle: 1 },
  ]) {
    const { mono } = steady(point);
    const fire = firingFrequencyHz(point.rpm, CROSSPLANE_V8.cylinderCount);
    const peak = dominantPeakAsFiringMultiple(mono, SAMPLE_RATE, fire, 1200);
    assert.ok(peak.nearestInteger >= 1, "the peak must be a firing harmonic, not sub-harmonic noise");
    assert.ok(
      peak.deviation < 0.02,
      `at ${point.rpm} rpm the peak (${peak.frequencyHz.toFixed(1)} Hz) is ${peak.multiple.toFixed(3)}x the firing frequency`,
    );
  }
});

test("order 4 tracks rpm with better than 0.3% error over the whole range", () => {
  const sweep = [800, 1200, 1600, 2200, 2800, 3400, 4000, 4600, 5200, 5800, 6400];
  const errors = [];
  for (const rpm of sweep) {
    const { mono } = steady({ rpm, throttle: 0.85, seconds: 2.8 });
    const measurement = measureOrderFrequency(mono, SAMPLE_RATE, rpm, 4);
    errors.push(Math.abs(measurement.relativeError));
    assert.ok(
      Math.abs(measurement.relativeError) < 0.003,
      `rpm ${rpm}: expected ${measurement.expectedHz.toFixed(2)} Hz, measured ${measurement.measuredHz.toFixed(2)} Hz`,
    );
    assert.ok(Math.abs(measurement.errorHz) < 1.5, "absolute order-4 error must stay below 1.5 Hz");
  }
  const worst = Math.max(...errors);
  assert.ok(worst < 0.003, `worst relative error ${(worst * 100).toFixed(3)}%`);
});

test("higher firing harmonics (8th, 12th, 16th) are present and land where they should", () => {
  for (const rpm of [2200, 3000, 3600]) {
    const { mono } = steady({ rpm, throttle: 1 });
    const levels = orderLevelsDb(mono, SAMPLE_RATE, rpm, [6.5, 8, 9.5, 10.5, 12, 13.5, 14.5, 16, 17.5]);
    for (const order of [8, 12, 16]) {
      const measurement = measureOrderFrequency(mono, SAMPLE_RATE, rpm, order, 0.03);
      assert.ok(
        Math.abs(measurement.relativeError) < 0.001,
        `order ${order} at ${rpm} rpm sits at ${measurement.measuredHz.toFixed(2)} Hz instead of ${measurement.expectedHz.toFixed(2)} Hz`,
      );
      // Compare against the mean energy of the two half-order neighbours: a
      // harmonic must stand above the local non-harmonic content.
      const neighbourEnergy =
        (Math.pow(10, levels.get(order - 1.5) / 10) + Math.pow(10, levels.get(order + 1.5) / 10)) / 2;
      const margin = levels.get(order) - 10 * Math.log10(neighbourEnergy);
      assert.ok(margin > 5, `order ${order} at ${rpm} rpm is only ${margin.toFixed(1)} dB above its neighbours`);
    }
  }
});

test("rpm changes move the orders with it (a sweep really sweeps)", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  synth.setControls({ rpm: 1200, throttle: 1, load: 1, combustion: 1, wet: 0.15 });
  warmup(synth, 0.5);
  const measured = [];
  for (const rpm of [1200, 2400, 3600, 4800]) {
    synth.setControls({ rpm });
    // let the slew limiter and smoothers arrive, then measure
    warmup(synth, 0.35);
    const { mono } = renderStereo(synth, 2.2);
    measured.push(measureOrderFrequency(mono, SAMPLE_RATE, rpm, 4).measuredHz);
  }
  const rpms = [1200, 2400, 3600, 4800];
  for (let i = 1; i < measured.length; i++) {
    const expectedRatio = rpms[i] / rpms[i - 1];
    const actualRatio = measured[i] / measured[i - 1];
    assert.ok(
      Math.abs(actualRatio - expectedRatio) < 0.02,
      `order 4 moved by x${actualRatio.toFixed(4)} while rpm moved by x${expectedRatio.toFixed(4)}`,
    );
  }
  const ratios = measured.map((hz, i) => hz / orderToHz(4, rpms[i]));
  for (const ratio of ratios) assert.ok(Math.abs(ratio - 1) < 0.01, `ratio ${ratio.toFixed(4)}`);
});

test("cross-plane crank produces the half-order rumble a flat-plane crank cannot", () => {
  for (const rpm of [1600, 3000, 4800]) {
    const cross = steady({ rpm, throttle: 1, config: CROSSPLANE_V8 });
    const flat = steady({ rpm, throttle: 1, config: FLATPLANE_V8 });
    const crossLevels = orderLevelsDb(cross.left, SAMPLE_RATE, rpm);
    const flatLevels = orderLevelsDb(flat.left, SAMPLE_RATE, rpm);
    const crossHalf = halfOrderEnergyDb(crossLevels);
    const flatHalf = halfOrderEnergyDb(flatLevels);
    assert.ok(
      crossHalf - flatHalf > 12,
      `at ${rpm} rpm the cross-plane half-order advantage was only ${(crossHalf - flatHalf).toFixed(1)} dB`,
    );
    // The 1.5th and 2.5th orders are the strongest half orders of a 90 deg crank.
    assert.ok(crossLevels.get(1.5) - flatLevels.get(1.5) > 8);
    assert.ok(crossLevels.get(2.5) - flatLevels.get(2.5) > 8);
    // Both layouts keep the same firing order, so the 4th order is unaffected.
    assert.ok(Math.abs(crossLevels.get(4) - flatLevels.get(4)) < 4);
  }
});

test("order tracking is independent of the host sample rate", () => {
  for (const sampleRate of [44100, 48000]) {
    const { mono } = steady({ rpm: 3000, throttle: 1, sampleRate, seconds: 2.5 });
    const measurement = measureOrderFrequency(mono, sampleRate, 3000, 4);
    assert.ok(Math.abs(measurement.relativeError) < 0.003, `${sampleRate} Hz host: ${measurement.measuredHz.toFixed(2)} Hz`);
  }
});
