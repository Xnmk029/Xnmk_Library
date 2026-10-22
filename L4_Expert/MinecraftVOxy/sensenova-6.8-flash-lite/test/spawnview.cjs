// VOXY CRAFT — 出生点初始视角验证（应望见远处雪帽高原）· 轻量单浏览器
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
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__VOXY__ && window.__VOXY__.focus, { timeout: 30000 });
  await page.waitForTimeout(3500); // 等流式 + LOD

  const info = await page.evaluate(() => {
    const g = window.__VOXY__;
    let lodTris = 0; for (const m of g.lodMeshes.values()) lodTris += m.geometry.attributes.position.count / 3;
    return {
      spawn: g.spawnPoint,
      lodLevels: g.lodMeshes.size, lodTris: Math.round(lodTris),
      viewDist: g.viewDist, draw: g.renderer.info.render.calls,
    };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'spawn-view.png') });
  console.log('[spawn]', JSON.stringify(info));
  console.log('errors:', errors.length, errors.slice(0, 3));
  await browser.close();
})().catch((e) => { console.error('异常:', e); process.exit(1); });
