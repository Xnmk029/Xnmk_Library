/**
 * Delay-line primitives for the acoustic (waveguide) part of the exhaust model.
 *
 * A gas column is modelled as a bi-directional digital waveguide: one delay
 * line per travel direction, a reflection coefficient at each termination and a
 * one-pole loss filter for wall/viscous damping. That is the cheap, real-time
 * equivalent of engine-sim's impulse-response convolution of the exhaust
 * network: the impulse response is *generated* by the recursion instead of
 * being convolved sample by sample.
 */

import { OnePoleLowpass } from "./filters.js";

/** Power-of-two ring buffer with linearly interpolated fractional reads. */
export class FractionalDelay {
  /** @param {number} maxDelaySamples */
  constructor(maxDelaySamples) {
    const needed = Math.max(4, Math.ceil(maxDelaySamples) + 4);
    let size = 4;
    while (size < needed) size *= 2;
    this.buffer = new Float32Array(size);
    this.mask = size - 1;
    this.writeIndex = 0;
  }

  reset() {
    this.buffer.fill(0);
    this.writeIndex = 0;
    return this;
  }

  /** @param {number} x sample to push into the line */
  write(x) {
    this.buffer[this.writeIndex] = x;
    this.writeIndex = (this.writeIndex + 1) & this.mask;
  }

  /**
   * Read `delay` samples in the past (fractional, linear interpolation).
   * @param {number} delay in samples, >= 1
   */
  read(delay) {
    const maxDelay = this.mask - 2;
    const d = delay < 1 ? 1 : delay > maxDelay ? maxDelay : delay;
    const base = Math.floor(d);
    const frac = d - base;
    const i0 = (this.writeIndex - base + this.buffer.length) & this.mask;
    const i1 = (i0 - 1 + this.buffer.length) & this.mask;
    const a = this.buffer[i0];
    return a + frac * (this.buffer[i1] - a);
  }

  /** Integer read, used by the reverb where fractional accuracy is irrelevant. */
  readInt(delay) {
    const maxDelay = this.mask - 1;
    const d = delay < 1 ? 1 : delay > maxDelay ? maxDelay : delay | 0;
    return this.buffer[(this.writeIndex - d + this.buffer.length) & this.mask];
  }
}

/**
 * One acoustic pipe section as a bi-directional waveguide.
 *
 * Terminations are supplied by the caller each sample, which is what makes the
 * model *time-varying*: a closed exhaust valve reflects almost perfectly
 * (r ~ +0.95), an open valve is a much softer termination. Because a
 * cross-plane V8 opens the valves of one bank at uneven crank spacing, that
 * time-varying termination is exactly what creates the half-order (720-degree
 * periodic) rumble that a purely linear filter chain can never produce.
 */
export class WaveguideSection {
  /**
   * @param {number} sampleRate
   * @param {object} options
   * @param {number} options.maxDelaySamples upper bound of the one-way travel time
   * @param {number} options.dampingHz wall-loss low-pass cutoff
   */
  constructor(sampleRate, { maxDelaySamples, dampingHz = 6500 }) {
    this.sampleRate = sampleRate;
    this.forward = new FractionalDelay(maxDelaySamples);
    this.backward = new FractionalDelay(maxDelaySamples);
    this.lossForward = new OnePoleLowpass(sampleRate, dampingHz);
    this.lossBackward = new OnePoleLowpass(sampleRate, dampingHz);
    this.delaySamples = Math.max(2, maxDelaySamples * 0.5);
    this.returning = 0;
  }

  reset() {
    this.forward.reset();
    this.backward.reset();
    this.lossForward.reset();
    this.lossBackward.reset();
    this.returning = 0;
    return this;
  }

  setDelaySamples(delaySamples) {
    const max = this.forward.mask - 3;
    this.delaySamples = Math.min(Math.max(delaySamples, 2), max);
    return this;
  }

  setDampingHz(hz) {
    this.lossForward.setCutoff(hz);
    this.lossBackward.setCutoff(hz);
    return this;
  }

  /**
   * Advance the section by one sample.
   * @param {number} input excitation injected at the near (valve) end
   * @param {number} nearReflection reflection coefficient at the valve end
   * @param {number} farReflection reflection coefficient at the far (collector) end
   * @returns {number} pressure wave leaving the far end
   */
  process(input, nearReflection, farReflection) {
    const injected = input + this.returning * nearReflection;
    this.forward.write(this.lossForward.process(injected));
    const arrived = this.forward.read(this.delaySamples);
    this.backward.write(this.lossBackward.process(arrived * farReflection));
    this.returning = this.backward.read(this.delaySamples);
    return arrived;
  }
}

/**
 * Feed-forward/feedback comb pair used for muffler chambers and quarter-wave
 * side branches. A negative feedback comb notches out the frequencies whose
 * half wavelength matches the chamber, which is how a real reflective muffler
 * removes the harsh upper orders while keeping the low-order thump.
 */
export class CombChamber {
  constructor(sampleRate, delaySeconds, feedback = -0.42, dampingHz = 4200) {
    this.line = new FractionalDelay(Math.ceil(delaySeconds * sampleRate) + 8);
    this.delaySamples = Math.max(2, delaySeconds * sampleRate);
    this.feedback = feedback;
    this.loss = new OnePoleLowpass(sampleRate, dampingHz);
  }

  reset() {
    this.line.reset();
    this.loss.reset();
    return this;
  }

  process(x) {
    const delayed = this.line.read(this.delaySamples);
    const y = x + delayed;
    this.line.write(this.loss.process(x + delayed * this.feedback));
    return y * 0.5;
  }
}
