import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/_src/city-data.json', 'utf8'));
for (const b of d.b) {
  if (!/marina bay sands|skypark|mice|theatres|supertree/i.test(b.n || '')) continue;
  const r = b.r;
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (let i = 0; i < r.length; i += 2) {
    const x = r[i], y = -r[i+1];
    if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
  }
  console.log(String(b.h).padStart(6), (b.n || '(anon)').padEnd(38), 'pts=' + (r.length / 2),
    'x[' + mnx.toFixed(0) + ',' + mxx.toFixed(0) + '] y[' + mny.toFixed(0) + ',' + mxy.toFixed(0) + ']');
}
