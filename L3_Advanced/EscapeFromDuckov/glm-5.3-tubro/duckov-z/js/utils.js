/* DUCKOV Z - 数学/随机/通用工具 */
(function (DZ) {
  'use strict';
  const U = {};
  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  U.ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  U.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  U.angLerp = (a, b, t) => a + U.angDiff(a, b) * U.clamp(t, 0, 1);
  U.pick = (arr, rng) => arr[(rng || Math.random)() * arr.length | 0];
  U.wpick = (entries, rng) => { // entries: [[item, weight],...]
    let tot = 0; for (const e of entries) tot += e[1];
    let r = (rng || Math.random)() * tot;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  };
  U.range = (a, b, rng) => a + ((rng || Math.random)() * (b - a + 1) | 0);
  U.frange = (a, b, rng) => a + (rng || Math.random)() * (b - a);
  U.shuffle = (arr, rng) => { const r = rng || Math.random; for (let i = arr.length - 1; i > 0; i--) { const j = r() * (i + 1) | 0;[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  U.mulberry32 = function (seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  U.uid = (() => { let n = 1; return () => 'e' + (n++).toString(36) + Date.now().toString(36).slice(-4); })();
  // 点在多边形内
  U.inPoly = (px, py, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  };
  // 线段相交测试 (不含共线端点细节，够用)
  U.segX = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
    const den = d1x * d2y - d1y * d2x; if (!den) return false;
    const t = ((cx - ax) * d2y - (cy - ay) * d2x) / den;
    const u = ((cx - ax) * d1y - (cy - ay) * d1x) / den;
    return t > 0 && t < 1 && u > 0 && u < 1;
  };
  U.aabb = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  U.fmtTime = mins => { mins = ((mins % 1440) + 1440) % 1440; const h = mins / 60 | 0, m = mins % 60 | 0; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
  U.isNight = mins => mins >= DZ.C.NIGHT_START || mins < DZ.C.NIGHT_END;
  U.rgbLerp = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)];
  U.cssRGB = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  U.ambientAt = h => {
    const K = DZ.C.AMBIENT_KEYS;
    for (let i = 0; i < K.length - 1; i++) {
      if (h >= K[i][0] && h <= K[i + 1][0]) {
        const t = (h - K[i][0]) / (K[i + 1][0] - K[i][0]);
        return U.rgbLerp([K[i][1], K[i][2], K[i][3]], [K[i + 1][1], K[i + 1][2], K[i + 1][3]], t);
      }
    }
    return [255, 255, 255];
  };
  // 圆 vs 瓦片网格碰撞滑动移动（像素域）
  U.moveCircle = function (x, y, vx, vy, r, solidFn) {
    let nx = x + vx;
    if (U.circleHits(nx, y, r, solidFn)) nx = x;
    let ny = y + vy;
    if (U.circleHits(nx, ny, r, solidFn)) ny = y;
    return [nx, ny];
  };
  U.circleHits = function (cx, cy, r, solidFn) {
    const TS = DZ.C.TILE;
    const x0 = Math.floor((cx - r) / TS), x1 = Math.floor((cx + r) / TS);
    const y0 = Math.floor((cy - r) / TS), y1 = Math.floor((cy + r) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!solidFn(tx, ty)) continue;
      const rx = U.clamp(cx, tx * TS, tx * TS + TS), ry = U.clamp(cy, ty * TS, ty * TS + TS);
      if (U.dist2(cx, cy, rx, ry) < r * r) return true;
    }
    return false;
  };
  U.easeOut = t => 1 - (1 - t) * (1 - t);
  U.now = () => performance.now();
  DZ.U = U;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
