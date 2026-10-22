// 纯 2D 数学（XZ 平面）。不依赖 three，可 node 单测。
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0 || 1e-6)); return t * t * (3 - 2 * t); };
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const angleDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const approachAngle = (cur, target, maxStep) => {
  const d = angleDiff(target, cur);
  return cur + clamp(d, -maxStep, maxStep);
};
/** 指数衰减插值，与帧率无关 */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

// ---- 线段/几何 ----
export function segIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const r1 = bx - ax, r2 = bz - az, s1 = dx - cx, s2 = dz - cz;
  const den = r1 * s2 - r2 * s1;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * s2 - (cz - az) * s1) / den;
  const u = ((cx - ax) * r2 - (cz - az) * r1) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, x: ax + r1 * t, z: az + r2 * t };
}

/** 射线 vs 轴对齐矩形（slab 法），返回命中距离或 Infinity */
export function rayAabb(ox, oz, dx, dz, minX, minZ, maxX, maxZ) {
  let tmin = -Infinity, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < minX || ox > maxX) return Infinity; }
  else { let t1 = (minX - ox) / dx, t2 = (maxX - ox) / dx; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); }
  if (Math.abs(dz) < 1e-9) { if (oz < minZ || oz > maxZ) return Infinity; }
  else { let t1 = (minZ - oz) / dz, t2 = (maxZ - oz) / dz; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); }
  if (tmax < tmin || tmax < 0) return Infinity;
  return tmin < 0 ? 0 : tmin;
}

export const pointInAabb = (x, z, minX, minZ, maxX, maxZ) => x >= minX && x <= maxX && z >= minZ && z <= maxZ;
export const circleAabb = (cx, cz, r, minX, minZ, maxX, maxZ) =>
  dist2(cx, cz, clamp(cx, minX, maxX), clamp(cz, minZ, maxZ)) < r * r;

/** 把圆推出 AABB（用于碰撞解算），返回修正量 */
export function pushOutAabb(cx, cz, r, minX, minZ, maxX, maxZ) {
  const nx = clamp(cx, minX, maxX), nz = clamp(cz, minZ, maxZ);
  let dx = cx - nx, dz = cz - nz;
  let d2 = dx * dx + dz * dz;
  if (d2 > r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2), push = r - d;
    return { x: (dx / d) * push, z: (dz / d) * push };
  }
  // 圆心在盒内：沿最浅的一面推出
  const l = cx - minX, rr = maxX - cx, u = cz - minZ, dn = maxZ - cz;
  const m = Math.min(l, rr, u, dn);
  if (m === l) return { x: -(l + r), z: 0 };
  if (m === rr) return { x: rr + r, z: 0 };
  if (m === u) return { x: 0, z: -(u + r) };
  return { x: 0, z: dn + r };
}

/** 多边形点包含（射线法） */
export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], zi = pts[i + 1], xj = pts[j], zj = pts[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export const fmtTime = (gameMinutes) => {
  const h = Math.floor(gameMinutes / 60) % 24, m = Math.floor(gameMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
