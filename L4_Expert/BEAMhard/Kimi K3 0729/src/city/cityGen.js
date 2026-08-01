/**
 * cityGen.js — procedural city vector data generation.
 *
 * Pure data, no three.js, no DOM — importable and testable in plain Node.
 * Everything is deterministic for a given seed (mulberry32 PRNG).
 *
 * Algorithm: perturbed grid-graph skeleton with L-system-like arterial growth:
 *  1. 4–6 arterial avenues cross the city (roughly N-S / E-W, slight curvature).
 *  2. Collectors branch off arterials every ~120–200 m with ±20° angle jitter.
 *  3. Local streets complete blocks via a loose grid inside each macro-cell.
 *  4. Blocks (macro-cells of the collector/local graph) are subdivided into
 *     building footprints inset from block edges; heights follow a district
 *     field (downtown / midtown / suburb by distance from center).
 *  5. Props: streetlights every 25 m along road edges, traffic signals at
 *     arterial intersections, ~30 seeded POIs, 4 named districts.
 */

/* ------------------------------------------------------------------ PRNG -- */

/**
 * mulberry32 seeded PRNG factory.
 * @param {number} seed
 * @returns {() => number} function returning floats in [0, 1)
 */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- geometry -- */

/** Total polyline length of a road. @param {{points:number[][]}} r @returns {number} meters */
export function roadLength(r) {
  let L = 0;
  const p = r.points;
  for (let i = 1; i < p.length; i++) {
    L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  }
  return L;
}

function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

/** Distance from point p to segment ab (2D, XZ). */
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz;
  let t = L2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** Minimum distance from a point to a road polyline. */
function roadDist(road, px, pz) {
  let d = Infinity;
  for (let i = 1; i < road.points.length; i++) {
    d = Math.min(d, segDist(px, pz, road.points[i - 1][0], road.points[i - 1][1], road.points[i][0], road.points[i][1]));
  }
  return d;
}

