// VOXY CRAFT — LOD 空洞验证：高视角俯视，检查级间无缝隙 · 轻量单浏览器
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
  await page.waitForTimeout(300);

  // 飞到出生点上空 200 格，俯视 40°，覆盖 LOD 各级环带（64-2048）
  await page.evaluate(() => {
    const g = window.__VOXY__;
    g.startStreaming();
    const sp = g.spawnPoint;
    const h = g.terrain.heightAt(sp.x, sp.z);
    g.player.state.x = sp.x + 0.5; g.player.state.z = sp.z + 0.5;
    g.player.state.y = h + 200; g.player.state.vy = 0; g.player.state.flying = true;
    g.controls.yaw = 0.7; g.controls.pitch = -0.7; // 俯视
  });
  await page.waitForTimeout(3500);

  const stats = await page.evaluate(() => {
    const g = window.__VOXY__;
    let lodTris = 0; for (const m of g.lodMeshes.values()) lodTris += m.geometry.attributes.position.count / 3;
    return { lodLevels: g.lodMeshes.size, lodTris: Math.round(lodTris), chunks: g.chunkMap.size };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'lod-topdown.png') });
  console.log('[topdown]', JSON.stringify(stats));
  console.log('errors:', errors.length, errors.slice(0, 3));
  await browser.close();
})().catch((e) => { console.error('异常:', e); process.exit(1); });
