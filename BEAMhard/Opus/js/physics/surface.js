/**
 * surface.js — analytic proving-ground terrain field (Phase 3.2).
 *
 * ONE height/material function drives both the physics solver and the visual
 * mesh generation, so wheel contact matches the rendered ground exactly.
 *
 * Zones along the +Z course corridor (three-space, car spawns at z=0 facing +z):
 *   STAGING   z −40…20     flat asphalt apron
 *   PAVE      z 20…120     Belgian cobblestone (hash-grid stone caps)
 *   BUMPS     z 140…260    asymmetric alternating half-cosine speed bumps
 *   SLALOM    z 280…420    flat asphalt, cone gates (objects, see proving.js)
 *   BANK      ring @ (−92, 510)  28° high-bank carousel, r 48…78
 *   WADE      z 580…680    water basin, level −0.06 m, max depth ≈ 0.45 m
 *   beyond    gravel runoff + rolling grass hills outside the corridor
 */

export const SURF = { ASPHALT: 0, COBBLE: 1, GRASS: 2, GRAVEL: 3, WATERBED: 4, BANK: 5 };
export const SURF_NAMES = ['ASPHALT', 'COBBLE', 'GRASS', 'GRAVEL', 'WATERBED', 'BANK'];
export const SURF_GRIP = [1.0, 0.90, 0.62, 0.78, 0.62, 1.0];

export const WATER_LEVEL = -0.06;
export const ROAD_HALF = 7.5;

const BANK_CX = -92, BANK_CZ = 510;
const BANK_R0 = 58, BANK_R1 = 68;          // 10 m banked band (Contidrom-style)
const BANK_TAN = Math.tan((28 * Math.PI) / 180);
const GATE_HALF = 0.30;                    // east entry gate half-angle (rad)

/* deterministic hash noise */
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/* Belgian pave: rounded stone caps on a jittered grid */
function cobbleHeight(x, z) {
  const CX = 0.34, CZ = 0.27, R = 0.21, A = 0.030;
  let h = 0;
  const cx0 = Math.floor(x / CX), cz0 = Math.floor(z / CZ);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const cx = cx0 + i, cz = cz0 + j;
      const jx = (hash2(cx * 3 + 11, cz * 7 + 5) - 0.5) * 0.12;
      const jz = (hash2(cx * 5 + 3, cz * 3 + 17) - 0.5) * 0.10;
      const sx = cx * CX + CX / 2 + jx, sz = cz * CZ + CZ / 2 + jz;
      const d2 = ((x - sx) / R) ** 2 + ((z - sz) / (R * 0.85)) ** 2;
      if (d2 < 1) {
        const cap = A * (1 - d2) * (0.72 + 0.55 * hash2(cx, cz));
        if (cap > h) h = cap;
      }
    }
  }
  return h;
}

/* asymmetric speed bumps: alternate rows hit only one side */
function bumpHeight(x, z) {
  const SPACING = 14, H = 0.088, L = 1.9;
  const k = Math.round((z - 150) / SPACING);
  if (k < 0 || k > 7) return 0;
  const zc = 150 + k * SPACING;
  const dz = z - zc;
  if (Math.abs(dz) > L / 2) return 0;
  const leftRow = (k % 2) === 0;
  // full height across the wheel track of one side only (wheels at |x|≈0.71)
  const sideMask = leftRow
    ? smooth01((x - 0.15) / 0.45)        // x>0 (left) side
    : smooth01((-x - 0.15) / 0.45);      // x<0 (right) side
  const prof = Math.cos((Math.PI * dz) / L) ** 2;
  return H * prof * sideMask;
}

function smooth01(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }

/* wading basin profile (negative) */
function poolDepth(z, x) {
  const inZ = smooth01((z - 588) / 14) * smooth01((676 - z) / 14);
  const inX = smooth01((x + ROAD_HALF + 1.5) / 3.5) * smooth01((ROAD_HALF + 1.5 - x) / 3.5);
  return -0.52 * inZ * inX;
}

/* rolling grass hills far from the course */
function hillHeight(x, z) {
  return 1.6 * vnoise(x * 0.011 + 40, z * 0.009 + 9) + 0.5 * vnoise(x * 0.031, z * 0.027);
}

/**
 * Height + surface material at (x, z).
 * Fast path used by physics: ~20 flops + a few hashes.
 */
