/**
 * Minimal, allocation-free filter primitives.
 *
 * All filters are single-sample `process()` objects: they are safe inside an
 * AudioWorklet render quantum (no allocation, no branching on sample data) and
 * they are individually unit-testable in Node.
 */

const TWO_PI = Math.PI * 2;

/** Clamp a frequency into a numerically safe band for a given sample rate. */
export function clampFrequency(hz, sampleRate) {
  const nyquist = sampleRate * 0.5;
  if (!Number.isFinite(hz)) return nyquist * 0.5;
  return Math.min(Math.max(hz, 1), nyquist * 0.98);
}

/** One-pole low-pass (exponential moving average) with a cutoff in Hz. */
export class OnePoleLowpass {
  constructor(sampleRate, cutoffHz) {
    this.sampleRate = sampleRate;
    this.z = 0;
    this.a = 0;
    this.setCutoff(cutoffHz);
  }

  setCutoff(cutoffHz) {
    const f = clampFrequency(cutoffHz, this.sampleRate);
    this.a = 1 - Math.exp((-TWO_PI * f) / this.sampleRate);
    return this;
  }

  reset() {
    this.z = 0;
    return this;
  }

  process(x) {
    this.z += this.a * (x - this.z);
    return this.z;
  }
}

/** One-pole high-pass, built as `x - lowpass(x)`; doubles as a DC blocker. */
export class OnePoleHighpass {
  constructor(sampleRate, cutoffHz) {
    this.lp = new OnePoleLowpass(sampleRate, cutoffHz);
  }

  setCutoff(cutoffHz) {
    this.lp.setCutoff(cutoffHz);
    return this;
  }

  reset() {
    this.lp.reset();
    return this;
  }

  process(x) {
    return x - this.lp.process(x);
  }
}

/**
 * DC blocker (`y[n] = x[n] - x[n-1] + R*y[n-1]`).
 * The exhaust pulse train carries a large positive mean; removing it before the
 * limiter is what keeps the output symmetric and clip-free.
 */
export class DcBlocker {
  constructor(sampleRate, cutoffHz = 12) {
    this.r = Math.exp((-TWO_PI * clampFrequency(cutoffHz, sampleRate)) / sampleRate);
    this.x1 = 0;
    this.y1 = 0;
  }

  reset() {
    this.x1 = 0;
    this.y1 = 0;
    return this;
  }

  process(x) {
    const y = x - this.x1 + this.r * this.y1;
    this.x1 = x;
    this.y1 = y;
    return y;
  }
}

/**
 * Bilinear-transform (RBJ cookbook) biquad in transposed direct form II.
 * Coefficients can be retuned every control block; the state stays bounded
 * because every design routine clamps frequency and Q.
 */
