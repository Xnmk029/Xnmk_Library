// 开发诊断工具：把场景里所有几何体/材质/性能数据翻出来，定位 NaN、空池、draw call 爆炸。
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(join(ROOT, 'dist/index.html')).href + '?autostart=1';

const browser = await chromium.launch({
  headless: true, channel: 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
page.on('console', (m) => console.log(`  [${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__GAME, null, { timeout: 20000 });
await page.waitForTimeout(1200);

const dump = await page.evaluate(() => {
  const g = window.__DUCKBOID;
  const out = { nan: [], meshes: [], pools: [], info: null };
  g.renderer.renderer.info.autoReset = false;
  g.renderer.renderer.info.reset();
  g.renderOnce(1);
  const i = g.renderer.renderer.info;
  out.info = { calls: i.render.calls, tris: i.render.triangles, lines: i.render.lines, programs: i.programs.length, geo: i.memory.geometries, tex: i.memory.textures };

  g.scene.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const geo = o.geometry;
    let nan = false;
    const pos = geo.attributes?.position;
    if (pos) {
      geo.computeBoundingSphere();
      if (Number.isNaN(geo.boundingSphere?.radius)) nan = true;
      for (let k = 0; k < Math.min(pos.count * 3, 300); k++) if (Number.isNaN(pos.array[k])) { nan = true; break; }
    }
    const rec = {
      name: o.name || geo.name || o.type, type: o.isInstancedMesh ? 'inst' : 'mesh',
      count: o.isInstancedMesh ? o.count : 1, max: o.isInstancedMesh ? o.instanceMatrix.count : 1,
      tris: (geo.index ? geo.index.count : geo.attributes.position.count) / 3,
      layer: o.layers.mask, nan,
    };
    out.meshes.push(rec);
    if (nan) out.nan.push(rec);
  });
  return out;
});

console.log('\n[info]', JSON.stringify(dump.info));
console.log(`\n[meshes] ${dump.meshes.length}`);
const byType = {};
for (const m of dump.meshes) {
  const k = m.name;
  byType[k] = byType[k] || { n: 0, count: 0, tris: 0, layer: m.layer };
  byType[k].n++; byType[k].count += m.count; byType[k].tris += Math.round(m.tris * m.count);
}
for (const k in byType) console.log(`  ${k.padEnd(20)} ×${String(byType[k].n).padStart(3)}  instances=${String(byType[k].count).padStart(5)}  tris=${byType[k].tris}  layer=${byType[k].layer}`);
console.log(`\n[NaN 几何体] ${dump.nan.length}`);
for (const n of dump.nan) console.log('  ✗', JSON.stringify(n));

await browser.close();
