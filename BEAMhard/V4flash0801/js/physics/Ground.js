/**
 * physics/Ground.js — procedural heightfield & materials for the whole world
 *  - proving ground zones: belgian cobblestone, asymmetric bumps, slalom (flat),
 *    banked oval track, wading pool basin
 *  - city: flat
 *  - water: wading pool level + drag/buoyancy queries
 */
import * as THREE from 'three';
import { CFG } from '../config.js';

// value noise for cobblestone
function hash2(x, z) {
  let s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t) { return t * t * (3 - 2 * t); }

export class Ground {
  constructor() {
    this.waterLevel = CFG.WORLD.waterLevel;
    // banked track
    this.bank = { cx: 0, cz: -150, R: 78, width: 14, bankDeg: 17 };
    // pool
    this.pool = { x0: -235, x1: -125, z0: -315, z1: -185, depth: -2.1 };
  }

  /** returns {y, nx, ny, nz, material} */
  heightAt(x, z) {
    // ---- wading pool basin ----
    const P = this.pool;
    if (x > P.x0 - 14 && x < P.x1 + 14 && z > P.z0 - 14 && z < P.z1 + 14) {
      const inPool = x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1;
      if (inPool) {
        const y = P.depth;
        // sloped entry on east side (from x1 towards x1-18)
        const rampX = THREE.MathUtils.clamp((P.x1 - x) / 16, 0, 1);
        const rampZ = THREE.MathUtils.clamp((P.z1 - z) / 16, 0, 1);
        const rampX2 = THREE.MathUtils.clamp((x - P.x0) / 16, 0, 1);
        const rampZ2 = THREE.MathUtils.clamp((z - P.z0) / 16, 0, 1);
        const ramp = Math.max(Math.min(rampX, rampX2, rampZ, rampZ2), 0.06);
        const yR = P.depth + (0 - P.depth) * (1 - ramp);
        return { y: yR, nx: 0, ny: 1, nz: 0, material: 'poolbed' };
      }
      return { y: 0, nx: 0, ny: 1, nz: 0, material: 'ramp' };
    }

    // ---- banked oval track ----
    const B = this.bank;
    const dx = x - B.cx, dz = z - B.cz;
    const r = Math.hypot(dx, dz);
    const inRing = r > B.R - B.width / 2 && r < B.R + B.width / 2;
    const bankT = Math.tan(B.bankDeg * Math.PI / 180);
    if (inRing) {
      // radial offset from centerline
      const off = r - B.R;
      const y = off * bankT;
      // surface normal for banked surface
      const nx = -dx / r * bankT, nz = -dz / r * bankT;
      const ny = 1;
      const len = Math.hypot(nx, ny, nz);
      return { y, nx: nx / len, ny: ny / len, nz: nz / len, material: 'asphalt' };
    }
    // entry/exit aprons blend to 0
    const apron = Math.max(0, 1 - (Math.abs(r - B.R) - B.width / 2) / 9);
    if (apron > 0.01) {
      const off = r - B.R;
      const y = off * bankT * apron;
      const nx = -dx / r * bankT * apron, nz = -dz / r * bankT * apron;
      const len = Math.hypot(nx, 1, nz);
      return { y, nx: nx / len, ny: 1 / len, nz: nz / len, material: 'asphalt' };
    }

    // ---- cobblestone zone ----
    if (x > -70 && x < 70 && z > 62 && z < 150) {
      return this.cobble(x, z);
    }
    // ---- asymmetric bumps ----
    if (x > -70 && x < 70 && z > 150 && z < 233) {
      return this.bumps(x, z);
    }

    // ---- slalom corridor / start pad / return roads: flat asphalt ----
    if ((x > -30 && x < 30 && z > -30 && z < 425) ||
        (x > -250 && x < 250 && z > -320 && z < -250)) {
      return { y: 0, nx: 0, ny: 1, nz: 0, material: 'asphalt' };
    }
    // ---- city: flat ground ----
    return { y: 0, nx: 0, ny: 1, nz: 0, material: 'ground' };
  }

  cobble(x, z) {
    // Belgian blocks: ~0.28m grid, rounded tops, height 0.045-0.11
    const gx = Math.floor(x / 0.28), gz = Math.floor(z / 0.28);
    const fx = (x / 0.28 - gx), fz = (z / 0.28 - gz);
    let h = 0;
    let nx = 0, nz = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const hh = hash2(gx + i, gz + j);
        const hgt = 0.045 + hh * 0.075;
        const cx = (gx + i) * 0.28, cz = (gz + j) * 0.28;
        const ddx = x - cx, ddz = z - cz;
        const rr = Math.hypot(ddx, ddz);
        if (rr < 0.17) {
          const bump = Math.pow(Math.max(0, 1 - rr / 0.17), 1.6) * hgt;
          if (bump > h) {
            h = bump;
            nx = -ddx * 3.2 * hgt;
            nz = -ddz * 3.2 * hgt;
          }
        }
      }
    }
    const len = Math.hypot(nx, 1, nz);
    return { y: h, nx: nx / len, ny: 1 / len, nz: nz / len, material: 'cobble' };
  }

  bumps(x, z) {
    // 6 rows of half-cylinder bumps, asymmetric height L/R, staggered phase
    const rowSpacing = 13.2;
    const row = Math.floor((z - 150) / rowSpacing);
    const zl = (z - 150) - row * rowSpacing;
    let h = 0, nx = 0, nz = 0;
    if (zl < 4.2) {
      // bump profile along z (half cylinder)
      const t = zl / 4.2;
      const prof = Math.sin(t * Math.PI);
      // height varies with x: left side higher (asymmetric)
      const hl = 0.155, hr = 0.06;
      const side = THREE.MathUtils.clamp((x + 30) / 60, 0, 1); // 0=left? x -30..30
      // left = negative x
      const sideL = THREE.MathUtils.clamp((-x + 30) / 60, 0, 1);
      const hMax = hl * sideL + hr * (1 - sideL);
      const phase = (row % 2) * 0.5;
      const pz = (zl / 4.2 + phase) % 1;
      const p = Math.sin(pz * Math.PI);
      h = hMax * p * prof;
      nz = Math.cos(pz * Math.PI) * (Math.PI / 4.2) * hMax * 0.18;
      nx = 0;
    }
    const len = Math.hypot(nx, 1, nz);
    return { y: h, nx: nx / len, ny: 1 / len, nz: nz / len, material: 'bump' };
  }

  waterAt(x, z) {
    const P = this.pool;
    if (x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) return this.waterLevel;
    return -1e9;
  }

  /** check circle collision vs pool walls (simple barrier) */
  poolWallAt(x, z) {
    const P = this.pool;
    if (x < P.x0 || x > P.x1 || z < P.z0 || z > P.z1) return null;
    return null;
  }

  materialColor(mat) {
    switch (mat) {
      case 'asphalt': return 0x2a2d34;
      case 'cobble': return 0x57585e;
      case 'bump': return 0x3d4048;
      case 'poolbed': return 0x6b7280;
      case 'ground': return 0x3f4a3a;
      default: return 0x33363d;
    }
  }
}
