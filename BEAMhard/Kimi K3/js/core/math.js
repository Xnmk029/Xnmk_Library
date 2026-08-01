// ============================================================================
// core/math.js — dependency-free 3D math (Vec3 / Quaternion / scalar helpers)
// Used by the physics solver, city generator and Node validation harness.
// Convention: right-handed, Y = up, -Z = vehicle forward (Three.js world).
// JBeam coords map as: three.x = jbeam.x, three.y = jbeam.z, three.z = jbeam.y
// ============================================================================

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

// --- Vec3 (plain {x,y,z} objects) -------------------------------------------
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const v3clone = (a) => ({ x: a.x, y: a.y, z: a.z });
export const v3set = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };
export const v3add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const v3addTo = (a, b) => { a.x += b.x; a.y += b.y; a.z += b.z; return a; };
export const v3sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const v3scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const v3scaleTo = (a, s) => { a.x *= s; a.y *= s; a.z *= s; return a; };
export const v3dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const v3cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const v3len = (a) => Math.hypot(a.x, a.y, a.z);
export const v3lenSq = (a) => a.x * a.x + a.y * a.y + a.z * a.z;
export const v3norm = (a) => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
export const v3neg = (a) => ({ x: -a.x, y: -a.y, z: -a.z });
export const v3mad = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s }); // a + b*s
export const v3lerp = (a, b, t) => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
});

// --- Quaternion ({x,y,z,w}) --------------------------------------------------
export const qIdentity = () => ({ x: 0, y: 0, z: 0, w: 1 });
export const qMul = (a, b) => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
export const qConj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
export const qNorm = (q) => {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
};
export const qFromAxisAngle = (axis, angle) => {
  const h = angle * 0.5, s = Math.sin(h);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(h) };
};
export const qFromYaw = (yaw) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
// Rotate vector by quaternion: v + 2*cross(q.xyz, cross(q.xyz, v) + w*v)
export const qRotate = (q, v) => {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
};
// Integrate orientation with world-space angular velocity (rad/s)
export const qIntegrate = (q, wx, wy, wz, dt) => {
  const h = dt * 0.5;
  const nx = q.x + h * (wx * q.w + wy * q.z - wz * q.y);
  const ny = q.y + h * (wy * q.w + wz * q.x - wx * q.z);
  const nz = q.z + h * (wz * q.w + wx * q.y - wy * q.x);
  const nw = q.w + h * (-wx * q.x - wy * q.y - wz * q.z);
  return qNorm({ x: nx, y: ny, z: nz, w: nw });
};

// --- Piecewise-linear table interpolation (e.g. engine torque curve) --------
export function tableInterp(table, x) {
  // table: [[x0,y0],[x1,y1],...] sorted ascending by x
  if (!table || table.length === 0) return 0;
  if (x <= table[0][0]) return table[0][1];
  const n = table.length;
  if (x >= table[n - 1][0]) return table[n - 1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid][0] <= x) lo = mid; else hi = mid;
  }
  const [x0, y0] = table[lo], [x1, y1] = table[hi];
  const t = (x - x0) / (x1 - x0);
  return y0 + (y1 - y0) * t;
}

// --- Deterministic RNG (mulberry32) + 2D value hash --------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(ix, iz, seed = 0) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1442695040888963407) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Convert a JBeam position [x,y,z] to Three.js world coords (strict 1:1 m).
export const jbeamToThree = (x, y, z) => ({ x, y: z, z: y });
export const threeToJbeam = (x, y, z) => ({ x, y: z, z: y });
