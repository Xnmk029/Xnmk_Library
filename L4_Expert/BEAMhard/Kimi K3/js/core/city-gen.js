// ============================================================================
// core/city-gen.js — Procedural city generator (pure JS, deterministic seed).
// Road network : hybrid Grid-Graph + Voronoi-jitter — arterials on a coarse
//                jittered lattice, collectors subdividing blocks, local lanes.
// Blocks       : polygon footprints between adjacent roads; building volumes
//                extruded by distance-to-centre falloff * hash noise.
// Props        : streetlights every ~30 m along roads, traffic signals at
//                arterial intersections, road markings polylines.
// POI          : named nodes at major intersections + amenities.
// Output is plain vector data consumed by the QuadTree tiler and renderer.
// ============================================================================

import { mulberry32, hash2, clamp01, lerp } from './math.js';

const POI_NAMES = [
  'Sakura Crossing', 'Harbor Gate', 'Neon Alley', 'Grand Circuit Hotel', 'Ueno Park',
  'Station Plaza', 'Drift Arena', 'Old Market', 'Skyline Tower', 'Riverside Walk',
  'Tech Quarter', 'Shrine Hill', 'Night Bazaar', 'Marina Point', 'Craft District',
  'Lantern Square', 'North Depot', 'South Ferry', 'East Arcade', 'West Gardens',
];

