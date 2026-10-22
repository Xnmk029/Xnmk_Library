// VOXY CRAFT — 程序化材质（SVG 像素风贴图 + 图集）
// 每个 tile 由代码生成 16×16 像素网格 → SVG → 光栅化进图集。零外部图片。
// 设计见 SPEC-设计 §8，技术见 SPEC-技术 §9。
import * as THREE from 'three';
import { hash2 } from '../math/rng.js';
import { TILE_KEYS, TILE_COUNT, tilePalette } from './tiles.js';
import { DYES } from './registry.js';

const TS = 16;

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
function strHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// 每像素确定性噪声 [0,1)
function pn(x, y, seed) { return hash2(x * 57 + 13, y * 131 + 7, seed); }

class Grid {
  constructor() { this.d = new Uint8ClampedArray(TS * TS * 4); }
  set(x, y, r, g, b, a = 255) {
    if (x < 0 || x > 15 || y < 0 || y > 15) return;
    const i = (x + y * TS) * 4;
    this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = a;
  }
}

function dyeColor(key) {
  const suffix = key.slice(key.indexOf('_') + 1);
  const d = DYES.find((x) => x.key === suffix);
  if (!d) return null;
  const n = parseInt(d.hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---- 图案库 ----
function fillNoise(g, base, variance, seed, alpha = 255) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const n = (pn(x, y, seed) - 0.5) * 2 * variance;
    g.set(x, y, clamp255(base[0] + n), clamp255(base[1] + n), clamp255(base[2] + n), alpha);
  }
}

function stoneBase(g, base, seed) {
  fillNoise(g, base, 14, seed);
  // 几条暗色裂纹
  for (let k = 0; k < 4; k++) {
    let x = (pn(k, 1, seed) * 16) | 0, y = (pn(k, 2, seed) * 16) | 0;
    for (let s = 0; s < 5; s++) {
      g.set(x, y, clamp255(base[0] - 34), clamp255(base[1] - 34), clamp255(base[2] - 34));
      x += (pn(x, y, seed + 5) * 3 - 1) | 0; y += (pn(y, x, seed + 9) * 2) | 0;
    }
  }
}

function orePattern(g, base, ore, seed) {
  stoneBase(g, base, seed);
  for (let c = 0; c < 5; c++) {
    const cx = 2 + (pn(c, 3, seed) * 12) | 0, cy = 2 + (pn(c, 4, seed) * 12) | 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
      if (pn(cx + dx, cy + dy, seed + c) > 0.35)
        g.set(cx + dx, cy + dy, ore[0], ore[1], ore[2]);
  }
}

function grassTop(g, base, seed) {
  fillNoise(g, base, 20, seed);
  for (let i = 0; i < 24; i++) {
    const x = (pn(i, 5, seed) * 16) | 0, y = (pn(i, 6, seed) * 16) | 0;
    g.set(x, y, clamp255(base[0] - 22), clamp255(base[1] + 12), clamp255(base[2] - 22));
  }
}

function grassSide(g, base, dirt, seed) {
  fillNoise(g, dirt, 16, seed);
  for (let x = 0; x < TS; x++) {
    const h = 3 + ((pn(x, 0, seed) * 3) | 0);
    for (let y = 0; y < h; y++) {
      const n = (pn(x, y, seed + 2) - 0.5) * 30;
      g.set(x, y, clamp255(base[0] + n), clamp255(base[1] + n), clamp255(base[2] + n));
    }
  }
}

function logSide(g, base, seed) {
  for (let x = 0; x < TS; x++) {
    const stripe = (pn(x, 0, seed) - 0.5) * 34;
    for (let y = 0; y < TS; y++) {
      const n = (pn(x, y, seed + 1) - 0.5) * 12;
      g.set(x, y, clamp255(base[0] + stripe + n), clamp255(base[1] + stripe + n), clamp255(base[2] + stripe + n));
    }
  }
  // 横向节疤
  for (let k = 0; k < 2; k++) { const y = (pn(k, 8, seed) * 16) | 0; for (let x = 0; x < TS; x++) g.set(x, y, clamp255(base[0] - 30), clamp255(base[1] - 30), clamp255(base[2] - 30)); }
}

