/**
 * Offline renderer for subjective listening ("human scoring") material.
 *
 * Writes a set of 48 kHz stereo WAV files into artifacts/ plus a JSON report
 * with the objective statistics of each clip. Run with:
 *   node scripts/render-audio-wav.mjs
 *
 * The rpm in every scenario comes from the same `EngineController` the car uses,
 * so these clips are not hand-drawn envelopes: they are the engine reacting to a
 * throttle/load script.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CROSSPLANE_V8, FLATPLANE_V8, withEngineOverrides } from "../src/audio/engine-config.js";
import { EngineController } from "../src/audio/engine-state.js";
import { EngineSynth } from "../src/audio/engine-synth.js";
import { VehicleAmbience } from "../src/audio/vehicle-ambience.js";
import { signalStats } from "../src/audio/analysis/order-analysis.js";
import { writeStereoWav } from "./lib/wav.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "artifacts");
const SAMPLE_RATE = 48000;
const BLOCK = 128;

mkdirSync(OUT_DIR, { recursive: true });

/**
 * Render a scenario.
 * @param {object} scenario
 * @param {string} scenario.name file name (without extension)
 * @param {string} scenario.description
 * @param {number} scenario.seconds
 * @param {object} [scenario.engine] engine config
 * @param {string} [scenario.space]
 * @param {number} [scenario.cabin]
 * @param {(t:number) => {throttle:number, loadTorqueNm?:number, space?:string, wet?:number}} scenario.script
 * @param {(t:number, engine:EngineController) => object} [scenario.ambience]
 */
function renderScenario(scenario) {
  const base = scenario.engine ?? CROSSPLANE_V8;
  // A bare flywheel revs far faster than an engine coupled to a car. Scaling the
  // rotating inertia is the cheapest honest way to script an "in gear" pull
  // without dragging the whole vehicle model into an audio demo.
  const config = scenario.inertiaScale
    ? withEngineOverrides(base, {
        torque: { flywheelInertiaKgM2: base.torque.flywheelInertiaKgM2 * scenario.inertiaScale },
      })
    : base;
  const synth = new EngineSynth({ sampleRate: SAMPLE_RATE, config, space: scenario.space ?? "trackside" });
  const engine = new EngineController(config);
  if (scenario.startRpm) engine.rpm = scenario.startRpm;
  const ambience = new VehicleAmbience({ sampleRate: SAMPLE_RATE });
  synth.setControls({ cabin: scenario.cabin ?? 0, master: 1 });

  const frames = Math.round(scenario.seconds * SAMPLE_RATE);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const blockL = new Float32Array(BLOCK);
  const blockR = new Float32Array(BLOCK);
  const blockSeconds = BLOCK / SAMPLE_RATE;
  let space = scenario.space ?? "trackside";
  let rpmMin = Infinity;
  let rpmMax = 0;

  for (let offset = 0; offset < frames; offset += BLOCK) {
    const t = offset / SAMPLE_RATE;
    const input = scenario.script(t);
    // Load: a fixed component plus a quadratic road-load term (aero + rolling),
    // which is what keeps a scripted pull from running away.
    const roadLoad = (scenario.roadLoadCoefficient ?? 0) * engine.rpm * engine.rpm;
    for (let k = 0; k < 4; k++) {
      engine.stepStandalone(blockSeconds / 4, {
        throttle: input.throttle,
        loadTorqueNm: (input.loadTorqueNm ?? 0) + roadLoad,
      });
    }
    if (input.space && input.space !== space) {
      space = input.space;
      synth.setSpace(space);
    }
    const state = engine.snapshot();
    rpmMin = Math.min(rpmMin, state.rpm);
    rpmMax = Math.max(rpmMax, state.rpm);
    synth.setControls({
      rpm: state.rpm,
      throttle: state.throttleInput,
      load: state.load,
      combustion: state.combustionEnergy,
      ignitionCut: state.ignitionCut,
      overrun: state.overrunIntensity,
      cabin: input.cabin ?? scenario.cabin ?? 0,
      wet: input.wet ?? undefined,
    });
    if (scenario.ambience) ambience.setControls(scenario.ambience(t, engine));

    const count = Math.min(BLOCK, frames - offset);
    synth.render(blockL, blockR, count);
    if (scenario.ambience) ambience.addInto(blockL, blockR, count);
    left.set(blockL.subarray(0, count), offset);
    right.set(blockR.subarray(0, count), offset);
  }

  const file = join(OUT_DIR, `${scenario.name}.wav`);
  const written = writeStereoWav(file, left, right, SAMPLE_RATE);
  const stats = signalStats(left, right);
  const diagnostics = synth.getDiagnostics();
  console.log(
    `${scenario.name.padEnd(30)} ${written.seconds.toFixed(1)}s  rpm ${rpmMin.toFixed(0)}-${rpmMax.toFixed(0)}  peak ${stats.peak.toFixed(3)}  rms ${stats.rmsDb.toFixed(1)} dBFS  clipped ${stats.clipped}  nan ${stats.nonFinite}  events ${diagnostics.firingEvents}`,
  );
  return {
    name: scenario.name,
    description: scenario.description,
    seconds: written.seconds,
    peak: stats.peak,
    rmsDb: stats.rmsDb,
    clippedSamples: stats.clipped,
    nonFiniteSamples: stats.nonFinite,
    firingEvents: diagnostics.firingEvents,
    crackles: diagnostics.crackles,
    engineId: config.id,
    rpmRange: [Math.round(rpmMin), Math.round(rpmMax)],
    space,
  };
}

