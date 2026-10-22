/**
 * Shared wavetables.
 *
 * Table lookups replace transcendental calls inside the per-sample loop, which
 * is a large part of why the whole engine fits in a few percent of one core.
 */

const SINE_BITS = 11;
const SINE_SIZE = 1 << SINE_BITS;
const SINE_MASK = SINE_SIZE - 1;

/** One period of a sine, plus a guard point for linear interpolation. */
export const SINE_TABLE = (() => {
  const t = new Float32Array(SINE_SIZE + 1);
  for (let i = 0; i <= SINE_SIZE; i++) t[i] = Math.sin((2 * Math.PI * i) / SINE_SIZE);
  return t;
})();

/**
 * sin(2*pi*phase) by interpolated lookup.
 * @param {number} phase any real number; only the fractional part matters
 */
export function sineLookup(phase) {
  const p = phase - Math.floor(phase);
  const x = p * SINE_SIZE;
  const i = x | 0;
  const frac = x - i;
  const a = SINE_TABLE[i & SINE_MASK];
  const b = SINE_TABLE[(i + 1) & SINE_MASK];
  return a + frac * (b - a);
}

/**
 * Build the normalised exhaust blow-down pressure pulse.
 *
 * Shape (u = 0..1 over the pulse):
 *   - a fast raised-cosine opening ramp (valve cracks open, choked flow),
 *   - an exponential blow-down decay as the cylinder empties,
 *   - a small secondary hump where the returning expansion wave re-reaches the
 *     valve, which is what gives the note its hollow "bark",
 *   - mean removed so the pulse train carries no DC into the pipe model.
 *
 * @param {number} size table length
 * @param {object} [shape]
 */
export function buildBlowdownPulse(size = 1024, { attack = 0.045, decay = 4.6, humpAt = 0.42, humpLevel = 0.16, humpWidth = 0.075 } = {}) {
  const table = new Float32Array(size + 1);
  let mean = 0;
  for (let i = 0; i < size; i++) {
    const u = i / size;
    const rise = u < attack ? 0.5 - 0.5 * Math.cos((Math.PI * u) / attack) : 1;
    const body = Math.exp(-decay * Math.max(0, u - attack));
    const hump = humpLevel * Math.exp(-Math.pow((u - humpAt) / humpWidth, 2));
    const v = rise * body - hump;
    table[i] = v;
    mean += v;
  }
  mean /= size;
  let peak = 0;
  for (let i = 0; i < size; i++) {
    table[i] -= mean;
    const a = table[i] < 0 ? -table[i] : table[i];
    if (a > peak) peak = a;
  }
  const norm = peak > 0 ? 1 / peak : 1;
  for (let i = 0; i < size; i++) table[i] *= norm;
  table[size] = table[0];
  return table;
}

/**
 * Turbulence envelope that rides on top of a blow-down pulse: strongest right
 * after the valve cracks (highest gas velocity), gone by mid-pulse.
 */
export function buildTurbulenceEnvelope(size = 1024) {
  const table = new Float32Array(size + 1);
  for (let i = 0; i < size; i++) {
    const u = i / size;
    table[i] = Math.exp(-7.5 * u) * (1 - Math.exp(-40 * u));
  }
  table[size] = 0;
  return table;
}

/**
 * Interpolated read of a table that has one guard sample at the end.
 * @param {Float32Array} table
 * @param {number} phase 0..1
 */
export function tableLookup(table, phase) {
  const size = table.length - 1;
  const x = phase * size;
  const i = x | 0;
  if (i < 0) return table[0];
  if (i >= size) return table[size];
  const frac = x - i;
  const a = table[i];
  return a + frac * (table[i + 1] - a);
}
