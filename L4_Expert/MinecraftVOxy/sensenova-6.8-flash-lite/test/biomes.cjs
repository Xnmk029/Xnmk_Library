// VOXY CRAFT — 7 群系截图自检（M2）
// 运行：NODE_PATH=".../node_modules" node test/biomes.cjs
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
  await page.waitForTimeout(500);

  const NAMES = ['plains', 'forest', 'desert', 'plateau', 'basin', 'lake', 'snow'];
  const results = [];
  for (let id = 0; id < 7; id++) {
    const info = await page.evaluate((bid) => window.__VOXY__.focusBiome(bid, 5), id);
    await page.waitForTimeout(400);
    if (info) {
      await page.screenshot({ path: path.join(SHOT_DIR, `biome_${id}_${NAMES[id]}.png`) });
      results.push({ id, name: NAMES[id], ...info });
      console.log(`  ✓ 群系 ${id} ${info.biome} @ (${info.wx},${info.wz}) h=${info.h} tris=${info.tris}`);
    } else {
      results.push({ id, name: NAMES[id], found: false });
      console.error(`  ✗ 群系 ${id} ${NAMES[id]} 未找到`);
    }
  }

  await browser.close();

  console.log('---------------------------------');
  console.log('console errors:', errors.length, errors.slice(0, 5));
  const foundCount = results.filter((r) => r.found !== false).length;
  console.log(`找到群系 ${foundCount}/7`);
  if (errors.length > 0) { console.error('存在 console error'); process.exit(1); }
  if (foundCount < 7) { console.error('群系未全部找到'); process.exit(1); }
  console.log('M2 群系自检通过 ✓');
})().catch((e) => { console.error('异常:', e); process.exit(1); });
