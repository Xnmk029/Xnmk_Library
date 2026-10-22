// mulberry32 种子随机 + 噪声工具
export class RNG {
  constructor(seed = 1) { this.s = seed >>> 0; if (this.s === 0) this.s = 0x9e3779b9; }
  next() { let t = (this.s += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}

// 2D 值噪声（用于城镇布局）
export function makeNoise2D(seed = 42) {
  const r = new RNG(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => { const g = h & 7; const u = g < 4 ? x : y; const v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -v : v); };
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1], ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    const x1 = grad(aa, xf, yf), x2 = grad(ba, xf - 1, yf), y1 = grad(ab, xf, yf - 1), y2 = grad(bb, xf - 1, yf - 1);
    const lerp = (a, b, t) => a + t * (b - a);
    return lerp(lerp(x1, x2, u), lerp(y1, y2, u), v);
  };
}
export const clamp = (v, a, b) => (Number.isNaN(v) ? a : v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); };
export const TAU = Math.PI * 2;
export const fmtTime = (h) => { const hh = Math.floor(h); const mm = Math.floor((h - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
export const fmtW = (kg) => kg >= 1 ? kg.toFixed(1) + ' kg' : Math.round(kg * 1000) + ' g';
