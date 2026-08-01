/**
 * fft.mjs -- tiny radix-2 FFT for diagnostics (spectrum panels, offline
 * analysis). No dependencies, power-of-two sizes only.
 */

export function fft(re, im) {
  const n = re.length;
  if (n <= 1) return;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Magnitude spectrum of a real signal. Returns Float32Array of bins 0..n/2. */
export function magnitudeSpectrum(signal) {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(signal);
  fft(re, im);
  const mag = new Float64Array(n / 2 + 1);
  const scale = 2 / n;
  for (let i = 0; i <= n / 2; i++) mag[i] = Math.hypot(re[i], im[i]) * scale;
  return mag;
}

/**
 * Energy near a frequency given a magnitude spectrum.
 * Sums a small bin window around the exact frequency.
 */
export function energyAt(mag, sampleRate, freq, windowHz = 6) {
  const n2 = mag.length - 1;
  const bin = (freq / sampleRate) * 2 * n2;
  const half = Math.max(1, Math.ceil((windowHz / sampleRate) * 2 * n2));
  let e = 0;
  for (let i = Math.max(0, Math.round(bin) - half); i <= Math.min(n2, Math.round(bin) + half); i++) {
    e += mag[i] * mag[i];
  }
  return e;
}
