// ============================================================
// world/fov.js — 拟真视野：视锥射线遮挡（僵毁 LOS × 鸭科夫视线迷雾 Shader 思路）
// 障碍物背后与玩家背后区域进入阴影蒙版；盲区内实体剔除渲染（防作弊式）
// ============================================================
'use strict';
const FOV = {
  // DDA 射线：返回撞到的距离（无遮挡返回 max）
  cast(W, x0, y0, ang, maxDist) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    let tx = Math.floor(x0 / 32), ty = Math.floor(y0 / 32);
    const stepX = cs > 0 ? 1 : -1, stepY = sn > 0 ? 1 : -1;
    const tDeltaX = cs !== 0 ? Math.abs(32 / cs) : 1e9;
    const tDeltaY = sn !== 0 ? Math.abs(32 / sn) : 1e9;
    let tMaxX = cs !== 0 ? (((cs > 0 ? (tx + 1) * 32 : tx * 32) - x0) / cs) : 1e9;
    let tMaxY = sn !== 0 ? (((sn > 0 ? (ty + 1) * 32 : ty * 32) - y0) / sn) : 1e9;
    let t = 0;
    for (let i = 0; i < 128; i++) {
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; tx += stepX; }
      else { t = tMaxY; tMaxY += tDeltaY; ty += stepY; }
      if (t > maxDist) return maxDist;
      if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) return Math.min(t, maxDist);
      if (W.opaque[ty * W.w + tx]) return t + 8; // 命中墙面（略延伸以覆盖墙面本体）
    }
    return maxDist;
  },

  // 玩家→点 是否无遮挡
  clearLine(W, x0, y0, x1, y1) {
    const d = U.dist(x0, y0, x1, y1);
    if (d < 4) return true;
    const ang = U.ang(x0, y0, x1, y1);
    return this.cast(W, x0, y0, ang, d) >= d - 6;
  },

  // 每帧计算视锥多边形（渲染迷雾蒙版用）
  compute(W, px, py, dir, coneRad, range) {
    const N = 56;
    const pts = [];
    const a0 = dir - coneRad / 2;
    for (let i = 0; i <= N; i++) {
      const a = a0 + coneRad * (i / N);
      const d = this.cast(W, px, py, a, range);
      pts.push([px + Math.cos(a) * d, py + Math.sin(a) * d]);
    }
    return { pts, omni: 2.6 * 32, range, dir, coneRad };
  },

  // 点可见性：视锥内 + 无遮挡，或贴身全向可见
  litPoint(W, px, py, dir, coneRad, range, x, y) {
    const d = U.dist(px, py, x, y);
    if (d > range + 16) {
      if (d > 3.2 * 32) return false;
      return this.clearLine(W, px, py, x, y);
    }
    if (d < 3.2 * 32) return this.clearLine(W, px, py, x, y);
    const a = U.ang(px, py, x, y);
    if (Math.abs(U.angDiff(dir, a)) > coneRad / 2) return false;
    return this.clearLine(W, px, py, x, y);
  }
};
window.FOV = FOV;
