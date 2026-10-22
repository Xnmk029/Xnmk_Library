// Extracts a render-ready city dataset from the raw OSM tiles.
// Outputs: city-data.json  +  preview.png (top-down sanity render)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OSM_DIR = path.join(HERE, 'osm');
const OUT = path.join(HERE, 'city-data.json');

// ---------- OSM XML reader ----------
const TAG_RE = /<(node|way|relation)\b([^>]*?)(\/?)>|<\/(\w+)>|<tag\b([^>]*?)\/?>|<nd\b([^>]*?)\/?>|<member\b([^>]*?)\/?>/g;
function parseTile(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const nodes = new Map(), ways = [], relations = [];
  let cur = null, curKind = null, m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(xml))) {
    if (m[1]) {
      const kind = m[1], attrs = m[2] || '';
      const id = /id="(-?\d+)"/.exec(attrs), sc = m[3] === '/';
      if (kind === 'node') {
        nodes.set(id[1], { lat: +/lat="([-\d.]+)"/.exec(attrs)[1], lon: +/lon="([-\d.]+)"/.exec(attrs)[1] });
        if (!sc) { cur = { id: id[1], tags: {}, refs: [], members: [] }; curKind = 'node'; }
      } else { cur = { id: id[1], tags: {}, refs: [], members: [] }; curKind = kind; if (sc) { (kind === 'way' ? ways : relations).push(cur); cur = null; } }
    } else if (m[4]) { if (cur && curKind) (curKind === 'way' ? ways : relations).push(cur); cur = null; curKind = null; }
    else if (m[5]) { const k = /k="([^"]*)"/.exec(m[5]), v = /v="([^"]*)"/.exec(m[5]); if (k && v && cur) cur.tags[k[1]] = v[1]; }
    else if (m[6]) { const r = /ref="(-?\d+)"/.exec(m[6]); if (r && cur) cur.refs.push(r[1]); }
    else if (m[7]) { const r = /ref="(-?\d+)"/.exec(m[7]), t = /type="(\w+)"/.exec(m[7]); if (r && t && cur) cur.members.push({ type: t[1], ref: r[1] }); }
  }
  return { nodes, ways, relations };
}
const tiles = fs.readdirSync(OSM_DIR).filter(f => f.endsWith('.osm')).sort();
const N = new Map(); let WAYS = [], RELS = [];
for (const t of tiles) { const p = parseTile(path.join(OSM_DIR, t)); for (const [k, v] of p.nodes) N.set(k, v); WAYS.push(...p.ways); RELS.push(...p.relations); }

// ---------- projection (origin = Merlion statue) ----------
const LON0 = 103.85428, LAT0 = 1.28582;
const M_LAT = 110574, M_LON = 111320 * Math.cos(LAT0 * Math.PI / 180);
const PX = lon => (lon - LON0) * M_LON;
const PY = lat => (lat - LAT0) * M_LAT;
const R = v => Math.round(v * 100) / 100;

// ---------- gather ----------
const wayById = new Map(WAYS.map(w => [w.id, w]));
const relById = new Map(RELS.map(r => [r.id, r]));
const usedInBuildingRel = new Set();

function ringOfWay(w) {
  const pts = w.refs.map(r => N.get(r)).filter(Boolean);
  if (pts.length < 3) return null;
  return pts.map(p => [PX(p.lon), PY(p.lat)]);
}
function ringOfRel(r) {
  const out = [];
  for (const mem of r.members) {
    if (mem.type !== 'way') continue;
    const w = wayById.get(mem.ref); if (!w) continue;
    const ring = ringOfWay(w); if (!ring) continue;
    out.push(ring);
  }
  return out.length ? out : null;
}
function isClosed(r) { const a = r[0], b = r[r.length - 1]; return Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5; }

