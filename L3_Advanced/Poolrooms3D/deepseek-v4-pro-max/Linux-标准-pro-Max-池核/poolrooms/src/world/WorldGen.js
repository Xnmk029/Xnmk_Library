// WorldGen.js — infinite procedural "Poolrooms" level generator.
//
// Pure JavaScript data generation. Zero imports (no three.js). Another module
// turns this data into geometry. Everything here is a function of (cx, cz, seed):
// deterministic, order-independent, and neighbour-independent.
//
// Coordinate conventions
//   * Chunk (cx, cz) occupies world x in [cx*CHUNK, cx*CHUNK+CHUNK), z likewise.
//     All geometry is authored in LOCAL coords [0..CHUNK] then offset by (cx,cz).
//   * Deck (walkable floor) top is y = DECK_Y = 0. Slabs run -DECK_TH..0.
//   * Ceiling underside is CEIL_Y = 5.0 (slab CEIL_Y..CEIL_Y+CEIL_TH) with
//     rectangular skylight holes (light shafts pass through the holes).
//   * Perimeter walls stand ON the chunk boundary, 0.3 m thick, wallTile up to
//     WALL_TOP (2.4 m = doorway height) with a plaster lintel 2.4..CEIL_Y above.
//     Each of the 4 borders has a doorway opening 0..2.4 m whose position comes
//     from the *shared edge key*, so both neighbours independently agree.
//
// Cross-chunk contract
//   * Doorway opening on a border = gap in wallTile; the plaster lintel runs the
//     full edge (so the opening is exactly 0..2.4 m tall). Position is derived
//     from edgeKey(axis, minChunkCoord, otherCoord), identical from both sides.
//   * Perimeter plaster always tops out at CEIL_Y (5.0), even in the atrium, so
//     neighbouring chunks always meet at a clean 5.0 m wall.
//
// Architectural detail (second pass)
//   * Perimeter walls get pilasters, a wainscot band, a cornice, and doorways get
//     real jambs + a soffit. Ceilings get a shallow beam grid (coffers) and a
//     raised curb around every skylight. Floors get gutters, threshold strips and
//     drain sumps. Pools get a scum-gutter lip, step nosings and a bench ledge.
//   * Skylights are SUN-BIASED: an opening is offset from its target by
//     ~1.48 * height along the sun's horizontal direction so the shaft actually
//     lands on water/deck. Daylight area targets 15..25% of the ceiling.

export const CHUNK = 32;     // chunk edge length, meters
export const DECK_Y = 0;     // walkable deck top surface height
export const CEIL_Y = 5.0;   // default ceiling underside height

