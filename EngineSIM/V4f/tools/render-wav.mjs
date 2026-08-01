/**
 * render-wav.mjs -- offline render / analysis / CPU benchmark for V4f.
 *
 * Usage:
 *   node tools/render-wav.mjs                  # sweep demo -> out/sweep.wav
 *   node tools/render-wav.mjs idle             # idle loop
 *   node tools/render-wav.mjs presets          # one wav per reverb preset
 *   node tools/render-wav.mjs --rpm 3000 --throttle 0.4 --seconds 8 --out out/cruise.wav
 *   node tools/render-wav.mjs --analyze        # order/half-order + header resonance
 *   node tools/render-wav.mjs --bench          # 20 s lite + high CPU accounting
 *
 * All DSP runs in the exact same EngineSynth class the AudioWorklet uses.
 */

import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  CROSSPLANE_V8,
  FLATPLANE_V8,
  REVERB_PRESETS,
  toAcousticConfig,
} from '../src/engine-config.mjs';

const require = createRequire(import.meta.url);
const { EngineSynth } = require('../src/engine-dsp.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const SR = 48000;
const CONTROL = 512; // control-rate block: ~94 updates/s

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

function parseArgs() {
  const positional = args.filter((a) => !a.startsWith('--'));
  return {
    scenario: positional[0] || 'sweep',
    out: flag('--out', null),
    quality: flag('--quality', 'lite'),
    preset: flag('--preset', 'garage'),
    seconds: Number(flag('--seconds', '0')),
    rpm: Number(flag('--rpm', '0')),
    throttle: Number(flag('--throttle', '-1')),
    analyze: args.includes('--analyze'),
    bench: args.includes('--bench'),
  };
}

/** Linear interpolation helper for script segments. */
function seg(t, pts) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, v0] = pts[i];
    const [t1, v1] = pts[i + 1];
    if (t >= t0 && t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return pts[pts.length - 1][1];
}

/** Returns a script function t -> {rpm, throttle, load, cut, pop}. */
function scenarioScript(scenario, seconds) {
  const S = seconds > 0 ? seconds : 26;
  if (scenario === 'idle') {
    return () => ({ rpm: 760, throttle: 0, load: 0.05, cut: false, pop: 0 });
  }
  if (scenario === 'cruise') {
    return () => ({ rpm: 3000, throttle: 0.25, load: 0.3, cut: false, pop: 0 });
  }
  if (scenario === 'launch') {
    return (t) => {
      if (t < 2) return { rpm: 3200, throttle: 0.4, load: 0.5, cut: false, pop: 0 };
      if (t < 12) return { rpm: 3200 + t * 280, throttle: 1, load: 1, cut: false, pop: 0 };
      return { rpm: 6200, throttle: 0.8, load: 0.85, cut: false, pop: 0 };
    };
  }
  if (scenario === 'limiter') {
    return (t) => ({
      rpm: 6500 + Math.sin(t * 9) * 80,
      throttle: 1,
      load: 1,
      cut: t > 0.5,
      pop: 0,
    });
  }
  if (scenario === 'rev') {
    return () => ({ rpm: 2400, throttle: 0.7, load: 0.8, cut: false, pop: 0 });
  }
  // sweep: the default showcase.
  return (t) => ({
    rpm: seg(t, [
      [0, 760],
      [3, 760],
      [3.8, 4200],
      [4.4, 900],
      [4.6, 800],
      [10.2, 6500],
      [11.6, 6550],
      [11.7, 6500],
      [15, 1100],
      [17, 4800],
      [19, 900],
      [S, 760],
    ]),
    throttle: seg(t, [
      [0, 0],
      [3, 0],
      [3.8, 0.7],
      [4.4, 0],
      [4.6, 1],
      [11.6, 1],
      [11.8, 0],
      [17, 0.8],
      [19, 0],
      [S, 0],
    ]),
    load: seg(t, [
      [0, 0.05],
      [3, 0.05],
      [3.8, 0.5],
      [4.4, 0.05],
      [4.6, 0.9],
      [11.6, 1],
      [11.8, 0.06],
      [17, 0.7],
      [19, 0.05],
      [S, 0.05],
    ]),
    cut: t > 11.5 && t < 11.85,
    pop: t > 11.8 && t < 15 ? 0.75 : 0,
  });
}

function applyReverb(synth, presetKey) {
  const p = REVERB_PRESETS[presetKey];
  synth.setParams({
    reverbSize: p.size,
    reverbDecay: p.decay,
    reverbDamp: p.damp,
    reverbMix: p.mix,
    reverbEarly: p.early,
    reverbPreDelay: p.predelay,
  });
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

/**
 * Render `seconds` of audio at 48 kHz.
 * @returns {{left:Float32Array, right:Float32Array, synth:EngineSynth}}
 */
function render(engine, quality, presetKey, script, seconds, opts = {}) {
  const cfg = toAcousticConfig(engine, { quality });
  const synth = new EngineSynth(SR, cfg);
  applyReverb(synth, presetKey);
  if (opts.dry) synth.setParams({ reverbMix: 0 });
  const n = seconds * SR;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i += CONTROL) {
    const t = i / SR;
    const s = script(t);
    synth.setParams({
      rpm: s.rpm,
      throttle: s.throttle,
      load: s.load,
      ignitionCut: s.cut,
      popIntensity: s.pop,
      running: true,
      cabin: opts.cabin ?? 0.7,
      masterGain: 0.85,
    });
    // One control-rate block per process call: a larger render chunk here
    // would advance the crank by more samples than the audio timeline has
    // moved (setParams loops at CONTROL), making the engine run at double
    // speed.
    const cnt = Math.min(CONTROL, n - i);
    const L = left.subarray(i, i + cnt);
    const R = right.subarray(i, i + cnt);
    synth.process(L, R, cnt);
  }
  return { left, right, synth };
}

