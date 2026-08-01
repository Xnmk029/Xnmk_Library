// VOXY CRAFT — 无头冒烟测试（Playwright + swiftshader 软渲染 WebGL）
// 运行：NODE_PATH="C:/Users/Administrator/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules" node test/smoke.cjs
// 必须用 .cjs + require（ESM import 不读 NODE_PATH）

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.VOXY_URL || 'http://127.0.0.1:8765/';
const SHOT_DIR = path.join(__dirname, 'shots');

(async () => {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errors = [];
  const warnings = [];
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error') errors.push(msg.text());
    else if (t === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  console.log('[smoke] 打开 ' + URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 等待 canvas 与启动完成
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => window.__VOXY__ && window.__VOXY__.fps >= 0, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500); // 让渲染循环稳定、FPS 采样

  const state = await page.evaluate(() => {
    const g = window.__VOXY__;
    return {
      hasGame: !!g,
      fps: g ? g.fps : -1,
      threeRev: g && g.renderer ? g.renderer.info.render.calls : -1,
      bootHidden: document.getElementById('boot') ? document.getElementById('boot').classList.contains('hide') : true,
      hudFps: document.getElementById('h-fps') ? document.getElementById('h-fps').textContent : null,
    };
  });

  await page.screenshot({ path: path.join(SHOT_DIR, 'm0-boot.png') });

  console.log('[smoke] 状态:', JSON.stringify(state));
  console.log('[smoke] console errors:', errors.length, errors.slice(0, 10));
  console.log('[smoke] console warnings:', warnings.length, warnings.slice(0, 10));

  await browser.close();

  // ---- 断言 ----
  let fail = 0;
  const assert = (cond, msg) => { if (!cond) { console.error('  ✗ FAIL: ' + msg); fail++; } else console.log('  ✓ ' + msg); };
  assert(state.hasGame, 'window.__VOXY__ 已挂载');
  assert(state.bootHidden, '启动遮罩已隐藏');
  assert(state.fps > 0, 'FPS > 0 (实测 ' + state.fps.toFixed(1) + ')');
  assert(errors.length === 0, 'console 零 error');

  if (fail > 0) { console.error('[smoke] 未通过，' + fail + ' 项失败'); process.exit(1); }
  console.log('[smoke] M0 冒烟通过 ✓');
})().catch((e) => { console.error('[smoke] 异常:', e); process.exit(1); });
