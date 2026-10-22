// Probe: where do key landmarks actually sit, and what does the water look like?
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OSM_DIR = path.join(HERE, 'osm');
const TAG_RE = /<(node|way|relation)\b([^>]*?)(\/?)>|<\/(\w+)>|<tag\b([^>]*?)\/?>|<nd\b([^>]*?)\/?>|<member\b([^>]*?)\/?>/g;
function parseTile(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const nodes = new Map(); const ways = []; const relations = [];
  let cur = null, curKind = null, m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(xml))) {
    if (m[1]) {
      const kind = m[1]; const attrs = m[2] || '';
      const id = /id="(-?\d+)"/.exec(attrs); const sc = m[3] === '/';
      if (kind === 'node') {
        nodes.set(id[1], { lat: +/lat="([-\d.]+)"/.exec(attrs)[1], lon: +/lon="([-\d.]+)"/.exec(attrs)[1] });
        if (!sc) { cur = { id: id[1], tags: {}, refs: [], members: [] }; curKind = 'node'; }
      } else { cur = { id: id[1], tags: {}, refs: [], members: [] }; curKind = kind; if (sc) { (kind === 'way' ? ways : relations).push(cur); cur = null; } }
    } else if (m[4]) { if (cur && curKind) (curKind === 'way' ? ways : relations).push(cur); cur = null; curKind = null; }
    else if (m[5]) { const k = /k="([^"]*)"/.exec(m[5]); const v = /v="([^"]*)"/.exec(m[5]); if (k && v && cur) cur.tags[k[1]] = v[1]; }
    else if (m[6]) { const r = /ref="(-?\d+)"/.exec(m[6]); if (r && cur) cur.refs.push(r[1]); }
    else if (m[7]) { const r = /ref="(-?\d+)"/.exec(m[7]); const t = /type="(\w+)"/.exec(m[7]); if (r && t && cur) cur.members.push({ type: t[1], ref: r[1] }); }
  }
  return { nodes, ways, relations };
}
const tiles = fs.readdirSync(OSM_DIR).filter(f => f.endsWith('.osm')).sort();
const N = new Map(); let ways = [], rels = [];
for (const t of tiles) { const p = parseTile(path.join(OSM_DIR, t)); for (const [k, v] of p.nodes) N.set(k, v); ways.push(...p.ways); rels.push(...p.relations); }

const LON0 = 103.8541592, LAT0 = 1.2856852;
const M_LAT = 110574, M_LON = 111320 * Math.cos(LAT0 * Math.PI / 180);
const fx = lon => (lon - LON0) * M_LON, fy = lat => (lat - LAT0) * M_LAT;
const p6 = v => String(Math.round(v)).padStart(6);

console.log('=== named landmark ways (x,y = metres from Merlion) ===');
const want = ['marina bay sands', 'artscience', 'merlion', 'esplanade', 'helix', 'uob', 'raffles place',
  'guoco', 'promontory', 'sail', 'suntec', 'gateway', 'collyer', 'fountain of wealth', 'fullerton', 'republic plaza',
  'capita', 'george street', 'battery', 'raffles quay', 'ascent', 'sinclair', 'centric', 'centric'];
const seen = new Set();
for (const w of ways) {
  const n = (w.tags.name || '').toLowerCase();
  if (!n || !want.some(k => n.includes(k))) continue;
  const pts = w.refs.map(r => N.get(r)).filter(Boolean); if (!pts.length) continue;
  const cx = pts.reduce((a, p) => a + fx(p.lon), 0) / pts.length;
  const cy = pts.reduce((a, p) => a + fy(p.lat), 0) / pts.length;
  const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon);
  const key = w.tags.name + '|' + w.tags.building;
  if (seen.has(key)) continue; seen.add(key);
  console.log(`  ${w.tags.name.padEnd(34)} ${String(w.tags.building || w.tags.natural || w.tags.man_made || w.tags.tourism || w.tags.leisure || w.tags.amenity || '-').padEnd(12)} x=${p6(cx)} y=${p6(cy)}  h=${w.tags.height || '-'} lv=${w.tags['building:levels'] || '-'} pts=${pts.length}`);
}

console.log('\n=== natural=water ways ===');
for (const w of ways) {
  if (w.tags.natural !== 'water' && w.tags.waterway !== 'riverbank') continue;
  const pts = w.refs.map(r => N.get(r)).filter(Boolean); if (!pts.length) continue;
  const xs = pts.map(p => +fx(p.lon)), ys = pts.map(p => +fy(p.lat));
  console.log(`  ${w.tags.name || '(unnamed)'} area=${w.tags.area || '-'} ${Math.min(...xs)},${Math.min(...ys)} -> ${Math.max(...xs)},${Math.max(...ys)} pts=${pts.length}`);
}
console.log('\n=== water multipolygon relations ===');
for (const r of rels) {
  if (r.tags.type !== 'multipolygon') continue;
  if (!/water|Marina|River|Basin/i.test(r.tags.natural || r.tags.water || r.tags.name || '')) continue;
  const outer = r.members.filter(m => m.type === 'way').map(m => m.ref);
  console.log(`  ${r.tags.name || '(unnamed)'} nat=${r.tags.natural || '-'} water=${r.tags.water || '-'} ways=${outer.length}`);
}
console.log('\n=== bridges (man_made=bridge) ===');
for (const w of ways) {
  if (w.tags.bridge !== 'yes' && w.tags.man_made !== 'bridge') continue;
  if (!w.tags.name) continue;
  const pts = w.refs.map(r => N.get(r)).filter(Boolean); if (!pts.length) continue;
  const xs = pts.map(p => +fx(p.lon)), ys = pts.map(p => +fy(p.lat));
  console.log(`  ${w.tags.name.padEnd(30)} ${w.tags.bridge || w.tags.man_made} ${Math.min(...xs)},${Math.min(...ys)} -> ${Math.max(...xs)},${Math.max(...ys)} pts=${pts.length}`);
}
console.log('\n=== tallest buildings ===');
const bs = ways.filter(w => w.tags.building && w.tags.building !== 'no')
  .map(w => {
    const h = w.tags.height ? parseFloat(w.tags.height) : (w.tags['building:levels'] ? parseFloat(w.tags['building:levels']) * 3.2 + 2 : 0);
    return { name: w.tags.name || '(anon)', h, lv: w.tags['building:levels'], tags: w.tags };
  }).filter(b => b.h > 60).sort((a, b) => b.h - a.h);
for (const b of bs.slice(0, 40)) console.log(`  ${String(b.h).padStart(6)}m  ${b.name.padEnd(32)} lv=${b.lv || '-'} mat=${b.tags['building:material'] || '-'} roof=${b.tags['roof:shape'] || '-'}`);
console.log(`  ... total buildings with height info: ${bs.length} / ${ways.filter(w => w.tags.building).length}`);
