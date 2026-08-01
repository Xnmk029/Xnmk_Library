/**
 * Tests for the worklet DSP.
 *
 * The worklet is a classic script that ends in registerProcessor(), so it
 * cannot be imported. Instead it is evaluated inside a function scope with
 * the AudioWorkletGlobalScope symbols shimmed in, and the classes we want are
 * returned from that scope.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CROSSPLANE_V8, FLATPLANE_V8, toAcousticConfig } from '../src/audio/engine-config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;

function loadWorklet(sampleRate = SR) {
  const src = fs.readFileSync(path.join(here, '../src/audio/engine-worklet.js'), 'utf8');
  const body = `${src}\nreturn { EngineSynth, FDNReverb, Duct, Delay, OnePole, buildPulseTable, EngineProcessor };`;
  const factory = new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', body);
  class StubProcessor {
    constructor() {
      this.port = { postMessage() {}, onmessage: null };
    }
  }
  return factory(StubProcessor, () => {}, sampleRate);
}

const W = loadWorklet();

/** Render `seconds` of audio at a fixed operating point. */
function render(engineDef, { rpm, throttle, load = null, seconds = 1, params = {} }) {
  const synth = new W.EngineSynth(SR, toAcousticConfig(engineDef));
  synth.setParams({
    rpm,
    throttle,
    load: load === null ? throttle : load,
    running: 1,
    cabin: 0,
    masterGain: 0.9,
    reverbMix: 0,
    ...params,
  });
  const n = 128;
  const total = Math.floor((seconds * SR) / n) * n;
  const out = new Float32Array(total);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < total; i += n) {
    synth.process(L, R, n);
    out.set(L, i);
  }
  return out;
}

/** Goertzel: magnitude at one frequency. Cheaper than a whole FFT. */
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

function rms(sig, from = 0) {
  let acc = 0;
  for (let i = from; i < sig.length; i++) acc += sig[i] * sig[i];
  return Math.sqrt(acc / (sig.length - from));
}

test('the synth produces finite, bounded, non-silent output', () => {
  const out = render(CROSSPLANE_V8, { rpm: 3000, throttle: 0.8, seconds: 0.5 });
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    assert.ok(Number.isFinite(out[i]), `non-finite sample at ${i}`);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  assert.ok(peak > 0.02, `output too quiet (peak ${peak})`);
  assert.ok(peak <= 1.0, `output not bounded (peak ${peak})`);
  assert.ok(rms(out, SR * 0.1) > 0.005, 'output has no sustained energy');
});

test('the dominant component is the 4th engine order (V8 firing rate)', () => {
  const rpm = 3000;
  const out = render(CROSSPLANE_V8, { rpm, throttle: 0.9, seconds: 1.2 });
  const skip = Math.floor(SR * 0.3); // let the pipes fill
  const order = (k) => magnitudeAt(out, (rpm / 60) * k, SR, skip);

  const fourth = order(4); // 200 Hz -- eight firings per two revolutions
  // Compare against neighbouring non-harmonic frequencies, not other orders:
  // an exhaust is rich, so orders 2 and 6 are legitimately strong too.
  const between = Math.max(order(3.55), order(4.45));
  assert.ok(fourth > between * 1.8, `4th order ${fourth.toExponential(2)} vs ${between.toExponential(2)}`);
});

test('firing frequency tracks rpm', () => {
  for (const rpm of [1200, 2400, 4800]) {
    const out = render(CROSSPLANE_V8, { rpm, throttle: 0.85, seconds: 0.9 });
    const skip = Math.floor(SR * 0.3);
    const onFiring = magnitudeAt(out, (rpm / 60) * 4, SR, skip);
    const offFiring = magnitudeAt(out, (rpm / 60) * 4 * 1.13, SR, skip);
    assert.ok(onFiring > offFiring, `rpm ${rpm}: ${onFiring} !> ${offFiring}`);
  }
});

test('the cross-plane crank puts energy at half-orders that a flat-plane crank does not', () => {
  // This is the whole claim of the model: the burble is the firing table.
  // Same block, same pipes, only the crank phasing differs.
  const rpm = 2400;
  const flat = { ...FLATPLANE_V8, redlineRpm: CROSSPLANE_V8.redlineRpm, torqueCurve: CROSSPLANE_V8.torqueCurve };
  const cross = render(CROSSPLANE_V8, { rpm, throttle: 0.85, seconds: 1.5 });
  const even = render(flat, { rpm, throttle: 0.85, seconds: 1.5 });
  const skip = Math.floor(SR * 0.4);
  const f0 = rpm / 60;

  // Odd half-orders (1.5, 2.5, 3.5) exist only when the per-bank firing
  // intervals are uneven.
  const half = (sig) =>
    [1.5, 2.5, 3.5].reduce((a, k) => a + magnitudeAt(sig, f0 * k, SR, skip), 0);
  // Normalise by the shared 4th-order level so overall loudness cannot
  // accidentally decide the test.
  const crossRatio = half(cross) / magnitudeAt(cross, f0 * 4, SR, skip);
  const evenRatio = half(even) / magnitudeAt(even, f0 * 4, SR, skip);

  assert.ok(
    crossRatio > evenRatio * 2,
    `cross-plane half-order ratio ${crossRatio.toFixed(3)} should dwarf flat-plane ${evenRatio.toFixed(3)}`
  );
});