function clampToBounds(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ------------------------------------------------------------- names ----- */

const SYL_A = ['Ka', 'Mi', 'No', 'Ta', 'Shi', 'Ro', 'Ha', 'Yu', 'Sen', 'Aka', 'Mizu', 'Ogi'];
const SYL_B = ['ra', 'ki', 'no', 'wa', 'ya', 'to', 'da', 'me', 'sa', 'chi', 'ru', 'ne'];
const POI_SUFFIX = { tower: 'Tower', mall: 'Mall', station: 'Station', park: 'Park', shrine: 'Shrine' };
const POI_KINDS = ['tower', 'mall', 'station', 'park', 'shrine'];
const DISTRICT_NAMES = ['Old Quarter', 'Harbor Ward', 'Hillside', 'Garden District'];

/* ------------------------------------------------------------- generator - */

/**
 * Generate a complete procedural city.
 * @param {number} [seed=7]
 * @param {object} [opts]
 * @param {number} [opts.extent=1024] half-size of the square city bounds (meters)
 * @param {number} [opts.arterials] force arterial count (default seeded 4–6)
 * @returns {{
 *   seed:number, bounds:{minX:number,minZ:number,maxX:number,maxZ:number},
 *   roads:Array<{id:number,klass:'arterial'|'collector'|'local',points:number[][],width:number,lanes:number}>,
 *   buildings:Array<{id:number,footprint:number[][],height:number,district:string}>,
 *   pois:Array<{id:number,name:string,kind:string,x:number,z:number}>,
 *   districts:Array<{name:string,x:number,z:number}>,
 *   streetlights:Array<{x:number,z:number}>, signals:Array<{x:number,z:number}>
 * }}
 */
export function generateCity(seed = 7, opts = {}) {
  const rng = makeRng(seed);
  const E = opts.extent || 1024;
  const bounds = { minX: -E, minZ: -E, maxX: E, maxZ: E };
  const roads = [];
  let roadId = 0;

  /* ------------------------------------------- 1. arterial avenues ------- */
  const nArt = opts.arterials || (4 + Math.floor(rng() * 3)); // 4–6
  const arterials = [];
  for (let i = 0; i < nArt; i++) {
    const vertical = i % 2 === 0; // alternate N-S and E-W
    const offset = (rng() * 2 - 1) * E * 0.7;
    const pts = [];
    const nSeg = 8 + Math.floor(rng() * 4);
    const curveAmp = (rng() * 2 - 1) * 90; // slight curvature
    const drift = (rng() * 2 - 1) * 140;
    for (let s = 0; s <= nSeg; s++) {
      const t = s / nSeg;
      const along = -E + t * 2 * E;
      const bend = Math.sin(t * Math.PI) * curveAmp + (t - 0.5) * drift;
      let x = vertical ? offset + bend : along;
      let z = vertical ? along : offset + bend;
      x = clampToBounds(x, -E, E); z = clampToBounds(z, -E, E);
      pts.push([x, z]);
    }
    const road = { id: roadId++, klass: 'arterial', points: pts, width: 14, lanes: 4 };
    roads.push(road); arterials.push(road);
  }

  /* ------------------------------------------- 2. collectors ------------- */
  // Branch off arterials every ~120–200 m, ±20° jitter, stop at bounds or near another road.
  const collectors = [];
  const jit = (rng() * 2 - 1);
  for (const art of arterials) {
    const spacing = 120 + rng() * 80;
    for (let i = 1; i < art.points.length; i++) {
      const [ax, az] = art.points[i - 1];
      const [bx, bz] = art.points[i];
      const segLen = Math.hypot(bx - ax, bz - az);
      const dirx = (bx - ax) / segLen, dirz = (bz - az) / segLen;
      for (let d = spacing * 0.5; d < segLen; d += spacing) {
        const px = ax + dirx * d, pz = az + dirz * d;
        if (Math.abs(px) > E * 0.96 || Math.abs(pz) > E * 0.96) continue;
        // grow perpendicular, seeded side
        const side = rng() < 0.5 ? 1 : -1;
        const jitterAng = (rng() * 2 - 1) * (20 * Math.PI / 180);
        const baseAng = Math.atan2(dirz, dirx) + side * Math.PI / 2 + jitterAng + jit * 0.1;
        const cdx = Math.cos(baseAng), cdz = Math.sin(baseAng);
        const target = 260 + rng() * 320; // collector length
        const pts = [[px, pz]];
        let cx = px, cz = pz, ang = baseAng;
        const step = 90 + rng() * 40;
        let stop = false;
        for (let g = 0; g < 8 && !stop; g++) {
          ang += (rng() * 2 - 1) * 0.18; // gentle wander
          const nx = cx + Math.cos(ang) * step, nz = cz + Math.sin(ang) * step;
          if (Math.abs(nx) > E || Math.abs(nz) > E) {
            pts.push([clampToBounds(nx, -E, E), clampToBounds(nz, -E, E)]);
            break;
          }
          pts.push([nx, nz]); cx = nx; cz = nz;
          // stop when reaching another arterial (far enough from start)
          let acc = 0;
          for (let k = 1; k < pts.length; k++) acc += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
          if (acc > target) break;
          for (const other of arterials) {
            if (other === art) continue;
            if (roadDist(other, cx, cz) < 26) { stop = true; break; }
          }
        }
        if (pts.length >= 2) {
          const road = { id: roadId++, klass: 'collector', points: pts, width: 9, lanes: 2 };
          roads.push(road); collectors.push(road);
        }
      }
    }
  }

  /* ------------------------------------------- 3. local streets ---------- */
  // Loose grid inside the whole extent; keep segments that don't collide with
  // arterial/collector corridors (leave a clearance around wider roads).
  const mains = arterials.concat(collectors);
  const gridStep = 100 + Math.floor(rng() * 25); // 100–125 m loose grid
  const ox = (rng() * 2 - 1) * gridStep * 0.5;
  const oz = (rng() * 2 - 1) * gridStep * 0.5;
  const gx = [], gz = [];
  for (let x = -E + gridStep * 0.5 + ox; x < E; x += gridStep) gx.push(x);
  for (let z = -E + gridStep * 0.5 + oz; z < E; z += gridStep) gz.push(z);
  const clearance = (r) => r.width * 0.5 + 14;
  function localOk(x1, z1, x2, z2) {
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    for (const r of mains) {
      const c = clearance(r);
      if (roadDist(r, mx, mz) < c || roadDist(r, x1, z1) < c * 0.6 || roadDist(r, x2, z2) < c * 0.6) return false;
    }
    return true;
  }
  const locals = [];
  const localKeep = 0.45; // seeded holes in the grid
  for (let i = 0; i < gx.length - 1; i++) {
    for (let j = 0; j < gz.length; j++) {
      if (rng() > localKeep) continue;
      const x1 = gx[i], x2 = gx[i + 1], z = gz[j];
      if (localOk(x1, z, x2, z)) locals.push({ id: roadId++, klass: 'local', points: [[x1, z], [x2, z]], width: 6, lanes: rng() < 0.3 ? 2 : 1 });
    }
  }
  for (let j = 0; j < gz.length - 1; j++) {
    for (let i = 0; i < gx.length; i++) {
      if (rng() > localKeep) continue;
      const z1 = gz[j], z2 = gz[j + 1], x = gx[i];
      if (localOk(x, z1, x, z2)) locals.push({ id: roadId++, klass: 'local', points: [[x, z1], [x, z2]], width: 6, lanes: rng() < 0.3 ? 2 : 1 });
    }
  }
  roads.push(...locals);

  /* ------------------------------------------- 4. district field --------- */
  function districtAt(x, z) {
    const d = Math.hypot(x, z) / E; // 0 center .. ~1.4 corner
    if (d < 0.28) return 'downtown';
    if (d < 0.72) return 'midtown';
    return 'suburb';
  }
  function heightFor(district) {
    if (district === 'downtown') return 40 + rng() * 120;   // 40–160
    if (district === 'midtown') return 12 + rng() * 33;     // 12–45
    return 4 + rng() * 8;                                    // 4–12
  }

  /* ------------------------------------------- 5. buildings -------------- */
  // Each macro-cell of the loose local grid is a block; subdivide into lots
  // inset from block edges, skipping cells crossed by a main road.
  const buildings = [];
  let bid = 0;
  const inset = 8; // sidewalk / setback from block edge
  for (let i = 0; i < gx.length - 1; i++) {
    for (let j = 0; j < gz.length - 1; j++) {
      const x0 = gx[i] + inset, x1 = gx[i + 1] - inset;
      const z0 = gz[j] + inset, z1 = gz[j + 1] - inset;
      if (x1 - x0 < 14 || z1 - z0 < 14) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // block is unusable if a main road crosses it: sample center + 4 corners
      let blocked = false;
      const samplePts = [[cx, cz], [x0, z0], [x1, z0], [x1, z1], [x0, z1]];
      for (const r of mains) {
        const lim = r.width * 0.5 + 6;
        for (const [sx, sz] of samplePts) {
          if (roadDist(r, sx, sz) < lim) { blocked = true; break; }
        }
        if (blocked) break;
      }
      if (blocked) continue;
      const district = districtAt(cx, cz);
      // subdivide block into lots
      const nx = district === 'suburb' ? 3 : 3 + Math.floor(rng() * 2);
      const nz = district === 'suburb' ? 3 : 3 + Math.floor(rng() * 2);
      const gap = 5;
      const lotW = (x1 - x0 - (nx - 1) * gap) / nx;
      const lotH = (z1 - z0 - (nz - 1) * gap) / nz;
      for (let a = 0; a < nx; a++) {
        for (let b = 0; b < nz; b++) {
          if (rng() < 0.12) continue; // vacant lot / pocket park
          const shrinkX = 1 + rng() * 3, shrinkZ = 1 + rng() * 3;
          const lx0 = x0 + a * (lotW + gap) + shrinkX, lx1 = x0 + a * (lotW + gap) + lotW - shrinkX;
          const lz0 = z0 + b * (lotH + gap) + shrinkZ, lz1 = z0 + b * (lotH + gap) + lotH - shrinkZ;
          if (lx1 - lx0 < 7 || lz1 - lz0 < 7) continue;
          // optional L-shape subdivision: split lot into two rectangles
          if (rng() < 0.22 && lx1 - lx0 > 18) {
            const mx = (lx0 + lx1) / 2 + (rng() * 2 - 1) * 2;
            buildings.push({ id: bid++, footprint: rectCCW(lx0, lz0, mx, lz1), height: heightFor(district), district });
            buildings.push({ id: bid++, footprint: rectCCW(mx + 2, lz0, lx1, lz1), height: heightFor(district), district });
          } else {
            buildings.push({ id: bid++, footprint: rectCCW(lx0, lz0, lx1, lz1), height: heightFor(district), district });
          }
        }
      }
    }
  }
  function rectCCW(x0, z0, x1, z1) {
    // CCW when viewed from +Y (X right, Z down on screen => use standard math CCW in XZ: (x,z) pairs wound so cross product points +Y)
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  }

  /* ------------------------------------------- 6. props ------------------ */
  const streetlights = [];
  const signals = [];
  for (const r of roads) {
    // streetlights every 25 m along both edges
    const off = r.width * 0.5 + 1.5;
    for (let i = 1; i < r.points.length; i++) {
      const [ax, az] = r.points[i - 1];
      const [bx, bz] = r.points[i];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      const nx = -dz, nz = dx; // normal
      for (let d = 12.5; d < L; d += 25) {
        const side = (Math.floor(d / 25) + i) % 2 === 0 ? 1 : -1; // alternate sides
        streetlights.push({ x: ax + dx * d + nx * off * side, z: az + dz * d + nz * off * side, side });
      }
    }
  }
  // traffic signals where two arterials pass near each other
  for (let i = 0; i < arterials.length; i++) {
    for (let j = i + 1; j < arterials.length; j++) {
      const A = arterials[i], B = arterials[j];
      for (let a = 1; a < A.points.length; a++) {
        for (let b = 1; b < B.points.length; b++) {
          const hit = segSegIntersect(
            A.points[a - 1][0], A.points[a - 1][1], A.points[a][0], A.points[a][1],
            B.points[b - 1][0], B.points[b - 1][1], B.points[b][0], B.points[b][1]);
          if (hit) {
            let dup = false;
            for (const s of signals) if (dist2(s.x, s.z, hit[0], hit[1]) < 900) { dup = true; break; }
            if (!dup) signals.push({ x: hit[0], z: hit[1] });
          }
        }
      }
    }
  }
  function segSegIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
    const d1x = bx - ax, d1z = bz - az, d2x = dx - cx, d2z = dz - cz;
    const den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((cx - ax) * d2z - (cz - az) * d2x) / den;
    const u = ((cx - ax) * d1z - (cz - az) * d1x) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return [ax + d1x * t, az + d1z * t];
  }

  /* ------------------------------------------- 7. POIs & districts ------- */
  const pois = [];
  const poiCount = 30;
  const usedNames = new Set();
  for (let i = 0; i < poiCount && buildings.length > 0; i++) {
    const b = buildings[Math.floor(rng() * buildings.length)];
    let cx = 0, cz = 0;
    for (const [x, z] of b.footprint) { cx += x; cz += z; }
    cx /= b.footprint.length; cz /= b.footprint.length;
    const kind = POI_KINDS[Math.floor(rng() * POI_KINDS.length)];
    let name = SYL_A[Math.floor(rng() * SYL_A.length)] + SYL_B[Math.floor(rng() * SYL_B.length)] + ' ' + POI_SUFFIX[kind];
    if (usedNames.has(name)) { name = SYL_A[Math.floor(rng() * SYL_A.length)] + name; }
    usedNames.add(name);
    pois.push({ id: i, name, kind, x: cx, z: cz });
  }
  const districts = DISTRICT_NAMES.map((name, i) => {
    const ang = (i / DISTRICT_NAMES.length) * Math.PI * 2 + rng() * 0.6;
    const r = E * (0.35 + rng() * 0.3);
    return { name, x: Math.cos(ang) * r, z: Math.sin(ang) * r };
  });

  return { seed, bounds, roads, buildings, pois, districts, streetlights, signals };
}
