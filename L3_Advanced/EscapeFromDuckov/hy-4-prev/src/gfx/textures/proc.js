// 程序化贴图：零外部资产，全部 Canvas2D 生成。上下文丢失后可直接重建。
import * as THREE from 'three';
import { mulberry32 } from '../../core/rng.js';

const cache = new Map();

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/** 值噪声（可平铺）：用整数格点 + 平滑插值，避免大 canvas 逐像素随机造成的块状 */
function valueNoise(size, cells, seed, alphaLo, alphaHi, tint) {
  const rnd = mulberry32(seed);
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (x, y) => g[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)];
  const img = new ImageData(size, size);
  const s = cells / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x * s, fy = y * s;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      const v = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
      const k = alphaLo + v * (alphaHi - alphaLo);
      const i = (y * size + x) * 4;
      img.data[i] = tint[0] * k; img.data[i + 1] = tint[1] * k; img.data[i + 2] = tint[2] * k; img.data[i + 3] = 255;
    }
  }
  return img;
}

const PALETTE = {
  grass:   { base: '#5d6e4e', cells: 22, seed: 11, lo: .82, hi: 1.18, blob: '#4a5a3e', blobN: 90, blobR: 26 },
  dirt:    { base: '#6b5f4b', cells: 26, seed: 12, lo: .80, hi: 1.20, blob: '#5a4f3d', blobN: 80, blobR: 22 },
  concrete:{ base: '#6f7274', cells: 12, seed: 13, lo: .86, hi: 1.14, blob: '#5f6264', blobN: 60, blobR: 30 },
  asphalt: { base: '#4b4e52', cells: 16, seed: 14, lo: .80, hi: 1.20, blob: '#3f4245', blobN: 70, blobR: 24 },
  metal:   { base: '#7b8288', cells: 10, seed: 15, lo: .84, hi: 1.16, blob: '#6b6f60', blobN: 40, blobR: 18 },
  wood:    { base: '#7a6142', cells: 8,  seed: 16, lo: .82, hi: 1.18, blob: '#655033', blobN: 46, blobR: 20 },
  rust:    { base: '#8a5a3a', cells: 18, seed: 17, lo: .70, hi: 1.35, blob: '#6d4530', blobN: 70, blobR: 22 },
  tile:    { base: '#8d9094', cells: 6,  seed: 18, lo: .90, hi: 1.10, blob: '#7d8084', blobN: 30, blobR: 26 },
};

/** 生成（并缓存）一张可平铺的地表/材质贴图 */
export function procTexture(name, size = 128) {
  const key = name + size;
  if (cache.has(key)) return cache.get(key);
  const p = PALETTE[name] || PALETTE.concrete;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, size, size);

  // 大色块拼接（微缩模型质感：不追求细节贴图，靠色块与局部脏污）
  const rnd = mulberry32(p.seed * 977);
  for (let i = 0; i < p.blobN; i++) {
    const x = rnd() * size, y = rnd() * size, r = (2 + rnd() * p.blobR * .25);
    ctx.fillStyle = p.blob;
    ctx.globalAlpha = .10 + rnd() * .22;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (.5 + rnd()), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // 平铺：跨边界的斑点要在对面补画
    if (x < r || x > size - r || y < r || y > size - r) {
      ctx.beginPath();
      ctx.ellipse(x < r ? x + size : x - size, y < r ? y + size : y - size, r, r * .8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // 噪声叠加
  const img = valueNoise(size, p.cells, p.seed, p.lo, p.hi, hexToRgb(p.base));
  const tmp = makeCanvas(size);
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.globalAlpha = .30;
  ctx.drawImage(tmp, 0, 0);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.name = name;
  cache.set(key, tex);
  return tex;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 贴图着色：同一张噪声图换色复用（集装箱、木箱等） */
export function tinted(name, hex, size = 64) {
  const t = procTexture(name, size).clone();
  t.needsUpdate = true;
  t.name = name + '_tinted';
  // 通过 material.color 着色即可，这里只保证独立实例，避免共享导致的连锁修改
  return t;
}

/** 血迹 / 焦痕等贴地贴花（带 alpha） */
export function decalTexture(kind = 'blood', size = 64) {
  const key = 'decal_' + kind + size;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(kind === 'blood' ? 71 : 72);
  const color = kind === 'blood' ? '#5e1410' : kind === 'scorch' ? '#14100e' : '#3a4a2a';
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * size * 0.34;
    const r = size * (0.08 + rnd() * 0.20);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55 + rnd() * 0.4;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, r * (0.5 + rnd() * 0.8), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/** 预生成全部贴图，避免首次用到时才生成造成掉帧 */
export function warmTextures() {
  return Object.keys(PALETTE).map((k) => procTexture(k));
}

export function disposeTextures() {
  for (const t of cache.values()) t.dispose?.();
  cache.clear();
}
