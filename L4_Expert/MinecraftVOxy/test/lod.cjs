// VOXY CRAFT — 远景 LOD 自检（M8）
// 运行：NODE_PATH=".../node_modules" node test/lod.cjs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.VOXY_URL || 'http://127.0.0.1:8765/';
const SHOT_DIR = path.join(__dirname, 'shots');

(async () => {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__VOXY__ && window.__VOXY__.focus, { timeout: 30000 });
  await page.waitForTimeout(400);

  // 高视点远眺函数
  async function farShot(biomeId, name, viewDist) {
    await page.evaluate(({ bid, vd }) => {
      const g = window.__VOXY__;
      g.setViewDistance(vd);
      const p = g.findBiome(bid);
      g.focusWorld(p.x, p.z, 4);
      // 高视点朝地平线远眺
      g.camera.position.set(p.x + 120, 170, p.z + 120);
      g.camera.lookAt(p.x - 500, 55, p.z - 500);
      g.camera.updateProjectionMatrix();
    }, { bid: biomeId, vd: viewDist });
    await page.waitForTimeout(3000); // 等待 LOD worker 构建
    const info = await page.evaluate(() => {
      const g = window.__VOXY__;
      let lodTris = 0;
      for (const m of g.lodMeshes.values()) lodTris += m.geometry.attributes.position.count / 3;
      return {
        lodLevels: g.lodMeshes.size,
        lodTris: Math.round(lodTris),
        draw: g.renderer.info.render.calls,
        viewDist: g.viewDist,
      };
    });
    await page.screenshot({ path: path.join(SHOT_DIR, `lod_${name}.png`) });
    console.log(`  [${name}] viewDist=${info.viewDist} LOD级=${info.lodLevels} LOD三角=${info.lodTris} draw=${info.draw}`);
    return info;
  }

  const forest = await farShot(1, 'forest', 4096);
  const snow = await farShot(6, 'snow', 4096);

  // 8192 极远视距不崩
  await page.evaluate(() => { const g = window.__VOXY__; g.setViewDistance(8192); g._rebuildLOD(0, 0); });
  await page.waitForTimeout(3500);
  const extreme = await page.evaluate(() => {
    const g = window.__VOXY__;
    return { lodLevels: g.lodMeshes.size, fps: g.fps, viewDist: g.viewDist };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'lod_8192.png') });
  console.log(`  [8192] LOD级=${extreme.lodLevels} fps=${extreme.fps.toFixed(0)}`);

  await browser.close();
  console.log('---------------------------------');
  console.log('console errors:', errors.length, errors.slice(0, 5));
  let fail = 0;
  const assert = (c, m) => { if (!c) { console.error('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };
  assert(forest.lodLevels >= 3, '森林远景生成多级 LOD (' + forest.lodLevels + ')');
  assert(forest.lodTris > 0, '远景有立体几何');
  assert(snow.lodLevels >= 3, '雪山远景生成多级 LOD');
  assert(extreme.lodLevels >= 3, '8192 视距 LOD 正常构建');
  assert(extreme.fps > 0, '8192 视距可渲染不崩');
  assert(errors.length === 0, 'console 零 error');

  if (fail > 0) { console.error('[M8] 未通过'); process.exit(1); }
  console.log('M8 远景 LOD 自检通过 ✓');
})().catch((e) => { console.error('异常:', e); process.exit(1); });
