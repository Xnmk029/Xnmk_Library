import fs from 'node:fs/promises';
await fs.mkdir('data', { recursive: true });
const jobs = [];
for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
  const w = 114.143 + x * .013, s = 22.267 + y * .01175;
  jobs.push({ x, y, bbox: [w, s, w + .013, s + .01175].map(v => v.toFixed(5)).join(',') });
}
async function worker() {
  while (jobs.length) {
    const j = jobs.shift(), filename = `data/tile-${j.x}-${j.y}.osm`;
    try { if ((await fs.stat(filename)).size > 100) { console.log('Cached', filename); continue; } } catch {}
    const r = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${j.bbox}`, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) throw Error(`${j.bbox}: ${r.status} ${await r.text()}`);
    const content = await r.text();
    await fs.writeFile(filename, content);
    console.log(filename, `${(content.length / 1e6).toFixed(1)} MB`);
  }
}
await Promise.all([worker(), worker()]);
