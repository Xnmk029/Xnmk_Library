/**
 * dsp.test.mjs -- automated validation for the V4f engine sound driver.
 *
 *   node --test test/
 *
 * Verifies, quantitatively:
 *   1. Firing geometry falls out of the real firing order.
 *   2. Cross-plane burble (half-order energy) is much stronger than
 *      flat-plane -- the identity is the firing table, not a parameter.
 *   3. Equal-length headers resonate at c/4L (quarter-wave modes only).
 *   4. FDN reverb decays and never blows up.
 *   5. No NaN / Inf, bounded output, no zipper discontinuities on jumps.
 *   6. CPU budget for both quality tiers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import {
  CROSSPLANE_V8,
  FLATPLANE_V8,
  deriveFiringAngles,
  bankIntervals,
  toAcousticConfig,
} from '../src/engine-config.mjs';
import { magnitudeSpectrum, energyAt } from '../src/fft.mjs';

const require = createRequire(import.meta.url);
const DSP = require('../src/engine-dsp.js');
const { EngineSynth, FDNReverb, Duct } = DSP;

const SR = 48000;

/** Render a scripted run through the real synth. */
function renderRun(engine, quality, seconds, script, preset = null, cabin = 0.7) {
  const cfg = toAcousticConfig(engine, { quality });
  const synth = new EngineSynth(SR, cfg);
  const p = preset || { size: 0.9, decay: 0.34, damp: 3200, mix: 0.1, early: 0.18, predelay: 0 };
  synth.setParams({
    reverbSize: p.size,
    reverbDecay: p.decay,
    reverbDamp: p.damp,
    reverbMix: p.mix,
    reverbEarly: p.early,
    reverbPreDelay: p.predelay,
  });
  const n = seconds * SR;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i += 256) {
    const s = script(i / SR);
    synth.setParams({
      rpm: s.rpm,
      throttle: s.throttle,
      load: s.load,
      ignitionCut: s.cut,
      popIntensity: s.pop,
      running: s.running ?? true,
      cabin,
      masterGain: 0.85,
    });
    const cnt = Math.min(256, n - i);
    synth.process(L.subarray(i, i + cnt), R.subarray(i, i + cnt), cnt);
  }
  return { L, R, synth };
}

