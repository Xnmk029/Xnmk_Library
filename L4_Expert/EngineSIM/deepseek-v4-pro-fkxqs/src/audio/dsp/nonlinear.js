/**
 * Cheap bounded non-linearities.
 *
 * Two jobs: (1) model the genuinely non-linear behaviour of high-amplitude gas
 * pulses in a pipe (asymmetric wave steepening), and (2) guarantee that no
 * stage of the chain can ever hand an unbounded value to the next stage.
 */

/** Rational tanh approximation, |softClip(x)| < 1 for every finite x. */
export function softClip(x) {
  const ax = x < 0 ? -x : x;
  return x / (1 + ax);
}

/**
 * Smooth saturator with a linear region, unity slope at zero and a hard
 * asymptote at +/-1. Cheaper than tanh and monotone, so it cannot fold.
 */
export function saturate(x, drive = 1) {
  const d = drive <= 0 ? 1e-6 : drive;
  const v = x * d;
  const av = v < 0 ? -v : v;
  if (av < 1e-12) return 0;
  const y = v / Math.sqrt(1 + v * v);
  return y;
}

/**
 * Asymmetric saturation: positive (compression) half of a gas pulse steepens
 * more than the negative (rarefaction) half. This asymmetry generates the even
 * harmonics that make an exhaust note sound "hard" under load.
 */
export function saturateAsymmetric(x, drive = 1, asymmetry = 0.25) {
  const up = drive * (1 + asymmetry);
  const down = drive * (1 - asymmetry);
  return x >= 0 ? saturate(x, up) : saturate(x, down);
}

/**
 * Hard safety clamp; the very last thing the renderer applies.
 * A non-finite value becomes silence rather than full scale: NaN is a bug
 * somewhere upstream, and a full-scale click is a worse way to report it.
 */
export function clampSample(x, ceiling = 1) {
  if (!Number.isFinite(x)) return 0;
  if (x > ceiling) return ceiling;
  if (x < -ceiling) return -ceiling;
  return x;
}

/** Replace non-finite values by 0 without changing finite ones. */
export function sanitize(x) {
  return Number.isFinite(x) ? x : 0;
}
