/**
 * Space engine: early reflections + a modulated 4x4 feedback delay network.
 *
 * This module is the "enhanced reverb / driving immersion" part of the brief and
 * is entirely original work (engine-sim itself ships no reverberator). It is
 * deliberately tiny: 1 pre-delay line, 8 early taps, 4 recirculating lines,
 * 4 one-pole dampers and an orthogonal Hadamard mix. Cost is ~40 flops/sample
 * for a full stereo tail, which is what keeps the whole engine affordable.
 */

import { FractionalDelay } from "./delay.js";
import { OnePoleLowpass } from "./filters.js";

/** Prime-ish base delays (seconds) - mutually incommensurate to avoid flutter. */
const LINE_SECONDS = [0.0297, 0.0371, 0.0411, 0.0437];
const LFO_RATES_HZ = [0.11, 0.157, 0.19, 0.234];
/** Early reflection pattern: [timeSeconds, gain, pan(-1..1)] */
const EARLY_TAPS = [
  [0.0043, 0.72, -0.7],
  [0.0071, 0.61, 0.55],
  [0.0113, 0.5, 0.85],
  [0.0149, 0.44, -0.45],
  [0.0193, 0.36, 0.25],
  [0.0241, 0.3, -0.9],
  [0.0307, 0.24, 0.65],
  [0.0389, 0.19, -0.2],
];

/**
 * Named acoustic environments. `wet` is the default send level for the space;
 * the driver may scale it further with speed/load.
 */
export const SPACE_PRESETS = {
  /** Inside the car: short, dark, dense - this is the "driving" listener. */
  cockpit: { rt60: 0.42, size: 0.42, dampingHz: 3600, predelayMs: 4.5, width: 0.55, wet: 0.3, earlyLevel: 0.8 },
  /** Chase camera on an open track: long lazy tail, wide stereo. */
  trackside: { rt60: 1.35, size: 1, dampingHz: 6200, predelayMs: 13, width: 0.95, wet: 0.36, earlyLevel: 0.55 },
  /** Concrete pit lane / paddock: mid tail with strong slap-back. */
  pitlane: { rt60: 1.75, size: 0.85, dampingHz: 4800, predelayMs: 9, width: 0.8, wet: 0.44, earlyLevel: 0.95 },
  /** Tunnel: the money shot for a V8 - very long, bright, huge. */
  tunnel: { rt60: 2.9, size: 1.35, dampingHz: 8200, predelayMs: 21, width: 1, wet: 0.62, earlyLevel: 1 },
};

/** @returns {string[]} available space preset names */
export function spacePresetNames() {
  return Object.keys(SPACE_PRESETS);
}

export class SpaceReverb {
  /**
   * @param {number} sampleRate
   * @param {string|object} [preset] preset name or explicit parameter object
   */
  constructor(sampleRate, preset = "trackside") {
    this.sampleRate = sampleRate;
    this.outL = 0;
    this.outR = 0;

    this.predelay = new FractionalDelay(Math.ceil(0.09 * sampleRate) + 8);
    this.predelaySamples = 8;

    this.lines = LINE_SECONDS.map((sec) => new FractionalDelay(Math.ceil(sec * 2.2 * sampleRate) + 16));
    this.lineDelays = LINE_SECONDS.map((sec) => sec * sampleRate);
    this.lineGains = [0.8, 0.8, 0.8, 0.8];
    this.dampers = LINE_SECONDS.map(() => new OnePoleLowpass(sampleRate, 6000));
    this.lfoPhase = [0, 0.25, 0.5, 0.75];
    this.lfoInc = LFO_RATES_HZ.map((hz) => hz / sampleRate);
    this.modDepth = 2.5;
    this.denormalFlip = 1;

    this.earlyTaps = EARLY_TAPS.map(([sec, gain, pan]) => ({ samples: sec * sampleRate, gain, pan }));
    this.earlyLevel = 0.6;
    this.width = 0.9;
    this.wet = 0.35;
    this.rt60 = 1;
    this.size = 1;

    this.setPreset(preset);
  }

  /** @param {string|object} preset */
  setPreset(preset) {
    const p = typeof preset === "string" ? SPACE_PRESETS[preset] : preset;
    if (!p) return this;
    this.configure(p);
    return this;
  }

