import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/_src/city-data.json', 'utf8'));
const CELL = 2.0, GW = 1950, GH = 1585;
const EXT = { x0: -2400, x1: 1500, z0: -1320, z1: 1850 };
const gx = x => Math.floor((x - EXT.x0) / CELL);
const gz = z => Math.floor((z - EXT.z0) / CELL);
const road = new Uint8Array(GW * GH);
let totalLen = 0, totalArea = 0;
const byClass = {};
for (const r of d.r) {
  const pts = r.p.split(' ').map(s => { const a = s.split(','); return [+a[0], - +a[1]]; });
  if (pts.length < 2) continue;
  let L = 0;
  for (let i = 0; i + 1 < pts.length; i++) L += Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]);
  totalLen += L; totalArea += L * r.w;
  byClass[r.c] = byClass[r.c] || { n: 0, len: 0, area: 0 };
  byClass[r.c].n++; byClass[r.c].len += L; byClass[r.c].area += L * r.w;
  // stamp
  const rad = r.w / 2, r2 = rad * rad;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i+1];
    const i0 = Math.max(0, gx(Math.min(x1,x2)-rad)), i1 = Math.min(GW-1, gx(Math.max(x1,x2)+rad));
    const j0 = Math.max(0, gz(Math.min(z1,z2)-rad)), j1 = Math.min(GH-1, gz(Math.max(z1,z2)+rad));
    const dx = x2-x1, dz = z2-z1, L2 = dx*dx+dz*dz;
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
      const px = EXT.x0 + (ii+0.5)*CELL, pz = EXT.z0 + (j+0.5)*CELL;
      let t = L2 ? ((px-x1)*dx + (pz-z1)*dz)/L2 : 0; t = Math.max(0, Math.min(1, t));
      const ax = px-(x1+t*dx), az = pz-(z1+t*dz);
      if (ax*ax+az*az <= r2) road[j*GW+ii] = 1;
    }
  }
}
let n = 0; for (let i = 0; i < road.length; i++) n += road[i];
const worldArea = (EXT.x1-EXT.x0) * (EXT.z1-EXT.z0);
console.log('grid', GW*GH, 'cells  =', (worldArea/1e6).toFixed(2), 'km2');
console.log('road cells', n, '=', (n/(GW*GH)*100).toFixed(1)+'%', ' area', (n*4/1e6).toFixed(2), 'km2');
console.log('sum road length', (totalLen/1000).toFixed(1), 'km   sum area', (totalArea/1e6).toFixed(2), 'km2');
console.log('--- by class (top 12 by area) ---');
Object.entries(byClass).sort((a,b)=>b[1].area-a[1].area).slice(0,12)
  .forEach(([k,v]) => console.log('  ', k.padEnd(14), String(v.n).padStart(5), (v.len/1000).toFixed(1).padStart(7)+'km', (v.area/1e6).toFixed(2).padStart(6)+'km2'));
