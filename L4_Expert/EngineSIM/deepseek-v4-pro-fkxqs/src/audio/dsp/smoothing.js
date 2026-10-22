/**
 * Parameter smoothing.
 *
 * Every control value that reaches the audio thread (throttle, rpm, load, mix,
 * pipe temperature) is smoothed here. This is the mechanism that satisfies the
 * "no audible parameter-jump clicks" requirement: a host can slam a control
 * from 0 to 1 in one block and the audio path still sees a continuous ramp.
 */

/** One-pole smoother specified by a time constant in seconds. */
export class ParamSmoother {
  constructor(sampleRate, timeConstantSec, initialValue = 0) {
    this.sampleRate = sampleRate;
    this.value = initialValue;
    this.target = initialValue;
    this.coefficient = 0;
    this.setTimeConstant(timeConstantSec);
  }

  setTimeConstant(timeConstantSec) {
    const t = Math.max(timeConstantSec, 1 / this.sampleRate);
    this.coefficient = 1 - Math.exp(-1 / (t * this.sampleRate));
    return this;
  }

  setTarget(target) {
    this.target = Number.isFinite(target) ? target : this.target;
    return this;
  }

  /** Jump instantly (used only when (re)initialising a voice). */
  snap(value) {
    const v = Number.isFinite(value) ? value : 0;
    this.value = v;
    this.target = v;
    return this;
  }

  next() {
    this.value += this.coefficient * (this.target - this.value);
    return this.value;
  }

  /** Advance by `n` samples at once (control-rate stepping). */
  advance(n) {
    for (let i = 0; i < n; i++) this.next();
    return this.value;
  }
}

/**
 * Slew limiter with independent rise/fall rates per second.
 * Used for the rpm control input so that an unrealistic external rpm jump can
 * never produce a discontinuity in the crank-angle phase.
 */
export class SlewLimiter {
  constructor(sampleRate, riseRatePerSec, fallRatePerSec = riseRatePerSec, initialValue = 0) {
    this.riseStep = riseRatePerSec / sampleRate;
    this.fallStep = fallRatePerSec / sampleRate;
    this.value = initialValue;
  }

  snap(value) {
    this.value = Number.isFinite(value) ? value : this.value;
    return this;
  }

  process(target, steps = 1) {
    const t = Number.isFinite(target) ? target : this.value;
    const delta = t - this.value;
    const maxUp = this.riseStep * steps;
    const maxDown = this.fallStep * steps;
    if (delta > maxUp) this.value += maxUp;
    else if (delta < -maxDown) this.value -= maxDown;
    else this.value = t;
    return this.value;
  }
}
