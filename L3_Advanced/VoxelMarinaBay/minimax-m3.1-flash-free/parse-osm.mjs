// Parse raw OSM XML tiles into a compact, render-ready JSON payload.
// Usage: node parse-osm.mjs
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OSM_DIR = path.join(HERE, 'osm');

// ---- tiny streaming-ish OSM XML reader -------------------------------------
const TAG_RE = /<(node|way|relation)\b([^>]*?)(\/?)>|<\/(\w+)>|<tag\b([^>]*?)\/?>|<nd\b([^>]*?)\/?>|<member\b([^>]*?)\/?>/g;

function parseTile(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const nodes = new Map();
  const ways = [];
  const relations = [];
  let cur = null, curKind = null, inTags = false;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(xml))) {
    if (m[1]) { // opening node/way/relation
      const kind = m[1];
      const attrs = m[2] || '';
      const id = /id="(-?\d+)"/.exec(attrs);
      const selfClose = m[3] === '/';
      if (kind === 'node') {
        const lat = +/lat="([-\d.]+)"/.exec(attrs)[1];
        const lon = +/lon="([-\d.]+)"/.exec(attrs)[1];
        nodes.set(id[1], { lat, lon });
        if (!selfClose) { cur = { id: id[1], tags: {}, refs: [], members: [] }; curKind = 'node'; }
      } else {
        cur = { id: id[1], tags: {}, refs: [], members: [] };
        curKind = kind;
        if (selfClose) { (kind === 'way' ? ways : relations).push(cur); cur = null; }
      }
    } else if (m[4]) { // closing tag
      if (cur && curKind) { (curKind === 'way' ? ways : relations).push(cur); }
      cur = null; curKind = null;
    } else if (m[5]) { // <tag k v/>
      const k = /k="([^"]*)"/.exec(m[5]);
      const v = /v="([^"]*)"/.exec(m[5]);
      if (k && v && cur) cur.tags[k[1]] = v[1];
    } else if (m[6]) { // <nd ref>
      const r = /ref="(-?\d+)"/.exec(m[6]);
      if (r && cur) cur.refs.push(r[1]);
    } else if (m[7]) { // <member>
      const r = /ref="(-?\d+)"/.exec(m[7]);
      const t = /type="(\w+)"/.exec(m[7]);
      if (r && t && cur) cur.members.push({ type: t[1], ref: r[1] });
    }
  }
  return { nodes, ways, relations };
}

// ---- load all tiles --------------------------------------------------------
const tiles = fs.readdirSync(OSM_DIR).filter(f => f.endsWith('.osm')).sort();
const allNodes = new Map();
let ways = [], relations = [];
for (const t of tiles) {
  const p = parseTile(path.join(OSM_DIR, t));
  for (const [k, v] of p.nodes) allNodes.set(k, v);
  ways.push(...p.ways); relations.push(...p.relations);
}
console.log(`nodes=${allNodes.size} ways=${ways.length} relations=${relations.length}`);

// ---- coordinate helpers ----------------------------------------------------
const LON0 = 103.8541592, LAT0 = 1.2856852;      // Merlion Park
const M_LAT = 110574, M_LON = 111320 * Math.cos(LAT0 * Math.PI / 180);
const toX = lon => (lon - LON0) * M_LON;
const toY = lat => (lat - LAT0) * M_LAT;
const r1 = v => Math.round(v * 10) / 10;

// ---- tag histograms (for decisions) ---------------------------------------
const hist = {};
for (const w of ways) {
  for (const k of Object.keys(w.tags)) hist[k] = (hist[k] || 0) + 1;
}
const interesting = ['building', 'building:levels', 'height', 'highway', 'natural', 'water', 'amenity',
  'leisure', 'landuse', 'bridge', 'tunnel', 'layer', 'man_made', 'tourism', 'railway', 'waterway',
  'building:material', 'building:use', 'roof:shape', 'building:part', 'public_transport'];
const summary = {};
for (const k of interesting) summary[k] = hist[k] || 0;
console.log('tag histogram (selected):', summary);

const buildingTypes = {};
for (const w of ways) if (w.tags.building) buildingTypes[w.tags.building] = (buildingTypes[w.tags.building] || 0) + 1;
console.log('building types:', buildingTypes);

const hwyTypes = {};
for (const w of ways) if (w.tags.highway) hwyTypes[w.tags.highway] = (hwyTypes[w.tags.highway] || 0) + 1;
console.log('highway types:', hwyTypes);

const natTypes = {};
for (const w of ways) if (w.tags.natural) natTypes[w.tags.natural] = (natTypes[w.tags.natural] || 0) + 1;
console.log('natural types:', natTypes);

const relTypes = {};
for (const r of relations) { const t = r.tags.type || '?'; relTypes[t] = (relTypes[t] || 0) + 1; }
console.log('relation types:', relTypes);

// ---- landmark probe --------------------------------------------------------
const want = ['marina bay sands', 'artscience', 'merlion', 'esplanade', 'helix', 'uob', 'raffles place',
  'guoco', 'promontory', 'sail', 'suntec', 'gateway', 'collyer', 'fountain of wealth', 'fullerton', 'republic plaza'];
for (const w of ways) {
  const n = (w.tags.name || '').toLowerCase();
  if (!n) continue;
  if (want.some(k => n.includes(k))) {
    const pts = w.refs.map(r => allNodes.get(r)).filter(Boolean);
    if (!pts.length) continue;
    const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon);
    console.log(`  [${w.tags.building || w.tags.natural || w.tags.man_made || w.tags.amenity || w.tags.leisure || w.tags.tourism || '?'}] ${w.tags.name}  lat ${Math.min(...lats).toFixed(5)}..${Math.max(...lats).toFixed(5)}  lon ${Math.min(...lons).toFixed(5)}..${Math.max(...lons).toFixed(5)}  h=${w.tags.height || ''} lv=${w.tags['building:levels'] || ''}`);
  }
}