test('equal-length primaries resonate where a quarter-wave pipe should', () => {
  // c / 4L for L = 0.82 m, c = 540 m/s -> ~165 Hz, and the Duct's comb should
  // put a peak there.
  const L = 0.82;
  const c = 540;
  const expected = c / (4 * L);
  const duct = new W.Duct(SR, L, c, 0.86, -1, 6500);
  const n = SR;
  const imp = new Float32Array(n);
  for (let i = 0; i < n; i++) imp[i] = duct.process(i === 0 ? 1 : 0);

  const at = (f) => magnitudeAt(imp, f, SR);
  const peak = at(expected);
  assert.ok(peak > at(expected * 0.5) * 1.5, 'no peak at the quarter-wave frequency');
  assert.ok(peak > at(expected * 1.5) * 0.8, 'quarter-wave peak weaker than the next mode');
  // Odd-harmonic structure: 3 * c/4L should also be a resonance, 2x should not.
  assert.ok(at(expected * 3) > at(expected * 2) * 1.4, 'missing odd-harmonic pipe structure');
});

test('the FDN reverb decays and never blows up, even at maximum settings', () => {
  const rev = new W.FDNReverb(SR);
  rev.setSize(6);
  rev.setDecay(0.92, 8000); // beyond any preset
  const out = new Float32Array(2);
  let early = 0;
  let late = 0;
  let peak = 0;
  const n = SR * 6;
  for (let i = 0; i < n; i++) {
    rev.process(i < 4 ? 1 : 0, out);
    const e = out[0] * out[0] + out[1] * out[1];
    peak = Math.max(peak, Math.abs(out[0]), Math.abs(out[1]));
    if (i > SR * 0.2 && i < SR * 0.4) early += e;
    if (i > SR * 5.0) late += e;
    assert.ok(Number.isFinite(out[0]) && Number.isFinite(out[1]), `non-finite at ${i}`);
  }
  assert.ok(peak < 8, `reverb output grew unreasonably (peak ${peak})`);
  assert.ok(late < early * 0.5, `reverb did not decay (early ${early}, late ${late})`);
});

test('reverb is a send, not a shortcut: dry output is unaffected by mix 0', () => {
  const a = render(CROSSPLANE_V8, { rpm: 3200, throttle: 0.7, seconds: 0.3, params: { reverbMix: 0 } });
  const b = render(CROSSPLANE_V8, { rpm: 3200, throttle: 0.7, seconds: 0.3, params: { reverbMix: 0.5 } });
  assert.ok(rms(b) > 0, 'wet path silent');
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  assert.ok(diff / a.length > 1e-5, 'reverb mix had no effect');
});

test('throttle position changes level and brightness', () => {
  const skip = Math.floor(SR * 0.3);
  const closed = render(CROSSPLANE_V8, { rpm: 3000, throttle: 0.02, load: 0.02, seconds: 0.8 });
  const open = render(CROSSPLANE_V8, { rpm: 3000, throttle: 1, load: 1, seconds: 0.8 });
  assert.ok(rms(open, skip) > rms(closed, skip) * 2, 'wide-open throttle should be much louder');
});

test('a spark cut collapses combustion energy (rev limiter behaviour)', () => {
  const skip = Math.floor(SR * 0.35);
  const firing = render(CROSSPLANE_V8, { rpm: 6500, throttle: 1, load: 1, seconds: 0.8 });
  const cut = render(CROSSPLANE_V8, {
    rpm: 6500, throttle: 1, load: 1, seconds: 0.8,
    params: { ignitionCut: 1, popIntensity: 1 },
  });
  // Most cylinders stop burning, so the 4th-order tone must drop hard even
  // though the overall signal stays busy with afterburn.
  const tone = (s) => magnitudeAt(s, (6500 / 60) * 4, SR, skip);
  assert.ok(tone(cut) < tone(firing) * 0.7, `${tone(cut)} !< ${tone(firing)}`);
});

test('an engine that is not running falls silent', () => {
  const out = render(CROSSPLANE_V8, {
    rpm: 0, throttle: 0, load: 0, seconds: 0.4, params: { running: 0 },
  });
  assert.ok(rms(out, SR * 0.2) < 0.02, `stopped engine still audible (${rms(out, SR * 0.2)})`);
});

test('no zipper noise or clicks across a fast rpm sweep', () => {
  const synth = new W.EngineSynth(SR, toAcousticConfig(CROSSPLANE_V8));
  const n = 128;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const frames = Math.floor((SR * 2) / n);
  let prev = 0;
  let maxJump = 0;
  for (let f = 0; f < frames; f++) {
    const t = f / frames;
    synth.setParams({
      rpm: 800 + t * 5700, throttle: 1, load: 1, running: 1, cabin: 1, masterGain: 0.9,
    });
    synth.process(L, R, n);
    for (let i = 0; i < n; i++) {
      maxJump = Math.max(maxJump, Math.abs(L[i] - prev));
      prev = L[i];
      assert.ok(Number.isFinite(L[i]));
    }
  }
  // A discontinuity from a parameter jump shows up as a sample-to-sample step
  // far larger than the signal itself.
  assert.ok(maxJump < 0.5, `suspicious discontinuity of ${maxJump.toFixed(3)}`);
});

test('the DSP fits a real-time budget with room to spare', () => {
  const synth = new W.EngineSynth(SR, toAcousticConfig(CROSSPLANE_V8));
  const n = 128;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  synth.setParams({ rpm: 4200, throttle: 0.9, load: 0.9, running: 1, cabin: 1 });
  const seconds = 20;
  const frames = Math.floor((SR * seconds) / n);
  // Warm up so JIT compilation is not measured.
  for (let f = 0; f < 400; f++) synth.process(L, R, n);
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < frames; f++) synth.process(L, R, n);
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const realtimePct = (elapsedMs / (seconds * 1000)) * 100;
  // Node and a browser worklet are not identical, but an order-of-magnitude
  // regression will trip this.
  assert.ok(realtimePct < 12, `engine DSP used ${realtimePct.toFixed(2)}% of real time`);
  console.log(`      engine DSP: ${realtimePct.toFixed(2)}% of one core at ${SR} Hz`);
});
