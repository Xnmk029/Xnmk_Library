// ============================================================
// core/util.js — 数学 / 随机 / 工具
// ============================================================
'use strict';
const U = {
  TAU: Math.PI * 2,
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  ang(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
  angDiff(a, b) { let d = (b - a) % U.TAU; if (d > Math.PI) d -= U.TAU; if (d < -Math.PI) d += U.TAU; return d; },
  moveToward(cur, tgt, maxD) { if (Math.abs(tgt - cur) <= maxD) return tgt; return cur + Math.sign(tgt - cur) * maxD; },
  rotTowards(cur, tgt, maxD) { const d = U.angDiff(cur, tgt); if (Math.abs(d) <= maxD) return tgt; return cur + Math.sign(d) * maxD; },
  fmtClock(min) { // min = 自 00:00 起的总分钟（可跨天）
    const day = Math.floor(min / 1440) + 1;
    const h = Math.floor((min % 1440) / 60), m = Math.floor(min % 60);
    return { day, str: String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') };
  },
  // 种子随机（mulberry32）——同种子生成同一张地图
  Rng(seed) {
    let s = seed >>> 0;
    const f = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    return {
      f, ri(a, b) { return a + Math.floor(f() * (b - a + 1)); },
      rf(a, b) { return a + f() * (b - a); },
      pick(arr) { return arr[Math.floor(f() * arr.length)]; },
      chance(p) { return f() < p; },
      wpick(pairs) { let tot = 0; for (const p of pairs) tot += p[1]; let r = f() * tot; for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; } return pairs[pairs.length - 1][0]; },
      shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
    };
  },
  // 全局随机（战斗/演出用）
  rand() { return Math.random(); },
  ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
  rf(a, b) { return a + Math.random() * (b - a); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p) { return Math.random() < p; },
  wpick(pairs) { let tot = 0; for (const p of pairs) tot += p[1]; let r = Math.random() * tot; for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; } return pairs[pairs.length - 1][0]; },
  _uid: 1, uid() { return U._uid++; },
  // 简单噪声（视觉色斑用）
  hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
};
window.U = U;
