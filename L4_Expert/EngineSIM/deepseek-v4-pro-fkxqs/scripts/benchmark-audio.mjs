/**
 * Real-time budget benchmark for the audio engine.
 *
 * Reports the fraction of one CPU core needed to synthesise stereo audio in
 * real time, for several render-quantum sizes and control loads. Run with:
 *   node scripts/benchmark-audio.mjs
 */

import { EngineSynth } from "../src/audio/engine-synth.js";
import { VehicleAmbience } from "../src/audio/vehicle-ambience.js";

const SAMPLE_RATE = 48000;
const SECONDS = 8;

function bench(label, factory, drive) {
  const { synth, render } = factory();
  const block = 128;
  const l = new Float32Array(block);
  const r = new Float32Array(block);
  // warm-up: let the JIT settle before timing
  for (let i = 0; i < 600; i++) render(l, r, block, i);
  const blocks = Math.round((SAMPLE_RATE * SECONDS) / block);
  const start = process.hrtime.bigint();
  for (let i = 0; i < blocks; i++) render(l, r, block, i);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  const fraction = ms / (SECONDS * 1000);
  console.log(
    `${label.padEnd(38)} ${(ms / SECONDS).toFixed(2).padStart(7)} ms/s audio  = ${(fraction * 100).toFixed(2).padStart(6)}% of one core  (x${(1 / fraction).toFixed(0)} faster than real time)`,
  );
  void synth;
  void drive;
  return fraction;
}

const results = {};

results.steady = bench("engine synth, steady 4000 rpm", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  synth.setControls({ rpm: 4000, throttle: 0.8, load: 0.8, combustion: 0.8 });
  return { synth, render: (l, r, n) => synth.render(l, r, n) };
});

results.sweeping = bench("engine synth, rpm sweep + control churn", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  let phase = 0;
  return {
    synth,
    render: (l, r, n, i) => {
      phase += 0.01;
      const rpm = 3200 + 2600 * Math.sin(phase);
      const throttle = 0.5 + 0.5 * Math.sin(phase * 0.7);
      synth.setControls({ rpm, throttle, load: throttle, combustion: throttle, overrun: throttle < 0.1 ? 0.7 : 0 });
      synth.render(l, r, n);
      void i;
    },
  };
});

results.tunnel = bench("engine synth, tunnel reverb + cabin", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE, space: "tunnel" });
  synth.setControls({ rpm: 5200, throttle: 1, load: 1, combustion: 1, cabin: 1, wet: 0.62 });
  return { synth, render: (l, r, n) => synth.render(l, r, n) };
});

results.full = bench("engine synth + vehicle ambience (full mix)", () => {
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE });
  const ambience = new VehicleAmbience({ sampleRate: SAMPLE_RATE });
  synth.setControls({ rpm: 4600, throttle: 0.9, load: 0.9, combustion: 0.9 });
  ambience.setControls({ speedMps: 44, slip: 0.35, surface: 0.9, brake: 0.1 });
  return {
    synth,
    render: (l, r, n) => {
      synth.render(l, r, n);
      ambience.addInto(l, r, n);
    },
  };
});

const worst = Math.max(...Object.values(results));
console.log(`\nworst case: ${(worst * 100).toFixed(2)}% of one core at ${SAMPLE_RATE} Hz stereo`);
