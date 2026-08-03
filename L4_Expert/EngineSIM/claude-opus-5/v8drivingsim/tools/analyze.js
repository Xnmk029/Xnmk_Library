/**
 * Order-spectrum analyser.
 *
 * Engine sound is best read in *engine orders* rather than Hz: order 1 is one
 * event per crank revolution, so a V8's firing rate is order 4 and its full
 * 720 deg cycle is order 0.5. Printing the spectrum this way makes the
 * cross-plane signature obvious -- energy on the odd half-orders (0.5, 1.5,
 * 2.5, 3.5) that an evenly-firing engine simply does not have.
 *
 *   node tools/analyze.js
 *   node tools/analyze.js --rpm 2400 --engine flatplane-v8-64
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINES, CROSSPLANE_V8, toAcousticConfig } from '../src/audio/engine-config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const BLOCK = 128;

function loadSynth(sampleRate) {
  const src = fs.readFileSync(path.join(here, '../src/audio/engine-worklet.js'), 'utf8');
  const f = new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate',
    `${src}\nreturn EngineSynth;`);
  class Stub { constructor() { this.port = { postMessage() {}, onmessage: null }; } }
  return f(Stub, () => {}, sampleRate);
}

/** Goertzel magnitude at one frequency. */
function magAt(sig, freq, sampleRate, from) {
  const w = (2 * Math.PI * freq) / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = from; i < sig.length; i++) {
    const s = sig[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return Math.hypot(s1 - s2 * Math.cos(w), s2 * Math.sin(w)) / (sig.length - from);
}

function render(def, rpm, throttle, seconds) {
  const EngineSynth = loadSynth(SR);
  const synth = new EngineSynth(SR, toAcousticConfig(def));
  synth.setParams({ rpm, throttle, load: throttle, running: 1, cabin: 0, masterGain: 0.9, reverbMix: 0 });
  const frames = Math.floor((seconds * SR) / BLOCK);
  const out = new Float32Array(frames * BLOCK);
  const L = new Float32Array(BLOCK);
  const R = new Float32Array(BLOCK);
  for (let f = 0; f < frames; f++) {
    synth.process(L, R, BLOCK);
    out.set(L, f * BLOCK);
  }
  return out;
}

const args = { rpm: 2400, throttle: 0.9, engine: 'crossplane-v8-64' };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i].replace(/^--/, '');
  if (k in args) { const v = process.argv[++i]; args[k] = /^-?\d*\.?\d+$/.test(v) ? Number(v) : v; }
}

const def = ENGINES[args.engine] || CROSSPLANE_V8;
const sig = render(def, args.rpm, args.throttle, 2.5);
const skip = Math.floor(SR * 0.5); // let the pipes fill
const f0 = args.rpm / 60; // order 1, Hz

const orders = [];
for (let k = 0.5; k <= 12.0001; k += 0.5) orders.push(k);
const mags = orders.map((k) => magAt(sig, f0 * k, SR, skip));
const peak = Math.max(...mags);

console.log(`\n${def.name}   ${args.rpm} rpm   throttle ${args.throttle}`);
console.log(`order 1 = ${f0.toFixed(1)} Hz,  firing order 4 = ${(f0 * 4).toFixed(1)} Hz\n`);
console.log('order    Hz     dB rel peak');
for (let i = 0; i < orders.length; i++) {
  const k = orders[i];
  const db = 20 * Math.log10(mags[i] / peak + 1e-12);
  const bar = '#'.repeat(Math.max(0, Math.round((db + 48) / 1.5)));
  const halfMark = k % 1 !== 0 ? ' <- half-order' : '';
  console.log(
    `${k.toFixed(1).padStart(5)} ${(f0 * k).toFixed(0).padStart(6)}  ${db.toFixed(1).padStart(6)}  ${bar}${halfMark}`
  );
}

const halfSum = orders.reduce((a, k, i) => (k % 1 !== 0 ? a + mags[i] * mags[i] : a), 0);
const wholeSum = orders.reduce((a, k, i) => (k % 1 === 0 ? a + mags[i] * mags[i] : a), 0);
console.log(
  `\nhalf-order energy / whole-order energy: ${(halfSum / wholeSum).toFixed(4)}` +
    `  (${(10 * Math.log10(halfSum / wholeSum)).toFixed(1)} dB)`
);
console.log('A cross-plane crank should sit well above a flat-plane one here.\n');
