// Assemble the single-file deliverable: template + inlined city data.
import fs from 'node:fs';
import path from 'node:path';
const HERE = 'F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/_src';
const OUT  = 'F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/voxel-marina-bay.html';

const tpl = fs.readFileSync(path.join(HERE, 'app-template.html'), 'utf8');
const data = fs.readFileSync(path.join(HERE, 'city-data.json'), 'utf8');
// guard against a </script> sequence inside the JSON
const safe = data.replace(/<\/script/gi, '<\\/script');
if (!tpl.includes('/*__CITY_DATA__*/')) { console.error('placeholder missing'); process.exit(1); }
const out = tpl.replace('/*__CITY_DATA__*/', safe);
fs.writeFileSync(OUT, out);
console.log(`${path.basename(OUT)}  ${(out.length / 1024).toFixed(0)} KB`);
