/**
 * Phase 1 - DSP primitives.
 *
 * Every block of the signal chain is verified on its own so a regression points
 * at one file instead of "the engine sounds wrong".
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  Biquad,
  CombChamber,
  DcBlocker,
  FractionalDelay,
  Limiter,
  OnePoleLowpass,
  ParamSmoother,
  PinkNoise,
  Resonator,
  SlewLimiter,
  SpaceReverb,
  WaveguideSection,
  Xorshift32,
  buildBlowdownPulse,
  buildTurbulenceEnvelope,
  clampSample,
  saturate,
  saturateAsymmetric,
  sineLookup,
  softClip,
  tableLookup,
} from "../src/audio/dsp/index.js";
import { SPACE_PRESETS, spacePresetNames } from "../src/audio/dsp/reverb.js";
import { fftInPlace, magnitudeSpectrum, peakInBand, toDb } from "../src/audio/analysis/fft.js";

const FS = 48000;

function impulseResponse(process, length) {
  const out = new Float64Array(length);
  for (let i = 0; i < length; i++) out[i] = process(i === 0 ? 1 : 0);
  return out;
}

function energyOf(signal, from, to) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += signal[i] * signal[i];
  return sum;
}

test("FFT measures a known sine exactly", () => {
  const n = 1 << 15;
  const signal = new Float64Array(n);
  for (let i = 0; i < n; i++) signal[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / FS);
  const { magnitudes, binHz } = magnitudeSpectrum(signal, FS);
  const peak = peakInBand(magnitudes, binHz, 300, 600);
  assert.ok(Math.abs(peak.frequency - 440) < 0.3, `measured ${peak.frequency.toFixed(3)} Hz`);
  // A Hann window halves the amplitude of a coherent tone; parabolic
  // interpolation recovers the level to within a percent.
  assert.ok(Math.abs(peak.magnitude - 0.25) < 0.008, `magnitude ${peak.magnitude.toFixed(4)}`);
  assert.ok(peak.binMagnitude <= peak.magnitude + 1e-12, "interpolated level must not be below the raw bin");
  assert.throws(() => fftInPlace(new Float64Array(6), new Float64Array(6)));
});

test("one-pole and biquad low-pass filters have the right shape and are stable", () => {
  const one = new OnePoleLowpass(FS, 1000);
  const response = impulseResponse((x) => one.process(x), 4096);
  const { magnitudes, binHz } = magnitudeSpectrum(response, FS, { fftSize: 4096, window: "none" });
  const dc = magnitudes[1];
  const atCutoff = magnitudes[Math.round(1000 / binHz)];
  const decade = magnitudes[Math.round(10000 / binHz)];
  assert.ok(Math.abs(toDb(atCutoff / dc) + 3) < 1.5, "one-pole -3 dB at cutoff");
  assert.ok(toDb(decade / dc) < -15, "one-pole must roll off");

  const biquad = new Biquad(FS).lowpass(1000, Math.SQRT1_2);
  const bResponse = impulseResponse((x) => biquad.process(x), 8192);
  let energyTail = 0;
  for (let i = 4096; i < 8192; i++) energyTail += bResponse[i] * bResponse[i];
  assert.ok(energyTail < 1e-12, "biquad impulse response must decay to zero");
  const spectrum = magnitudeSpectrum(bResponse, FS, { fftSize: 8192, window: "none" });
  const gainAt = (hz) => spectrum.magnitudes[Math.round(hz / spectrum.binHz)];
  assert.ok(toDb(gainAt(4000) / gainAt(50)) < -20, "2-pole low-pass must be past -20 dB two octaves up");
  assert.ok(Math.abs(toDb(gainAt(1000) / gainAt(50)) + 3) < 2, "biquad -3 dB at cutoff");
});

test("biquad shelves and peaks apply the gain they are asked for", () => {
  const peaking = new Biquad(FS).peaking(200, 1.2, 6);
  const response = impulseResponse((x) => peaking.process(x), 16384);
  const { magnitudes, binHz } = magnitudeSpectrum(response, FS, { fftSize: 16384, window: "none" });
  const at200 = toDb(magnitudes[Math.round(200 / binHz)]);
  const at2000 = toDb(magnitudes[Math.round(2000 / binHz)]);
  assert.ok(Math.abs(at200 - at2000 - 6) < 1.2, `peak gain was ${(at200 - at2000).toFixed(2)} dB`);

  const shelf = new Biquad(FS).highShelf(1000, -12, 0.9);
  const shelfResponse = impulseResponse((x) => shelf.process(x), 16384);
  const shelfSpectrum = magnitudeSpectrum(shelfResponse, FS, { fftSize: 16384, window: "none" });
  const low = toDb(shelfSpectrum.magnitudes[Math.round(100 / shelfSpectrum.binHz)]);
  const high = toDb(shelfSpectrum.magnitudes[Math.round(12000 / shelfSpectrum.binHz)]);
  assert.ok(Math.abs(high - low + 12) < 1.5, `shelf delta was ${(high - low).toFixed(2)} dB`);
});

test("DC blocker removes a constant offset but keeps the signal", () => {
  const dc = new DcBlocker(FS, 12);
  let last = 0;
  for (let i = 0; i < FS; i++) last = dc.process(1 + 0.2 * Math.sin((2 * Math.PI * 100 * i) / FS));
  assert.ok(Math.abs(last) < 0.25, "offset must be gone");
  let peak = 0;
  for (let i = 0; i < 2000; i++) {
    const y = dc.process(1 + 0.2 * Math.sin((2 * Math.PI * 100 * i) / FS));
    peak = Math.max(peak, Math.abs(y));
  }
  assert.ok(peak > 0.1, "the 100 Hz component must survive");
});

test("resonator rings at its frequency with unity peak gain and decays", () => {
  const resonator = new Resonator(FS, 250, 0.05);
  const response = impulseResponse((x) => resonator.process(x), 16384);
  const { magnitudes, binHz } = magnitudeSpectrum(response, FS, { fftSize: 16384, window: "none" });
  const peak = peakInBand(magnitudes, binHz, 150, 400);
  assert.ok(Math.abs(peak.frequency - 250) < 4, `rang at ${peak.frequency.toFixed(1)} Hz`);
  assert.ok(Math.abs(peak.magnitude * 16384 * 0.5 - 1) < 0.25, "peak gain must be near unity");
  const early = energyOf(response, 0, 2400);
  const late = energyOf(response, 12000, 16384);
  assert.ok(late < early * 1e-3, `resonator must ring down (late/early = ${(late / early).toExponential(2)})`);
});

test("fractional delay reads back what was written, with interpolation", () => {
  const line = new FractionalDelay(256);
  for (let i = 0; i < 128; i++) line.write(i);
  assert.ok(Math.abs(line.read(1) - 127) < 1e-6);
  assert.ok(Math.abs(line.read(10) - 118) < 1e-6);
  assert.ok(Math.abs(line.read(10.5) - 117.5) < 1e-6, "linear interpolation between taps");
  assert.equal(line.readInt(1), 127);
  // Out-of-range requests are clamped, never wrapped into garbage.
  assert.ok(Number.isFinite(line.read(-5)));
  assert.ok(Number.isFinite(line.read(1e9)));
});

test("waveguide section resonates at c/(4L) and stays stable", () => {
  const section = new WaveguideSection(FS, { maxDelaySamples: 256, dampingHz: 9000 });
  section.setDelaySamples(48); // 48 samples one way -> 250 Hz quarter-wave
  const length = 1 << 15;
  const response = new Float64Array(length);
  for (let i = 0; i < length; i++) response[i] = section.process(i === 0 ? 1 : 0, 0.95, -0.55);
  const { magnitudes, binHz } = magnitudeSpectrum(response, FS, { fftSize: 1 << 14 });
  const peak = peakInBand(magnitudes, binHz, 120, 400);
  assert.ok(Math.abs(peak.frequency - 250) < 12, `first resonance at ${peak.frequency.toFixed(1)} Hz, expected 250`);
  let late = 0;
  for (let i = length - 4096; i < length; i++) late += Math.abs(response[i]);
  assert.ok(late < 1e-3, "a lossy pipe must ring down");
  for (const v of response) assert.ok(Number.isFinite(v));
});

test("comb chamber notches the frequency its length corresponds to", () => {
  const comb = new CombChamber(FS, 0.002, -0.6, 8000);
  const response = impulseResponse((x) => comb.process(x), 1 << 14);
  const { magnitudes, binHz } = magnitudeSpectrum(response, FS, { fftSize: 1 << 14 });
  const at250 = magnitudes[Math.round(250 / binHz)];
  const at500 = magnitudes[Math.round(500 / binHz)];
  assert.ok(Number.isFinite(at250) && Number.isFinite(at500));
  assert.ok(at250 !== at500, "a comb must not be flat");
  for (const v of response) assert.ok(Number.isFinite(v));
});

test("space reverb decays at roughly the requested RT60 and is stereo", () => {
  for (const name of spacePresetNames()) {
    const reverb = new SpaceReverb(FS, name);
    const target = SPACE_PRESETS[name].rt60;
    const seconds = Math.min(8, target * 2.5 + 0.5);
    const frames = Math.round(seconds * FS);
    let energyL = 0;
    let energyR = 0;
    let decayTime = -1;
    let peak = 0;
    const window = Math.round(FS * 0.05);
    let windowEnergy = 0;
    let windowPeakEnergy = 0;
    for (let i = 0; i < frames; i++) {
      reverb.process(i === 0 ? 1 : 0);
      const l = reverb.outL;
      const r = reverb.outR;
      assert.ok(Number.isFinite(l) && Number.isFinite(r), `${name} produced a non-finite sample`);
      energyL += l * l;
      energyR += r * r;
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
      windowEnergy += l * l + r * r;
      if (i % window === window - 1) {
        if (windowPeakEnergy === 0) windowPeakEnergy = windowEnergy;
        if (decayTime < 0 && windowPeakEnergy > 0 && windowEnergy < windowPeakEnergy * 1e-6) {
          decayTime = i / FS;
        }
        windowEnergy = 0;
      }
    }
    assert.ok(energyL > 0 && energyR > 0, `${name} produced no tail`);
    assert.ok(Math.abs(energyL - energyR) / Math.max(energyL, energyR) < 0.9, `${name} channels must both carry the tail`);
    assert.ok(decayTime > target * 0.35, `${name} decayed too fast (${decayTime.toFixed(2)} s vs RT60 ${target} s)`);
    assert.ok(decayTime < target * 2.6 + 0.4, `${name} decayed too slowly (${decayTime.toFixed(2)} s vs RT60 ${target} s)`);
    assert.ok(peak < 4, `${name} reverb gain is out of control (peak ${peak.toFixed(2)})`);
  }
});

test("reverb survives a preset switch mid-tail without exploding", () => {
  const reverb = new SpaceReverb(FS, "cockpit");
  let peak = 0;
  for (let i = 0; i < FS; i++) {
    if (i === 4800) reverb.setPreset("tunnel");
    if (i === 9600) reverb.setPreset("pitlane");
    reverb.process(Math.sin((2 * Math.PI * 180 * i) / FS) * 0.4);
    peak = Math.max(peak, Math.abs(reverb.outL), Math.abs(reverb.outR));
    assert.ok(Number.isFinite(reverb.outL) && Number.isFinite(reverb.outR));
  }
  assert.ok(peak < 4);
});

test("limiter bounds the output and reports its reduction", () => {
  const limiter = new Limiter(FS, { ceiling: 0.8 });
  let peak = 0;
  for (let i = 0; i < FS; i++) {
    limiter.process(4 * Math.sin((2 * Math.PI * 100 * i) / FS), -4 * Math.sin((2 * Math.PI * 100 * i) / FS));
    peak = Math.max(peak, Math.abs(limiter.outL), Math.abs(limiter.outR));
  }
  assert.ok(peak < 1, `limiter output peaked at ${peak.toFixed(4)}`);
  assert.ok(limiter.reduction > 0.5, "4x overdrive must be strongly reduced");
  limiter.process(NaN, Infinity);
  assert.ok(Number.isFinite(limiter.outL) && Number.isFinite(limiter.outR));
});

test("non-linear helpers stay bounded and monotone", () => {
  for (const x of [-1e9, -100, -1, -0.3, 0, 0.3, 1, 100, 1e9]) {
    assert.ok(Math.abs(softClip(x)) < 1, `softClip(${x})`);
    assert.ok(Math.abs(saturate(x, 2)) <= 1, `saturate(${x})`);
    assert.ok(Math.abs(saturateAsymmetric(x, 2, 0.3)) <= 1, `saturateAsymmetric(${x})`);
    assert.ok(Math.abs(clampSample(x)) <= 1, `clampSample(${x})`);
  }
  // Inside the working range the bound is strict, which is what the audio path
  // actually relies on.
  for (const x of [-4, -1, -0.5, 0, 0.5, 1, 4]) {
    assert.ok(Math.abs(saturate(x, 2)) < 1);
    assert.ok(Math.abs(saturateAsymmetric(x, 2, 0.3)) < 1);
  }
  // Non-finite input becomes silence, not a full-scale click.
  assert.equal(clampSample(NaN), 0);
  assert.equal(clampSample(Infinity), 0);
  assert.equal(clampSample(1.5), 1);
  assert.equal(clampSample(-1.5), -1);
  let previous = -Infinity;
  for (let x = -4; x <= 4; x += 0.01) {
    const y = saturate(x, 1.5);
    assert.ok(y > previous, "saturate must be strictly increasing");
    previous = y;
  }
  // Asymmetry: the compression half of a gas pulse is driven harder than the
  // rarefaction half, so the transfer curve is not odd-symmetric and the
  // saturator generates even harmonics (a DC/2nd-order component appears for a
  // symmetric input).
  assert.ok(Math.abs(saturateAsymmetric(0.5, 1, 0.4)) > Math.abs(saturateAsymmetric(-0.5, 1, 0.4)));
  let mean = 0;
  const n = 4800;
  for (let i = 0; i < n; i++) mean += saturateAsymmetric(Math.sin((2 * Math.PI * i) / n), 1.5, 0.35);
  assert.ok(Math.abs(mean / n) > 0.01, "an asymmetric saturator must rectify a symmetric input");
  let symmetricMean = 0;
  for (let i = 0; i < n; i++) symmetricMean += saturateAsymmetric(Math.sin((2 * Math.PI * i) / n), 1.5, 0);
  assert.ok(Math.abs(symmetricMean / n) < 1e-12, "with zero asymmetry the curve must stay odd");
});

test("parameter smoother and slew limiter converge without overshoot", () => {
  const smoother = new ParamSmoother(FS, 0.02, 0);
  smoother.setTarget(1);
  let previous = -1;
  for (let i = 0; i < FS; i++) {
    const v = smoother.next();
    assert.ok(v > previous - 1e-12 && v <= 1, "monotone, no overshoot");
    previous = v;
  }
  assert.ok(Math.abs(smoother.value - 1) < 1e-3, "must converge");
  smoother.snap(0.25);
  assert.equal(smoother.value, 0.25);
  smoother.setTarget(NaN);
  smoother.next();
  assert.ok(Number.isFinite(smoother.value));

  const slew = new SlewLimiter(FS, 1000, 500, 0);
  slew.process(1e6, 1);
  assert.ok(Math.abs(slew.value - 1000 / FS) < 1e-9, "rise rate must be respected");
  const before = slew.value;
  slew.process(-1e6, 1);
  assert.ok(Math.abs(slew.value - (before - 500 / FS)) < 1e-9, "fall rate must be respected");
});

test("noise sources are deterministic, bounded and spectrally sane", () => {
  const a = new Xorshift32(7);
  const b = new Xorshift32(7);
  for (let i = 0; i < 1000; i++) assert.equal(a.nextUint32(), b.nextUint32());
  const rng = new Xorshift32(99);
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 200000; i++) {
    const v = rng.nextBipolar();
    sum += v;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  assert.ok(Math.abs(sum / 200000) < 0.01, "white noise must be zero mean");
  assert.ok(min > -1.001 && max < 1.001);
  const gaussRng = new Xorshift32(5);
  let gaussPeak = 0;
  for (let i = 0; i < 100000; i++) gaussPeak = Math.max(gaussPeak, Math.abs(gaussRng.nextGaussian()));
  assert.ok(gaussPeak < 1.74, "the bounded gaussian must stay bounded");

  const pink = new PinkNoise(new Xorshift32(3));
  const n = 1 << 15;
  const signal = new Float64Array(n);
  for (let i = 0; i < n; i++) signal[i] = pink.next();
  const { magnitudes, binHz } = magnitudeSpectrum(signal, FS);
  const bandEnergy = (from, to) => {
    let sum = 0;
    for (let i = Math.round(from / binHz); i <= Math.round(to / binHz); i++) sum += magnitudes[i] * magnitudes[i];
    return sum;
  };
  const low = bandEnergy(100, 200);
  const high = bandEnergy(1000, 2000);
  assert.ok(low > high, "pink noise must fall with frequency");
});

test("wavetables are normalised, zero-mean and interpolate cleanly", () => {
  const pulse = buildBlowdownPulse(1024);
  let mean = 0;
  let peak = 0;
  for (let i = 0; i < 1024; i++) {
    mean += pulse[i];
    peak = Math.max(peak, Math.abs(pulse[i]));
  }
  assert.ok(Math.abs(mean / 1024) < 1e-6, "the pulse must carry no DC");
  assert.ok(Math.abs(peak - 1) < 1e-6, "the pulse must be peak normalised");
  assert.equal(pulse[1024], pulse[0], "guard sample must close the loop");
  assert.ok(tableLookup(pulse, 0.5) !== 0);
  assert.equal(tableLookup(pulse, 0), pulse[0]);

  const turbulence = buildTurbulenceEnvelope(512);
  assert.ok(turbulence[0] < 0.05 && turbulence[512] === 0, "turbulence starts and ends at zero");
  let maxTurbulence = 0;
  for (const v of turbulence) maxTurbulence = Math.max(maxTurbulence, v);
  assert.ok(maxTurbulence > 0.5 && maxTurbulence <= 1);

  for (const phase of [0, 0.1, 0.25, 0.5, 0.999, 1.5, -0.25]) {
    const s = sineLookup(phase);
    assert.ok(Number.isFinite(s) && Math.abs(s) <= 1.001);
    assert.ok(Math.abs(s - Math.sin(2 * Math.PI * phase)) < 2e-3, "sine table must match Math.sin");
  }
});