function logTop(g, base, seed) {
  fillNoise(g, base, 10, seed);
  const cx = 7.5, cy = 7.5;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (((d | 0) % 3) === 0) g.set(x, y, clamp255(base[0] - 28), clamp255(base[1] - 28), clamp255(base[2] - 28));
  }
}

function leaves(g, base, seed) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const r = pn(x, y, seed);
    if (r < 0.16) continue; // 透明孔洞，制造蓬松感
    const n = (r - 0.5) * 46;
    g.set(x, y, clamp255(base[0] + n), clamp255(base[1] + n), clamp255(base[2] + n));
  }
}

function planks(g, base, seed) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const plank = (y / 4) | 0;
    const seam = (y % 4 === 0);
    const grain = (pn(x, plank, seed + x) - 0.5) * 18;
    const off = seam ? -34 : 0;
    g.set(x, y, clamp255(base[0] + grain + off), clamp255(base[1] + grain + off), clamp255(base[2] + grain + off));
  }
}

function bricks(g, base, seed) {
  const mortar = [base[0] - 46, base[1] - 46, base[2] - 46];
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const row = (y / 4) | 0;
    const offset = (row % 2) * 4;
    const isMortar = (y % 4 === 0) || ((x + offset) % 8 === 0);
    const n = (pn(x, y, seed) - 0.5) * 16;
    const c = isMortar ? mortar : base;
    g.set(x, y, clamp255(c[0] + n), clamp255(c[1] + n), clamp255(c[2] + n));
  }
}

function glass(g, tint, seed) {
  // 近乎透明 + 边框 + 对角高光
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const border = (x === 0 || y === 0 || x === 15 || y === 15);
    const highlight = (x === y) || (x === y + 1);
    if (border) g.set(x, y, clamp255(tint[0] + 40), clamp255(tint[1] + 40), clamp255(tint[2] + 40), 235);
    else if (highlight) g.set(x, y, 235, 245, 250, 120);
    else g.set(x, y, tint[0], tint[1], tint[2], 46);
  }
}

function plant(g, color, seed) {
  // 透明底 + 茎 + 花/叶
  for (let y = 0; y < TS; y++) {
    const sx = 7 + ((pn(y, 0, seed) * 2) | 0);
    g.set(sx, y, 70, 120, 50); // 茎
  }
  for (let i = 0; i < 10; i++) {
    const x = 4 + ((pn(i, 1, seed) * 8) | 0), y = 1 + ((pn(i, 2, seed) * 6) | 0);
    g.set(x, y, color[0], color[1], color[2]);
  }
}

