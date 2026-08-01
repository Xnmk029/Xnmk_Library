/**
 * citygen.js — Task 5.1: procedural city vector data (pure module, DOM-free).
 *
 * Grid-graph algorithm with jittered spacing:
 *   1. arterial lines across the 4096 m² site (jittered ~340 m pitch) + two
 *      diagonal boulevards through downtown
 *   2. district cells between arterials → collector subdivision (~110 m)
 *   3. 45 % of collector blocks get local-street splits
 *   4. blocks inset by road half-widths → lots along the frontage → building
 *      footprints with a downtown-gaussian height field
 *   5. props: streetlights along arterials/collectors, signal heads at
 *      arterial×arterial crossings; parks/plazas; named POIs per district
 *
 * All features carry bboxes for quadtree slicing (tiles.js).
 */

export const CITY_SIZE = 4096;            // world metres, centred on origin
export const HALF = CITY_SIZE / 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DISTRICT_A = ['Kanda', 'Umi', 'Hoshi', 'Aki', 'Momo', 'Kaze', 'Yuki', 'Hana', 'Tsuki', 'Sora', 'Nami', 'Hikari'];
const DISTRICT_B = ['-chō', ' Heights', ' Wharf', ' Terrace', '-dai', ' Gardens', ' Crossing', ' Hill', ' Bay', ' Park'];
const LANDMARKS = ['Tower', 'Broadcast Center', 'Grand Hotel', 'Works', 'Exchange', 'Arena', 'Depot', 'Museum'];

