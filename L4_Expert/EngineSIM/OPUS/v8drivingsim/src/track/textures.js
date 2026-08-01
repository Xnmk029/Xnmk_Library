/**
 * Procedurally generated surface textures.
 *
 * Everything here is drawn into a canvas at load time. No image files, no
 * network fetches, nothing to 404 -- and the whole set costs about 60 ms to
 * build and roughly 2 MB of VRAM.
 *
 * The asphalt normal map is derived from the same height field that produced
 * the albedo, which is what makes the aggregate read as bumps under the sun
 * rather than as painted-on speckle.
 */

import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Tileable value noise
 * ------------------------------------------------------------------ */

function hash2(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) & 0x7fffffff) / 0x7fffffff;
}

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Fractal value noise that tiles exactly.
 *
 * The lattice period is forced to divide the texture size at every octave, so
 * sampling wraps seamlessly. Without that, a repeating ground plane shows a
 * visible grid of seams.
 */
function fbm(size, baseCells, octaves, seed, gain = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells * (1 << o);
    if (cells > size) break;
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step;
      const y0 = Math.floor(gy) % cells;
      const y1 = (y0 + 1) % cells;
      const fy = smooth(gy - Math.floor(gy));
      for (let x = 0; x < size; x++) {
        const gx = x / step;
        const x0 = Math.floor(gx) % cells;
        const x1 = (x0 + 1) % cells;
        const fx = smooth(gx - Math.floor(gx));
        const a = hash2(x0, y0, seed + o);
        const b = hash2(x1, y0, seed + o);
        const c = hash2(x0, y1, seed + o);
        const d = hash2(x1, y1, seed + o);
        const top = a + (b - a) * fx;
        const bot = c + (d - c) * fx;
        out[y * size + x] += amp * (top + (bot - top) * fy);
      }
    }
    norm += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function finish(canvas, repeat, { srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Turn a height field into a tangent-space normal map.
 * Central differences, wrapped so the result tiles like its source.
 */
function normalMapFrom(height, size, strength) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height[y * size + ((x - 1 + size) % size)];
      const r = height[y * size + ((x + 1) % size)];
      const u = height[((y - 1 + size) % size) * size + x];
      const dn = height[((y + 1) % size) * size + x];
      let nx = (l - r) * strength;
      let ny = (u - dn) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / len) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

/**
 * Asphalt: albedo + normal + roughness, all from one height field.
 * `repeat` is in tiles; the track ribbon maps roughly 1 tile per 4 m.
 */
export function asphaltTextures(size = 512, repeat = [1, 1]) {
  // Two scales of noise: coarse for patchy tone, fine for aggregate.
  const coarse = fbm(size, 4, 3, 11);
  const grain = fbm(size, 64, 3, 27);
  const height = new Float32Array(size * size);

  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rough = makeCanvas(size);
  const rctx = rough.getContext('2d');
  const rimg = rctx.createImageData(size, size);
  const rd = rimg.data;

  for (let i = 0; i < size * size; i++) {
    // Aggregate: sparse bright chips embedded in dark bitumen.
    const chip = grain[i] > 0.63 ? (grain[i] - 0.63) * 2.6 : 0;
    const tone = 0.34 + coarse[i] * 0.3;
    const v = tone * 0.5 + chip * 0.55;
    height[i] = grain[i] * 0.8 + coarse[i] * 0.2;

    // Slight blue-grey cast; bitumen is never neutral.
    const r = Math.min(255, v * 255 * 1.02);
    const g = Math.min(255, v * 255 * 1.0);
    const b = Math.min(255, v * 255 * 1.06);
    const o = i * 4;
    d[o] = r;
    d[o + 1] = g;
    d[o + 2] = b;
    d[o + 3] = 255;

    // Polished (darker, smoother) where the coarse noise is low: the racing
    // line is shinier than the rest of the track.
    const rv = 0.62 + (1 - coarse[i]) * 0.22 - chip * 0.18;
    const rq = Math.max(0, Math.min(1, rv)) * 255;
    rd[o] = rq;
    rd[o + 1] = rq;
    rd[o + 2] = rq;
    rd[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  rctx.putImageData(rimg, 0, 0);

  return {
    map: finish(canvas, repeat),
    normalMap: finish(normalMapFrom(height, size, 2.6), repeat, { srgb: false }),
    roughnessMap: finish(rough, repeat, { srgb: false }),
  };
}

/** Grass: mottled green with a bit of dry patchiness. */
export function grassTexture(size = 256, repeat = [1, 1]) {
  const coarse = fbm(size, 3, 3, 5);
  const fine = fbm(size, 48, 2, 91);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    // Keep the low-frequency term modest. A strong one looks great on a single
    // tile and turns into an obvious repeating blotch pattern once the texture
    // is tiled ninety times across a field.
    const dry = coarse[i] * 0.45;
    const blade = fine[i];
    const r = 58 + dry * 62 + blade * 30;
    const g = 92 + dry * 46 + blade * 38;
    const b = 42 + dry * 22 + blade * 18;
    const o = i * 4;
    d[o] = r;
    d[o + 1] = g;
    d[o + 2] = b;
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: finish(canvas, repeat),
    normalMap: finish(normalMapFrom(fine, size, 1.4), repeat, { srgb: false }),
  };
}

/** Gravel / sand run-off. */
export function gravelTexture(size = 256, repeat = [1, 1]) {
  const grain = fbm(size, 56, 3, 303);
  const coarse = fbm(size, 6, 2, 77);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = 0.55 + grain[i] * 0.36 + coarse[i] * 0.12;
    const o = i * 4;
    d[o] = Math.min(255, v * 214);
    d[o + 1] = Math.min(255, v * 196);
    d[o + 2] = Math.min(255, v * 168);
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: finish(canvas, repeat),
    normalMap: finish(normalMapFrom(grain, size, 3.4), repeat, { srgb: false }),
  };
}

/** Weathered concrete, for barriers and the pit wall. */
export function concreteTexture(size = 256, repeat = [1, 1]) {
  const coarse = fbm(size, 5, 4, 404);
  const fine = fbm(size, 40, 2, 505);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = 0.62 + coarse[i] * 0.24 + fine[i] * 0.1;
    const o = i * 4;
    d[o] = Math.min(255, v * 208);
    d[o + 1] = Math.min(255, v * 206);
    d[o + 2] = Math.min(255, v * 198);
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { map: finish(canvas, repeat) };
}

/**
 * Start/finish: a band of black-and-white blocks. Drawn rather than noised
 * because it needs hard edges.
 */
export function startLineTexture(size = 256) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e9e9e9';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1a1a1a';
  const cells = 8;
  const c = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * c, y * c, c, c);
    }
  }
  // Scuff it so it does not look like a fresh decal.
  const grime = fbm(size, 12, 2, 707);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const g = 0.82 + grime[i] * 0.3;
    img.data[i * 4] *= g;
    img.data[i * 4 + 1] *= g;
    img.data[i * 4 + 2] *= g;
  }
  ctx.putImageData(img, 0, 0);
  return finish(canvas, [1, 1]);
}

/** Soft round sprite for smoke and dust particles. */
export function smokeTexture(size = 64) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.32)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
