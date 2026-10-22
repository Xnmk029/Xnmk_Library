/* DUCKOV Z - 射线可见多边形（战术视野） */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U;
  const F = {};
  const TAU = Math.PI * 2;

  // 收集附近静态线段(墙)
  function segsNear(S, tx, ty, rTiles) {
    const CELL = S.segCell, out = [];
    const seen = new Set();
    const x0 = Math.max(0, ((tx - rTiles) / CELL) | 0), x1 = Math.min((C.MW - 1) / CELL | 0, ((tx + rTiles) / CELL) | 0);
    const y0 = Math.max(0, ((ty - rTiles) / CELL) | 0), y1 = Math.min((C.MH - 1) / CELL | 0, ((ty + rTiles) / CELL) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const arr = S.segGrid.get(cx + ',' + cy);
      if (!arr) continue;
      for (const id of arr) { if (!seen.has(id)) { seen.add(id); out.push(S.segs[id]); } }
    }
    return out;
  }
  // 线段求交 t∈(0,1)
  function raySeg(px, py, dx, dy, seg) {
    const x1 = seg[0], y1 = seg[1], x2 = seg[2], y2 = seg[3];
    const rx = x2 - x1, ry = y2 - y1;
    const den = dx * ry - dy * rx;
    if (Math.abs(den) < 1e-9) return Infinity;
    const t = ((x1 - px) * ry - (y1 - py) * rx) / den;
    const u = ((x1 - px) * dy - (y1 - py) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) return t;
    return Infinity;
  }
  // 计算可见多边形：返回 [[x,y]...] 世界像素坐标
  F.compute = function (S, px, py, radius) {
    const tx = px / C.TILE, ty = py / C.TILE;
    const base = segsNear(S, tx, ty, radius / C.TILE + 2).concat(DZ.W.dynSegsNear(S, tx | 0, ty | 0, Math.ceil(radius / C.TILE) + 1));
    const rPx = radius * C.TILE;
    // 角点角度
    const angs = [];
    for (const s of base) {
      const d2 = U.dist2(px, py, s[0], s[1]);
      if (d2 > rPx * rPx * 1.44 && U.dist2(px, py, s[2], s[3]) > rPx * rPx * 1.44) continue;
      for (let k = 0; k < 4; k += 2) {
        const a = Math.atan2(s[k + 1] - py, s[k] - px);
        angs.push(a - 0.0004, a, a + 0.0004);
      }
    }
    for (let i = 0; i < 48; i++) angs.push(i / 48 * TAU); // 兜底圆周
    const poly = [];
    for (const a of angs) {
      const dx = Math.cos(a), dy = Math.sin(a);
      let best = rPx;
      for (const s of base) { const t = raySeg(px, py, dx, dy, s); if (t < best) best = t; }
      poly.push([px + dx * best, py + dy * best]);
    }
    return poly;
  };
  // 单点视线检测(用于僵尸看玩家等)：距离+可选扇形+遮挡
  F.canSee = function (S, ax, ay, bx, by, maxDist, halfFov, facingA) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    if (d > maxDist * C.TILE) return false;
    if (halfFov != null) {
      const aTo = Math.atan2(dy, dx);
      if (Math.abs(U.angDiff(facingA == null ? aTo : facingA, aTo)) > halfFov) return false;
    }
    const steps = Math.ceil(d / (C.TILE * 0.45));
    for (let i = 1; i < steps; i++) {
      const cx = ax + dx * i / steps, cy = ay + dy * i / steps;
      const txx = cx / C.TILE | 0, tyy = cy / C.TILE | 0;
      const t = DZ.W.tget(S, txx, tyy);
      if (t === DZ.W.T.WEXT || t === DZ.W.T.WINT) return false;
      const m = S.meta.get(txx + ',' + tyy);
      if (m) {
        if (m.t === 'door' && !m.open) return false;
        if (m.t === 'win' && m.curtain && !m.broken) return false;
      }
    }
    return true;
  };
  DZ.FOV = F;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