// ---------------------------------------------------------------------------
// Deterministic PRNG (no Math.random anywhere)
// ---------------------------------------------------------------------------
function hash32(u) {
  u |= 0;
  u = Math.imul(u ^ (u >>> 16), 0x85ebca6b);
  u = Math.imul(u ^ (u >>> 13), 0xc2b2ae35);
  u ^= u >>> 16;
  return u >>> 0;
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function hashKey(cx, cz, seed, ...salts) {
  let h = 0x9e3779b9 ^ hash32(seed) ^ hash32(cx) ^ Math.imul(hash32(cz), 0x27d4eb2f);
  h ^= hashStr('poolrooms');
  for (const s of salts) { h = Math.imul(h ^ hashStr(s), 0x85ebca6b); h = (h ^ (h >>> 13)) >>> 0; }
  return h >>> 0;
}
function makeRng(seedU32) {
  let a = seedU32 >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
function irange(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------
export function chunkKey(cx, cz) { return cx + ',' + cz; }
export function worldToChunk(x, z) { return [Math.floor(x / CHUNK), Math.floor(z / CHUNK)]; }

// ---------------------------------------------------------------------------
// Materials & shared dimensions
// ---------------------------------------------------------------------------
const MAT = {
  deck: 'deckTile', wall: 'wallTile', pool: 'poolTile', poolDeep: 'poolTileDeep',
  concrete: 'concrete', plaster: 'plaster', coping: 'coping', metal: 'metal',
};

const WALL_T = 0.3;        // perimeter wall thickness
const WALL_TOP = 2.4;      // doorway height / bottom of lintel
const DECK_TH = 0.4;       // deck slab thickness
const CEIL_TH = 0.35;      // ceiling slab thickness
const POOL_WALL = 0.3;     // basin wall thickness
const FLOOR_TH = 0.3;      // basin floor thickness
const COPING_W = 0.28;     // pool coping lip width
const COPING_H = 0.06;     // pool coping lip height
const ATRIUM_CEIL = 9.0;   // atrium double-height underside
const PERIM_BAND = 4.0;    // atrium perimeter band keeps default 5.0 ceiling
const CLER_TOP = 2.5;      // clerestory slot bottom (above the 2.4 doorway band)
const CLER_BOT = 3.6;      // clerestory slot top (1.1 m slot)

// Sun: elevation 34°, azimuth 2.42 rad -> direction (0.53, 0.56, -0.63).
const SUN_HX = 0.644, SUN_HZ = -0.766; // normalised horizontal component
const SUN_K = 1.48;                    // 1 / tan(34°) ~ offset per metre of height

// Water surface/bottom heights (surface sits 0.08..0.18 below deck).
const WATER = {
  deep:    { surface: -0.12, depth: 2.4 },  // bottom -2.52
  shallow: { surface: -0.12, depth: 0.28 }, // bottom -0.40 (<=0.45 step: wadeable)
  trough:  { surface: -0.12, depth: 0.25 }, // bottom -0.37 (<=0.45 step: wadeable)
};

const ARCHETYPES = [
  ['grandPool', 16], ['shallowHall', 14], ['corridorMaze', 16], ['lapPools', 10],
  ['stairTerraces', 10], ['atrium', 10], ['changingRooms', 8], ['divingWell', 6],
];
function pickArchetype(rng) {
  let total = 0;
  for (const [, w] of ARCHETYPES) total += w;
  let r = rng() * total;
  for (const [name, w] of ARCHETYPES) { r -= w; if (r < 0) return name; }
  return ARCHETYPES[ARCHETYPES.length - 1][0];
}

const FULL = { x0: 0, z0: 0, x1: CHUNK, z1: CHUNK };

// ---------------------------------------------------------------------------
// Shared-edge doorway keying
// ---------------------------------------------------------------------------
function edgeKey(axis, cx, cz, seed) { return hashKey(cx, cz, seed, 'edge', axis); }

function doorwayOnEdge(axis, side, cx, cz, seed) {
  const key = side === 1
    ? edgeKey(axis, cx, cz, seed)
    : (axis === 'x' ? edgeKey('x', cx - 1, cz, seed) : edgeKey('z', cx, cz - 1, seed));
  const rng = makeRng(key);
  const width = range(rng, 2.4, 3.2);
  const start = range(rng, 3.0, 32.0 - 3.0 - width);
  return { axis, side, start, width };
}
function buildDoorways(cx, cz, seed) {
  return [
    doorwayOnEdge('x', -1, cx, cz, seed), doorwayOnEdge('x', +1, cx, cz, seed),
    doorwayOnEdge('z', -1, cx, cz, seed), doorwayOnEdge('z', +1, cx, cz, seed),
  ];
}
function doorwayZones(doorways) {
  const zones = [];
  for (const d of doorways) {
    const c = d.start + d.width / 2;
    if (d.axis === 'x') {
      const z0 = c - d.width / 2 - 0.5, z1 = c + d.width / 2 + 0.5;
      zones.push(d.side === 1 ? { x0: CHUNK - 2.5, z0, x1: CHUNK, z1 } : { x0: 0, z0, x1: 2.5, z1 });
    } else {
      const x0 = c - d.width / 2 - 0.5, x1 = c + d.width / 2 + 0.5;
      zones.push(d.side === 1 ? { x0, z0: CHUNK - 2.5, x1, z1: CHUNK } : { x0, z0: 0, x1, z1: 2.5 });
    }
  }
  return zones;
}
function rectsOverlap(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0; }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

// ---------------------------------------------------------------------------
// Rectangle subtraction (region minus axis-aligned, non-overlapping holes)
// ---------------------------------------------------------------------------
function subtractRects(region, holes) {
  let rects = [region];
  for (const h of holes) {
    const next = [];
    for (const r of rects) {
      const ix0 = Math.max(r.x0, h.x0), ix1 = Math.min(r.x1, h.x1);
      const iz0 = Math.max(r.z0, h.z0), iz1 = Math.min(r.z1, h.z1);
      if (ix0 >= ix1 || iz0 >= iz1) { next.push(r); continue; }
      if (r.z0 < iz0) next.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: iz0 });
      if (iz1 < r.z1) next.push({ x0: r.x0, z0: iz1, x1: r.x1, z1: r.z1 });
      if (r.x0 < ix0) next.push({ x0: r.x0, z0: iz0, x1: ix0, z1: iz1 });
      if (ix1 < r.x1) next.push({ x0: ix1, z0: iz0, x1: r.x1, z1: iz1 });
    }
    rects = next;
  }
  return rects;
}

// ---------------------------------------------------------------------------
// Generation context
// ---------------------------------------------------------------------------
function makeCtx(cx, cz, seed, chunk) {
  const ox = cx * CHUNK, oz = cz * CHUNK;
  const ctx = {
    cx, cz, seed, ox, oz, chunk,
    deckHoles: [], skylights: [], pools: [],
    rng: null,
    addBox(lx0, ly0, lz0, lx1, ly1, lz1, mat, collide = true, skip = null) {
      if (skip && !skip.length) skip = null;
      const b = { min: [lx0 + ox, ly0, lz0 + oz], max: [lx1 + ox, ly1, lz1 + oz], mat, collide };
      if (skip) b.skip = skip;
      chunk.boxes.push(b);
    },
    addWater(x0, z0, x1, z1, surface, bottom, kind) {
      chunk.waters.push({ x0: x0 + ox, z0: z0 + oz, x1: x1 + ox, z1: z1 + oz, surface, bottom, kind });
    },
    addLight(x, y, z, color, intensity, distance) {
      chunk.lights.push({ pos: [x + ox, y, z + oz], color, intensity, distance });
    },
    addProp(type, x, y, z, rot = 0, size = null) {
      const p = { type, pos: [x + ox, y, z + oz], rot };
      if (size) p.size = size;
      chunk.props.push(p);
    },
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// Shared shell: perimeter walls + architectural articulation
// ---------------------------------------------------------------------------
function buildPerimeter(ctx, doorways) {
  for (const d of doorways) {
    if (d.axis === 'x') {
      const x0 = d.side === 1 ? CHUNK - WALL_T : 0;
      const x1 = d.side === 1 ? CHUNK : WALL_T;
      const outer = d.side === 1 ? '+x' : '-x';
      for (const [z0, z1] of [[0, d.start], [d.start + d.width, CHUNK]]) {
        if (z1 - z0 > 0.001) ctx.addBox(x0, 0, z0, x1, WALL_TOP, z1, MAT.wall, true, ['-y', '+y', outer]);
      }
      ctx.addBox(x0, WALL_TOP, 0, x1, CEIL_Y, CHUNK, MAT.plaster, true, ['+y', outer]);
    } else {
      const z0 = d.side === 1 ? CHUNK - WALL_T : 0;
      const z1 = d.side === 1 ? CHUNK : WALL_T;
      const outer = d.side === 1 ? '+z' : '-z';
      for (const [x0, x1] of [[0, d.start], [d.start + d.width, CHUNK]]) {
        if (x1 - x0 > 0.001) ctx.addBox(x0, 0, z0, x1, WALL_TOP, z1, MAT.wall, true, ['-y', '+y', outer]);
      }
      ctx.addBox(0, WALL_TOP, z0, CHUNK, CEIL_Y, z1, MAT.plaster, true, ['+y', outer]);
    }
  }
}

// Pilasters, wainscot band and cornice on the perimeter wall interior faces.
// All decorative trim: collide:false (thin, the player walks past/over it).
function addWallDetail(ctx, doorways) {
  for (const d of doorways) {
    const gap0 = d.start, gap1 = d.start + d.width;
    const inner = d.side === 1 ? CHUNK - WALL_T : WALL_T;
    const outer = d.axis === 'x' ? (d.side === 1 ? '+x' : '-x') : (d.side === 1 ? '+z' : '-z');
    const prot = (w) => (d.side === 1 ? [inner - w, inner] : [inner, inner + w]);
    const wallBox = (a, y0, b, y1, p0, p1, mat, skip) => {
      if (d.axis === 'x') ctx.addBox(p0, y0, a, p1, y1, b, mat, false, skip);
      else ctx.addBox(a, y0, p0, b, y1, p1, mat, false, skip);
    };
    // Pilasters: engaged columns every 4 m, skipping the doorway.
    for (let t = 2; t < 32; t += 4) {
      if (t > gap0 - 1.0 && t < gap1 + 1.0) continue;
      const [p0, p1] = prot(0.18);
      wallBox(t - 0.2, 0, t + 0.2, WALL_TOP, p0, p1, MAT.concrete, ['-y', '+y', outer]);
    }
    // Wainscot band at ~1.0 m, split at the doorway.
    for (const [a, b] of [[0, gap0], [gap1, CHUNK]]) {
      if (b - a <= 0.001) continue;
      const [p0, p1] = prot(0.05);
      wallBox(a, 0.90, b, 1.06, p0, p1, MAT.concrete, ['-y', '+y', outer]);
    }
    // Cornice where wall meets ceiling (continuous, above the doorway).
    const [c0, c1] = prot(0.12);
    wallBox(0, CEIL_Y - 0.22, CHUNK, CEIL_Y, c0, c1, MAT.concrete, ['+y', outer]);
  }
}

// Doorway jambs + soffit so openings read as built rather than cut.
function addDoorwayFrames(ctx, doorways) {
  for (const d of doorways) {
    const gap0 = d.start, gap1 = d.start + d.width;
    const inner = d.side === 1 ? CHUNK - WALL_T : WALL_T;
    const outer = d.axis === 'x' ? (d.side === 1 ? '+x' : '-x') : (d.side === 1 ? '+z' : '-z');
    const prot = (w) => (d.side === 1 ? [inner - w, inner] : [inner, inner + w]);
    const wallBox = (a, y0, b, y1, p0, p1, mat, skip) => {
      if (d.axis === 'x') ctx.addBox(p0, y0, a, p1, y1, b, mat, false, skip);
      else ctx.addBox(a, y0, p0, b, y1, p1, mat, false, skip);
    };
    const [j0, j1] = prot(0.10);
    for (const s of [gap0 - 0.15, gap1]) {
      wallBox(s, 0, s + 0.15, WALL_TOP, j0, j1, MAT.concrete, ['-y', '+y', outer]);
    }
    const [s0, s1] = prot(0.12);
    wallBox(gap0 - 0.15, WALL_TOP, gap1 + 0.15, WALL_TOP + 0.20, s0, s1, MAT.concrete, ['+y', outer]);
  }
}

// ---------------------------------------------------------------------------
// Daylight system (sun-biased skylights, ceiling beams, skylight curbs)
// ---------------------------------------------------------------------------
function sunOffset(ceilH) { return { x: SUN_K * ceilH * SUN_HX, z: SUN_K * ceilH * SUN_HZ }; }

// Register a skylight slot; light lands at (tx,tz). Clamped to `region`, skips
// overlaps. Returns the rect or null.
function addSkylight(ctx, tx, tz, len, wid, ceilH, region = FULL) {
  const o = sunOffset(ceilH);
  const hx = len / 2, hz = wid / 2;
  if (region.x1 - region.x0 < len || region.z1 - region.z0 < wid) return null;
  const cx = clamp(tx + o.x, region.x0 + hx, region.x1 - hx);
  const cz = clamp(tz + o.z, region.z0 + hz, region.z1 - hz);
  const r = { x0: cx - hx, z0: cz - hz, x1: cx + hx, z1: cz + hz, ceilH };
  for (const s of ctx.skylights) if (rectsOverlap(s, r)) return null;
  ctx.skylights.push(r);
  return r;
}

const GRID_X = [9, 16, 23];
const GRID_Z = [6, 12, 18, 24];

// Default full-chunk ceiling: hero long slots sun-biased onto pools/decks plus a
// 3x4 grid of slots; then the ceiling slab, a beam grid, and skylight curbs.
function defaultRoof(ctx, heroTargets, opts = {}) {
  for (const [tx, tz] of heroTargets) addSkylight(ctx, tx, tz, opts.heroLen || 12, opts.heroWid || 2.8, CEIL_Y, FULL);
  for (const gx of GRID_X) for (const gz of GRID_Z) addSkylight(ctx, gx, gz, 6.5, 2.4, CEIL_Y, FULL);
  buildCeiling(ctx, ctx.skylights, CEIL_Y);
  if (opts.beams !== false) addCeilingBeams(ctx, CEIL_Y, FULL);
}

// Ceiling slab(s) at a height with skylight holes, optionally over a sub-region.
function buildCeiling(ctx, holes, ceilY, mat = MAT.plaster, region = FULL) {
  const rects = subtractRects(region, holes);
  for (const r of rects) {
    const skip = ['+y'];
    if (r.x0 <= 0.001) skip.push('-x');
    if (r.x1 >= CHUNK - 0.001) skip.push('+x');
    if (r.z0 <= 0.001) skip.push('-z');
    if (r.z1 >= CHUNK - 0.001) skip.push('+z');
    ctx.addBox(r.x0, ceilY, r.z0, r.x1, ceilY + CEIL_TH, r.z1, mat, true, skip);
  }
}

// Shallow beam grid (coffers) hanging from the ceiling underside; beams are
// clipped against skylights. The two directions are offset 0.002 m so their
// undersides never sit exactly coplanar at the intersections.
function addCeilingBeams(ctx, ceilY, region) {
  const w = 0.26, d = 0.18;
  for (let z = region.z0 + 4; z < region.z1 - 1; z += 4) {
    for (const r of subtractRects({ x0: region.x0, z0: z - w / 2, x1: region.x1, z1: z + w / 2 }, ctx.skylights)) {
      ctx.addBox(r.x0, ceilY - d, r.z0, r.x1, ceilY, r.z1, MAT.plaster, false, ['+y']);
    }
  }
  for (let x = region.x0 + 4; x < region.x1 - 1; x += 4) {
    for (const r of subtractRects({ x0: x - w / 2, z0: region.z0, x1: x + w / 2, z1: region.z1 }, ctx.skylights)) {
      ctx.addBox(r.x0, ceilY - d - 0.002, r.z0, r.x1, ceilY, r.z1, MAT.plaster, false, ['+y']);
    }
  }
}

// Raised curb (frame) around every skylight opening, so light shafts have a
// visible edge. collide:false — well above head height.
function addSkylightCurbs(ctx) {
  for (const s of ctx.skylights) {
    const y0 = s.ceilH - 0.14, y1 = s.ceilH, t = 0.12;
    ctx.addBox(s.x0, y0, s.z0, s.x1, y1, s.z0 + t, MAT.plaster, false, ['+y']);
    ctx.addBox(s.x0, y0, s.z1 - t, s.x1, y1, s.z1, MAT.plaster, false, ['+y']);
    ctx.addBox(s.x0, y0, s.z0 + t, s.x0 + t, y1, s.z1 - t, MAT.plaster, false, ['+y']);
    ctx.addBox(s.x1 - t, y0, s.z0 + t, s.x1, y1, s.z1 - t, MAT.plaster, false, ['+y']);
  }
}

// ---------------------------------------------------------------------------
// Deck / floor
// ---------------------------------------------------------------------------
function buildDeck(ctx) {
  const rects = subtractRects(FULL, ctx.deckHoles);
  for (const r of rects) ctx.addBox(r.x0, -DECK_TH, r.z0, r.x1, DECK_Y, r.z1, MAT.deck, true, ['-y']);
}

function column(ctx, x, z, y0, y1, size = 0.6, mat = MAT.concrete) {
  const h = size / 2;
  ctx.addBox(x - h, y0, z - h, x + h, y1, z + h, mat, true, ['-y', '+y']);
}

// Threshold strips at doorways, gutters + drain sumps around pools (on the deck).
function addFloorDetail(ctx, doorways) {
  for (const d of doorways) {
    const gap0 = d.start, gap1 = d.start + d.width;
    if (d.axis === 'x') {
      const x0 = d.side === 1 ? CHUNK - WALL_T - 0.3 : WALL_T;
      const x1 = d.side === 1 ? CHUNK - WALL_T : WALL_T + 0.3;
      ctx.addBox(x0, 0, gap0, x1, 0.02, gap1, MAT.metal, false, ['-y']);
    } else {
      const z0 = d.side === 1 ? CHUNK - WALL_T - 0.3 : WALL_T;
      const z1 = d.side === 1 ? CHUNK - WALL_T : WALL_T + 0.3;
      ctx.addBox(gap0, 0, z0, gap1, 0.02, z1, MAT.metal, false, ['-y']);
    }
  }
  for (const p of ctx.pools) {
    // Gutter channel (concrete) ~0.6 m outside the coping on all four sides.
    const g = 0.6, w = 0.35;
    ctx.addBox(p.x0 - POOL_WALL - g - w, 0, p.z0 - POOL_WALL - g, p.x1 + POOL_WALL + g + w, 0.02, p.z0 - POOL_WALL - g + w, MAT.concrete, false, ['-y']);
    ctx.addBox(p.x0 - POOL_WALL - g - w, 0, p.z1 + POOL_WALL + g - w, p.x1 + POOL_WALL + g + w, 0.02, p.z1 + POOL_WALL + g + w, MAT.concrete, false, ['-y']);
    ctx.addBox(p.x0 - POOL_WALL - g, 0, p.z0 - POOL_WALL - g, p.x0 - POOL_WALL - g + w, 0.02, p.z1 + POOL_WALL + g, MAT.concrete, false, ['-y']);
    ctx.addBox(p.x1 + POOL_WALL + g - w, 0, p.z0 - POOL_WALL - g, p.x1 + POOL_WALL + g, 0.02, p.z1 + POOL_WALL + g, MAT.concrete, false, ['-y']);
    // Drain sump pad + drain (already a prop on the pool).
    ctx.addBox(p.x0 + 1.0, 0, p.z0 - POOL_WALL - g, p.x0 + 1.6, 0.03, p.z0 - POOL_WALL - g + w, MAT.concrete, false, ['-y']);
  }
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------
function addPool(ctx, x0, z0, x1, z1, kind, depth, opts = {}) {
  const surface = WATER[kind].surface;
  const bottom = surface - depth;
  const deep = depth > 1.8;
  const mat = deep ? MAT.poolDeep : MAT.pool;

  if (!opts.noHole) {
    ctx.deckHoles.push({ x0: x0 - POOL_WALL, z0: z0 - POOL_WALL, x1: x1 + POOL_WALL, z1: z1 + POOL_WALL });
  }
  if (!opts.noFloor) {
    ctx.addBox(x0 - POOL_WALL, bottom - FLOOR_TH, z0 - POOL_WALL, x1 + POOL_WALL, bottom, z1 + POOL_WALL, mat, true, ['-y']);
  }
  if (!opts.noWalls) {
    ctx.addBox(x0 - POOL_WALL, bottom, z0 - POOL_WALL, x1 + POOL_WALL, DECK_Y, z0, mat, true, ['-y']); // south
    ctx.addBox(x0 - POOL_WALL, bottom, z1, x1 + POOL_WALL, DECK_Y, z1 + POOL_WALL, mat, true, ['-y']); // north
    ctx.addBox(x0 - POOL_WALL, bottom, z0, x0, DECK_Y, z1, mat, true, ['-y']);                        // west
    ctx.addBox(x1, bottom, z0, x1 + POOL_WALL, DECK_Y, z1, mat, true, ['-y']);                        // east
  }
  if (!opts.noCoping) {
    const cw = COPING_W / 2;
    ctx.addBox(x0, DECK_Y, z0 - cw, x1, DECK_Y + COPING_H, z0 + cw, MAT.coping, true, ['-y']);
    ctx.addBox(x0, DECK_Y, z1 - cw, x1, DECK_Y + COPING_H, z1 + cw, MAT.coping, true, ['-y']);
    ctx.addBox(x0 - cw, DECK_Y, z0, x0 + cw, DECK_Y + COPING_H, z1, MAT.coping, true, ['-y']);
    ctx.addBox(x1 - cw, DECK_Y, z0, x1 + cw, DECK_Y + COPING_H, z1, MAT.coping, true, ['-y']);
  }
  ctx.addWater(x0, z0, x1, z1, surface, bottom, kind);
  ctx.pools.push({ x0, z0, x1, z1, kind, depth, surface, bottom, mat });

  // Tiled scum-gutter lip just under the coping (contrasting band on the inner rim).
  if (!opts.noScum && !opts.noWalls) {
    const t = 0.05;
    ctx.addBox(x0, -0.15, z0, x0 + t, 0, z1, MAT.coping, false, ['-y', '+y']);
    ctx.addBox(x1 - t, -0.15, z0, x1, 0, z1, MAT.coping, false, ['-y', '+y']);
    ctx.addBox(x0, -0.15, z0, x1, 0, z0 + t, MAT.coping, false, ['-y', '+y']);
    ctx.addBox(x0, -0.15, z1 - t, x1, 0, z1, MAT.coping, false, ['-y', '+y']);
  }

  if (kind === 'deep') {
    if (opts.ladder) ctx.addProp('ladder', x1 + 0.18, DECK_Y, (z0 + z1) / 2, Math.PI, null);
    addPoolSteps(ctx, x0, z0, x1, z1, bottom, mat, opts.stepCount || 0);
    if (!opts.noBench) addBenchLedge(ctx, x0, z0, x1, z1, bottom, surface, mat);
  }
  if (opts.drain) ctx.addProp('drain', (x0 + x1) / 2, bottom + 0.02, (z0 + z1) / 2, 0, null);
}

// Shallow bench/seat ledge inside a deep pool, against the north wall, its top
// ~0.45 m below the surface (so you can sit with water at chest height).
function addBenchLedge(ctx, x0, z0, x1, z1, bottom, surface, mat) {
  const top = surface - 0.45;
  if (top <= bottom + 0.1) return;
  ctx.addBox(x0 + 1.5, bottom, z1 - POOL_WALL - 0.45, x1 - 1.5, top, z1 - POOL_WALL - 0.05, mat, true, ['-y', '+z']);
}

// Submerged stair run out of a deep pool, with metal nosings on each tread edge.
function addPoolSteps(ctx, x0, z0, x1, z1, bottom, mat, countOverride) {
  const rise = 0.3, tread = 0.35, width = 2.0;
  const n = countOverride || Math.ceil((DECK_Y - bottom) / rise);
  const alongX = (x1 - x0) >= (z1 - z0);
  for (let i = 0; i < n; i++) {
    const yTop = -i * rise;
    let yBot = yTop - rise;
    if (yBot < bottom) yBot = bottom;
    if (alongX) {
      const sx = x0 + i * tread;
      ctx.addBox(sx, yBot, z0, sx + tread, yTop, z0 + width, mat, true, ['-y']);
      ctx.addBox(sx, yTop, z0, sx + 0.06, yTop + 0.02, z0 + width, MAT.metal, false, ['-y', '+y']);
    } else {
      const sz = z0 + i * tread;
      ctx.addBox(x0, yBot, sz, x0 + width, yTop, sz + tread, mat, true, ['-y']);
      ctx.addBox(x0, yTop, sz, x0 + width, yTop + 0.02, sz + 0.06, MAT.metal, false, ['-y', '+y']);
    }
  }
}

// Walkable stairs (rise<=0.19, tread>=0.28) ascending +z; each step its own box.
function addStairs(ctx, x0, x1, zEdge, baseY, topY, mat, dir = 1) {
  const rise = 0.15, tread = 0.30;
  const n = Math.round((topY - baseY) / rise);
  for (let i = 0; i < n; i++) {
    const yTop = baseY + (i + 1) * rise;
    const za = zEdge - dir * (n - i) * tread;
    const zb = zEdge - dir * (n - i - 1) * tread;
    ctx.addBox(x0, yTop - rise, Math.min(za, zb), x1, yTop, Math.max(za, zb), mat, true, ['-y']);
  }
}

// A parapet (low safety wall) on top of a raised platform.
function parapet(ctx, x0, z0, x1, z1, topY, axis, side) {
  const h = 0.9, t = 0.15;
  if (axis === 'x') { // runs along x, at the z0/z1 edge
    const z0b = side === -1 ? z0 : z1 - t;
    ctx.addBox(x0, topY, z0b, x1, topY + h, z0b + t, MAT.concrete, true, ['-y', '+y']);
  } else { // runs along z, at the x0/x1 edge
    const x0b = side === -1 ? x0 : x1 - t;
    ctx.addBox(x0b, topY, z0, x0b + t, topY + h, z1, MAT.concrete, true, ['-y', '+y']);
  }
}

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
function addLights(ctx, keySalt) {
  const rng = makeRng(hashKey(ctx.cx, ctx.cz, ctx.seed, 'lights', keySalt));
  const warm = [1.0, 0.88, 0.72];
  const cool = [0.78, 0.9, 1.0];
  ctx.addLight(16, CEIL_Y - 1.6, 16, warm, 1.4, 20);
  ctx.addLight(range(rng, 6, 12), CEIL_Y - 1.8, range(rng, 6, 12), cool, 0.8, 15);
  ctx.addLight(range(rng, 20, 26), CEIL_Y - 1.8, range(rng, 20, 26), cool, 0.8, 15);
}

// ---------------------------------------------------------------------------
// Archetype builders
// ---------------------------------------------------------------------------

// grandPool — one big deep pool with wide decks, corner columns, coping,
// sun-biased skylights, and a submerged stair exit.
function buildGrandPool(ctx, doorways) {
  const pool = { x0: 8, z0: 10, x1: 24, z1: 22 };
  addPool(ctx, pool.x0, pool.z0, pool.x1, pool.z1, 'deep', WATER.deep.depth, { drain: true });
  for (const [cx0, cz0] of [[8, 10], [24, 10], [8, 22], [24, 22]]) {
    column(ctx, cx0, cz0, 0, CEIL_Y, 0.7, MAT.concrete);
    ctx.addProp('pillarLamp', cx0, 3.2, cz0, 0, null);
  }
  ctx.addProp('bench', 5, DECK_Y, 16, Math.PI / 2, null);
  ctx.addProp('bench', 27, DECK_Y, 16, -Math.PI / 2, null);
  buildDeck(ctx);
  defaultRoof(ctx, [[16, 16]]);
  ctx.chunk.spawn = [16 + ctx.ox, DECK_Y, 5 + ctx.oz];
}

// shallowHall — whole floor is 0.28 m shallow water, column grid, dry deck
// islands (spawn) and dry strips through every doorway.
function buildShallowHall(ctx, doorways) {
  const rng = ctx.rng;
  const m = 0.3;
  ctx.addBox(0, -0.40 - FLOOR_TH, 0, CHUNK, -0.40, CHUNK, MAT.pool, true, ['-y']);
  ctx.addBox(0, -0.40, 0, WALL_T, DECK_Y, CHUNK, MAT.pool, true, ['-y', '+y']);
  ctx.addBox(CHUNK - WALL_T, -0.40, 0, CHUNK, DECK_Y, CHUNK, MAT.pool, true, ['-y', '+y']);
  ctx.addBox(0, -0.40, 0, CHUNK, DECK_Y, WALL_T, MAT.pool, true, ['-y', '+y']);
  ctx.addBox(0, -0.40, CHUNK - WALL_T, CHUNK, DECK_Y, CHUNK, MAT.pool, true, ['-y', '+y']);
  ctx.addWater(m, m, CHUNK - m, CHUNK - m, -0.12, -0.40, 'shallow');

  for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) column(ctx, 8 * i, 8 * j, -0.40, CEIL_Y, 0.6, MAT.concrete);

  const islands = [];
  while (islands.length < 3) {
    const ix = irange(rng, 1, 6), iz = irange(rng, 1, 6);
    const cx0 = ix * 4 - 1.4, cz0 = iz * 4 - 1.4;
    const r = { x0: cx0, z0: cz0, x1: cx0 + 2.8, z1: cz0 + 2.8 };
    if (islands.some((o) => rectsOverlap(o, r))) continue;
    islands.push(r);
    ctx.addBox(r.x0, -0.40, r.z0, r.x1, DECK_Y, r.z1, MAT.deck, true, ['-y']);
  }
  for (const z of doorwayZones(doorways)) ctx.addBox(z.x0, -0.40, z.z0, z.x1, DECK_Y, z.z1, MAT.deck, true, ['-y']);

  defaultRoof(ctx, [[16, 16]], { beams: false });
  const isl = islands[0];
  ctx.chunk.spawn = [isl.x0 + 1.4 + ctx.ox, DECK_Y, isl.z0 + 1.4 + ctx.oz];
}

// corridorMaze — 7x7 grid of 4 m corridors separated by full-height walls carved
// by a DFS spanning tree, with clerestory slots high on ~1/3 of walls + troughs.
function buildCorridorMaze(ctx, doorways) {
  const rng = ctx.rng;
  const CW = 4.0, WT = 0.3;
  const start = (CHUNK - (7 * CW + 6 * WT)) / 2; // 1.1
  const N = 7;
  const cellX = (i) => start + i * (CW + WT);
  const cellZ = (j) => start + j * (CW + WT);

  const visited = Array.from({ length: N }, () => new Array(N).fill(false));
  const vWall = Array.from({ length: N - 1 }, () => new Array(N).fill(false));
  const hWall = Array.from({ length: N }, () => new Array(N - 1).fill(false));
  const stack = [[0, 0]];
  visited[0][0] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const nbrs = [];
    if (i > 0 && !visited[i - 1][j]) nbrs.push([i - 1, j, 'v', i - 1, j]);
    if (i < N - 1 && !visited[i + 1][j]) nbrs.push([i + 1, j, 'v', i, j]);
    if (j > 0 && !visited[i][j - 1]) nbrs.push([i, j - 1, 'h', i, j - 1]);
    if (j < N - 1 && !visited[i][j + 1]) nbrs.push([i, j + 1, 'h', i, j]);
    if (!nbrs.length) { stack.pop(); continue; }
    const [ni, nj, dir, wi, wj] = nbrs[irange(rng, 0, nbrs.length - 1)];
    if (dir === 'v') vWall[wi][wj] = true; else hWall[wi][wj] = true;
    visited[ni][nj] = true;
    stack.push([ni, nj]);
  }
  for (let k = 0; k < 5; k++) {
    if (rng() < 0.5) { vWall[irange(rng, 0, N - 2)][irange(rng, 0, N - 1)] = true; }
    else { hWall[irange(rng, 0, N - 1)][irange(rng, 0, N - 2)] = true; }
  }

  const emitWall = (i, j, axis) => {
    const cler = ((axis === 'v' ? i : j) + (axis === 'v' ? j : i)) % 3 === 1;
    if (axis === 'v') {
      const x = cellX(i) + CW;
      if (cler) {
        ctx.addBox(x, 0, cellZ(j), x + WT, CLER_TOP, cellZ(j) + CW, MAT.wall, true, ['-y']);
        ctx.addBox(x, CLER_BOT, cellZ(j), x + WT, CEIL_Y, cellZ(j) + CW, MAT.wall, true, ['+y']);
      } else {
        ctx.addBox(x, 0, cellZ(j), x + WT, CEIL_Y, cellZ(j) + CW, MAT.wall, true, ['-y', '+y']);
      }
    } else {
      const z = cellZ(j) + CW;
      if (cler) {
        ctx.addBox(cellX(i), 0, z, cellX(i) + CW, CLER_TOP, z + WT, MAT.wall, true, ['-y']);
        ctx.addBox(cellX(i), CLER_BOT, z, cellX(i) + CW, CEIL_Y, z + WT, MAT.wall, true, ['+y']);
      } else {
        ctx.addBox(cellX(i), 0, z, cellX(i) + CW, CEIL_Y, z + WT, MAT.wall, true, ['-y', '+y']);
      }
    }
  };
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < N; j++) if (!vWall[i][j]) emitWall(i, j, 'v');
  for (let i = 0; i < N; i++) for (let j = 0; j < N - 1; j++) if (!hWall[i][j]) emitWall(i, j, 'h');

  const troughCells = [];
  while (troughCells.length < 5) {
    const i = irange(rng, 1, N - 2), j = irange(rng, 1, N - 2);
    if (i === 3 && j === 3) continue;
    const key = i + ',' + j;
    if (troughCells.includes(key)) continue;
    troughCells.push(key);
    const cx0 = cellX(i), cz0 = cellZ(j);
    if (rng() < 0.5) addPool(ctx, cx0 + 1, cz0 + 1.4, cx0 + CW - 1, cz0 + 2.6, 'trough', WATER.trough.depth, { noCoping: true, noScum: true });
    else addPool(ctx, cx0 + 1.4, cz0 + 1, cx0 + 2.6, cz0 + CW - 1, 'trough', WATER.trough.depth, { noCoping: true, noScum: true });
  }

  buildDeck(ctx);
  defaultRoof(ctx, [], { beams: false });
  const sc = cellX(3) + CW / 2;
  ctx.chunk.spawn = [sc + ctx.ox, DECK_Y, sc + ctx.oz];
}

// lapPools — 3 parallel deep lanes along x separated by walkways + low dividing
// curbs, lane-divider strips on the basin floors, ladders + steps.
function buildLapPools(ctx, doorways) {
  const lanes = [{ z0: 10.75, z1: 13.25 }, { z0: 14.75, z1: 17.25 }, { z0: 18.75, z1: 21.25 }];
  for (const L of lanes) addPool(ctx, 4, L.z0, 28, L.z1, 'deep', WATER.deep.depth, { ladder: true, drain: true });
  // Lane-divider strips on each basin floor (contrast against poolTileDeep).
  for (const L of lanes) {
    const zc = (L.z0 + L.z1) / 2;
    ctx.addBox(4.5, -2.52, zc - 0.15, 27.5, -2.50, zc + 0.15, MAT.pool, false, ['-y']);
  }
  // Low dividing curbs between the lanes (on the walkways), 0.4 m tall so they
  // can still be stepped over.
  for (const zc of [14.25, 18.25]) {
    ctx.addBox(4, 0, zc - 0.1, 28, 0.4, zc + 0.1, MAT.concrete, true, ['-y', '+y']);
  }
  for (const L of lanes) {
    ctx.addProp('bench', 3.4, DECK_Y, (L.z0 + L.z1) / 2, Math.PI / 2, null);
    ctx.addProp('bench', 28.6, DECK_Y, (L.z0 + L.z1) / 2, -Math.PI / 2, null);
  }
  buildDeck(ctx);
  defaultRoof(ctx, [[16, 16]]);
  ctx.chunk.spawn = [16 + ctx.ox, DECK_Y, 14 + ctx.oz];
}

// stairTerraces — two raised terraces (+1.2/+2.4) with stairs + parapets, and a
// spillover deep pool on the deck.
function buildStairTerraces(ctx, doorways) {
  ctx.addBox(7, 0, 7, 25, 1.2, 17, MAT.deck, true, ['-y']);   // A
  ctx.addBox(7, 0, 20, 25, 2.4, 27, MAT.deck, true, ['-y']);  // B
  addStairs(ctx, 9, 13, 7, 0, 1.2, MAT.deck, 1);
  addStairs(ctx, 9, 13, 20, 1.2, 2.4, MAT.deck, 1);
  addPool(ctx, 8, 2.7, 24, 5.7, 'deep', WATER.deep.depth, { drain: true });
  // Parapets on the terrace edges (north edge of A, north + south of B).
  parapet(ctx, 7, 7, 25, 17, 1.2, 'x', 1);
  parapet(ctx, 7, 20, 25, 27, 2.4, 'x', -1);
  parapet(ctx, 7, 20, 25, 27, 2.4, 'x', 1);
  for (let x = 9; x <= 24; x += 1.5) ctx.addProp('railing', x, 1.2, 17, 0, null);
  buildDeck(ctx);
  defaultRoof(ctx, [[16, 12]]);
  ctx.chunk.spawn = [16 + ctx.ox, DECK_Y, 3.5 + ctx.oz];
}

// atrium — double-height centre (CEIL 9.0), big sun-biased skylight, deep pool,
// mezzanine (+2.8) with stairs + parapet, planter blocks, 4 m band at 5.0.
function buildAtrium(ctx, doorways) {
  const inner = { x0: 4, z0: 4, x1: 28, z1: 28 };

  // Skylights: a sun-biased hero slot over the pool + a second inner slot (9.0),
  // plus four band slots in the ring (5.0). ~20% of the ceiling is open.
  {
    const o = sunOffset(ATRIUM_CEIL);
    const hx = 6, hz = 2.5;
    const cx = clamp(17 + o.x, inner.x0 + hx, inner.x1 - hx);
    const cz = clamp(18 + o.z, inner.z0 + hz, inner.z1 - hz);
    ctx.skylights.push({ x0: cx - hx, z0: cz - hz, x1: cx + hx, z1: cz + hz, ceilH: ATRIUM_CEIL });
    ctx.skylights.push({ x0: 6, z0: 6, x1: 14, z1: 9, ceilH: ATRIUM_CEIL });        // second inner slot
    ctx.skylights.push({ x0: 6, z0: 1.5, x1: 26, z1: 3.1, ceilH: CEIL_Y });         // north band
    ctx.skylights.push({ x0: 6, z0: 28.9, x1: 26, z1: 30.5, ceilH: CEIL_Y });       // south band
    ctx.skylights.push({ x0: 1.5, z0: 6, x1: 3.1, z1: 26, ceilH: CEIL_Y });         // west band
    ctx.skylights.push({ x0: 28.9, z0: 6, x1: 30.5, z1: 26, ceilH: CEIL_Y });       // east band
  }

  buildCeiling(ctx, [inner, ...ctx.skylights], CEIL_Y);                  // band (ring) at 5.0
  buildCeiling(ctx, ctx.skylights, ATRIUM_CEIL, MAT.plaster, inner);     // inner at 9.0
  addCeilingBeams(ctx, ATRIUM_CEIL, inner);

  // Transition walls between band and tall centre.
  ctx.addBox(inner.x0, CEIL_Y, inner.z0, inner.x0 + WALL_T, ATRIUM_CEIL, inner.z1, MAT.plaster, true, ['-x', '-y', '+y']);
  ctx.addBox(inner.x1 - WALL_T, CEIL_Y, inner.z0, inner.x1, ATRIUM_CEIL, inner.z1, MAT.plaster, true, ['+x', '-y', '+y']);
  ctx.addBox(inner.x0, CEIL_Y, inner.z0, inner.x1, ATRIUM_CEIL, inner.z0 + WALL_T, MAT.plaster, true, ['-z', '-y', '+y']);
  ctx.addBox(inner.x0, CEIL_Y, inner.z1 - WALL_T, inner.x1, ATRIUM_CEIL, inner.z1, MAT.plaster, true, ['+z', '-y', '+y']);

  // Deep pool + mezzanine walkway (+2.8) + parapet along the pool edge.
  addPool(ctx, 10, 10, 24, 26, 'deep', 3.0, { ladder: true, drain: true });
  ctx.addBox(5, 0, 10, 9, 2.8, 26, MAT.deck, true, ['-y']);
  addStairs(ctx, 5, 9, 10, 0, 2.8, MAT.deck, 1);
  parapet(ctx, 5, 10, 9, 26, 2.8, 'z', 1);
  for (let z = 11; z <= 25; z += 1.5) ctx.addProp('railing', 9, 2.8, z, Math.PI / 2, null);
  // Planter-like blocks along the band.
  for (const [px, pz] of [[6, 6], [26, 6], [6, 26], [26, 26]]) {
    ctx.addBox(px - 0.45, 0, pz - 0.45, px + 0.45, 0.45, pz + 0.45, MAT.concrete, true, ['-y', '+y']);
  }

  buildDeck(ctx);
  ctx.addLight(16, ATRIUM_CEIL - 1.5, 16, [0.85, 0.93, 1.0], 2.2, 24);
  ctx.chunk.spawn = [16 + ctx.ox, DECK_Y, 6 + ctx.oz];
}

// changingRooms — tiled stalls (with door gaps) + benches, a shallow wading pool
// east, and open deck connecting the doorways.
function buildChangingRooms(ctx, doorways) {
  const rng = ctx.rng;
  const cols = [3, 5.5, 8, 10.5, 13];
  const rows = [2, 6.6, 11.2, 15.8, 20.4, 25, 30];
  for (let ci = 0; ci < cols.length; ci++) {
    const x = cols[ci];
    for (let ri = 0; ri < rows.length - 1; ri++) {
      const z0 = rows[ri], z1 = rows[ri + 1];
      const gap = z0 + 0.8 + rng() * Math.max(0.1, (z1 - z0) - 1.7);
      if (gap - z0 > 0.05) ctx.addBox(x, 0, z0, x + 0.2, 2.4, gap, MAT.wall, true, ['-y', '+y']);
      if (z1 - (gap + 0.9) > 0.05) ctx.addBox(x, 0, gap + 0.9, x + 0.2, 2.4, z1, MAT.wall, true, ['-y', '+y']);
    }
  }
  for (let ri = 0; ri < rows.length; ri++) {
    const z = rows[ri];
    for (let ci = 0; ci < cols.length - 1; ci++) {
      const x0 = cols[ci], x1 = cols[ci + 1];
      const gap = x0 + 0.5 + rng() * Math.max(0.1, (x1 - x0) - 1.4);
      if (gap - x0 > 0.05) ctx.addBox(x0, 0, z, gap, 2.4, z + 0.2, MAT.wall, true, ['-y', '+y']);
      if (x1 - (gap + 0.9) > 0.05) ctx.addBox(gap + 0.9, 0, z, x1, 2.4, z + 0.2, MAT.wall, true, ['-y', '+y']);
    }
  }
  for (let ci = 0; ci < cols.length - 1; ci++) {
    for (let ri = 0; ri < rows.length - 1; ri++) {
      const x0 = cols[ci] + 0.4, x1 = cols[ci + 1] - 0.4;
      const z0 = rows[ri] + 0.6, z1 = rows[ri + 1] - 0.6;
      if (x1 - x0 > 0.8 && z1 - z0 > 0.8) ctx.addProp('bench', (x0 + x1) / 2, DECK_Y, z0 + 0.5, 0, null);
    }
  }
  addPool(ctx, 16, 6, 28, 26, 'shallow', WATER.shallow.depth, { drain: true });
  buildDeck(ctx);
  defaultRoof(ctx, [[22, 16]]);
  ctx.chunk.spawn = [16 + ctx.ox, DECK_Y, 28 + ctx.oz];
}

// divingWell — a very deep small pool with ladder + steps, and a diving platform
// (with railings + parapet) reached by stairs.
function buildDivingWell(ctx, doorways) {
  addPool(ctx, 13, 13, 19, 19, 'deep', 5.0, { ladder: true, drain: true, stepCount: 8 });
  ctx.addBox(20, 0, 13, 24, 1.0, 19, MAT.deck, true, ['-y']);
  addStairs(ctx, 20, 24, 13, 0, 1.0, MAT.deck, -1);
  parapet(ctx, 20, 13, 24, 19, 1.0, 'z', -1);
  for (let x = 20.5; x <= 23.5; x += 1.0) ctx.addProp('railing', x, 1.0, 13, 0, null);
  ctx.addProp('railing', 20, 1.0, 16, Math.PI / 2, null);
  buildDeck(ctx);
  defaultRoof(ctx, [[16, 16]]);
  ctx.chunk.spawn = [16 + ctx.ox, DECK_Y, 7 + ctx.oz];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export function generateChunk(cx, cz, seed = 1337) {
  const chunk = { cx, cz, archetype: '', boxes: [], waters: [], lights: [], props: [], spawn: null };
  const ctx = makeCtx(cx, cz, seed, chunk);
  ctx.rng = makeRng(hashKey(cx, cz, seed, 'layout'));

  const doorways = buildDoorways(cx, cz, seed);
  buildPerimeter(ctx, doorways);
  addWallDetail(ctx, doorways);
  addDoorwayFrames(ctx, doorways);

  const archetype = pickArchetype(ctx.rng);
  chunk.archetype = archetype;
  switch (archetype) {
    case 'grandPool': buildGrandPool(ctx, doorways); break;
    case 'shallowHall': buildShallowHall(ctx, doorways); break;
    case 'corridorMaze': buildCorridorMaze(ctx, doorways); break;
    case 'lapPools': buildLapPools(ctx, doorways); break;
    case 'stairTerraces': buildStairTerraces(ctx, doorways); break;
    case 'atrium': buildAtrium(ctx, doorways); break;
    case 'changingRooms': buildChangingRooms(ctx, doorways); break;
    case 'divingWell': buildDivingWell(ctx, doorways); break;
    default: buildGrandPool(ctx, doorways); break;
  }

  addFloorDetail(ctx, doorways);
  addSkylightCurbs(ctx);
  addLights(ctx, archetype);
  return chunk;
}