  /**
   * @param {object} params
   * @param {number} [params.rt60] reverberation time in seconds
   * @param {number} [params.size] geometric scale of the space
   * @param {number} [params.dampingHz] air/absorption low-pass in the tail
   * @param {number} [params.predelayMs] pre-delay
   * @param {number} [params.width] stereo width 0..1
   * @param {number} [params.wet] default wet level
   * @param {number} [params.earlyLevel] early reflection level
   */
  configure(params) {
    if (Number.isFinite(params.rt60)) this.rt60 = Math.min(Math.max(params.rt60, 0.05), 8);
    if (Number.isFinite(params.size)) this.size = Math.min(Math.max(params.size, 0.15), 2);
    if (Number.isFinite(params.width)) this.width = Math.min(Math.max(params.width, 0), 1);
    if (Number.isFinite(params.wet)) this.wet = Math.min(Math.max(params.wet, 0), 1);
    if (Number.isFinite(params.earlyLevel)) this.earlyLevel = Math.min(Math.max(params.earlyLevel, 0), 1.5);
    if (Number.isFinite(params.predelayMs)) {
      this.predelaySamples = Math.max(1, (params.predelayMs / 1000) * this.sampleRate);
    }
    if (Number.isFinite(params.dampingHz)) {
      for (const d of this.dampers) d.setCutoff(params.dampingHz);
    }
    for (let i = 0; i < this.lines.length; i++) {
      const base = LINE_SECONDS[i] * this.size * this.sampleRate;
      const maxDelay = this.lines[i].mask - 8;
      this.lineDelays[i] = Math.min(Math.max(base, 16), maxDelay);
      // Feedback gain that realises the requested RT60 for this line length.
      this.lineGains[i] = Math.pow(10, (-3 * this.lineDelays[i]) / (this.rt60 * this.sampleRate));
    }
    return this;
  }

  reset() {
    this.predelay.reset();
    for (const l of this.lines) l.reset();
    for (const d of this.dampers) d.reset();
    this.outL = 0;
    this.outR = 0;
    return this;
  }

  /**
   * Process one mono sample into `outL`/`outR` (wet only, no dry path).
   * @param {number} x
   */
  process(x) {
    const denormal = 1e-18 * this.denormalFlip;
    this.denormalFlip = -this.denormalFlip;

    this.predelay.write(x + denormal);
    const pre = this.predelay.read(this.predelaySamples);

    let earlyL = 0;
    let earlyR = 0;
    for (let i = 0; i < this.earlyTaps.length; i++) {
      const tap = this.earlyTaps[i];
      const s = this.predelay.read(tap.samples * this.size) * tap.gain;
      const panR = (tap.pan + 1) * 0.5;
      earlyL += s * (1 - panR);
      earlyR += s * panR;
    }
    earlyL *= this.earlyLevel * 0.5;
    earlyR *= this.earlyLevel * 0.5;

    // Read the recirculating lines (with a little chorus-free modulation).
    const d0 = this.dampers[0].process(this.lines[0].read(this.lineDelays[0] + this.modDepth * Math.sin(this.lfoPhase[0] * 6.283185307179586)));
    const d1 = this.dampers[1].process(this.lines[1].read(this.lineDelays[1] + this.modDepth * Math.sin(this.lfoPhase[1] * 6.283185307179586)));
    const d2 = this.dampers[2].process(this.lines[2].read(this.lineDelays[2] + this.modDepth * Math.sin(this.lfoPhase[2] * 6.283185307179586)));
    const d3 = this.dampers[3].process(this.lines[3].read(this.lineDelays[3] + this.modDepth * Math.sin(this.lfoPhase[3] * 6.283185307179586)));

    const g0 = d0 * this.lineGains[0];
    const g1 = d1 * this.lineGains[1];
    const g2 = d2 * this.lineGains[2];
    const g3 = d3 * this.lineGains[3];

    // Normalised 4x4 Hadamard: lossless rotation, so RT60 comes only from gains.
    const h0 = 0.5 * (g0 + g1 + g2 + g3);
    const h1 = 0.5 * (g0 - g1 + g2 - g3);
    const h2 = 0.5 * (g0 + g1 - g2 - g3);
    const h3 = 0.5 * (g0 - g1 - g2 + g3);

    const inject = pre * 0.5;
    this.lines[0].write(inject + h0 + denormal);
    this.lines[1].write(inject + h1 - denormal);
    this.lines[2].write(inject + h2 + denormal);
    this.lines[3].write(inject + h3 - denormal);

    for (let i = 0; i < 4; i++) {
      this.lfoPhase[i] += this.lfoInc[i];
      if (this.lfoPhase[i] >= 1) this.lfoPhase[i] -= 1;
    }

    const tailMid = (d0 + d1 + d2 + d3) * 0.25;
    const tailSide = (d0 - d1 + d2 - d3) * 0.25;
    const side = tailSide * this.width;
    this.outL = earlyL + tailMid + side;
    this.outR = earlyR + tailMid - side;
    return this;
  }
}
