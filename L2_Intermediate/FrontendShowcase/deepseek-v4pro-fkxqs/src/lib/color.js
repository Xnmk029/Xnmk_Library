/** Tiny colour + math helpers shared by the Canvas background and the HUD. */

/** '#23ff00' -> [35, 255, 0] */
export function hexToRgb(hex) {
  let h = String(hex).replace('#', '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbString = (rgb) => `${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}`;

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent exponential smoothing factor. */
export const smoothing = (dt, speed) => 1 - Math.exp(-dt * speed);

export function lerpRgbInto(out, target, t) {
  out[0] = lerp(out[0], target[0], t);
  out[1] = lerp(out[1], target[1], t);
  out[2] = lerp(out[2], target[2], t);
  return out;
}

/** Deterministic 32-bit PRNG (mulberry32) — stable visuals across reloads. */
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