/** Goertzel: magnitude at one exact frequency. */
function magnitudeAt(sig, freq, sampleRate = SR, from = 0) {
  const w = (2 * Math.PI * freq) / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = from; i < sig.length; i++) {
    const s = sig[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  const n = sig.length - from;
  return Math.hypot(s1 - s2 * Math.cos(w), s2 * Math.sin(w)) / n;
}

test('firing geometry: cross-plane banks are uneven, flat-plane banks are even', () => {
  const cross = deriveFiringAngles(CROSSPLANE_V8.firingOrder, CROSSPLANE_V8.bankOf);
  assert.equal(cross.length, 8);
  assert.deepEqual(bankIntervals(cross, 0), [270, 180, 90, 180]);
  assert.deepEqual(bankIntervals(cross, 1), [90, 180, 270, 180]);

  const flat = deriveFiringAngles(FLATPLANE_V8.firingOrder, FLATPLANE_V8.bankOf);
  assert.deepEqual(bankIntervals(flat, 0), [180, 180, 180, 180]);
  assert.deepEqual(bankIntervals(flat, 1), [180, 180, 180, 180]);
});

test('acoustic config carries the firing table through to the worklet', () => {
  const cfg = toAcousticConfig(CROSSPLANE_V8, { quality: 'lite' });
  assert.equal(cfg.firing.length, 8);
  assert.deepEqual(
    cfg.firing.map((f) => f.angle),
    [0, 90, 180, 270, 360, 450, 540, 630]
  );
  assert.equal(cfg.quality, 'lite');
});

test('cross-plane has far more half-order energy than flat-plane', () => {
  const script = () => ({ rpm: 2400, throttle: 0.85, load: 0.85, cut: false, pop: 0 });
  // Dry + exterior so we measure the exhaust identity, not the room.
  const DRY = { size: 0.9, decay: 0.34, damp: 3200, mix: 0, early: 0.18, predelay: 0 };
  const measure = (engine) => {
    const { L } = renderRun(engine, 'lite', 6, script, DRY, 0);
    const f0 = 40; // 2400 rpm = 40 rev/s
    // Odd half-orders (1.5, 2.5, 3.5) exist only when the per-bank firing
    // intervals are uneven. Normalise by the shared 4th-order level so
    // overall loudness cannot decide the test.
    const half = [1.5, 2.5, 3.5].reduce((a, k) => a + magnitudeAt(L, f0 * k, SR, SR), 0);
    const whole = magnitudeAt(L, f0 * 4, SR, SR);
    return half / whole;
  };
  const cross = measure(CROSSPLANE_V8);
  const flat = measure(FLATPLANE_V8);
  console.log(`  half/whole ratio: cross ${cross.toFixed(4)} vs flat ${flat.toFixed(4)}`);
  assert.ok(cross > flat * 2, `expected cross-plane to dominate half-orders (${cross} vs ${flat})`);
});

test('equal-length header comb resonates at c/4L (quarter-wave modes only)', () => {
  const L = 0.82;
  const c = 540;
  const expected = c / (4 * L); // 164.6 Hz
  const duct = new Duct(SR, L, c, 0.86, -1, 6500);
  const n = SR * 2;
  const sig = new Float64Array(n);
  sig[64] = 1;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = duct.process(sig[i]);
  const at = (f) => magnitudeAt(out, f, SR, SR * 0.05); // let the comb fill
  const peak = at(expected);
  console.log(
    `  header resonance: ${expected.toFixed(1)} Hz = ${peak.toExponential(2)}, ` +
      `3x/2x = ${at(expected * 3).toExponential(2)}/${at(expected * 2).toExponential(2)}`
  );
  assert.ok(peak > at(expected * 0.5) * 1.5, 'no peak at the quarter-wave frequency');
  // Odd-harmonic structure: 3 * c/4L should resonate, 2x should not.
  assert.ok(peak > at(expected * 2) * 1.4, 'even (c/2L) mode should be much weaker');
  assert.ok(at(expected * 3) > at(expected * 2) * 1.4, 'missing odd-harmonic pipe structure');
});

test('FDN reverb decays and never blows up, even at maximum decay', () => {
  const rv = new FDNReverb(SR);
  rv.setDecay(0.94, 900);
  rv.setSize(5);
  const n = SR * 12;
  const mono = new Float64Array(n);
  const out = new Float64Array(n);
  const wet = new Float32Array(2);
  mono[100] = 1;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    rv.process(mono[i], wet);
    const v = wet[0];
    out[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const rms = (a, b) => {
    let e = 0;
    for (let i = a; i < b; i++) e += out[i] * out[i];
    return Math.sqrt(e / (b - a));
  };
  const head = rms(100, 100 + SR);
  const tail = rms(n - 2 * SR, n);
  console.log(`  FDN: peak ${peak.toFixed(2)}, head RMS ${head.toFixed(4)}, tail RMS ${tail.toFixed(6)}`);
  assert.ok(Number.isFinite(peak) && peak < 2, 'FDN impulse response must be finite and bounded');
  assert.ok(tail < head * 0.05, 'tail must decay substantially after 10 s');
  assert.ok(out.every((v) => Number.isFinite(v)), 'no NaN/Inf in FDN');
});

test('random parameter abuse: no NaN/Inf, bounded output, no blow-up over 30 s', () => {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const { L, R } = renderRun(CROSSPLANE_V8, 'high', 30, () => ({
    rpm: 500 + rand() * 6500,
    throttle: rand(),
    load: rand() * 1.4,
    cut: rand() > 0.7,
    pop: rand() * 0.8,
    running: rand() > 0.1,
  }), { size: 3, decay: 0.86, damp: 2400, mix: 0.46, early: 0.22, predelay: 8 });
  let peak = 0;
  let sum = 0;
  let bad = 0;
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    const r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) bad++;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sum += Math.abs(l) + Math.abs(r);
  }
  const rms = sum / (L.length * 2);
  console.log(`  abuse run: peak ${peak.toFixed(3)}, RMS ${rms.toFixed(4)}, bad samples ${bad}`);
  assert.equal(bad, 0, 'no NaN/Inf under parameter abuse');
  assert.ok(peak < 2.5, `output bounded, got peak ${peak}`);
  assert.ok(rms > 1e-5 && rms < 0.6, `sane level, got RMS ${rms}`);
});

test('rpm step is smoothed: no audible zipper discontinuity', () => {
  const { L } = renderRun(CROSSPLANE_V8, 'lite', 3, (t) => ({
    rpm: t < 1 ? 800 : 6000,
    throttle: 0.6,
    load: 0.7,
    cut: false,
    pop: 0,
  }));
  let maxDelta = 0;
  for (let i = 1; i < L.length; i++) maxDelta = Math.max(maxDelta, Math.abs(L[i] - L[i - 1]));
  console.log(`  max sample-to-sample delta after 800->6000 jump: ${maxDelta.toFixed(4)}`);
  assert.ok(maxDelta < 1.0, `step must not create a discontinuity, got ${maxDelta}`);
});

test('CPU budget: 20 s renders well inside realtime for both tiers', () => {
  const script = (t) => ({
    rpm: t < 4 ? 760 + t * 120 : 760 + Math.min(t - 4, 16) * 360,
    throttle: t < 4 ? 0 : 0.8,
    load: t < 4 ? 0.05 : 0.8,
    cut: false,
    pop: 0,
  });
  for (const quality of ['lite', 'high']) {
    // Warm the JIT, then take the best of three runs: OS noise makes any
    // single timing lie.
    renderRun(CROSSPLANE_V8, quality, 2, script);
    let best = Infinity;
    for (let r = 0; r < 3; r++) {
      const t0 = performance.now();
      renderRun(CROSSPLANE_V8, quality, 20, script);
      best = Math.min(best, performance.now() - t0);
    }
    const pct = ((best / 1000 / 20) * 100).toFixed(2);
    console.log(`  bench ${quality}: 20 s audio in ${best.toFixed(0)} ms (best of 3) = ${pct}% of one core`);
    assert.ok(best < 5000, `${quality} 20 s render should take well under 5 s, took ${best.toFixed(0)} ms`);
  }
});
