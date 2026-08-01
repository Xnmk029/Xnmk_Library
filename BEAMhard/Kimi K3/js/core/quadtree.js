// ============================================================================
// core/quadtree.js — 3D Vector Tile pipeline (pure JS).
// Slices city vector data (road LineStrings, building Polygons, POI points,
// props) into a standard z/x/y QuadTree tile hierarchy with exact geometry
// clipping (Liang–Barsky for lines, Sutherland–Hodgman for polygons), so the
// renderer can stream tiles on demand by frustum + zoom level.
// ============================================================================

export class QuadTreeTiler {
  /**
   * @param bounds {minX, minZ, maxX, maxZ} world bounds (square enforced)
   * @param maxZ  deepest zoom level
   */
  constructor(bounds, maxZ = 6) {
    const size = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    this.root = { minX: cx - size / 2, minZ: cz - size / 2, maxX: cx + size / 2, maxZ: cz + size / 2 };
    this.size = size;
    this.maxZ = maxZ;
    this.tiles = new Map(); // "z/x/y" -> tile
  }

  tileBounds(z, x, y) {
    const n = 1 << z;
    const w = this.size / n;
    return {
      minX: this.root.minX + x * w,
      minZ: this.root.minZ + y * w,
      maxX: this.root.minX + (x + 1) * w,
      maxZ: this.root.minZ + (y + 1) * w,
      w,
    };
  }

  tileKey(z, x, y) { return `${z}/${x}/${y}`; }

  // Build all tiles from z=0..maxZ. Features are clipped into every tile they touch.
  build(city) {
    const t0 = nowMs();
    let featureAssignments = 0;
    for (let z = 0; z <= this.maxZ; z++) {
      const n = 1 << z;
      for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
          const b = this.tileBounds(z, x, y);
          const tile = {
            z, x, y, key: this.tileKey(z, x, y), bounds: b,
            roads: [], buildings: [], markings: [],
            streetlights: [], signals: [], pois: [],
            empty: true,
          };
          for (const r of city.roads) {
            const clipped = clipPolyline(r.points, b);
            if (clipped.length) { tile.roads.push({ kind: r.kind, width: r.width, segments: clipped }); tile.empty = false; featureAssignments++; }
          }
          for (const m of city.markings) {
            const clipped = clipPolyline(m.points, b);
            if (clipped.length) { tile.markings.push({ kind: m.kind, width: m.width, segments: clipped }); featureAssignments++; }
          }
          for (const bd of city.buildings) {
            const poly = clipPolygon(bd.polygon, b);
            if (poly.length >= 3) { tile.buildings.push({ height: bd.height, polygon: poly }); tile.empty = false; featureAssignments++; }
          }
          for (const s of city.streetlights) {
            if (s.x >= b.minX && s.x < b.maxX && s.z >= b.minZ && s.z < b.maxZ) { tile.streetlights.push(s); featureAssignments++; }
          }
          for (const s of city.signals) {
            if (s.x >= b.minX && s.x < b.maxX && s.z >= b.minZ && s.z < b.maxZ) { tile.signals.push(s); featureAssignments++; }
          }
          for (const p of city.pois) {
            if (p.x >= b.minX && p.x < b.maxX && p.z >= b.minZ && p.z < b.maxZ) { tile.pois.push(p); featureAssignments++; }
          }
          this.tiles.set(tile.key, tile);
        }
      }
    }
    this.buildTimeMs = nowMs() - t0;
    this.featureAssignments = featureAssignments;
    return this;
  }

  get(z, x, y) { return this.tiles.get(this.tileKey(z, x, y)); }

  // Tiles covering a world-space rect at zoom z.
  cover(z, minX, minZ, maxX, maxZ) {
    const n = 1 << z;
    const w = this.size / n;
    const clampI = (i) => Math.max(0, Math.min(n - 1, i));
    const x0 = clampI(Math.floor((minX - this.root.minX) / w));
    const x1 = clampI(Math.floor((maxX - this.root.minX) / w));
    const y0 = clampI(Math.floor((minZ - this.root.minZ) / w));
    const y1 = clampI(Math.floor((maxZ - this.root.minZ) / w));
    const out = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(this.get(z, x, y));
    return out.filter(Boolean);
  }

  stats() {
    let nonEmpty = 0, buildings = 0, roadSegs = 0;
    for (const t of this.tiles.values()) {
      if (!t.empty) nonEmpty++;
      buildings += t.buildings.length;
      for (const r of t.roads) roadSegs += r.segments.length;
    }
    return {
      tiles: this.tiles.size, nonEmpty, buildings, roadSegs,
      buildTimeMs: this.buildTimeMs, featureAssignments: this.featureAssignments,
    };
  }
}

function nowMs() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

// --- Liang–Barsky polyline clipping -> list of clipped segments (each [p0,p1..]) ---
export function clipPolyline(points, b) {
  const out = [];
  let current = null;
  for (let i = 1; i < points.length; i++) {
    const seg = clipSegment(points[i - 1], points[i], b);
    if (seg) {
      if (!current) { current = [seg[0], seg[1]]; out.push(current); }
      else {
        const last = current[current.length - 1];
        if (Math.abs(last[0] - seg[0][0]) < 1e-6 && Math.abs(last[1] - seg[0][1]) < 1e-6) current.push(seg[1]);
        else { current = [seg[0], seg[1]]; out.push(current); }
      }
    } else current = null;
  }
  return out;
}

function clipSegment(p0, p1, b) {
  const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
  let t0 = 0, t1 = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (clip(-dx, p0[0] - b.minX) && clip(dx, b.maxX - p0[0]) &&
      clip(-dz, p0[1] - b.minZ) && clip(dz, b.maxZ - p0[1])) {
    return [
      [p0[0] + t0 * dx, p0[1] + t0 * dz],
      [p0[0] + t1 * dx, p0[1] + t1 * dz],
    ];
  }
  return null;
}

// --- Sutherland–Hodgman polygon clipping -------------------------------------
export function clipPolygon(poly, b) {
  let out = poly;
  const edges = [
    { inside: (p) => p[0] >= b.minX, intersect: (a, c) => intersectX(a, c, b.minX) },
    { inside: (p) => p[0] <= b.maxX, intersect: (a, c) => intersectX(a, c, b.maxX) },
    { inside: (p) => p[1] >= b.minZ, intersect: (a, c) => intersectZ(a, c, b.minZ) },
    { inside: (p) => p[1] <= b.maxZ, intersect: (a, c) => intersectZ(a, c, b.maxZ) },
  ];
  for (const e of edges) {
    if (!out.length) break;
    const input = out; out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      const curIn = e.inside(cur), prevIn = e.inside(prev);
      if (curIn) {
        if (!prevIn) out.push(e.intersect(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(e.intersect(prev, cur));
      }
    }
  }
  return out;
}
function intersectX(a, b, x) {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + t * (b[1] - a[1])];
}
function intersectZ(a, b, z) {
  const t = (z - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), z];
}
