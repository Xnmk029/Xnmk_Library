/**
 * Offline renderer -- audition the engine without a browser.
 *
 *   node tools/render-wav.js                       # default rev sweep
 *   node tools/render-wav.js --engine flatplane-v8-64
 *   node tools/render-wav.js --preset tunnel --rpm 3200 --dur 6
 *   node tools/render-wav.js --script launch
 *
 * Renders through exactly the same DSP the browser runs, by evaluating the
 * worklet source with the AudioWorkletGlobalScope symbols shimmed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINES, CROSSPLANE_V8, toAcousticConfig } from '../src/audio/engine-config.js';
import { REVERB_PRESETS } from '../src/audio/engine-audio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const BLOCK = 128;

function loadSynth(sampleRate) {
  const src = fs.readFileSync(path.join(here, '../src/audio/engine-worklet.js'), 'utf8');
  const factory = new Function(
    'AudioWorkletProcessor',
    'registerProcessor',
    'sampleRate',
    `${src}\nreturn EngineSynth;`
  );
  class Stub {
    constructor() {
      this.port = { postMessage() {}, onmessage: null };
    }
  }
  return factory(Stub, () => {}, sampleRate);
}

function parseArgs(argv) {
  const out = { engine: 'crossplane-v8-64', preset: 'open', dur: 9, rpm: null, script: 'sweep', out: null, cabin: 1 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    const v = argv[i + 1];
    if (k in out) {
      out[k] = /^-?\d*\.?\d+$/.test(v) ? Number(v) : v;
      i++;
    }
  }
  return out;
}

/**
 * Control scripts: functions of normalised time returning engine state.
 * These are the interesting operating points to listen to.
 */
const SCRIPTS = {
  /** Idle, blip, full sweep to the limiter, then a trailing-throttle overrun. */
  sweep(t, def) {
    const idle = def.idleRpm;
    const top = def.limiterRpm;
    if (t < 0.14) return { rpm: idle, throttle: 0.0, load: 0.05 };
    if (t < 0.2) return { rpm: idle + (t - 0.14) / 0.06 * 1800, throttle: 0.9, load: 0.9 };
    if (t < 0.26) return { rpm: idle + 1800 - (t - 0.2) / 0.06 * 1500, throttle: 0, load: 0.02, popIntensity: 0.5 };
    if (t < 0.78) {
      const u = (t - 0.26) / 0.52;
      return { rpm: idle + u * (top - idle), throttle: 1, load: 1 };
    }
    if (t < 0.84) return { rpm: top + 40, throttle: 1, load: 1, ignitionCut: 1, popIntensity: 1 };
    const u = (t - 0.84) / 0.16;
    return { rpm: top - u * (top - idle), throttle: 0, load: 0.02, popIntensity: 0.85 };
  },
  /** Standing start: clutch slip, then three upshifts. */
  launch(t, def) {
    const shifts = [0.0, 0.24, 0.46, 0.66, 0.85];
    let seg = 0;
    while (seg < shifts.length - 1 && t > shifts[seg + 1]) seg++;
    const u = (t - shifts[seg]) / ((shifts[seg + 1] ?? 1) - shifts[seg]);
    const lo = seg === 0 ? 2600 : 3200;
    const rpm = lo + u * (def.limiterRpm - 250 - lo);
    // The 120 ms of spark cut across each shift is most of what a shift
    // actually sounds like.
    const shifting = seg > 0 && u < 0.06;
    return {
      rpm,
      throttle: shifting ? 0 : 1,
      load: shifting ? 0 : 1,
      ignitionCut: shifting ? 1 : 0,
      popIntensity: shifting ? 0.9 : 0,
    };
  },
  /** Hold a steady rpm -- for looking at the spectrum. */
  steady(t, def, rpm) {
    return { rpm: rpm ?? 3000, throttle: 0.85, load: 0.85 };
  },
  /** Cold start, then settle to idle. */
  start(t, def) {
    if (t < 0.08) return { rpm: 260 * (t / 0.08), throttle: 0.1, load: 0.1, running: 0 };
    if (t < 0.16) return { rpm: 300 + (t - 0.08) / 0.08 * 900, throttle: 0.55, load: 0.7 };
    const u = Math.min(1, (t - 0.16) / 0.25);
    return { rpm: 1200 - u * (1200 - def.idleRpm), throttle: 0.08, load: 0.1 };
  },
};

function writeWav(file, left, right, sampleRate) {
  const n = left.length;
  const bytes = n * 4; // 2 channels * 16-bit
  const buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + bytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(bytes, 40);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE((l * 32767) | 0, 44 + i * 4);
    buf.writeInt16LE((r * 32767) | 0, 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

const args = parseArgs(process.argv);
const def = ENGINES[args.engine] || CROSSPLANE_V8;
const preset = REVERB_PRESETS[args.preset] || REVERB_PRESETS.open;
const script = SCRIPTS[args.script] || SCRIPTS.sweep;

const EngineSynth = loadSynth(SR);
const synth = new EngineSynth(SR, toAcousticConfig(def));
synth.setParams({
  reverbSize: preset.size,
  reverbDecay: preset.decay,
  reverbDamp: preset.damp,
  reverbMix: preset.mix,
  masterGain: 0.92,
  cabin: args.cabin,
});

const totalFrames = Math.floor((args.dur * SR) / BLOCK);
const left = new Float32Array(totalFrames * BLOCK);
const right = new Float32Array(totalFrames * BLOCK);
const L = new Float32Array(BLOCK);
const R = new Float32Array(BLOCK);

const t0 = process.hrtime.bigint();
for (let f = 0; f < totalFrames; f++) {
  const t = f / totalFrames;
  const s = script(t, def, args.rpm);
  synth.setParams({
    rpm: s.rpm,
    throttle: s.throttle,
    load: s.load ?? s.throttle,
    ignitionCut: s.ignitionCut ?? 0,
    popIntensity: s.popIntensity ?? 0,
    running: s.running ?? 1,
  });
  synth.process(L, R, BLOCK);
  left.set(L, f * BLOCK);
  right.set(R, f * BLOCK);
}
const ms = Number(process.hrtime.bigint() - t0) / 1e6;

const outFile = args.out || path.join(here, `../renders/${def.id}-${args.script}-${args.preset}.wav`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
writeWav(outFile, left, right, SR);

let peak = 0;
let sum = 0;
for (let i = 0; i < left.length; i++) {
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  sum += left[i] * left[i] + right[i] * right[i];
}
const rms = Math.sqrt(sum / (left.length * 2));

console.log(`engine    ${def.name}`);
console.log(`script    ${args.script}   preset ${preset.name}   ${args.dur}s @ ${SR} Hz`);
console.log(`render    ${ms.toFixed(0)} ms  (${((ms / (args.dur * 1000)) * 100).toFixed(2)}% of real time)`);
console.log(`level     peak ${(20 * Math.log10(peak || 1e-9)).toFixed(1)} dBFS   rms ${(20 * Math.log10(rms || 1e-9)).toFixed(1)} dBFS`);
console.log(`written   ${path.relative(process.cwd(), outFile)}`);