export function generateCity(seed = 1337) {
  const rnd = mulberry32(seed);
  const roads = [];      // {pts:[x,z,...], cls:0 art|1 col|2 loc, w}
  const buildings = [];  // {x, z, w, d, h, rot, c:[r,g,b], bbox}
  const parks = [];      // {x, z, w, d}
  const lights = [];     // [x, z, rotY]
  const signals = [];    // [x, z, rotY]
  const pois = [];       // {x, z, name, kind, rank}

  const W = { art: 26, col: 15, loc: 8.5 };

  // ---- arterial axes --------------------------------------------------------
  const makeAxes = () => {
    const xs = [-HALF];
    let x = -HALF;
    while (x < HALF - 240) {
      x += 300 + rnd() * 110;
      if (x < HALF - 140) xs.push(Math.round(x));
    }
    xs.push(HALF);
    return xs;
  };
  const ax = makeAxes();       // vertical arterials (const x)
  const az = makeAxes();       // horizontal arterials (const z)

  for (const x of ax) roads.push({ pts: [x, -HALF, x, HALF], cls: 0, w: W.art });
  for (const z of az) roads.push({ pts: [-HALF, z, HALF, z], cls: 0, w: W.art });

  // diagonal boulevards through the core
  roads.push({ pts: [-HALF * 0.8, -HALF * 0.8, HALF * 0.8, HALF * 0.8], cls: 0, w: W.art });
  roads.push({ pts: [-HALF * 0.55, HALF * 0.8, HALF * 0.8, -HALF * 0.55], cls: 0, w: W.art });

  // signals at arterial crossings
  for (const x of ax) {
    for (const z of az) {
      if (Math.abs(x) === HALF || Math.abs(z) === HALF) continue;
      for (const [ox, oz] of [[14, 14], [-14, 14], [14, -14], [-14, -14]]) {
        if (rnd() < 0.6) signals.push([x + ox, z + oz, Math.atan2(oz, ox)]);
      }
    }
  }

  // ---- districts ------------------------------------------------------------
  const heightAtDowntown = (x, z) => {
    const d = Math.hypot(x - 180, z + 240);
    return Math.exp(-((d / 780) ** 2));
  };

  let districtIdx = 0;
  for (let i = 0; i < ax.length - 1; i++) {
    for (let j = 0; j < az.length - 1; j++) {
      const x0 = ax[i] + W.art / 2 + 3, x1 = ax[i + 1] - W.art / 2 - 3;
      const z0 = az[j] + W.art / 2 + 3, z1 = az[j + 1] - W.art / 2 - 3;
      const dw = x1 - x0, dh = z1 - z0;
      if (dw < 60 || dh < 60) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const density = heightAtDowntown(cx, cz);

      // district POI (rank 1) on a sparse subset
      if (districtIdx % 3 === 0) {
        pois.push({
          x: cx, z: cz,
          name: DISTRICT_A[districtIdx % DISTRICT_A.length] + DISTRICT_B[(districtIdx * 7 + 3) % DISTRICT_B.length],
          kind: 'district', rank: 1,
        });
      }
      districtIdx++;

      // ---- collectors subdividing the district cell ------------------------
      const bxs = [x0];
      let bx = x0;
      const pitch = 105 + rnd() * 60;
      while (bx < x1 - pitch * 0.8) { bx += pitch; if (bx < x1 - 45) bxs.push(bx); }
      bxs.push(x1);
      const bzs = [z0];
      let bz = z0;
      while (bz < z1 - pitch * 0.8) { bz += pitch * (0.85 + rnd() * 0.4); if (bz < z1 - 45) bzs.push(bz); }
      bzs.push(z1);

      for (let k = 1; k < bxs.length - 1; k++) roads.push({ pts: [bxs[k], z0 - 2, bxs[k], z1 + 2], cls: 1, w: W.col });
      for (let k = 1; k < bzs.length - 1; k++) roads.push({ pts: [x0 - 2, bzs[k], x1 + 2, bzs[k]], cls: 1, w: W.col });

      // ---- blocks -----------------------------------------------------------
      for (let bi = 0; bi < bxs.length - 1; bi++) {
        for (let bj = 0; bj < bzs.length - 1; bj++) {
          let bx0 = bxs[bi] + (bi === 0 ? 0 : W.col / 2 + 2);
          let bx1 = bxs[bi + 1] - (bi === bxs.length - 2 ? 0 : W.col / 2 + 2);
          let bz0 = bzs[bj] + (bj === 0 ? 0 : W.col / 2 + 2);
          let bz1 = bzs[bj + 1] - (bj === bzs.length - 2 ? 0 : W.col / 2 + 2);
          const bw = bx1 - bx0, bd = bz1 - bz0;
          if (bw < 34 || bd < 34) continue;

          // park?
          if (rnd() < 0.07) {
            parks.push({ x: (bx0 + bx1) / 2, z: (bz0 + bz1) / 2, w: bw, d: bd });
            if (rnd() < 0.5) {
              pois.push({ x: (bx0 + bx1) / 2, z: (bz0 + bz1) / 2, name: DISTRICT_A[(districtIdx * 3 + bi) % DISTRICT_A.length] + ' Park', kind: 'park', rank: 3 });
            }
            continue;
          }

          // optional local split of big blocks
          if (bw > 95 && rnd() < 0.45) {
            const sx = bx0 + bw * (0.4 + rnd() * 0.2);
            roads.push({ pts: [sx, bz0 - 1, sx, bz1 + 1], cls: 2, w: W.loc });
          }

          // ---- lots / building extrusion footprints -------------------------
          const lotPitch = 20 + rnd() * 12;
          const nx = Math.max(1, Math.floor(bw / lotPitch));
          const nz = Math.max(1, Math.floor(bd / lotPitch));
          const step = Math.min(4, nx * nz);           // cap per-block building count
          for (let li = 0; li < Math.min(nx * nz, 6); li++) {
            const gx = li % nx, gz = (li / nx) | 0;
            const lw = bw / nx, ld = bd / nz;
            const inset = 1.5 + rnd() * 2.5;
            const w = Math.max(10, lw - inset * 2), d = Math.max(10, ld - inset * 2);
            const x = bx0 + gx * lw + lw / 2, z = bz0 + gz * ld + ld / 2;
            const base = 7 + rnd() * 10;
            const h = Math.max(6, base + 118 * density * (0.35 + rnd() * 0.85));
            const shade = 0.55 + rnd() * 0.3;
            const warm = rnd() * 0.12;
            buildings.push({
              x, z, w, d, h,
              rot: 0,
              c: [shade + warm, shade + warm * 0.5, shade],
              bbox: [x - w / 2, z - d / 2, x + w / 2, z + d / 2],
            });
            if (h > 100 && rnd() < 0.35) {
              pois.push({
                x, z,
                name: DISTRICT_A[(bi * 5 + bj * 3 + districtIdx) % DISTRICT_A.length] + ' ' + LANDMARKS[(districtIdx + li) % LANDMARKS.length],
                kind: 'landmark', rank: 2, h,
              });
            }
          }
        }
      }
    }
  }

  // ---- streetlights along arterials -----------------------------------------
  for (const x of ax) {
    for (let z = -HALF + 40; z < HALF - 40; z += 34 + rnd() * 8) {
      lights.push([x + W.art / 2 + 1.2, z, Math.PI]);
      lights.push([x - W.art / 2 - 1.2, z + 17, 0]);
    }
  }
  for (const z of az) {
    for (let x = -HALF + 40; x < HALF - 40; x += 34 + rnd() * 8) {
      lights.push([x, z + W.art / 2 + 1.2, Math.PI / 2]);
      lights.push([x + 17, z - W.art / 2 - 1.2, -Math.PI / 2]);
    }
  }

  // signature POIs
  pois.push({ x: 180, z: -240, name: 'NIHONBASHI-EAST CORE', kind: 'district', rank: 1 });
  pois.push({ x: 0, z: 0, name: 'Central Station', kind: 'station', rank: 2 });

  const city = { seed, roads, buildings, parks, lights, signals, pois, size: CITY_SIZE };
  city.stats = {
    roads: roads.length,
    arterials: roads.filter(r => r.cls === 0).length,
    collectors: roads.filter(r => r.cls === 1).length,
    locals: roads.filter(r => r.cls === 2).length,
    buildings: buildings.length,
    parks: parks.length,
    lights: lights.length,
    signals: signals.length,
    pois: pois.length,
  };
  return city;
}

/** Clip a 2-point segment to an AABB (Liang–Barsky). Returns [x0,z0,x1,z1] or null. */
export function clipSegment(x0, z0, x1, z1, minX, minZ, maxX, maxZ) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dz = z1 - z0;
  const p = [-dx, dx, -dz, dz];
  const q = [x0 - minX, maxX - x0, z0 - minZ, maxZ - z0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [x0 + t0 * dx, z0 + t0 * dz, x0 + t1 * dx, z0 + t1 * dz];
}

export default { generateCity, clipSegment, mulberry32, CITY_SIZE, HALF };
