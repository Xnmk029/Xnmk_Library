/**
 * VehicleAmbience - the non-engine half of the driving mix.
 *
 * Entirely original work (engine-sim models an engine on a test bench, not a
 * car): rolling/road noise, wind, tyre scrub and squeal, kerb rumble and brake
 * squeal. It exists because "driving feel" is not only the exhaust: the ear
 * judges speed from wind and road noise and judges grip from the tyres.
 *
 * The module is deliberately additive and self-bounded: it renders *into* an
 * existing stereo buffer and its own contribution can never exceed
 * `OUTPUT_CEILING`, so it cannot make a limited engine bus clip.
 */

import { Biquad, DcBlocker, PinkNoise, Resonator, Xorshift32, clampSample, ParamSmoother, saturate } from "./dsp/index.js";

/** Hard bound on this module's contribution to the mix. */
const OUTPUT_CEILING = 0.16;

function clamp01(x) {
  return Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0;
}

export class VehicleAmbience {
  /**
   * @param {object} [options]
   * @param {number} [options.sampleRate]
   * @param {number} [options.seed]
   */
  constructor({ sampleRate = 48000, seed = 0x7f4a7c15 } = {}) {
    this.sampleRate = sampleRate;
    this.rngL = new Xorshift32(seed);
    this.rngR = new Xorshift32(seed ^ 0x9e3779b9);
    this.pinkL = new PinkNoise(this.rngL);
    this.pinkR = new PinkNoise(this.rngR);

    // Road / rolling noise: broad band with a carcass resonance near 180 Hz.
    this.roadBandL = new Biquad(sampleRate).bandpass(230, 0.55);
    this.roadBandR = new Biquad(sampleRate).bandpass(245, 0.55);
    this.carcassL = new Resonator(sampleRate, 178, 0.02);
    this.carcassR = new Resonator(sampleRate, 186, 0.02);

    // Wind: high-passed noise, level ~ v^2.
    this.windL = new Biquad(sampleRate).highpass(520, 0.7);
    this.windR = new Biquad(sampleRate).highpass(560, 0.7);

    // Tyre scrub/squeal formants.
    this.squealA = new Resonator(sampleRate, 720, 0.05);
    this.squealB = new Resonator(sampleRate, 1180, 0.04);
    this.scrubBand = new Biquad(sampleRate).bandpass(480, 0.8);
    this.squealLfoPhase = 0;

    // Brake squeal: very narrow, only at low speed with pressure applied.
    this.brakeSqueal = new Resonator(sampleRate, 2450, 0.12);

    // Kerb rumble: periodic impacts whose rate follows road speed.
    this.kerbPhase = 0;
    this.kerbBand = new Biquad(sampleRate).bandpass(95, 0.9);

    this.dcL = new DcBlocker(sampleRate, 25);
    this.dcR = new DcBlocker(sampleRate, 25);

    this.speedSm = new ParamSmoother(sampleRate, 0.08, 0);
    this.slipSm = new ParamSmoother(sampleRate, 0.05, 0);
    this.surfaceSm = new ParamSmoother(sampleRate, 0.12, 1);
    this.brakeSm = new ParamSmoother(sampleRate, 0.06, 0);
    this.kerbSm = new ParamSmoother(sampleRate, 0.05, 0);
    this.gainSm = new ParamSmoother(sampleRate, 0.1, 1);

    this.controls = { speedMps: 0, slip: 0, surface: 1, brake: 0, kerb: 0, gain: 1 };
    this.reset();
  }

  reset() {
    this.roadBandL.reset();
    this.roadBandR.reset();
    this.carcassL.reset();
    this.carcassR.reset();
    this.windL.reset();
    this.windR.reset();
    this.squealA.reset();
    this.squealB.reset();
    this.scrubBand.reset();
    this.brakeSqueal.reset();
    this.kerbBand.reset();
    this.dcL.reset();
    this.dcR.reset();
    this.squealLfoPhase = 0;
    this.kerbPhase = 0;
    this.peak = 0;
    this.nonFinite = 0;
    return this;
  }

  /**
   * @param {object} controls
   * @param {number} [controls.speedMps] road speed
   * @param {number} [controls.slip] combined normalised tyre slip 0..1
   * @param {number} [controls.surface] grip/quality of the surface, 1 = asphalt
   * @param {number} [controls.brake] brake pressure 0..1
   * @param {number} [controls.kerb] kerb/rumble-strip contact 0..1
   * @param {number} [controls.gain] master gain for the whole ambience bus
   */
  setControls(controls = {}) {
    const c = this.controls;
    if ("speedMps" in controls) c.speedMps = Number.isFinite(controls.speedMps) ? Math.abs(controls.speedMps) : c.speedMps;
    if ("slip" in controls) c.slip = clamp01(controls.slip);
    if ("surface" in controls) c.surface = clamp01(controls.surface);
    if ("brake" in controls) c.brake = clamp01(controls.brake);
    if ("kerb" in controls) c.kerb = clamp01(controls.kerb);
    if ("gain" in controls) c.gain = Number.isFinite(controls.gain) ? Math.min(Math.max(controls.gain, 0), 2) : c.gain;
    this.speedSm.setTarget(c.speedMps);
    this.slipSm.setTarget(c.slip);
    this.surfaceSm.setTarget(c.surface);
    this.brakeSm.setTarget(c.brake);
    this.kerbSm.setTarget(c.kerb);
    this.gainSm.setTarget(c.gain);
    return this;
  }

