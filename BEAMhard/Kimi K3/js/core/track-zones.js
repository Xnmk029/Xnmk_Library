// ============================================================================
// core/track-zones.js — Procedural proving-ground ground model (pure JS).
// A single analytic surface shared by the physics solver AND the mesh builder,
// guaranteeing pixel-perfect physics/visual agreement.
//
// World layout (Three.js coords, metres). Vehicle spawns at z=+372 facing -Z.
//   z in [ +200, +262 ]  Zone 1: Belgian cobblestones (suspension)
//   z in [ +120, +172 ]  Zone 1b: Asymmetric bump strip (left side only)
//   z in [  -42,  +42 ]  Zone 2a: Slalom course (cones, steering)
//   z in [ -152,  -62 ]  Zone 2b: Banked high-speed curve strip
//   z in [ -262, -202 ]  Zone 3: Wading pool (0.55 m deep, buoyancy/drag)
//   elsewhere            Flat asphalt skidpan / run-off
// ============================================================================

import { hash2, smoothstep, clamp01 } from './math.js';

export const ZONES = {
  COBBLE: { name: 'BELGIAN COBBLESTONES', z0: 200, z1: 262, halfWidth: 7 },
  ASYM_BUMP: { name: 'ASYMMETRIC BUMPS', z0: 120, z1: 172, halfWidth: 7 },
  SLALOM: { name: 'SLALOM', z0: -42, z1: 42, halfWidth: 8 },
  BANK: { name: 'BANKED CURVE', z0: -152, z1: -62, halfWidth: 9 },
  WATER: { name: 'WADING POOL', z0: -262, z1: -202, halfWidth: 6, depth: 0.55 },
};

export const TRACK = {
  halfWidth: 8,          // asphalt ribbon half width
  length: 800,           // total straight length
  spawn: { x: 0, z: 372, heading: 0 }, // yaw 0 => forward = -Z (into the course)
};

const WATER_LEVEL = 0.0;
const POOL_FLOOR = -ZONES.WATER.depth;

// Cobblestone: per-stone domed bumps, stone pitch ~0.28 m, Belgian pattern.
function cobbleHeight(x, z) {
  const P = 0.28;
  const row = Math.floor(z / P);
  const stagger = (row % 2) * P * 0.5;
  const cx = Math.floor((x + stagger) / P);
  const fx = ((x + stagger) / P) - cx - 0.5;
  const fz = (z / P) - row - 0.5;
  const hRand = hash2(cx, row, 1337);
  const amp = 0.016 + 0.014 * hRand;          // 16–30 mm stones
  const dome = Math.max(0, 1 - (fx * fx + fz * fz) * 4.2);
  return amp * dome;
}

// Asymmetric bumps: sinusoidal bumps ONLY under the left half (x < -0.4).
function asymBumpHeight(x, z) {
  if (x > -0.4) return 0;
  const wave = Math.sin((z - ZONES.ASYM_BUMP.z0) * (Math.PI * 2 / 4.0));
  const envelope = smoothstep(ZONES.ASYM_BUMP.z0, ZONES.ASYM_BUMP.z0 + 4, z) *
    (1 - smoothstep(ZONES.ASYM_BUMP.z1 - 4, ZONES.ASYM_BUMP.z1, z));
  const sideRamp = smoothstep(-0.4, -1.2, x);
  return 0.06 * Math.max(0, wave) * envelope * sideRamp;
}

// Banked curve: cross slope building to 12 degrees at outer edge.
function bankHeight(x, z) {
  const zn = clamp01((z - ZONES.BANK.z0) / (ZONES.BANK.z1 - ZONES.BANK.z0));
  const envelope = smoothstep(0, 0.15, zn) * (1 - smoothstep(0.85, 1, zn));
  const t = clamp01((-x + 1.5) / 7.5); // higher on -x side (left = outer)
  return envelope * t * Math.tan(12 * Math.PI / 180) * 7.5 * 0.5;
}

function inZone(z, zone) { return z >= zone.z0 && z <= zone.z1; }

// --- Public API ---------------------------------------------------------------

// Ground surface height (metres) at world (x, z).
export function groundHeight(x, z) {
  // Wading pool: excavated floor with entry/exit ramps.
  if (inZone(z, ZONES.WATER) && Math.abs(x) < ZONES.WATER.halfWidth + 2) {
    const zn = Math.min(z - ZONES.WATER.z0, ZONES.WATER.z1 - z);
    const ramp = smoothstep(0, 6, zn);            // 6 m ramps at both ends
    const edge = 1 - smoothstep(ZONES.WATER.halfWidth - 1, ZONES.WATER.halfWidth + 2, Math.abs(x));
    return POOL_FLOOR * Math.min(ramp, edge);
  }
  let h = 0;
  if (inZone(z, ZONES.COBBLE) && Math.abs(x) < ZONES.COBBLE.halfWidth) {
    const edge = 1 - smoothstep(ZONES.COBBLE.halfWidth - 1.5, ZONES.COBBLE.halfWidth, Math.abs(x));
    h += cobbleHeight(x, z) * edge;
  }
  if (inZone(z, ZONES.ASYM_BUMP) && Math.abs(x) < ZONES.ASYM_BUMP.halfWidth) {
    h += asymBumpHeight(x, z);
  }
  if (inZone(z, ZONES.BANK) && Math.abs(x) < ZONES.BANK.halfWidth + 2) {
    h += bankHeight(x, z);
  }
  return h;
}

// Surface friction multiplier at (x, z).
export function groundFriction(x, z) {
  if (inZone(z, ZONES.WATER) && Math.abs(x) < ZONES.WATER.halfWidth) return 0.55; // wet pool floor
  if (inZone(z, ZONES.COBBLE) && Math.abs(x) < ZONES.COBBLE.halfWidth) return 0.9;
  if (Math.abs(x) > TRACK.halfWidth + 4) return 0.75; // grass run-off
  return 1.0;
}

// Water depth (metres, >= 0) at (x, z).
export function waterDepth(x, z) {
  if (!inZone(z, ZONES.WATER) || Math.abs(x) > ZONES.WATER.halfWidth) return 0;
  const floor = groundHeight(x, z);
  const d = WATER_LEVEL - floor;
  return d > 0 ? d : 0;
}

export function waterLevel() { return WATER_LEVEL; }

// Zone descriptor at position (for HUD banners & telemetry tagging).
export function zoneAt(x, z) {
  for (const key of Object.keys(ZONES)) {
    const zn = ZONES[key];
    if (z >= zn.z0 && z <= zn.z1 && Math.abs(x) <= zn.halfWidth) return { key, name: zn.name };
  }
  return { key: 'FLAT', name: 'SKIDPAN / FLAT' };
}

// Slalom cone layout (used by mesh builder + collision + validation).
export function slalomCones() {
  const cones = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const z = 35 - i * 14;
    const x = (i % 2 === 0 ? -1 : 1) * 3.0;
    cones.push({ x, z, r: 0.16, h: 0.5 });
  }
  return cones;
}

// Aggregate ground interface consumed by the physics solver.
export function makeProvingGroundSurface() {
  return {
    name: 'proving-ground',
    height: groundHeight,
    friction: groundFriction,
    waterDepth,
    waterLevel,
    zoneAt,
    cones: slalomCones(),
  };
}

// City mode: perfectly flat tarmac, slightly polished.
export function makeCitySurface() {
  return {
    name: 'city',
    height: () => 0,
    friction: () => 1.0,
    waterDepth: () => 0,
    waterLevel: () => -Infinity,
    zoneAt: () => ({ key: 'CITY', name: 'DOWNTOWN' }),
  };
}
