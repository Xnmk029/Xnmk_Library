/**
 * Engine-order analysis helpers.
 *
 * Part of the product, not the test folder, because the acceptance criteria of
 * this project are spectral: the same code that proves "the 4th order tracks
 * rpm" in CI also feeds the in-browser diagnostics overlay.
 */

import { bandMagnitude, magnitudeSpectrum, peakInBand, toDb } from "./fft.js";
import { orderToHz } from "../firing.js";

/** Orders inspected by default: every half order up to the 16th. */
export const DEFAULT_ORDERS = (() => {
  const list = [];
  for (let o = 0.5; o <= 16.0001; o += 0.5) list.push(Math.round(o * 10) / 10);
  return list;
})();

/**
 * Render a synth into fresh stereo buffers.
 * @param {{render:(l:Float32Array,r:Float32Array,n:number)=>unknown, sampleRate:number}} synth
 * @param {number} seconds
 */
export function renderStereo(synth, seconds) {
  const frames = Math.round(synth.sampleRate * seconds);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  synth.render(left, right, frames);
  const mono = new Float64Array(frames);
  for (let i = 0; i < frames; i++) mono[i] = (left[i] + right[i]) * 0.5;
  return { left, right, mono, frames };
}

/**
 * Run the synth for `seconds` and throw the audio away: lets the pipe model,
 * reverb tail and gas temperature reach steady state before measuring.
 */
export function warmup(synth, seconds = 0.6) {
  const frames = Math.round(synth.sampleRate * seconds);
  const l = new Float32Array(frames);
  const r = new Float32Array(frames);
  synth.render(l, r, frames);
  if (typeof synth.resetDiagnostics === "function") synth.resetDiagnostics();
  return synth;
}

/**
 * Level (dB) of each requested engine order.
 * @param {ArrayLike<number>} signal
 * @param {number} sampleRate
 * @param {number} rpm
 * @param {number[]} [orders]
 * @param {number} [halfWidthHz] integration half-width around each order
 * @returns {Map<number, number>} order -> dB
 */
export function orderLevelsDb(signal, sampleRate, rpm, orders = DEFAULT_ORDERS, halfWidthHz = 1.6) {
  const { magnitudes, binHz } = magnitudeSpectrum(signal, sampleRate);
  const out = new Map();
  for (const order of orders) {
    out.set(order, toDb(bandMagnitude(magnitudes, binHz, orderToHz(order, rpm), halfWidthHz)));
  }
  return out;
}

/** Total energy (dB) of the half-integer orders - the cross-plane signature. */
export function halfOrderEnergyDb(levels) {
  let sum = 0;
  for (const [order, db] of levels) {
    if (!Number.isInteger(order)) sum += Math.pow(10, db / 10);
  }
  return 10 * Math.log10(Math.max(sum, 1e-30));
}

/** Total energy (dB) of the integer orders. */
export function integerOrderEnergyDb(levels) {
  let sum = 0;
  for (const [order, db] of levels) {
    if (Number.isInteger(order)) sum += Math.pow(10, db / 10);
  }
  return 10 * Math.log10(Math.max(sum, 1e-30));
}

/** Strongest order within `[minOrder, maxOrder]`. */
export function dominantOrder(levels, minOrder = 0.5, maxOrder = 16) {
  let best = { order: 0, db: -Infinity };
  for (const [order, db] of levels) {
    if (order < minOrder || order > maxOrder) continue;
    if (db > best.db) best = { order, db };
  }
  return best;
}

/**
 * Measure the actual frequency of one engine order by finding the spectral peak
 * inside a +/-`windowFraction` window around its expected position.
 * @returns {{expectedHz:number, measuredHz:number, errorHz:number, relativeError:number, magnitude:number}}
 */
export function measureOrderFrequency(signal, sampleRate, rpm, order, windowFraction = 0.08) {
  const { magnitudes, binHz } = magnitudeSpectrum(signal, sampleRate);
  const expectedHz = orderToHz(order, rpm);
  const peak = peakInBand(magnitudes, binHz, expectedHz * (1 - windowFraction), expectedHz * (1 + windowFraction));
  return {
    expectedHz,
    measuredHz: peak.frequency,
    errorHz: peak.frequency - expectedHz,
    relativeError: expectedHz > 0 ? (peak.frequency - expectedHz) / expectedHz : 0,
    magnitude: peak.magnitude,
  };
}

/**
 * Global spectral peak below `maxHz` expressed as a multiple of the firing
 * frequency. A value that is (very close to) an integer proves that the loudest
 * thing in the signal is a firing harmonic and not an unrelated resonance.
 */
export function dominantPeakAsFiringMultiple(signal, sampleRate, firingHz, maxHz = 1200, minHz = 20) {
  const { magnitudes, binHz } = magnitudeSpectrum(signal, sampleRate);
  const peak = peakInBand(magnitudes, binHz, minHz, maxHz);
  const multiple = peak.frequency / firingHz;
  return {
    frequencyHz: peak.frequency,
    multiple,
    nearestInteger: Math.round(multiple),
    deviation: Math.abs(multiple - Math.round(multiple)),
  };
}

/**
 * Largest absolute sample-to-sample difference: a cheap, very sensitive
 * detector for parameter-jump clicks (a discontinuity always shows up here).
 */
export function maxSampleDelta(signal, from = 1, to = signal.length) {
  let worst = 0;
  for (let i = Math.max(1, from); i < to; i++) {
    const d = Math.abs(signal[i] - signal[i - 1]);
    if (d > worst) worst = d;
  }
  return worst;
}

/** Peak / RMS / finiteness / clipping report for a stereo pair. */
export function signalStats(left, right) {
  let peak = 0;
  let sumSquares = 0;
  let clipped = 0;
  let nonFinite = 0;
  const n = left.length;
  for (let i = 0; i < n; i++) {
    const l = left[i];
    const r = right[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      nonFinite++;
      continue;
    }
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    sumSquares += l * l + r * r;
  }
  return {
    peak,
    rms: Math.sqrt(sumSquares / (2 * n)),
    rmsDb: toDb(Math.sqrt(sumSquares / (2 * n))),
    clipped,
    clippedFraction: clipped / n,
    nonFinite,
    frames: n,
  };
}