export function generateCity(options = {}) {
  const seed = options.seed ?? 20260728;
  const size = options.size ?? 1600;          // city extent (m), square
  const half = size / 2;
  const rng = mulberry32(seed);

  const roads = [];
  const intersections = new Map(); // "ix,iz" -> {x,z,arterial:bool}
  let roadId = 0;

  // ---- Layer 1: arterials — coarse grid with per-line curvature --------------
  const ARTERIAL_N = 4; // each direction
  const aGap = size / (ARTERIAL_N + 1);
  const key = (x, z) => `${Math.round(x * 2)},${Math.round(z * 2)}`;

  const addIntersection = (x, z, arterial) => {
    const k = key(x, z);
    const ex = intersections.get(k);
    if (ex) { ex.arterial = ex.arterial || arterial; return ex; }
    const it = { x, z, arterial, id: intersections.size };
    intersections.set(k, it);
    return it;
  };

  const mkRoad = (pts, kind, width) => {
    if (pts.length < 2) return null;
    const r = { id: roadId++, kind, width, points: pts, length: polyLen(pts) };
    roads.push(r);
    return r;
  };

  // vertical arterials (x const-ish, wavy)
  const vXs = [];
  for (let i = 1; i <= ARTERIAL_N; i++) {
    const x0 = -half + i * aGap + (rng() - 0.5) * aGap * 0.25;
    vXs.push(x0);
    const pts = [];
    const phase = rng() * Math.PI * 2, amp = 20 + rng() * 30, wl = 350 + rng() * 250;
    for (let z = -half; z <= half; z += 50) {
      pts.push([x0 + Math.sin(z / wl * Math.PI * 2 + phase) * amp, z]);
    }
    mkRoad(pts, 'arterial', 14);
  }
  // horizontal arterials
  const hZs = [];
  for (let i = 1; i <= ARTERIAL_N; i++) {
    const z0 = -half + i * aGap + (rng() - 0.5) * aGap * 0.25;
    hZs.push(z0);
    const pts = [];
    const phase = rng() * Math.PI * 2, amp = 20 + rng() * 30, wl = 350 + rng() * 250;
    for (let x = -half; x <= half; x += 50) {
      pts.push([x, z0 + Math.sin(x / wl * Math.PI * 2 + phase) * amp]);
    }
    mkRoad(pts, 'arterial', 14);
  }
  // arterial intersections
  for (const x of vXs) for (const z of hZs) addIntersection(x, z, true);

  // ---- Layer 2: collectors — subdivide each arterial cell (Voronoi jitter) ---
  const cellXs = [-half, ...vXs, half];
  const cellZs = [-half, ...hZs, half];
  const blocks = [];
  let poiCount = 0;

  for (let cx = 0; cx < cellXs.length - 1; cx++) {
    for (let cz = 0; cz < cellZs.length - 1; cz++) {
      const x0 = cellXs[cx], x1 = cellXs[cx + 1];
      const z0 = cellZs[cz], z1 = cellZs[cz + 1];
      const w = x1 - x0, d = z1 - z0;
      // collector lines: 1-2 verticals + horizontals inside the cell
      const nV = Math.max(1, Math.round(w / 180));
      const nH = Math.max(1, Math.round(d / 180));
      const innerXs = [], innerZs = [];
      for (let i = 1; i <= nV; i++) {
        const x = x0 + (w * i) / (nV + 1) + (rng() - 0.5) * 24;
        innerXs.push(x);
        mkRoad([[x, z0], [x + (rng() - 0.5) * 14, (z0 + z1) / 2], [x, z1]], 'collector', 9);
      }
      for (let i = 1; i <= nH; i++) {
        const z = z0 + (d * i) / (nH + 1) + (rng() - 0.5) * 24;
        innerZs.push(z);
        mkRoad([[x0, z], [(x0 + x1) / 2, z + (rng() - 0.5) * 14], [x1, z]], 'collector', 9);
      }
      for (const x of innerXs) for (const z of innerZs) addIntersection(x, z, false);
      for (const x of innerXs) { addIntersection(x, z0, false); addIntersection(x, z1, false); }
      for (const z of innerZs) { addIntersection(x0, z, false); addIntersection(x1, z, false); }

      // ---- blocks between inner subdivision lines ----
      const bx = [x0, ...innerXs, x1], bz = [z0, ...innerZs, z1];
      for (let i = 0; i < bx.length - 1; i++) {
        for (let j = 0; j < bz.length - 1; j++) {
          const bx0 = bx[i] + 6, bx1 = bx[i + 1] - 6;
          const bz0 = bz[j] + 6, bz1 = bz[j + 1] - 6;
          if (bx1 - bx0 < 24 || bz1 - bz0 < 24) continue;
          blocks.push({ x0: bx0, x1: bx1, z0: bz0, z1: bz1 });
        }
      }
    }
  }

  // ---- Layer 3: local lanes (sparse, inside large blocks) --------------------
  for (const b of blocks) {
    if ((b.x1 - b.x0) > 90 && rng() < 0.5) {
      const x = (b.x0 + b.x1) / 2 + (rng() - 0.5) * 10;
      mkRoad([[x, b.z0 - 6], [x, b.z1 + 6]], 'local', 5.5);
    }
  }

  // ---- Buildings: extrude footprints inside blocks ---------------------------
  const buildings = [];
  let bid = 0;
  const centreFalloff = (x, z) => {
    const d = Math.hypot(x, z) / half;            // 0 centre -> 1 edge
    return Math.pow(1 - clamp01(d), 1.6);
  };
  for (const b of blocks) {
    const bw = b.x1 - b.x0, bd = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const urban = centreFalloff(cx, cz);
    // split large blocks into 1..4 lots
    const lotsX = bw > 70 ? 2 : 1, lotsZ = bd > 70 ? 2 : 1;
    for (let i = 0; i < lotsX; i++) {
      for (let j = 0; j < lotsZ; j++) {
        const lx0 = lerp(b.x0, b.x1, i / lotsX) + 4;
        const lx1 = lerp(b.x0, b.x1, (i + 1) / lotsX) - 4;
        const lz0 = lerp(b.z0, b.z1, j / lotsZ) + 4;
        const lz1 = lerp(b.z0, b.z1, (j + 1) / lotsZ) - 4;
        if (lx1 - lx0 < 10 || lz1 - lz0 < 10) continue;
        const hSeed = hash2(bid, 7, seed);
        const park = hSeed > 0.93 && urban < 0.5;
        if (park) continue; // pocket park: no building
        const hBase = 8 + urban * 55;
        const height = Math.max(6, hBase * (0.55 + hSeed * 0.9));
        // footprint: rectangle, occasionally L-shaped (two rects)
        const footprints = [[
          [lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1],
        ]];
        if (hSeed > 0.72 && (lx1 - lx0) > 26 && (lz1 - lz0) > 26) {
          const mx = (lx0 + lx1) / 2;
          footprints[0] = [[lx0, lz0], [lx1, lz0], [lx1, (lz0 + lz1) / 2], [mx, (lz0 + lz1) / 2], [mx, lz1], [lx0, lz1]];
        }
        buildings.push({ id: bid++, polygon: footprints[0], height, cx: (lx0 + lx1) / 2, cz: (lz0 + lz1) / 2 });
      }
    }
  }

  // ---- Props: streetlights + signals + markings -------------------------------
  const streetlights = [];
  const signals = [];
  const markings = [];
  for (const r of roads) {
    // centreline dashes
    if (r.kind !== 'local') {
      markings.push({ kind: 'dashed', width: 0.18, points: r.points });
    }
    // edge lines on arterials
    if (r.kind === 'arterial') {
      markings.push({ kind: 'edgeL', width: 0.14, points: offsetPolyline(r.points, r.width / 2 - 0.4) });
      markings.push({ kind: 'edgeR', width: 0.14, points: offsetPolyline(r.points, -(r.width / 2 - 0.4)) });
    }
    // streetlights every ~30 m along both sides
    const step = r.kind === 'local' ? 45 : 30;
    const n = Math.max(1, Math.floor(r.length / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = samplePolyline(r.points, t);
      const tan = samplePolylineTangent(r.points, t);
      const nx = -tan[1], nz = tan[0];
      const side = i % 2 === 0 ? 1 : -1;
      streetlights.push({
        x: p[0] + nx * side * (r.width / 2 + 0.8),
        z: p[1] + nz * side * (r.width / 2 + 0.8),
        h: 6, road: r.id,
      });
    }
  }
  for (const it of intersections.values()) {
    if (it.arterial) signals.push({ x: it.x + 7, z: it.z + 7, h: 5.2 });
  }

  // ---- POIs -------------------------------------------------------------------
  const pois = [];
  let pi = 0;
  for (const it of intersections.values()) {
    if (it.arterial && pi < POI_NAMES.length && (pi % 2 === 0)) {
      pois.push({ name: POI_NAMES[pi], x: it.x, z: it.z, kind: 'landmark', importance: 1 });
      pi++;
    }
  }
  // extra amenity POIs scattered
  const amenityKinds = ['fuel', 'parking', 'food', 'garage'];
  for (let i = 0; i < 24 && pi < POI_NAMES.length + 24; i++) {
    const b = buildings[Math.floor(rng() * buildings.length)];
    if (!b) break;
    pois.push({
      name: amenityKinds[i % amenityKinds.length].toUpperCase() + ' ' + (100 + i),
      x: b.cx, z: b.cz, kind: amenityKinds[i % amenityKinds.length], importance: 0.5,
    });
  }

  return {
    seed, size, half,
    roads, buildings, streetlights, signals, markings, pois,
    intersections: [...intersections.values()],
    stats: {
      roads: roads.length, buildings: buildings.length,
      streetlights: streetlights.length, signals: signals.length,
      markings: markings.length, pois: pois.length,
      intersections: intersections.size,
    },
  };
}

// --- polyline helpers ---------------------------------------------------------
function polyLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
function samplePolyline(pts, t) {
  const L = polyLen(pts);
  let target = t * L;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (target <= seg) {
      const u = seg > 0 ? target / seg : 0;
      return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)];
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}
function samplePolylineTangent(pts, t) {
  const e = 0.01;
  const a = samplePolyline(pts, Math.max(0, t - e));
  const b = samplePolyline(pts, Math.min(1, t + e));
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}
function offsetPolyline(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const t = pts.length === 1 ? 0 : i / (pts.length - 1);
    const tan = samplePolylineTangent(pts, t);
    out.push([pts[i][0] - tan[1] * off, pts[i][1] + tan[0] * off]);
  }
  return out;
}
