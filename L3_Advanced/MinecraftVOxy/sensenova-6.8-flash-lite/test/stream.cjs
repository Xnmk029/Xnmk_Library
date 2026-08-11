// VOXY CRAFT — 流式加载冒烟（M7）
// 运行：NODE_PATH=".../node_modules" node test/stream.cjs
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

  // 启动流式 + 定位玩家
  await page.evaluate(() => {
    const g = window.__VOXY__;
    g.startStreaming();
    g.player.spawnAt(0, 0);
    g.player.state.flying = true;
  });
  await page.waitForTimeout(3000); // 等待 worker 生成初始区块

  const s1 = await page.evaluate(() => {
    const g = window.__VOXY__;
    return { loaded: g.streamer.loadedCount, chunks: g.chunkMap.size, submitted: g.streamer.stats.submitted, installed: g.streamer.stats.installed };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'm7-stream-origin.png') });
  console.log('[M7] 初始:', JSON.stringify(s1));

  // 瞬移玩家到 256 格外，触发回收 + 重新流式
  await page.evaluate(() => {
    const g = window.__VOXY__;
    const h = g.terrain.heightAt(256, 256);
    g.player.state.x = 256.5; g.player.state.z = 256.5;
    g.player.state.y = Math.max(h, 40) + 3; g.player.state.vy = 0;
  });
  await page.waitForTimeout(3500);

  const s2 = await page.evaluate(() => {
    const g = window.__VOXY__;
    return { loaded: g.streamer.loadedCount, chunks: g.chunkMap.size, unloaded: g.streamer.stats.unloaded, discarded: g.streamer.stats.discarded, longFrames: g.longFrames };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'm7-stream-moved.png') });
  console.log('[M7] 移动后:', JSON.stringify(s2));

  await browser.close();

  console.log('console errors:', errors.length, errors.slice(0, 5));
  let fail = 0;
  const assert = (c, m) => { if (!c) { console.error('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };
  assert(s1.loaded > 0, '初始流式加载了区块 (' + s1.loaded + ')');
  assert(s1.installed > 0, 'Worker 结果被安装');
  assert(s2.unloaded > 0, '移动后回收了越界区块 (' + s2.unloaded + ')');
  assert(s2.loaded > 0, '移动后新区块已加载');
  assert(s2.chunks <= 600, '区块数量有界无泄漏 (' + s2.chunks + ')');
  assert(errors.length === 0, 'console 零 error');

  if (fail > 0) { console.error('[M7] 未通过'); process.exit(1); }
  console.log('M7 流式加载冒烟通过 ✓');
})().catch((e) => { console.error('异常:', e); process.exit(1); });
