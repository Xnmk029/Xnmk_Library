const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const URL = process.env.VOXY_URL || 'http://127.0.0.1:8765/';
const SHOT_DIR = path.join(__dirname, 'shots');
(async () => {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__VOXY__ && window.__VOXY__.focus, { timeout: 30000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const g = window.__VOXY__;
    g.startStreaming();
    const d = g.findBiome(2); // 沙漠
    const h = g.terrain.heightAt(d.x, d.z);
    g.player.state.x = d.x + 0.5; g.player.state.z = d.z + 0.5;
    g.player.state.y = h + 120; g.player.state.vy = 0; g.player.state.flying = true;
    g.controls.yaw = 0.8; g.controls.pitch = -0.5;
  });
  await page.waitForTimeout(3500);
  const stats = await page.evaluate(() => {
    const g = window.__VOXY__;
    let lt=0; for (const m of g.lodMeshes.values()) lt += m.geometry.attributes.position.count/3;
    return { lodLevels: g.lodMeshes.size, lodTris: Math.round(lt), chunks: g.chunkMap.size };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'lod-desert.png') });
  console.log('[desert]', JSON.stringify(stats), 'errors:', errors.length);
  await browser.close();
})().catch(e => { console.error('异常:', e); process.exit(1); });
