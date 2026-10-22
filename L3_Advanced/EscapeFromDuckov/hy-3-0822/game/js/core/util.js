// ============================================================
//  util.js — 基础数学 / 随机数 / 时间格式化
//  《鸭科夫毁灭工程》 Duckov Zomboid Project
// ============================================================

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function invLerp(a, b, v) { return b === a ? 0 : clamp01((v - a) / (b - a)); }
export function smoothstep(a, b, v) { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); }
export function sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function len(x, y) { return Math.sqrt(x * x + y * y); }

/** 角度归一化到 -PI..PI */
export function normAng(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
/** 两角最短差值 */
export function angDiff(a, b) { return normAng(a - b); }
/** 朝目标角度旋转，速度受限 */
export function rotToward(cur, target, maxStep) {
  const d = angDiff(target, cur);
  if (Math.abs(d) <= maxStep) return target;
  return normAng(cur + sign(d) * maxStep);
}
export function moveToward(cur, target, maxStep) {
  const d = target - cur;
  if (Math.abs(d) <= maxStep) return target;
  return cur + sign(d) * maxStep;
}
/** 指数趋近（帧率无关的平滑） */
export function damp(cur, target, rate, dt) {
  return target + (cur - target) * Math.exp(-rate * dt);
}

// ------------------------------------------------------------
//  确定性随机数（mulberry32）
// ------------------------------------------------------------
export class RNG {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a = 0, b = 1) { return a + this.next() * (b - a); }
  /** 含端点整数 */
  int(a, b) { return Math.floor(a + this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  /** entries: [[value, weight], ...] */
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e[1];
    let r = this.next() * total;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries.length ? entries[entries.length - 1][0] : null;
  }
  /** 高斯近似 */
  gauss(mean = 0, sd = 1) {
    let s = 0;
    for (let i = 0; i < 3; i++) s += this.next();
    return mean + (s / 3 - 0.5) * 3.464 * sd;
  }
}

export const rng = new RNG(Date.now() & 0xffffffff);
export function nowSeed() { return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0; }

let _uid = 1;
export function uid() { return _uid++; }
export function setUidBase(v) { _uid = Math.max(_uid, v | 0); }

// ------------------------------------------------------------
//  时间
// ------------------------------------------------------------
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export function fmtClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function dayName(day) { return WEEK[day % 7]; }
export function fmtWeight(kg) { return (Math.round(kg * 10) / 10).toFixed(1); }
export function fmtNum(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)); }

// ------------------------------------------------------------
//  杂项
// ------------------------------------------------------------
export function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
/** 点是否在以 dir 为中心、半角 half 的扇形内 */
export function inCone(dx, dy, dir, half) {
  const a = Math.atan2(dy, dx);
  return Math.abs(angDiff(a, dir)) <= half;
}
export function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
export function pad2(n) { return String(n).padStart(2, '0'); }
