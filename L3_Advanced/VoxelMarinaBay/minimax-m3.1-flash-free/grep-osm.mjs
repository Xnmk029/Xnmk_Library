import fs from 'node:fs';
const HERE = 'F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/_src';
for (const f of ['t3', 't4']) {
  const x = fs.readFileSync(`${HERE}/osm/${f}.osm`, 'utf8');
  const names = [...x.matchAll(/<tag k="name" v="([^"]*)"\/>/g)].map(m => m[1]);
  const hits = [...new Set(names.filter(n => /supertree|merlion|fountain|suntec|helix|promontory|skyway|mice|expo/i.test(n)))];
  console.log('==', f, hits.length);
  for (const h of hits) console.log('   ', h);
}
