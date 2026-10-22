import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/_src/city-data.json', 'utf8'));
const bb = b => { let a = 1e9, c = -1e9, e = 1e9, f = -1e9; const r = b.r; for (let i = 0; i < r.length; i += 2) { if (r[i] < a) a = r[i]; if (r[i] > c) c = r[i]; if (r[i + 1] < e) e = r[i + 1]; if (r[i + 1] > f) f = r[i + 1]; } return [a, c, e, f]; };
for (const b of d.b) {
  if (!/marina bay financial|financial centre|gateway|marina boulevard|hong leong|marina bay tower|central park|maple|quayside|fullerton|marina suites|residence/i.test(b.n || '')) continue;
  const [a, c, e, f] = bb(b);
  console.log(String(b.h).padStart(6), (b.n || '(anon)').padEnd(40), 'x[' + a.toFixed(0) + ',' + c.toFixed(0) + '] y[' + e.toFixed(0) + ',' + f.toFixed(0) + ']');
}
console.log('--- greens near MBFC/Promontory ---');
for (const g of d.g) {
  const r = g.r; let a = 1e9, c = -1e9, e = 1e9, f = -1e9;
  for (let i = 0; i < r.length; i += 2) { if (r[i] < a) a = r[i]; if (r[i] > c) c = r[i]; if (r[i + 1] < e) e = r[i + 1]; if (r[i + 1] > f) f = r[i + 1]; }
  if (c < -150 || a > 500) continue;
  console.log('  ', g.k.padEnd(10), 'x[' + a.toFixed(0) + ',' + c.toFixed(0) + '] y[' + e.toFixed(0) + ',' + f.toFixed(0) + ']');
}