  /**
   * Add `frames` samples of ambience into an existing stereo buffer.
   * @param {Float32Array} outL
   * @param {Float32Array} outR
   * @param {number} [frames]
   */
  addInto(outL, outR, frames = outL.length) {
    const sampleRate = this.sampleRate;
    for (let i = 0; i < frames; i++) {
      const speed = this.speedSm.next();
      const slip = this.slipSm.next();
      const surface = this.surfaceSm.next();
      const brake = this.brakeSm.next();
      const kerb = this.kerbSm.next();
      const gain = this.gainSm.next();

      const v = speed / 40;
      const rollLevel = 0.5 * Math.pow(v, 1.15) * (1.25 - 0.45 * surface);
      const windLevel = 0.34 * v * v;

      const nl = this.pinkL.next();
      const nr = this.pinkR.next();
      const wl = this.rngL.nextBipolar();
      const wr = this.rngR.nextBipolar();

      let l = (this.roadBandL.process(nl) + 0.6 * this.carcassL.process(nl)) * rollLevel;
      let r = (this.roadBandR.process(nr) + 0.6 * this.carcassR.process(nr)) * rollLevel;
      l += this.windL.process(wl) * windLevel;
      r += this.windR.process(wr) * windLevel;

      // Tyre scrub rises with slip; above ~0.35 it breaks into a squeal whose
      // level warbles, which is what makes a slide audible.
      if (slip > 0.02) {
        const scrub = this.scrubBand.process(wl + wr) * slip * 0.55 * Math.min(1, v * 2.2);
        this.squealLfoPhase += (7.5 + 12 * slip) / sampleRate;
        if (this.squealLfoPhase >= 1) this.squealLfoPhase -= 1;
        const warble = 0.72 + 0.28 * Math.sin(2 * Math.PI * this.squealLfoPhase);
        const squealDrive = Math.max(0, slip - 0.3) / 0.7;
        const squeal =
          (this.squealA.process(wl) * 0.8 + this.squealB.process(wr) * 0.6) *
          squealDrive *
          warble *
          Math.min(1, v * 3) *
          1.35;
        l += scrub * 0.9 + squeal;
        r += scrub * 1.0 + squeal * 0.92;
      }

      // Kerb / rumble strip: impact rate proportional to speed.
      if (kerb > 0.01 && speed > 0.5) {
        this.kerbPhase += (speed * 1.9) / sampleRate;
        let impulse = 0;
        if (this.kerbPhase >= 1) {
          this.kerbPhase -= 1;
          impulse = 1;
        }
        const thump = this.kerbBand.process(impulse * 6 + wl * 0.35) * kerb * Math.min(1, v * 3) * 1.8;
        l += thump;
        r += thump * 0.85;
      }

      // Brake squeal at low speed.
      if (brake > 0.25 && speed > 0.8 && speed < 12) {
        const gate = brake * (1 - Math.abs(speed - 5) / 7);
        if (gate > 0) {
          const sq = this.brakeSqueal.process(wr) * gate * 0.5;
          l += sq * 0.8;
          r += sq;
        }
      }

      l = this.dcL.process(l) * gain;
      r = this.dcR.process(r) * gain;

      // Self-bounding: OUTPUT_CEILING * saturate() cannot exceed the ceiling.
      const al = OUTPUT_CEILING * saturate(l * 1.4, 1);
      const ar = OUTPUT_CEILING * saturate(r * 1.4, 1);
      const absPeak = Math.max(al < 0 ? -al : al, ar < 0 ? -ar : ar);
      if (absPeak > this.peak) this.peak = absPeak;
      if (!Number.isFinite(al) || !Number.isFinite(ar)) {
        this.nonFinite++;
        this.reset();
        continue;
      }
      outL[i] = clampSample(outL[i] + al);
      outR[i] = clampSample(outR[i] + ar);
    }
    return this;
  }

  /** Diagnostics for tests and the HUD. */
  getDiagnostics() {
    return { peak: this.peak, nonFinite: this.nonFinite, ceiling: OUTPUT_CEILING };
  }
}