const scenarios = [
  {
    name: "01-idle-trackside",
    description: "Cold-ish idle, exterior microphone. Listen for the lopey cross-plane beat.",
    seconds: 8,
    space: "trackside",
    script: () => ({ throttle: 0 }),
  },
  {
    name: "02-throttle-blips",
    description: "Three throttle blips from idle: tip-in bark, overrun crackle on the way down.",
    seconds: 10,
    space: "trackside",
    inertiaScale: 1.8,
    script: (t) => {
      const blip = (start, length) => t >= start && t < start + length;
      const throttle = blip(1.5, 0.35) || blip(4, 0.5) || blip(7, 0.9) ? 1 : 0;
      return { throttle, loadTorqueNm: 25 };
    },
  },
  {
    name: "03-sweep-to-limiter",
    description: "Loaded pull from idle to the rev limiter, limiter bounce, then lift-off.",
    seconds: 12,
    space: "trackside",
    inertiaScale: 8,
    roadLoadCoefficient: 3e-6,
    script: (t) => {
      if (t < 0.8) return { throttle: 0, loadTorqueNm: 10 };
      if (t < 9.5) return { throttle: 1, loadTorqueNm: 190 };
      return { throttle: 0, loadTorqueNm: 40 };
    },
  },
  {
    name: "04-cockpit-cruise",
    description: "Inside the car at a cruise, then a part-throttle tip-in. Cabin filtering + short reverb.",
    seconds: 9,
    space: "cockpit",
    cabin: 1,
    inertiaScale: 30,
    roadLoadCoefficient: 1.55e-6,
    startRpm: 2400,
    script: (t) => ({ throttle: t > 3.5 && t < 6.5 ? 0.6 : 0.12 }),
    ambience: (t) => ({ speedMps: 28 + 4 * Math.sin(t), slip: 0.05, surface: 1, brake: 0, kerb: 0 }),
  },
  {
    name: "05-tunnel-pass",
    description: "Wide open through a tunnel: the reverb tail is doing the work here.",
    seconds: 10,
    space: "tunnel",
    inertiaScale: 16,
    roadLoadCoefficient: 9e-6,
    startRpm: 3200,
    script: (t) => ({ throttle: t < 8.5 ? 1 : 0, loadTorqueNm: 60, wet: 0.62 }),
    ambience: (t) => ({ speedMps: 40 + 3 * t, slip: 0.08, surface: 1, brake: 0, kerb: 0 }),
  },
  {
    name: "06-flatplane-reference",
    description: "Same pull with a 180-degree flat-plane crank: no rumble, pure even-order scream (A/B reference).",
    seconds: 12,
    engine: FLATPLANE_V8,
    space: "trackside",
    inertiaScale: 8,
    roadLoadCoefficient: 3e-6,
    script: (t) => {
      if (t < 0.8) return { throttle: 0, loadTorqueNm: 10 };
      if (t < 9.5) return { throttle: 1, loadTorqueNm: 190 };
      return { throttle: 0, loadTorqueNm: 40 };
    },
  },
  {
    name: "07-slide-and-kerbs",
    description: "Power-on slide over a kerb: tyre squeal, rumble strip and exhaust together.",
    seconds: 9,
    space: "trackside",
    inertiaScale: 14,
    roadLoadCoefficient: 5e-6,
    startRpm: 3400,
    script: (t) => ({ throttle: t < 7.5 ? 0.9 : 0.2, loadTorqueNm: 120 }),
    ambience: (t) => ({
      speedMps: 33,
      slip: t > 2 && t < 6.5 ? 0.75 : 0.1,
      surface: 0.85,
      brake: t > 7.5 ? 0.6 : 0,
      kerb: t > 3.5 && t < 4.6 ? 1 : 0,
    }),
  },
];

const report = scenarios.map(renderScenario);
const reportPath = join(OUT_DIR, "audio-render-report.json");
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sampleRate: SAMPLE_RATE,
      clips: report,
      note: "Objective statistics only. Tone, rumble and driving feel are scored by a human listener.",
    },
    null,
    2,
  ),
);
console.log(`\nwrote ${report.length} clips + ${reportPath}`);
