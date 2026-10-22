// ============================================================
//  palette.js — 全局美术基调（《逃离鸭科夫》视觉语言）
//  · 场景：低饱和冷色 · 微缩工业废土
//  · 角色：高饱和固有色（暗场可读性）
//  · 统一深色描边 + 三阶赛璐璐光照
// ============================================================

import { clamp01, lerp } from './util.js';

export const OUTLINE = '#14151c';
export const OUTLINE_SOFT = '#1d1f28';

/** 环境色板（低饱和、偏冷） */
export const ENV = {
  asphalt: '#3b3f46',
  asphalt2: '#43474f',
  concrete: '#585c60',
  concrete2: '#4e5256',
  dirt: '#5b5243',
  dirt2: '#655b4a',
  gravel: '#5a5b58',
  grass: '#4a5940',
  grass2: '#53634a',
  grassDry: '#6b6647',
  woodFloor: '#6a5236',
  woodFloor2: '#5e4930',
  tileFloor: '#7a7f84',
  tileFloor2: '#6e7378',
  labFloor: '#4a5560',
  labFloor2: '#425059',
  carpet: '#5d4750',
  water: '#2f4a56',
  wallBrick: '#7a5a4c',
  wallBrickDark: '#5f453a',
  wallConcrete: '#767b80',
  wallConcreteDark: '#5c6166',
  wallWood: '#7d6343',
  wallWoodDark: '#5f4a31',
  wallLab: '#8b949c',
  wallLabDark: '#6b747c',
  metal: '#6d747a',
  metalDark: '#525a60',
  rust: '#8a5433',
  crate: '#8a6b3d',
  crateDark: '#6b5230',
  container: '#3f6b62',
  containerAlt: '#7a4b3f',
  blood: '#7d2b32',
  snowless: '#6a6f74',
  glass: '#8fb6c4',
};

/** 角色/装备色板（高饱和） */
export const CHAR = {
  duckYellow: '#ffd24a',
  duckOrange: '#ff9f43',
  duckPink: '#ffb3c1',
  duckWhite: '#f3efe3',
  duckSick: '#a8c86a',   // 感染鸭：病态绿
  duckSick2: '#8fae57',
  duckElite: '#c86a4a',
  beak: '#ff8c1a',
  beakDark: '#d96f0c',
  foot: '#ff8c1a',
  gearOlive: '#4d5340',
  gearSand: '#a08a5f',
  gearBlack: '#2a2c33',
  gearGray: '#575d63',
  visor: '#7de3ff',
  bossPurple: '#6d5b8f',
};

/** 弹药曳光颜色（子弹等级可视化，来自视觉分析报告） */
export const TRACER = {
  1: '#ffb347', // 常规：橙黄
  2: '#ffd166',
  3: '#4fc3ff', // 蓝弹：穿甲
  4: '#63d2ff',
  5: '#c77dff', // 紫弹：高穿
  6: '#7dffd4', // 能量弹
};

// ------------------------------------------------------------
//  颜色工具
// ------------------------------------------------------------
const _cache = new Map();

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
}
export function mix(a, b, t) {
  const key = a + '|' + b + '|' + t.toFixed(3);
  const c = _cache.get(key);
  if (c) return c;
  const A = hexToRgb(a), B = hexToRgb(b);
  const out = rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
  _cache.set(key, out);
  return out;
}
/** k<1 变暗，k>1 变亮 */
export function shade(hex, k) {
  const key = hex + '#' + k.toFixed(3);
  const c = _cache.get(key);
  if (c) return c;
  const [r, g, b] = hexToRgb(hex);
  const out = rgbToHex(Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k));
  _cache.set(key, out);
  return out;
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
/** 降低饱和度（废土基调） */
export function desat(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const l = r * 0.299 + g * 0.587 + b * 0.114;
  return rgbToHex(lerp(r, l, amount), lerp(g, l, amount), lerp(b, l, amount));
}

// ------------------------------------------------------------
//  三阶赛璐璐光照（Tone Banding）
//  将连续光照量化为 暗部 / 过渡部 / 亮部
// ------------------------------------------------------------
export const BANDS = [0.40, 0.68, 1.0];
export function bandOf(light) {
  const l = clamp01(light);
  if (l < 0.34) return 0;
  if (l < 0.72) return 1;
  return 2;
}
/** 取阶梯光照后的颜色 */
export function celColor(hex, light) {
  return shade(hex, BANDS[bandOf(light)]);
}
/** 夜色/阴影染色：暗部偏冷蓝（而非纯黑） */
export const NIGHT_TINT = '#0d1420';
export const SHADOW_TINT = '#1b2230';
