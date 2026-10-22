// list named buildings in a world-space box, with extents + height
import fs from 'node:fs';
const HERE = 'F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/_src';
const d = JSON.parse(fs.readFileSync(HERE + '/city-data.json', 'utf8'));
const box = process.argv[2].split(',').map(Number);
const [x0, y0, x1, y1] = box;
const rows = [];
for (const b of d.b) {
  const r = b.r; let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (let i = 0; i < r.length; i += 2) { const x = r[i], y = r[i + 1]; if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
  if (mnx > x1 || mxx < x0 || mny > y1 || mxy < y0) continue;
  const area = Math.abs(r.reduce((a, v, i) => (i % 2 ? a : a), 0));
  rows.push({ n: b.n || '(anon)', t: b.t, m: b.m, h: b.h, mnx, mxx, mny, mxy, pts: r.length / 2, area: Math.round((mxx - mnx) * (mxy - mny)) });
}
rows.sort((a, b) => b.h - a.h);
console.log(`buildings in [${box}]: ${rows.length}`);
for (const r of rows.slice(0, 60)) {
  console.log(`  ${String(r.h).padStart(6)}m ${r.n.slice(0, 34).padEnd(34)} ${r.t.padEnd(11)} ${r.m.padEnd(12)} x[${r.mnx.toFixed(0)},${r.mxx.toFixed(0)}] y[${r.mny.toFixed(0)},${r.mxy.toFixed(0)}]  ${r.pts}p`);
}
console.log('\n--- named entries in box ---');
for (const nm of d.named) {
  if (nm.x < x0 || nm.x > x1 || nm.y < y0 || nm.y > y1) continue;
  console.log(`  ${nm.n.slice(0, 38).padEnd(38)} ${(nm.b || '').padEnd(12)} x=${nm.x.toFixed(0)} y=${nm.y.toFixed(0)} h=${nm.h} lv=${nm.lv}`);
}