// ---- tile key → 绘制 ----
function drawTile(key, base, seed) {
  const g = new Grid();
  const B = base;
  if (key === 'grass_top') grassTop(g, [92, 140, 62], seed);
  else if (key === 'grass_side') grassSide(g, [92, 140, 62], [115, 82, 58], seed);
  else if (key === 'dirt' || key === 'podzol') fillNoise(g, key === 'podzol' ? [107, 82, 50] : [115, 82, 58], 16, seed);
  else if (key === 'sand') fillNoise(g, [212, 196, 140], 12, seed);
  else if (key === 'red_sand') fillNoise(g, [192, 112, 72], 12, seed);
  else if (key === 'gravel') fillNoise(g, [133, 128, 124], 26, seed);
  else if (key === 'snow_block' || key === 'snow_layer') fillNoise(g, [238, 242, 248], 6, seed);
  else if (key === 'stone' || key === 'smooth_stone') stoneBase(g, [127, 127, 133], seed);
  else if (key === 'cobblestone' || key === 'mossy_cobble') { stoneBase(g, key === 'mossy_cobble' ? [108, 122, 98] : [117, 117, 123], seed); }
  else if (key === 'deepslate' || key === 'mossy_deepslate') stoneBase(g, key === 'mossy_deepslate' ? [76, 90, 76] : [81, 81, 88], seed);
  else if (key === 'granite') stoneBase(g, [154, 106, 96], seed);
  else if (key === 'diorite') stoneBase(g, [184, 184, 188], seed);
  else if (key === 'andesite') stoneBase(g, [140, 140, 144], seed);
  else if (key === 'basalt' || key === 'bedrock') stoneBase(g, key === 'bedrock' ? [51, 51, 56] : [76, 76, 82], seed);
  else if (key.endsWith('_ore')) {
    const ORE = { coal: [40, 40, 46], iron: [200, 168, 136], copper: [192, 120, 72], gold: [232, 200, 80], diamond: [90, 216, 208], redstone: [192, 56, 42], lapis: [58, 88, 192], emerald: [58, 192, 96] };
    const name = key.slice(0, key.indexOf('_'));
    orePattern(g, [127, 127, 133], ORE[name] || [200, 200, 200], seed);
  }
  else if (key.endsWith('_block')) fillNoise(g, B, 10, seed);
  else if (key.endsWith('_log_side')) logSide(g, B, seed);
  else if (key.endsWith('_log_top')) logTop(g, B, seed);
  else if (key.endsWith('_leaves')) leaves(g, B, seed);
  else if (key.endsWith('_planks')) planks(g, B, seed);
  else if (key === 'bricks' || key.endsWith('_bricks') || key === 'stone_tiles') bricks(g, B, seed);
  else if (key === 'glass' || key.startsWith('glass_')) glass(g, key === 'glass' ? [200, 220, 224] : dyeColor(key) || B, seed);
  else if (key === 'flower') plant(g, [216, 90, 122], seed);
  else if (key === 'tallgrass' || key === 'fern' || key === 'sugarcane' || key === 'bamboo') plant(g, B, seed);
  else if (key === 'mushroom_red') plant(g, [192, 72, 58], seed);
  else if (key === 'mushroom_brown') plant(g, [154, 122, 90], seed);
  else if (key === 'water') fillNoise(g, [53, 104, 192], 10, seed, 200);
  else if (key === 'ice' || key === 'packed_ice' || key === 'blue_ice') fillNoise(g, B, 8, seed, 210);
  else if (key.startsWith('wool_')) fillNoise(g, dyeColor(key) || B, 8, seed);
  else if (key.startsWith('concrete_')) fillNoise(g, dyeColor(key) || B, 4, seed);
  else if (key.startsWith('terracotta_')) fillNoise(g, dyeColor(key) || B, 12, seed);
  else if (key.startsWith('carpet_')) fillNoise(g, dyeColor(key) || B, 10, seed);
  else if (key.startsWith('bed_')) fillNoise(g, dyeColor(key) || B, 8, seed);
  else fillNoise(g, B, 14, seed); // 通用回退
  return g;
}

function gridToSVG(g) {
  let rects = '';
  const d = g.d;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const i = (x + y * TS) * 4;
    const a = d[i + 3];
    if (a <= 0) continue;
    rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="rgb(${d[i]},${d[i + 1]},${d[i + 2]})"${a < 255 ? ` fill-opacity="${(a / 255).toFixed(2)}"` : ''}/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects}</svg>`;
}

function loadSVG(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// 构建图集（浏览器环境，异步）
export async function buildAtlas() {
  const palette = tilePalette();
  const per = 16;
  const cols = per, rows = Math.ceil(TILE_COUNT / per);
  const canvas = document.createElement('canvas');
  canvas.width = cols * TS; canvas.height = rows * TS;
  const ctx = canvas.getContext('2d');

  const jobs = TILE_KEYS.map(async (key, i) => {
    const base = [palette[i * 3] * 255, palette[i * 3 + 1] * 255, palette[i * 3 + 2] * 255];
    const g = drawTile(key, base, strHash(key));
    const img = await loadSVG(gridToSVG(g));
    const tx = (i % cols) * TS, ty = ((i / cols) | 0) * TS;
    ctx.drawImage(img, tx, ty, TS, TS);
  });
  await Promise.all(jobs);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return { texture: tex, tilesPerRow: cols, tileSize: TS, tileCount: TILE_COUNT, canvas };
}

// 单个 tile 的 SVG（物品图标 / 调试用）
export function tileSVG(key) {
  const i = TILE_KEYS.indexOf(key);
  const palette = tilePalette();
  const base = i >= 0 ? [palette[i * 3] * 255, palette[i * 3 + 1] * 255, palette[i * 3 + 2] * 255] : [200, 200, 200];
  return gridToSVG(drawTile(key, base, strHash(key)));
}
