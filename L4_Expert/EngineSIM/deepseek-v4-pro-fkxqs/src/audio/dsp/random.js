/**
 * Deterministic, allocation-free noise sources.
 *
 * Every stochastic element of the engine synthesiser (turbulence, combustion
 * jitter, overrun crackle, tyre scrub) is driven from a seeded xorshift32
 * generator so that offline renders and unit tests are bit-reproducible.
 */

const INV_UINT32 = 1 / 4294967296;

/** Fast, deterministic 32-bit xorshift PRNG. */
export class Xorshift32 {
  /** @param {number} [seed] non-zero 32-bit seed */
  constructor(seed = 0x9e3779b9) {
    this.state = (seed | 0) === 0 ? 0x9e3779b9 : seed >>> 0;
  }

  /** @returns {number} next raw 32-bit unsigned value */
  nextUint32() {
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x;
  }

  /** @returns {number} uniform value in [0, 1) */
  nextUnit() {
    return this.nextUint32() * INV_UINT32;
  }

  /** @returns {number} uniform value in [-1, 1) */
  nextBipolar() {
    return this.nextUint32() * INV_UINT32 * 2 - 1;
  }

  /**
   * Approximately normal deviate (sum of three uniforms, variance normalised).
   * Cheaper than Box-Muller and bounded, which keeps the audio path safe.
   * @returns {number} value in (-1.73, 1.73)
   */
  nextGaussian() {
    const a = this.nextUnit();
    const b = this.nextUnit();
    const c = this.nextUnit();
    return (a + b + c - 1.5) * 1.1547005383792515;
  }
}

/**
 * Pink-ish noise (-3 dB/oct) via the classic Voss/McCartney economy filter.
 * Used for intake rush, wind and tyre noise where white noise is too harsh.
 */
export class PinkNoise {
  /** @param {Xorshift32} rng */
  constructor(rng) {
    this.rng = rng;
    this.b0 = 0;
    this.b1 = 0;
    this.b2 = 0;
  }

  /** @returns {number} pink noise sample, roughly in [-1, 1] */
  next() {
    const white = this.rng.nextBipolar();
    this.b0 = 0.99765 * this.b0 + white * 0.0990460;
    this.b1 = 0.96300 * this.b1 + white * 0.2965164;
    this.b2 = 0.57000 * this.b2 + white * 1.0526913;
    return (this.b0 + this.b1 + this.b2 + white * 0.1848) * 0.42;
  }
}
