// ============================================================
//  vision.js — 拟真视野 / 战争迷雾 / 光照 / 噪音传播
//  融合：僵毁的 LOS + 光照；鸭科夫的手电体积光锥、热成像、风暴遮蔽
// ============================================================
import { inCone, clamp } from '../core/util.js';

const DAY_LEN = 540; // 一“天”秒数（供昼夜与 AI 节律）
export function dayLen() { return DAY_LEN; }

/** 全局昼夜：返回 0..1 的日照强度 */
export function updateDayNight(game, dt) {
  game.time = (game.time || 0) + dt;
  const t = (game.time % DAY_LEN) / DAY_LEN;        // 0..1
  // 正弦日照：正午最亮，午夜全黑；户外最低也有微光
  game.sun = clamp(Math.sin((t - 0.25) * Math.PI * 2) * 0.5 + 0.5, 0, 1);
  game.night = game.sun < 0.22;
  // 天气遮蔽（风暴降低可视）
  const w = game.level ? game.level.weather : 'clear';
  game.fog = w === 'storm' ? 0.55 : w === 'fog' ? 0.4 : 0.0;
}

function lampOn(game, lp) { return !lp.needPower || game.level.powered; }

/** 计算每格亮度写入 lv.light[]（0..1），供渲染与视野使用 */
export function computeLight(game) {
  const lv = game.level;
  if (!lv) return;
  const sun = game.sun ?? 1;
  const dark = game.night;
  for (let i = 0; i < lv.light.length; i++) {
    const x = i % lv.w, y = (i / lv.w) | 0;
    let L;
    if (lv.isIndoor(x, y)) {
      // 室内：无顶则按户外，有顶则偏暗
      L = dark ? 0.04 : 0.10;
      if (!lv.isIndoor(x, y)) L = 0.12 + sun * 0.5;
    } else {
      L = 0.16 + sun * 0.7;
    }
    lv.light[i] = L;
  }
  // 灯具
  for (const lp of lv.lamps) if (lampOn(game, lp)) addLight(lv, lp.x, lp.y, lp.r, 0.9);
  // 火堆 / 篝火
  for (const f of game.fires || []) addLight(lv, f.x, f.y, f.r || 6, 0.95);
  // 玩家手电（仅在黑暗中提供近身照明）
  const P = game.player;
  if (P && P.light && dark) addLight(lv, P.x, P.y, 4.5, 0.5);
  // 自然光衰减（风暴/雾）
  const fog = game.fog || 0;
  if (fog > 0) for (let i = 0; i < lv.light.length; i++) lv.light[i] *= (1 - fog * 0.5);
}

function addLight(lv, x, y, r, amt) {
  const r2 = r * r;
  const x0 = Math.max(0, (x - r) | 0), x1 = Math.min(lv.w - 1, (x + r) | 0);
  const y0 = Math.max(0, (y - r) | 0), y1 = Math.min(lv.h - 1, (y + r) | 0);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const d2 = (i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2;
    if (d2 > r2) continue;
    const f = 1 - Math.sqrt(d2) / r;
    const idx = lv.i(i, j);
    lv.light[idx] = Math.min(1, lv.light[idx] + amt * f * f);
  }
}

function litTile(lv, x, y) { return lv.light[lv.i(x, y)] > 0.16; }

// DDA 视线（阻挡 = opaque）
function losClear(lv, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist * 3);
  if (steps <= 0) return true;
  const sx = dx / steps, sy = dy / steps;
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    x += sx; y += sy;
    const tx = x | 0, ty = y | 0;
    if (!lv.inB(tx, ty)) return false;
    if (i < steps - 1 && lv.opaque[lv.i(tx, ty)]) return false;
  }
  return true;
}

function revealAround(lv, cx, cy, r) {
  const r2 = r * r;
  const x0 = Math.max(0, (cx - r) | 0), x1 = Math.min(lv.w - 1, (cx + r) | 0);
  const y0 = Math.max(0, (cy - r) | 0), y1 = Math.min(lv.h - 1, (cy + r) | 0);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 > r2) continue;
    if (!losClear(lv, cx, cy, i + 0.5, j + 0.5)) continue;
    const idx = lv.i(i, j); lv.vis[idx] = 1; if (!lv.seen[idx]) lv.seen[idx] = 1;
  }
}

/**
 * 计算玩家视野，写入 lv.vis / lv.seen（战争迷雾）
 */
export function computeVision(game) {
  const lv = game.level, P = game.player;
  if (!lv || !P) return;
  lv.vis.fill(0);
  const dark = game.night;
  // 基础视距：户外明亮，室内有灯则正常，黑暗中骤降
  let baseR;
  if (!lv.isIndoor(P.x | 0, P.y | 0)) baseR = 15 - (game.fog || 0) * 6;
  else if (litTile(lv, P.x | 0, P.y | 0)) baseR = 13;
  else baseR = 3.6;
  baseR *= P.body.visionMul();
  if (P.sneaking) baseR *= 0.92;
  const torch = P.light; // 手电
  const torR = 16, torFov = 0.62; // ~36°

  revealAround(lv, P.x, P.y, Math.max(2.2, baseR * 0.5));

  const R = Math.ceil(baseR) + 2;
  const x0 = Math.max(0, (P.x - R) | 0), x1 = Math.min(lv.w - 1, (P.x + R) | 0);
  const y0 = Math.max(0, (P.y - R) | 0), y1 = Math.min(lv.h - 1, (P.y + R) | 0);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const d = Math.hypot(i + 0.5 - P.x, j + 0.5 - P.y);
    if (d > baseR + 1) continue;
    if (d <= baseR * 0.5) { const idx = lv.i(i, j); lv.vis[idx] = 1; if (!lv.seen[idx]) lv.seen[idx] = 1; continue; }
    if (!losClear(lv, P.x, P.y, i + 0.5, j + 0.5)) continue;
    let vis = false;
    if (litTile(lv, i, j)) vis = d <= baseR;
    else if (d <= baseR * 0.5) vis = true;
    if (!vis && torch && dark) vis = inCone(P.x, P.y, P.facing, i + 0.5, j + 0.5, torFov, torR);
    if (vis) { const idx = lv.i(i, j); lv.vis[idx] = 1; if (!lv.seen[idx]) lv.seen[idx] = 1; }
  }
  // 灯具与火堆恒亮（即使不在玩家视野也“见过”）
  for (const lp of lv.lamps) if (lampOn(game, lp)) revealAround(lv, lp.x + 0.5, lp.y + 0.5, lp.r);
  for (const f of game.fires || []) revealAround(lv, f.x, f.y, f.r || 6);

  // 暴露度（用于潜行评估）
  P.exposure = Math.min(1, (lv.indoors(P.x | 0, P.y | 0) ? 0.3 : 0.6) + (P.sprinting ? 0.4 : 0) + (P.light ? 0.2 : 0));
}

/** 玩家当前可见？用于实体绘制 */
export function tileVisible(lv, x, y) { return !!lv.vis[lv.i(x, y)]; }

// ---------------- 噪音传播 ----------------
export function emitNoise(game, x, y, r, kind) {
  game.noises.push({ x, y, r, kind, t: game.time });
}
export function decayNoises(game) {
  const t = game.time;
  game.noises = game.noises.filter(n => t - n.t < 0.4);
}
/** 某点是否听到来自 (nx,ny) 半径为 r 的噪音（按听力与距离衰减） */
export function heard(x, y, nx, ny, r, hearing) {
  const d = Math.hypot(x - nx, y - ny);
  return d <= r * (hearing / 14);
}