// stitch a bag of way fragments into closed rings
const rk = p => Math.round(p[0] * 2) / 2 + ',' + Math.round(p[1] * 2) / 2;
function stitchRings(frags) {
  const pool = frags.filter(f => f && f.length > 1).map(f => f.map(p => [p[0], p[1]]));
  const used = new Array(pool.length).fill(false);
  const out = [];
  for (let i = 0; i < pool.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let ring = pool[i].slice();
    let guard = 0;
    while (rk(ring[0]) !== rk(ring[ring.length - 1]) && guard++ < 2000) {
      const endK = rk(ring[ring.length - 1]);
      let j = -1, reversed = false;
      for (let k = 0; k < pool.length; k++) {
        if (used[k]) continue;
        if (rk(pool[k][0]) === endK) { j = k; break; }
      }
      if (j < 0) {
        for (let k = 0; k < pool.length; k++) {
          if (used[k]) continue;
          if (rk(pool[k][pool[k].length - 1]) === endK) { j = k; reversed = true; break; }
        }
      }
      if (j < 0) break;
      used[j] = true;
      const seg = reversed ? pool[j].slice().reverse() : pool[j];
      ring = ring.concat(seg.slice(1));
    }
    if (rk(ring[0]) !== rk(ring[ring.length - 1])) ring.push([ring[0][0], ring[0][1]]);
    if (ring.length > 2) out.push(ring);
  }
  return out;
}

// ---------- water ----------
const waterPolys = [];
const seenRel = new Set();
for (const r of RELS) {
  const t = r.tags.type;
  const isWater = t === 'multipolygon' && (r.tags.natural === 'water' || r.tags.waterway === 'riverbank' || r.tags.water === 'river' || r.tags.water === 'reservoir' || r.tags.water === 'lake' || r.tags.water === 'pond');
  if (!isWater || seenRel.has(r.id)) continue;
  seenRel.add(r.id);
  const frags = [];
  for (const mem of r.members) {
    if (mem.type !== 'way') continue;
    const w = wayById.get(mem.ref); if (!w) continue;
    const ring = ringOfWay(w); if (!ring) continue;
    frags.push(ring);
  }
  const rings = stitchRings(frags);
  if (rings.length) waterPolys.push(rings);
}
// ponds / small water ways
for (const w of WAYS) {
  if (w.tags.natural !== 'water' && w.tags.waterway !== 'riverbank') continue;
  const ring = ringOfWay(w); if (!ring || ring.length < 3) continue;
  waterPolys.push([ring]);
}

