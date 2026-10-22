// VOXY CRAFT — 4 种树截图自检（M5）
// 运行：NODE_PATH=".../node_modules" node test/trees.cjs
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

  const TYPES = ['fir', 'palm', 'sakura', 'giant'];
  let found = 0;
  for (const t of TYPES) {
    const info = await page.evaluate((type) => window.__VOXY__.focusTree(type, 4), t);
    await page.waitForTimeout(400);
    if (info) {
      await page.screenshot({ path: path.join(SHOT_DIR, `tree_${t}.png`) });
      console.log(`  ✓ 树 ${t} @ (${info.wx},${info.wz}) h=${info.h}`);
      found++;
    } else {
      console.error(`  ✗ 树种 ${t} 未找到`);
    }
  }

  await browser.close();
  console.log('---------------------------------');
  console.log('console errors:', errors.length, errors.slice(0, 5));
  console.log(`找到树种 ${found}/4`);
  if (errors.length > 0) { console.error('存在 console error'); process.exit(1); }
  if (found < 4) { console.error('树种未全部找到'); process.exit(1); }
  console.log('M5 树种自检通过 ✓');
})().catch((e) => { console.error('异常:', e); process.exit(1); });
