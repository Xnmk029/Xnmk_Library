import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/_src/city-data.json', 'utf8'));
const bb = (b) => {
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  const r = b.r;
  for (let i = 0; i < r.length; i += 2) {
    const x = r[i], y = r[i + 1];
    if (x < mnx) mnx = x; if (x > mxx) mxx = x;
    if (y < mny) mny = y; if (y > mxy) mxy = y;
  }
  return [mnx, mxx, mny, mxy];
};
const box = (x0, y0, x1, y1) => d.b.filter(b => {
  const [mnx, mxx, mny, mxy] = bb(b);
  return mnx <= x1 && mxx >= x0 && mny <= y1 && mxy >= y0;
});
for (const [nm, x0, y0, x1, y1] of [['SAIL', -230, -580, -90, -440], ['ORP', -450, -250, -300, -80], ['MBFC', -260, -560, 300, -100]]) {
  console.log('==', nm);
  for (const b of box(x0, y0, x1, y1).slice(0, 24)) {
    const [mnx, mxx, mny, mxy] = bb(b);
    console.log('  ', String(b.h).padStart(6), (b.n || '(anon)').padEnd(32), 'x[' + mnx.toFixed(0) + ',' + mxx.toFixed(0) + '] y[' + mny.toFixed(0) + ',' + mxy.toFixed(0) + ']');
  }
}