// ---------- buildings ----------
// Curated real-world heights (OSM height tags are incomplete/wrong for many SG towers)
const H_OVERRIDE = [
  [/^Guoco Tower$/i, 290], [/^One Raffles Place Tower 1$/i, 280], [/^One Raffles Place Tower 2$/i, 175],
  [/^UOB Plaza Tower 1$/i, 280], [/^UOB Plaza Tower 2$/i, 174], [/^Republic Plaza$/i, 280],
  [/^OUE Bayfront$/i, 280], [/^Ocean Financial Centre$/i, 243], [/^One George Street$/i, 205],
  [/^CapitaGreen$/i, 197], [/^CapitaSpring$/i, 201], [/^One Raffles Quay North Tower$/i, 280],
  [/^One Raffles Quay South Tower$/i, 270], [/^Marina Bay Financial Centre Tower 1$/i, 245],
  [/^Marina Bay Financial Centre Tower 2$/i, 210], [/^Marina Bay Financial Centre Tower 3$/i, 245],
  [/^The Sail/i, 245], [/^ArtScience Museum$/i, 55], [/^Esplanade Theatre$/i, 42],
  [/^Esplanade Concert Hall$/i, 42], [/^Pickering Operation Complex$/i, 26],
  [/MICE Building/i, 26], [/Marina Bay Sands Theatres/i, 28], [/Esplanade Theatres on the Bay/i, 22],
  [/^Asia Square Tower 1$/i, 231], [/^Asia Square Tower 2$/i, 213], [/^Millenia Tower$/i, 280],
  [/^The Concourse$/i, 160], [/^Maybank Tower$/i, 175], [/^Hitachi Tower$/i, 145],
  [/^Marina Bay Sands Tower/i, 200], [/^SkyPark$/i, 200], [/^Menara OCBC$/i, 280],
  [/^5 Raffles Quay$/i, 92], [/^4 Raffles Quay$/i, 104], [/^3 Raffles Quay$/i, 81],
  [/^The Gateway/i, 131], [/^Suntec Tower 1$/i, 187], [/^Suntec Tower 2$/i, 158],
  [/^Suntec Tower 3$/i, 197], [/^Suntec Tower 4$/i, 135], [/^Suntec Tower 5$/i, 124],
  [/^OUE Downtown 2$/i, 280], [/^SGX Centre/i, 280], [/^NTUC Centre$/i, 163],
  [/^Ocean Financial/i, 243], [/^Six Battery Road$/i, 280], [/^Bank of China Building$/i, 280],
  [/^International Plaza$/i, 160], [/^Lippo Centre$/i, 186], [/^Singapore Land Tower$/i, 190],
  [/^Chevron House$/i, 152], [/^Six Raffles Quay$/i, 118], [/^Six Battery Road$/i, 280],
  [/^Swissôtel The Stamford$/i, 226], [/^Concourse Skyline$/i, 160],
];
const buildings = [];
function overrideHeight(name, area, fallback) {
  if (!name) return fallback;
  for (const [re, h] of H_OVERRIDE) {
    if (re.test(name)) {
      if (/Guoco Tower/i.test(name) && area < 2500) return fallback;   // low podium part
      return h;
    }
  }
  return fallback;
}
function pushBuilding(ring, tags, forcedH) {
  if (!ring || ring.length < 3) return;
  if (!isClosed(ring)) ring.push(ring[0].slice());
  const area = Math.abs(polyArea(ring));
  if (area < 28) return;                       // ignore sheds/canopies
  let h = forcedH;
  if (h == null) {
    const ht = parseFloat(tags.height || '');
    const lv = parseFloat(tags['building:levels'] || '');
    if (ht > 0) h = ht;
    else if (lv > 0) h = lv * 3.05 + 2.2;
    else h = guessHeight(ring, area, tags);
    h = overrideHeight(tags.name, area, h);
  }
  buildings.push({ r: ring.map(p => [R(p[0]), R(p[1])]), h: Math.round(h * 10) / 10, m: tags['building:material'] || '', t: tags.building || '', n: tags.name || '', k: tags['building:part'] || '' });
}
function guessHeight(ring, area, tags) {
  const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  const d = Math.hypot(cx, cy);
  // CBD core (Raffles Place / Collyer Quay / George St) is dense & tall
  const inCore = (cx > -520 && cx < -180 && cy > -480 && cy < 60);
  const inMarina = (cx > 350 && cy < 120 && cy > -520);
  if (inCore) return Math.min(120, 14 + Math.sqrt(area) * 1.5);
  if (inMarina) return Math.min(90, 12 + Math.sqrt(area) * 1.1);
  if (d < 900) return Math.min(60, 8 + Math.sqrt(area) * 0.9);
  return Math.min(40, 6 + Math.sqrt(area) * 0.55);
}
function polyArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]);
  return a / 2;
}
// building relations first (they carry the authoritative outline + height)
for (const r of RELS) {
  if (r.tags.type !== 'building') continue;
  const frags = [];
  for (const mem of r.members) {
    if (mem.type !== 'way') continue;
    const w = wayById.get(mem.ref); if (!w) continue;
    const ring = ringOfWay(w); if (!ring) continue;
    frags.push(ring); usedInBuildingRel.add(mem.ref);
  }
  const rings = stitchRings(frags);
  if (!rings.length) continue;
  const outer = rings.slice().sort((a, b) => Math.abs(polyArea(b)) - Math.abs(polyArea(a)))[0];
  const h = parseFloat(r.tags.height || '') || null;
  pushBuilding(outer, r.tags, h);
}
for (const w of WAYS) {
  if (!w.tags.building || w.tags.building === 'no' || w.tags['building:part']) continue;
  if (usedInBuildingRel.has(w.id)) continue;
  const ring = ringOfWay(w); if (!ring) continue;
  pushBuilding(ring, w.tags, null);
}

