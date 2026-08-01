// VOXY CRAFT — 单文件 dist 离线验证（file:// 双击场景）
// 运行：NODE_PATH=".../node_modules" node test/dist.cjs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const DIST = path.join(__dirname, '..', 'dist', 'index.html');
const URL = pathToFileURL(DIST).href;
const SHOT_DIR = path.join(__dirname, 'shots');

(async () => {
  if (!fs.existsSync(DIST)) { console.error('dist/index.html 不存在，请先运行 node build/bundle.mjs'); process.exit(1); }
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  console.log('[dist] 打开 ' + URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__VOXY__ && window.__VOXY__.focus, { timeout: 30000 });
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const g = window.__VOXY__;
    return { fps: g.fps, chunks: g.chunkMap.size, workerSrc: typeof window.__VOXY_WORKER_SRC__ === 'string' };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'dist-file.png') });
  await browser.close();

  console.log('[dist] 状态:', JSON.stringify(state));
  console.log('[dist] console errors:', errors.length, errors.slice(0, 5));

  let fail = 0;
  const assert = (c, m) => { if (!c) { console.error('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };
  assert(state.workerSrc, 'Worker 代码已内联（Blob 模式）');
  assert(state.fps > 0, 'file:// 下可渲染 (' + state.fps.toFixed(0) + ' fps)');
  assert(state.chunks > 0, '区块已生成 (' + state.chunks + ')');
  assert(errors.length === 0, 'console 零 error');

  if (fail > 0) { console.error('[dist] 未通过'); process.exit(1); }
  console.log('M11 单文件离线验证通过 ✓');
})().catch((e) => { console.error('异常:', e); process.exit(1); });