export class Biquad {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.s1 = 0;
    this.s2 = 0;
  }

  reset() {
    this.s1 = 0;
    this.s2 = 0;
    return this;
  }

  /** @private */
  setNormalised(b0, b1, b2, a0, a1, a2) {
    const inv = 1 / a0;
    this.b0 = b0 * inv;
    this.b1 = b1 * inv;
    this.b2 = b2 * inv;
    this.a1 = a1 * inv;
    this.a2 = a2 * inv;
    return this;
  }

  /** @private */
  intermediates(freqHz, q) {
    const f = clampFrequency(freqHz, this.sampleRate);
    const safeQ = Math.min(Math.max(Number.isFinite(q) ? q : 0.707, 0.05), 40);
    const w0 = (TWO_PI * f) / this.sampleRate;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alpha = sw / (2 * safeQ);
    return { cw, alpha };
  }

  lowpass(freqHz, q = Math.SQRT1_2) {
    const { cw, alpha } = this.intermediates(freqHz, q);
    const b1 = 1 - cw;
    return this.setNormalised(b1 * 0.5, b1, b1 * 0.5, 1 + alpha, -2 * cw, 1 - alpha);
  }

  highpass(freqHz, q = Math.SQRT1_2) {
    const { cw, alpha } = this.intermediates(freqHz, q);
    const b0 = (1 + cw) * 0.5;
    return this.setNormalised(b0, -(1 + cw), b0, 1 + alpha, -2 * cw, 1 - alpha);
  }

  bandpass(freqHz, q = 1) {
    const { cw, alpha } = this.intermediates(freqHz, q);
    return this.setNormalised(alpha, 0, -alpha, 1 + alpha, -2 * cw, 1 - alpha);
  }

  notch(freqHz, q = 4) {
    const { cw, alpha } = this.intermediates(freqHz, q);
    return this.setNormalised(1, -2 * cw, 1, 1 + alpha, -2 * cw, 1 - alpha);
  }

  peaking(freqHz, q, gainDb) {
    const { cw, alpha } = this.intermediates(freqHz, q);
    const a = Math.pow(10, Math.min(Math.max(gainDb, -36), 36) / 40);
    return this.setNormalised(
      1 + alpha * a,
      -2 * cw,
      1 - alpha * a,
      1 + alpha / a,
      -2 * cw,
      1 - alpha / a,
    );
  }

  lowShelf(freqHz, gainDb, slope = 1) {
    const f = clampFrequency(freqHz, this.sampleRate);
    const a = Math.pow(10, Math.min(Math.max(gainDb, -36), 36) / 40);
    const w0 = (TWO_PI * f) / this.sampleRate;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alpha = (sw / 2) * Math.sqrt((a + 1 / a) * (1 / slope - 1) + 2);
    const twoSqrtAAlpha = 2 * Math.sqrt(a) * alpha;
    return this.setNormalised(
      a * (a + 1 - (a - 1) * cw + twoSqrtAAlpha),
      2 * a * (a - 1 - (a + 1) * cw),
      a * (a + 1 - (a - 1) * cw - twoSqrtAAlpha),
      a + 1 + (a - 1) * cw + twoSqrtAAlpha,
      -2 * (a - 1 + (a + 1) * cw),
      a + 1 + (a - 1) * cw - twoSqrtAAlpha,
    );
  }

  highShelf(freqHz, gainDb, slope = 1) {
    const f = clampFrequency(freqHz, this.sampleRate);
    const a = Math.pow(10, Math.min(Math.max(gainDb, -36), 36) / 40);
    const w0 = (TWO_PI * f) / this.sampleRate;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alpha = (sw / 2) * Math.sqrt((a + 1 / a) * (1 / slope - 1) + 2);
    const twoSqrtAAlpha = 2 * Math.sqrt(a) * alpha;
    return this.setNormalised(
      a * (a + 1 + (a - 1) * cw + twoSqrtAAlpha),
      -2 * a * (a - 1 + (a + 1) * cw),
      a * (a + 1 + (a - 1) * cw - twoSqrtAAlpha),
      a + 1 - (a - 1) * cw + twoSqrtAAlpha,
      2 * (a - 1 - (a + 1) * cw),
      a + 1 - (a - 1) * cw - twoSqrtAAlpha,
    );
  }

  process(x) {
    const y = this.b0 * x + this.s1;
    this.s1 = this.b1 * x - this.a1 * y + this.s2;
    this.s2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

/**
 * Two-pole resonator used for body/panel resonances and tyre squeal formants.
 * Implemented directly (not via the cookbook) so the peak gain stays unity and
 * retuning it every block cannot pump energy into the state.
 */
export class Resonator {
  constructor(sampleRate, freqHz, decayTimeSec) {
    this.sampleRate = sampleRate;
    this.y1 = 0;
    this.y2 = 0;
    this.b0 = 1;
    this.a1 = 0;
    this.a2 = 0;
    this.set(freqHz, decayTimeSec);
  }

  set(freqHz, decayTimeSec) {
    const f = clampFrequency(freqHz, this.sampleRate);
    const t = Math.max(decayTimeSec, 1e-4);
    const r = Math.exp(-1 / (t * this.sampleRate));
    const theta = (TWO_PI * f) / this.sampleRate;
    this.a1 = 2 * r * Math.cos(theta);
    this.a2 = -(r * r);
    this.b0 = (1 - r) * Math.sqrt(1 + r * r - 2 * r * Math.cos(2 * theta));
    return this;
  }

  reset() {
    this.y1 = 0;
    this.y2 = 0;
    return this;
  }

  process(x) {
    const y = this.b0 * x + this.a1 * this.y1 + this.a2 * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}
