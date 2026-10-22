/**
 * Output conditioning: peak limiter + guaranteed-bounded final stage.
 *
 * The synthesiser is designed to sit around -12 dBFS RMS, but a rev-limiter
 * bounce or a tunnel reverb bloom can transiently ask for more. This limiter
 * removes those peaks smoothly (no zipper, no pumping at these attack times)
 * and the trailing `saturate` + `clampSample` pair makes "no NaN / no sustained
 * clipping" a structural property of the renderer rather than a hope.
 */

import { clampSample, saturate } from "./nonlinear.js";

export class Limiter {
  /**
   * @param {number} sampleRate
   * @param {object} [options]
   * @param {number} [options.ceiling] linear peak ceiling before the soft clip
   * @param {number} [options.attackMs]
   * @param {number} [options.releaseMs]
   */
  constructor(sampleRate, { ceiling = 0.86, attackMs = 1.6, releaseMs = 160 } = {}) {
    this.ceiling = ceiling;
    this.attack = Math.exp(-1 / ((attackMs / 1000) * sampleRate));
    this.release = Math.exp(-1 / ((releaseMs / 1000) * sampleRate));
    this.envelope = 0;
    this.gain = 1;
    this.gainSmoothing = Math.exp(-1 / (0.0025 * sampleRate));
    this.reduction = 0;
    /** Latest bounded left/right result (written in place - no allocation). */
    this.outL = 0;
    this.outR = 0;
  }

  reset() {
    this.envelope = 0;
    this.gain = 1;
    this.reduction = 0;
    return this;
  }

  /**
   * Compute the gain for the current stereo peak and apply it to both channels.
   * Results land in `outL`/`outR` so the audio thread never allocates.
   * @param {number} l
   * @param {number} r
   */
  process(l, r) {
    const li = Number.isFinite(l) ? l : 0;
    const ri = Number.isFinite(r) ? r : 0;
    const peak = Math.max(li < 0 ? -li : li, ri < 0 ? -ri : ri);
    const coefficient = peak > this.envelope ? this.attack : this.release;
    this.envelope = peak + coefficient * (this.envelope - peak);

    const targetGain = this.envelope > this.ceiling ? this.ceiling / this.envelope : 1;
    this.gain = targetGain + this.gainSmoothing * (this.gain - targetGain);
    this.reduction = 1 - this.gain;

    // saturate() is monotone with |y| < 1, so the pair below can never clip.
    this.outL = clampSample(saturate(li * this.gain, 1.05) * 0.96);
    this.outR = clampSample(saturate(ri * this.gain, 1.05) * 0.96);
    return this;
  }
}
