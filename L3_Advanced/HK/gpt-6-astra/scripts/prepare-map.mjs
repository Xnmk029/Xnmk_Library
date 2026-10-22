import fs from 'node:fs/promises';
const files = await fs.readdir('data');
async function read(prefix) { const f = []; for (const path of files.filter(x => new RegExp('^' + prefix + '-[0-9]+\\.geojson$').test(x))) f.push(...JSON.parse(await fs.readFile('data/' + path, 'utf8')).features); return f; }
const lon0 = 114.1694, lat0 = 22.29;
const project = p => [Math.round((p[0] - lon0) * 111320 * Math.cos(lat0 * Math.PI / 180) * 2) / 2, Math.round(-(p[1] - lat0) * 111320 * 2) / 2];
function simplify(coords) {
  const out = [];
  for (let i = 0; i < coords.length; i++) { const p = project(coords[i]); if (!out.length || Math.hypot(p[0] - out.at(-1)[0], p[1] - out.at(-1)[1]) >= 2 || i === coords.length - 1) out.push(p); }
  return out;
}
const rawBuildings = await read('buildings');
const unique = new Map(rawBuildings.map(f => [f.id, f]));
const buildings = [...unique.values()].filter(f => f.properties.Shape_Area >= 60 && f.properties.BuildingBlockType !== 'Open-sided Structure').flatMap(f => {
  const a = f.properties, h = (a.TopHeight && a.BaseHeight !== null) ? a.TopHeight - a.BaseHeight : Math.max(8, (a.Storeys || 6) * 3.3);
  if (h < 4) return [];
  const rings = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map(p => p[0]) : [f.geometry.coordinates[0]];
  return rings.map((r, i) => ({ id: a.OBJECTID * 10 + i, name: a.BuildingNameTC || a.BuildingNameEN || '', en: a.BuildingNameEN || '', p: simplify(r), h: Math.round(Math.max(4, h) * 2) / 2, base: Math.round((a.BaseHeight || 4) * 2) / 2, estimated: !(a.TopHeight && a.BaseHeight !== null), kind: a.BuildingBlockType }));
});
const roads = (await read('roads')).flatMap(f => {
  const a = f.properties;
  const paths = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
  return paths.map((p, i) => ({ id: (f.id || a.OBJECTID) * 10 + i, name: a.CHINESESTREETNAME || '', p: simplify(p), kind: a.STREETTYPE || 'road' }));
});
const boundary = JSON.parse(await fs.readFile('data/hong-kong-boundary.geojson', 'utf8'));
const land = boundary.features.flatMap(f => f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map(p => simplify(p[0])) : [simplify(f.geometry.coordinates[0])]);
const parks = (await read('land')).map(f => ({ id: f.properties.OBJECTID, name: '', kind: 'woodland', p: simplify(f.geometry.type==='MultiPolygon'?f.geometry.coordinates[0][0]:f.geometry.coordinates[0]) }));
const city = { buildings, roads, land, coast: land, parks, piers: [], meta: { date: '2026-09-05', source: 'Lands Department CSDI / Hong Kong GeoJSON (2019) / CEDD', buildings: buildings.length, measuredHeights: buildings.filter(b => !b.estimated).length } };
await fs.mkdir('public', {recursive: true});
await fs.writeFile('public/city.json', JSON.stringify(city));
console.log(JSON.stringify(city.meta));
console.log('roads', roads.length, 'land polygons', land.length, 'size', (JSON.stringify(city).length / 1e6).toFixed(2), 'MB');
console.log('road properties', JSON.stringify((await read('roads'))[0].properties));