// ---------- roads ----------
// world clip rect — everything outside is open sea / haze
const CLIP = { x0: -2400, x1: 1500, y0: -1320, y1: 1850 };
const ROAD_W = { motorway: 22, motorway_link: 12, trunk: 26, trunk_link: 14, primary: 22, primary_link: 13, secondary: 18, secondary_link: 11, tertiary: 14, tertiary_link: 10, residential: 11, unclassified: 10, living_street: 8, service: 7, pedestrian: 9, footway: 4, path: 3, steps: 3, cycleway: 3, corridor: 5, road: 10, raceway: 12 };
// Deck height for elevated / bridge roads around Marina Bay.
const DECK = [
  [/helix/i, 13], [/ocbc skyway/i, 24], [/bayfront avenue/i, 16], [/east coast parkway/i, 16],
  [/sheares/i, 15], [/jubilee/i, 9], [/cavenagh/i, 12], [/elgin/i, 10], [/coleman/i, 12],
  [/north bridge/i, 9], [/new bridge/i, 10], [/eu tong sen/i, 8], [/garden bay/i, 8], [/dragonfly/i, 7],
  [/marina promenade/i, 7], [/gardens by the bay/i, 8], [/nieuweg/i, 6], [/orive/i, 6],
  [/gue link/i, 12], [/suntec city/i, 6], [/temasek/i, 8],
];
function deckHeight(tags) {
  const n = tags.name || '';
  for (const [re, h] of DECK) if (re.test(n)) return h;
  const lay = parseInt(tags.layer || '0', 10);
  if (lay > 0) return 5.5 * lay;
  return 0;
}
// polyline simplification (perpendicular distance)
function decimate(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false); keep[0] = true; keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let mi = -1, md = 0;
    const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      let d;
      if (L2 === 0) d = Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
      else {
        let t = ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / L2;
        t = Math.max(0, Math.min(1, t));
        d = Math.hypot(pts[i][0] - (ax + t * dx), pts[i][1] - (ay + t * dy));
      }
      if (d > md) { md = d; mi = i; }
    }
    if (mi > 0 && md > tol) { keep[mi] = true; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const roads = [];
for (const w of WAYS) {
  const hw = w.tags.highway; if (!hw) continue;
  if (w.tags.tunnel && w.tags.tunnel !== 'no') continue;         // skip underpasses (mostly MRT)
  if (w.tags.railway) continue;
  const pts = w.refs.map(r => N.get(r)).filter(Boolean);
  if (pts.length < 2) continue;
  let poly = pts.map(p => [R(PX(p.lon)), R(PY(p.lat))]);
  poly = decimate(poly, (hw === 'footway' || hw === 'path' || hw === 'steps' || hw === 'cycleway') ? 1.6 : 2.8);
  // clip to the world rect
  const clipped = [];
  for (const p of poly) if (p[0] >= CLIP.x0 && p[0] <= CLIP.x1 && p[1] >= CLIP.y0 && p[1] <= CLIP.y1) clipped.push(p);
  if (clipped.length < 2) continue;
  poly = clipped;
  const isBridge = w.tags.bridge && w.tags.bridge !== 'no';
  roads.push({ c: hw, w: ROAD_W[hw] || 8, b: isBridge ? 1 : 0, h: isBridge ? deckHeight(w.tags) : 0, p: poly.map(p => Math.round(p[0]) + ',' + Math.round(p[1])).join(' ') });
}

// ---------- green areas ----------
const greens = [];
for (const w of WAYS) {
  const t = w.tags;
  const isGreen = t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'grass' || t.natural === 'wood' || t.natural === 'scrub' ||
    t.landuse === 'grass' || t.landuse === 'village_green' || t.landuse === 'forest' || t.landuse === 'meadow' ||
    (t.leisure === 'common' && t.natural === 'water' === undefined) ;
  if (!isGreen) continue;
  const ring = ringOfWay(w); if (!ring || ring.length < 3) continue;
  greens.push({ r: ring.map(p => [R(p[0]), R(p[1])]), k: t.leisure || t.natural || t.landuse });
}

// ---------- plazas / pedestrian areas (promenades) ----------
const plazas = [];
for (const w of WAYS) {
  const t = w.tags;
  if (!(t.highway === 'pedestrian' || t.landuse === 'pedestrian' || t.area === 'yes')) continue;
  const ring = ringOfWay(w); if (!ring || ring.length < 3) continue;
  if (polyArea(ring) < 400) continue;
  plazas.push({ r: ring.map(p => [R(p[0]), R(p[1])]) });
}

// ---------- trees ----------
const trees = [];
for (const w of WAYS) {
  if (w.tags.natural !== 'tree_row' && w.tags.natural !== 'tree') continue;
  const pts = w.refs.map(r => N.get(r)).filter(Boolean);
  for (const p of pts) trees.push([R(PX(p.lon)), R(PY(p.lat))]);
}
for (const w of WAYS) {
  if (w.tags.natural !== 'tree') continue;
  const p = N.get(w.refs[0]); if (p) trees.push([R(PX(p.lon)), R(PY(p.lat))]);
}

// ---------- named landmarks (raw node positions; used as label fallback) ----------
const named = [];
for (const w of WAYS) {
  const n = w.tags.name; if (!n) continue;
  if (!w.tags.building && !w.tags.tourism && !w.tags.leisure && !w.tags.man_made && !w.tags.landuse && !w.tags.natural) continue;
  const pts = w.refs.map(r => N.get(r)).filter(Boolean);
  if (!pts || !pts.length) continue;
  const cx = pts.reduce((a, p) => a + PX(p.lon), 0) / pts.length;
  const cy = pts.reduce((a, p) => a + PY(p.lat), 0) / pts.length;
  named.push({ n, x: R(cx), y: R(cy), b: w.tags.building || '', h: w.tags.height || '', lv: w.tags['building:levels'] || '' });
}

// ---------- special landmarks ----------
// Helix Bridge centreline: collect every "Helix" way node, order along the principal axis
function principalPath(pts) {
  const uniq = []; const seen = new Set();
  for (const p of pts) { const k = Math.round(p[0]) + ',' + Math.round(p[1]); if (!seen.has(k)) { seen.add(k); uniq.push(p); } }
  if (uniq.length < 2) return [];
  const mx = uniq.reduce((a, p) => a + p[0], 0) / uniq.length, my = uniq.reduce((a, p) => a + p[1], 0) / uniq.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of uniq) { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(ang), uy = Math.sin(ang);
  uniq.sort((a, b) => (a[0] * ux + a[1] * uy) - (b[0] * ux + b[1] * uy));
  // resample to a smooth polyline
  const path = [uniq[0]]; let acc = 0;
  for (let i = 1; i < uniq.length; i++) {
    const d = Math.hypot(uniq[i][0] - path[path.length - 1][0], uniq[i][1] - path[path.length - 1][1]);
    if (d > 6) { path.push(uniq[i]); }
  }
  return path.map(p => [R(p[0]), R(p[1])]);
}
const helixPts = [];
for (const w of WAYS) {
  if (!/helix/i.test(w.tags.name || '')) continue;
  for (const r of w.refs) { const n = N.get(r); if (n) helixPts.push([PX(n.lon), PY(n.lat)]); }
}
const helixPath = principalPath(helixPts);
function namedPos(re) {
  for (const w of WAYS) {
    if (!re.test(w.tags.name || '')) continue;
    const pts = w.refs.map(r => N.get(r)).filter(Boolean);
    if (!pts.length) continue;
    return [R(pts.reduce((a, p) => a + PX(p.lon), 0) / pts.length), R(pts.reduce((a, p) => a + PY(p.lat), 0) / pts.length)];
  }
  return null;
}
const merlion = namedPos(/^Merlion Fountain$/i) || namedPos(/^Merlion Park$/i);
const fow = namedPos(/^Fountain of Wealth$/i);
const esplanade = namedPos(/^Esplanade Theatre$/i);
// Supertree Grove bbox from its relation members
let grove = null;
for (const r of RELS) {
  if (!/Supertree Grove/i.test(r.tags.name || '')) continue;
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (const mem of r.members) {
    const w = wayById.get(mem.ref); if (!w) continue;
    for (const p of w.refs) { const n = N.get(p); if (!n) continue; const x = PX(n.lon), y = PY(n.lat); if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
  }
  if (mxx > mnx) grove = [R(mnx), R(mny), R(mxx), R(mxy)];
  break;
}

// ---------- hero geometry (icons OSM models poorly) ----------
const HERO = [
  // One Raffles Place Tower 1 — the 280 m slab that closes the Raffles Place canyon
  { n: 'One Raffles Place Tower 1', x0: -424, y0: -226, x1: -335, y1: -143, h: 280, m: 'glass',
    drop: [/^One Raffles Place$/i, /^One Raffles Place Tower 2$/i] },
  { n: 'One Raffles Place Tower 2', x0: -424, y0: -138, x1: -371, y1: -96, h: 175, m: 'glass' },
];
for (const hero of HERO) {
  if (hero.drop) {
    for (let i = buildings.length - 1; i >= 0; i--) if (hero.drop.some(re => re.test(buildings[i].n))) buildings.splice(i, 1);
  }
  const ring = [[hero.x0, hero.y0], [hero.x1, hero.y0], [hero.x1, hero.y1], [hero.x0, hero.y1], [hero.x0, hero.y0]];
  buildings.push({ r: ring, h: hero.h, m: hero.m, t: 'office', n: hero.n, k: '' });
}
// ---------- curated landmark labels ----------
const LABELS = [
  ['Marina Bay Sands', /Marina Bay Sands Tower 1/i], ['ArtScience Museum', /^ArtScience Museum$/i],
  ['Merlion Park', /^Merlion Park$/i], ['The Esplanade', /^Esplanade Theatre$/i],
  ['UOB Plaza', /^UOB Plaza Tower 1$/i],
  ['One Raffles Place', /^One Raffles Place Tower 1$/i], ['Republic Plaza', /^Republic Plaza$/i],  ['Guoco Tower', /^Guoco Tower$/i], ['CapitaGreen', /^CapitaGreen$/i],
  ['CapitaSpring', /^CapitaSpring$/i], ['One Raffles Quay', /^One Raffles Quay North Tower$/i],
  ['The Sail @ Marina Bay', /^The Sail/i], ['The Promontory', /^The Promontory/i],
  ['Ocean Financial Centre', /^Ocean Financial Centre$/i], ['OUE Bayfront', /^OUE Bayfront$/i],
  ['One George Street', /^One George Street$/i], ['Millenia Tower', /^Millenia Tower$/i],
  ['Suntec Tower 3', /^Suntec Tower 3$/i], ['Fountain of Wealth', /^Fountain of Wealth$/i],
  ['Supertree Grove', /^Supertree Grove$/i], ['Gardens by the Bay', /^Gardens by the Bay$/i],
  ['Marina One', /^Marina One$/i], ['The Fullerton Hotel', /^The Fullerton Hotel$/i],
  ['Six Battery Road', /^Six Battery Road$/i], ['Maybank Tower', /^Maybank Tower$/i],
  ['Hong Leong Building', /^Hong Leong/i], ['Hitachi Tower', /^Hitachi Tower$/i],
  ['SGX Centre', /^SGX Centre/i], ['The Gateway', /^The Gateway/i],
  ['One Marina Boulevard', /^Marina Bay Financial Centre Tower 1$/i], ['Chevron House', /^Chevron House$/i],
];
const labels = [];
const labelSeen = new Set();
for (const [label, re] of LABELS) {
  let done = false;
  for (const b of buildings) {
    if (!re.test(b.n)) continue;
    let sx = 0, sy = 0;
    for (const p of b.r) { sx += p[0]; sy += p[1]; }
    labels.push({ n: label, x: R(sx / b.r.length), y: R(sy / b.r.length), h: b.h });
    done = true; break;
  }
  if (done) { labelSeen.add(label); continue; }
  for (const nm of named) {
    if (!re.test(nm.n)) continue;
    labels.push({ n: label, x: nm.x, y: nm.y, h: parseFloat(nm.h) || 30 });
    done = true; break;
  }
  if (!done) console.log('  [missing label]', label);
}
if (merlion) labels.push({ n: 'Merlion', x: merlion[0], y: merlion[1], h: 12 });
if (helixPath.length) {
  const mid = helixPath[Math.floor(helixPath.length / 2)];
  labels.push({ n: 'Helix Bridge', x: mid[0], y: mid[1], h: 14 });
}
if (grove) labels.push({ n: 'Gardens by the Bay', x: (grove[0] + grove[2]) / 2, y: (grove[1] + grove[3]) / 2, h: 50 });

// ---------- serialize ----------
// rings are arrays of [x,y] pairs
const roundRing = (ring, tol) => {
  const s = decimate(ring, tol);
  return s.map(p => [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2]);
};
const out = {
  origin: { lon: LON0, lat: LAT0 },
  water: waterPolys.map(poly => poly.map(ring => roundRing(ring, 1.6).flat())),
  b: buildings.map(b => ({ r: roundRing(b.r, 1.4).flat(), h: b.h, m: b.m, t: b.t, n: b.n })),
  r: roads.map(r => ({ c: r.c, w: r.w, b: r.b, h: r.h, p: r.p })),
  g: greens.map(g => ({ r: roundRing(g.r, 2.0).flat(), k: g.k })),
  pl: plazas.map(g => roundRing(g.r, 2.0).flat()),
  t: trees.map(p => [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2]),
  labels,
  special: { helix: helixPath, merlion, fow, esplanade, grove },
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`city-data.json  waterPolys=${waterPolys.length} buildings=${buildings.length} roads=${roads.length} greens=${greens.length} plazas=${plazas.length} trees=${trees.length} labels=${labels.length}  size=${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);

// ================= preview renderer =================
const BB = process.argv[2] ? (() => { const a = process.argv[2].split(',').map(Number); return { x0: a[0], y0: a[1], x1: a[2], y1: a[3] }; })() : { x0: -1150, y0: -1200, x1: 1500, y1: 800 };
const SCALE = process.argv[3] ? parseFloat(process.argv[3]) : 0.34;   // px per metre
const PW = Math.round((BB.x1 - BB.x0) * SCALE), PH = Math.round((BB.y1 - BB.y0) * SCALE);
const img = Buffer.alloc(PW * PH * 3);
const px = (x, y) => [Math.round((x - BB.x0) * SCALE), Math.round((BB.y1 - y) * SCALE)];
const setp = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= PW || y >= PH) return; const i = (y * PW + x) * 3; img[i] = r; img[i + 1] = g; img[i + 2] = b; };
for (let i = 0; i < PW * PH; i++) { img[i * 3] = 28; img[i * 3 + 1] = 34; img[i * 3 + 2] = 32; }
// greens
function fillPoly(rings, col) {
  let minY = 1e9, maxY = -1e9;
  const pts = rings.flat().map(p => px(p[0], p[1]));
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.max(0, minY); y <= Math.min(PH - 1, maxY); y++) {
    const xs = [];
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = px(ring[i][0], ring[i][1]), b = px(ring[j][0], ring[j][1]);
        if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(PW - 1, Math.floor(xs[k + 1])); x++) setp(x, y, col[0], col[1], col[2]);
  }
}
for (const g of greens) fillPoly([g.r.map(p => [p[0], p[1]])], [46, 86, 48]);
for (const p of plazas) fillPoly([p.r.map(v => [v[0], v[1]])], [96, 94, 86]);
// water
for (const poly of waterPolys) fillPoly(poly.map(ring => ring.map(p => [p[0], p[1]])), [22, 56, 96]);
// buildings (height shaded)
for (const b of buildings) {
  const t = Math.min(1, b.h / 240);
  const col = [Math.round(90 + 150 * t), Math.round(86 + 140 * t), Math.round(80 + 130 * t)];
  fillPoly([b.r.map(p => [p[0], p[1]])], col);
}
// roads
for (const r of roads) {
  const col = r.b ? [150, 90, 60] : [70, 70, 74];
  const wdt = Math.max(1, Math.round(r.w * SCALE));
  for (let i = 0; i + 1 < r.p.length; i++) {
    const a = px(r.p[i][0], r.p[i][1]), b = px(r.p[i + 1][0], r.p[i + 1][1]);
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let s = 0; s <= n; s++) {
      const x = Math.round(a[0] + (b[0] - a[0]) * s / n), y = Math.round(a[1] + (b[1] - a[1]) * s / n);
      for (let oy = -wdt; oy <= wdt; oy++) for (let ox = -wdt; ox <= wdt; ox++) if (Math.abs(ox) + Math.abs(oy) <= wdt) setp(x + ox, y + oy, col[0], col[1], col[2]);
    }
  }
}
// landmark dots
for (const nm of named) {
  if (!/marina bay sands|artscience|merlion|esplanade|uob|raffles place|guoco|suntec|helix|promontory|fountain|sail|capital|collyer|fullerton/i.test(nm.n)) continue;
  const [x, y] = px(nm.x, nm.y);
  for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) if (ox * ox + oy * oy <= 9) setp(x + ox, y + oy, 255, 90, 90);
}
// grid every 200 m
for (let gx = Math.ceil(BB.x0 / 200) * 200; gx < BB.x1; gx += 200) { const [x] = px(gx, 0); for (let y = 0; y < PH; y += 1) if (y % 6 < 1) setp(x, y, 70, 70, 70); }
for (let gy = Math.ceil(BB.y0 / 200) * 200; gy < BB.y1; gy += 200) { const [, y] = px(0, gy); for (let x = 0; x < PW; x += 1) if (x % 6 < 1) setp(x, y, 70, 70, 70); }

// PNG encode
function crc32(buf) { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let crc = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
const raw = Buffer.alloc((PW * 3 + 1) * PH);
for (let y = 0; y < PH; y++) { raw[y * (PW * 3 + 1)] = 0; img.copy(raw, y * (PW * 3 + 1) + 1, y * PW * 3, (y + 1) * PW * 3); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(PW, 0); ihdr.writeUInt32BE(PH, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const OUTPNG = path.join(HERE, process.argv[4] || 'preview.png');
fs.writeFileSync(OUTPNG, png);
console.log(`${path.basename(OUTPNG)} ${PW}x${PH}`);