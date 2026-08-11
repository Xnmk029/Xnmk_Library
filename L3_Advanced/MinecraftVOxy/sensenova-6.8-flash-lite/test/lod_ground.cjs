// VOXY CRAFT — 地面视角远景 LOD 复现（森林→沙漠，匹配用户场景）· 轻量单浏览器
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

  // 找森林点 + 其附近的沙漠方向，地面视角朝沙漠地平线
  const setup = await page.evaluate(() => {
    const g = window.__VOXY__;
    g.startStreaming();
    const forest = g.findBiome(1);           // 森林
    // 在森林点周围找沙漠方向
    let dir = null;
    for (let a = 0; a < 8 && !dir; a++) {
      const ang = a * Math.PI / 4;
      const sx = forest.x + Math.round(Math.sin(ang) * 150);
      const sz = forest.z + Math.round(Math.cos(ang) * 150);
      const h = g.terrain.heightAt(sx, sz);
      if (g.terrain.biomeAt(sx, sz, h) === 2) dir = { dx: Math.sin(ang), dz: Math.cos(ang) };
    }
    if (!dir) dir = { dx: 1, dz: 0 };
    g.player.state.x = forest.x + 0.5; g.player.state.z = forest.z + 0.5;
    g.player.state.y = g.terrain.heightAt(forest.x, forest.z) + 2.5;
    g.player.state.vy = 0; g.player.state.flying = true;
    g.controls.yaw = Math.atan2(-dir.dx, -dir.dz);  // 面向沙漠
    g.controls.pitch = -0.05;                        // 近似水平
    return { forest, dir };
  });
  console.log('[setup]', JSON.stringify(setup));
  await page.waitForTimeout(3500); // 等待流式 + LOD

  const stats = await page.evaluate(() => {
    const g = window.__VOXY__;
    let lodTris = 0; for (const m of g.lodMeshes.values()) lodTris += m.geometry.attributes.position.count / 3;
    return {
      lodLevels: g.lodMeshes.size, lodTris: Math.round(lodTris),
      chunks: g.chunkMap.size, draw: g.renderer.info.render.calls,
      viewDist: g.viewDist, camY: g.camera.position.y.toFixed(1),
    };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'lod-ground.png') });
  console.log('[stats]', JSON.stringify(stats));
  console.log('errors:', errors.length, errors.slice(0, 3));

  await browser.close();
})().catch((e) => { console.error('异常:', e); process.exit(1); });