/** Write 16-bit PCM stereo WAV. */
function writeWav(path, left, right, sampleRate = SR) {
  const n = left.length;
  const bytes = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => bytes.setUint32(o, s, true);
  const w2 = (o, s) => bytes.setUint16(o, s, true);
  bytes.setUint8(0, 0x52);
  bytes.setUint8(1, 0x49);
  bytes.setUint8(2, 0x46);
  bytes.setUint8(3, 0x46);
  w(4, 36 + n * 4);
  bytes.setUint8(8, 0x57);
  bytes.setUint8(9, 0x41);
  bytes.setUint8(10, 0x56);
  bytes.setUint8(11, 0x45);
  bytes.setUint8(12, 0x66);
  bytes.setUint8(13, 0x6d);
  bytes.setUint8(14, 0x74);
  bytes.setUint8(15, 0x20);
  w(16, 16);
  w2(20, 1);
  w2(22, 2);
  w(24, sampleRate);
  w(28, sampleRate * 4);
  w2(32, 4);
  w2(34, 16);
  bytes.setUint8(36, 0x64);
  bytes.setUint8(37, 0x61);
  bytes.setUint8(38, 0x74);
  bytes.setUint8(39, 0x61);
  w(40, n * 4);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    bytes.setInt16(o, (l * 32767) | 0, true);
    bytes.setInt16(o + 2, (r * 32767) | 0, true);
    o += 4;
  }
  writeFileSync(path, Buffer.from(bytes.buffer));
  console.log(`wrote ${path} (${n} samples, ${(n / sampleRate).toFixed(1)} s)`);
}

function analyzeOrders(engine, label) {
  // Dry + exterior, per channel: a mono downmix cancels the per-bank
  // asymmetry that IS the cross-plane burble (see docs/DSP.md).
  const { left } = render(engine, 'lite', 'open', () => ({
    rpm: 2400,
    throttle: 0.7,
    load: 0.8,
    cut: false,
    pop: 0,
  }), 8, { dry: true, cabin: 0 });
  const f0 = 40; // 2400 rpm = 40 rev/s, crank order 1 = 40 Hz
  const half = [1.5, 2.5, 3.5].reduce((a, k) => a + magnitudeAt(left, k * f0, SR, SR), 0);
  const whole = magnitudeAt(left, 4 * f0, SR, SR);
  const ratioDb = 20 * Math.log10(Math.max(half, 1e-30) / Math.max(whole, 1e-30));

  // Header resonance: measure the quarter-wave comb itself (c/4L), the
  // component whose identity the equal-length design is responsible for.
  const { Duct } = require('../src/engine-dsp.js');
  const L = 0.82;
  const c = 540;
  const duct = new Duct(SR, L, c, 0.86, -1, 6500);
  const n2 = SR;
  const imp = new Float32Array(n2);
  for (let i = 0; i < n2; i++) imp[i] = duct.process(i === 0 ? 1 : 0);
  const expected = c / (4 * L);
  const peakFreq = magnitudeAt(imp, expected, SR, SR * 0.05);
  const peak2x = magnitudeAt(imp, expected * 2, SR, SR * 0.05);
  console.log(
    `${label}: half/whole order energy = ${ratioDb.toFixed(1)} dB, ` +
      `header resonance ${expected.toFixed(0)} Hz (${peakFreq.toExponential(2)}, even mode ${(peak2x / peakFreq * 100).toFixed(1)}%)`
  );
  return { ratioDb };
}

async function main() {
  const o = parseArgs();
  const engine = CROSSPLANE_V8;

  if (o.bench) {
    const script = scenarioScript('sweep', 20);
    for (const quality of ['lite', 'high']) {
      render(engine, quality, 'open', script, 2); // warm the JIT
      let best = Infinity;
      for (let r = 0; r < 3; r++) {
        const t0 = performance.now();
        render(engine, quality, 'open', script, 20);
        best = Math.min(best, performance.now() - t0);
      }
      console.log(
        `bench ${quality}: 20 s of audio rendered in ${best.toFixed(0)} ms (best of 3) = ${((best / 1000 / 20) * 100).toFixed(2)}% of one core`
      );
    }
    return;
  }

  if (o.analyze) {
    analyzeOrders(CROSSPLANE_V8, 'cross-plane');
    analyzeOrders(FLATPLANE_V8, 'flat-plane ');
    return;
  }

  if (o.scenario === 'presets') {
    const script = () => ({ rpm: 4500, throttle: 0.7, load: 0.8, cut: false, pop: 0 });
    for (const key of Object.keys(REVERB_PRESETS)) {
      const { left, right } = render(engine, o.quality, key, script, 6);
      writeWav(join(OUT, `preset-${key}.wav`), left, right);
    }
    return;
  }

  const seconds = o.seconds > 0 ? o.seconds : 26;
  const script =
    o.rpm > 0 || o.throttle >= 0
      ? () => ({
          rpm: o.rpm || 3000,
          throttle: o.throttle >= 0 ? o.throttle : 0.3,
          load: 0.6,
          cut: false,
          pop: 0,
        })
      : scenarioScript(o.scenario, seconds);
  const outPath = o.out || join(OUT, `${o.scenario}.wav`);
  const { left, right } = render(engine, o.quality, o.preset, script, seconds);
  writeWav(outPath, left, right);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
