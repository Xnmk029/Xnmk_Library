// VOXY CRAFT — UI 自检（M10：物品栏 ≥80 种 / 快捷栏图标 / 设置面板）
// 运行：NODE_PATH=".../node_modules" node test/ui.cjs
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

  const info = await page.evaluate(() => {
    const g = window.__VOXY__;
    g.inventory.open();
    const cells = document.querySelectorAll('#inv-grid .cell').length;
    const hotbarIcons = document.querySelectorAll('#hotbar .slot img').length;
    const kinds = g.inventory.count;
    // 打开设置面板
    g.inventory.close();
    g.settings.open();
    const settingsOpen = g.settings.isOpen;
    g.settings.close();
    return { cells, hotbarIcons, kinds, settingsOpen };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'm10-ui.png') });

  // 物品栏截图
  await page.evaluate(() => window.__VOXY__.inventory.open());
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOT_DIR, 'm10-inventory.png') });

  await browser.close();
  console.log('[M10] 结果:', JSON.stringify(info));
  console.log('console errors:', errors.length, errors.slice(0, 5));

  let fail = 0;
  const assert = (c, m) => { if (!c) { console.error('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };
  assert(info.cells >= 80, '物品栏陈列 ≥80 种 (' + info.cells + ')');
  assert(info.hotbarIcons > 0, '快捷栏有图标 (' + info.hotbarIcons + ')');
  assert(info.settingsOpen, '设置面板可打开');
  assert(errors.length === 0, 'console 零 error');

  if (fail > 0) { console.error('[M10] 未通过'); process.exit(1); }
  console.log('M10 UI 自检通过 ✓');
})().catch((e) => { console.error('异常:', e); process.exit(1); });
