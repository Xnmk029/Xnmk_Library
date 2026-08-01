// ---------------------------------------------------------------
// 噪声工具：种子随机、2D 值噪声（晶格周期 256，可无缝平铺）、fbm
// ---------------------------------------------------------------

/** 种子随机数生成器 (mulberry32) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 2D 值噪声，晶格周期 256（x、y 方向均以 256 为周期 → 天然无缝平铺）。
 */
export function makeValueNoise2D(seed) {
  const rand = mulberry32(seed);
  const vals = new Float32Array(256);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { vals[i] = rand(); perm[i] = i; }
  // Fisher-Yates 洗牌
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  function hash(ix, iy) {
    return vals[(perm[(ix & 255)] + iy) & 255];
  }
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, octaves = 4) => {
    let sum = 0, amp = 0.5, norm = 0, f = 1;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise(x * f, y * f);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
  return { noise, fbm };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;