export function surfaceInfo(x, z) {
  // access road: corridor shoulder → carousel east gate (flat)
  if (z >= 501 && z <= 519 && x <= -5 && x >= BANK_CX + BANK_R0 - 6) {
    return { h: 0.02, type: SURF.GRAVEL };
  }

  // bank carousel bowl: flat infield, 10 m 28° band, outer retaining lip,
  // with the banking feathered away across the east entry gate
  const bdx = x - BANK_CX, bdz = z - BANK_CZ;
  const br = Math.hypot(bdx, bdz);
  if (br < BANK_R1 + 14) {
    const a = Math.atan2(bdz, bdx);                 // 0 rad = east gate
    const gate = smooth01((Math.abs(a) - 0.10) / 0.30);   // flat ±0.10, full bank by ±0.40
    let h = 0, type = SURF.GRAVEL;
    if (br < BANK_R0) {
      h = 0.02;
      type = br < BANK_R0 - 10 ? SURF.GRASS : SURF.GRAVEL;
    } else if (br <= BANK_R1) {
      h = (br - BANK_R0) * BANK_TAN * gate;
      type = SURF.BANK;
    } else {
      const wallBase = (BANK_R1 - BANK_R0) * BANK_TAN * gate;
      h = wallBase + smooth01((br - BANK_R1) / 5) * 2.4 * gate;
      type = SURF.GRAVEL;
    }
    return { h, type };
  }

  const onRoad = Math.abs(x) <= ROAD_HALF;
  const shoulder = Math.abs(x) <= ROAD_HALF + 3;

  if (onRoad || shoulder) {
    let h = 0;
    let type = onRoad ? SURF.ASPHALT : SURF.GRAVEL;
    if (z >= 20 && z <= 120 && onRoad) {
      h += cobbleHeight(x, z);
      type = SURF.COBBLE;
    }
    if (z >= 140 && z <= 262 && onRoad) {
      h += bumpHeight(x, z);
    }
    const pd = poolDepth(z, x);
    if (pd < -0.005) {
      h += pd;
      type = SURF.WATERBED;
    }
    if (z > 700 && onRoad) type = SURF.GRAVEL;
    // subtle asphalt undulation
    h += 0.05 * vnoise(x * 0.05, z * 0.045);
    if (!onRoad) {
      const t = smooth01((Math.abs(x) - ROAD_HALF) / 3);
      h += t * 0.12 + 0.02 * vnoise(x * 0.7, z * 0.7);
    }
    return { h, type };
  }

  // open terrain
  const t = smooth01((Math.abs(x) - ROAD_HALF - 3) / 10);
  const h = (0.12 + hillHeight(x, z)) * t + 0.02;
  return { h, type: SURF.GRASS };
}

export function heightAt(x, z) { return surfaceInfo(x, z).h; }

/** Central-difference surface normal. */
export function normalAt(x, z, eps = 0.18) {
  const hL = heightAt(x - eps, z), hR = heightAt(x + eps, z);
  const hD = heightAt(x, z - eps), hU = heightAt(x, z + eps);
  const n = [-(hR - hL) / (2 * eps), 1, -(hU - hD) / (2 * eps)];
  const l = Math.hypot(n[0], n[1], n[2]);
  return [n[0] / l, n[1] / l, n[2] / l];
}

/** Water level at (x,z), or -Infinity when there is no water body. */
export function waterLevelAt(x, z) {
  if (z > 575 && z < 690 && Math.abs(x) < ROAD_HALF + 4) return WATER_LEVEL;
  return -Infinity;
}

export function zoneAt(z, x = 0) {
  const bdx = x - BANK_CX, bdz = z - BANK_CZ;
  if (Math.hypot(bdx, bdz) < BANK_R1 + 10) return 'HIGH-BANK CAROUSEL';
  if (z < 20) return 'STAGING AREA';
  if (z <= 120) return 'BELGIAN PAVE';
  if (z <= 262) return 'ASYMMETRIC BUMPS';
  if (z <= 420) return 'SLALOM GATES';
  if (z <= 560) return 'TRANSIT';
  if (z <= 690) return 'WADING POOL';
  return 'RUNOFF';
}

export const BANK = { cx: BANK_CX, cz: BANK_CZ, r0: BANK_R0, r1: BANK_R1, tan: BANK_TAN };
export default { surfaceInfo, heightAt, normalAt, waterLevelAt, zoneAt, SURF, SURF_NAMES, SURF_GRIP, WATER_LEVEL, ROAD_HALF, BANK };
