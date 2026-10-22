/**
 * Minimal radix-2 FFT and spectral helpers.
 *
 * Used by the automated order/rpm-tracking tests and by the in-browser
 * diagnostics overlay. Kept in `src` (not `test`) on purpose: the objective
 * acceptance criteria of this project are spectral, so the measurement code is
 * part of the product.
 */

/**
 * In-place iterative complex FFT.
 * @param {Float64Array} re
 * @param {Float64Array} im
 */
export function fftInPlace(re, im) {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) {
    throw new Error("fftInPlace requires power-of-two arrays of equal length");
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + half] * cr - im[i + k + half] * ci;
        const vi = re[i + k + half] * ci + im[i + k + half] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + half] = ur - vr;
        im[i + k + half] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Periodic Hann window of length n. */
export function hannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

/**
 * Windowed magnitude spectrum of a real signal.
 *
 * Use `window: "none"` when the input *is* an impulse response: a Hann window
 * starts at zero and would delete exactly the part that carries the response.
 *
 * @param {ArrayLike<number>} signal
 * @param {number} sampleRate
 * @param {object} [options]
 * @param {number} [options.fftSize] power of two; defaults to the largest that fits
 * @param {number} [options.offset] first sample to analyse
 * @param {"hann"|"none"} [options.window]
 * @returns {{magnitudes: Float64Array, binHz: number, fftSize: number}}
 */
export function magnitudeSpectrum(signal, sampleRate, { fftSize, offset = 0, window = "hann" } = {}) {
  const available = signal.length - offset;
  let size = fftSize;
  if (!size) {
    size = 1;
    while (size * 2 <= available) size *= 2;
  }
  if (size > available) throw new Error("magnitudeSpectrum: fftSize exceeds available samples");
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  if (window === "none") {
    for (let i = 0; i < size; i++) re[i] = signal[offset + i];
  } else {
    const win = hannWindow(size);
    for (let i = 0; i < size; i++) re[i] = signal[offset + i] * win[i];
  }
  fftInPlace(re, im);
  const bins = size / 2;
  const magnitudes = new Float64Array(bins);
  const norm = 2 / size;
  for (let i = 0; i < bins; i++) magnitudes[i] = Math.hypot(re[i], im[i]) * norm;
  return { magnitudes, binHz: sampleRate / size, fftSize: size };
}

/**
 * Highest magnitude inside [lowHz, highHz] with parabolic interpolation of both
 * frequency and amplitude, which pushes frequency accuracy well below one bin
 * and removes most of the window's scalloping loss from the level.
 * @returns {{frequency:number, magnitude:number, binMagnitude:number, binIndex:number}}
 */
export function peakInBand(magnitudes, binHz, lowHz, highHz) {
  const first = Math.max(1, Math.ceil(lowHz / binHz));
  const last = Math.min(magnitudes.length - 2, Math.floor(highHz / binHz));
  let bestIndex = first;
  let best = -1;
  for (let i = first; i <= last; i++) {
    if (magnitudes[i] > best) {
      best = magnitudes[i];
      bestIndex = i;
    }
  }
  // Interpolate on the log scale: for a Hann window the main lobe is very
  // close to a parabola in dB, which is what makes this sub-bin accurate for
  // both the frequency and the level.
  const yl = toDb(magnitudes[bestIndex - 1]);
  const y0 = toDb(magnitudes[bestIndex]);
  const yr = toDb(magnitudes[bestIndex + 1]);
  const denominator = yl - 2 * y0 + yr;
  const delta = denominator === 0 ? 0 : (0.5 * (yl - yr)) / denominator;
  const clampedDelta = Math.min(Math.max(delta, -0.5), 0.5);
  const peakDb = y0 - 0.25 * (yl - yr) * clampedDelta;
  return {
    frequency: (bestIndex + clampedDelta) * binHz,
    magnitude: Math.pow(10, peakDb / 20),
    binMagnitude: magnitudes[bestIndex],
    binIndex: bestIndex,
  };
}

/**
 * RMS-style magnitude of the energy inside a narrow band around `centerHz`.
 * @param {Float64Array} magnitudes
 * @param {number} binHz
 * @param {number} centerHz
 * @param {number} halfWidthHz
 */
export function bandMagnitude(magnitudes, binHz, centerHz, halfWidthHz) {
  const first = Math.max(0, Math.floor((centerHz - halfWidthHz) / binHz));
  const last = Math.min(magnitudes.length - 1, Math.ceil((centerHz + halfWidthHz) / binHz));
  let sum = 0;
  for (let i = first; i <= last; i++) sum += magnitudes[i] * magnitudes[i];
  return Math.sqrt(sum);
}

/** Convenience: 20*log10 with a floor so silence maps to -200 dB, not -Infinity. */
export function toDb(magnitude) {
  return 20 * Math.log10(Math.max(magnitude, 1e-10));
}
