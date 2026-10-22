import { clamp, TAU } from './util.js';
export const V2 = {
  add: (a, b) => ({ x: a.x + b.x, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, z: a.z - b.z }),
  len: a => Math.hypot(a.x, a.z),
  norm: a => { const l = Math.hypot(a.x, a.z) || 1; return { x: a.x / l, z: a.z / l }; },
  scale: (a, s) => ({ x: a.x * s, z: a.z * s }),
};
export function angleLerp(a, b, t) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return a + d * clamp(t, 0, 1); }
export function segCircleHit(ax, az, bx, bz, cx, cz, r) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : clamp(((cx - ax) * dx + (cz - az) * dz) / len2, 0, 1);
  const px = ax + dx * t, pz = az + dz * t;
  const ex = cx - px, ez = cz - pz;
  return ex * ex + ez * ez <= r * r;
}
export function raySegHit(ox, oz, dx, dz, ax, az, bx, bz) {
  const rx = bx - ax, rz = bz - az;
  const denom = dx * rz - dz * rx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((ox - ax) * rz - (oz - az) * rx) / denom;
  const u = ((ox - ax) * dz - (oz - az) * dx) / denom;
  if (t >= 0 && u >= 0 && u <= 1) return { t, x: ox + dx * t, z: oz + dz * t };
  return null;
}
export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i], zj = pts[j];
    if (((pts[i].z > z) !== (zj > z)) && (x < (zj.x - xi.x) * (z - pts[i].z) / (zj.z - pts[i].z) + xi.x)) inside = !inside;
  }
  return inside;
}
export const facingToAngle = { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 };
