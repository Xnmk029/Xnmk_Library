// VOXY CRAFT — 实玩视角回归（修复验证）：近景面剔除破洞 + 远景 LOD 加载
// 运行：NODE_PATH=".../node_modules" node test/playview.cjs
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

  // 进入流式玩家模式
  await page.evaluate(() => {
    const g = window.__VOXY__;
    g.startStreaming();
    g.player.spawnAt(0, 0);
    g.player.state.flying = true;
  });
  await page.waitForTimeout(2500);

  // ---- 验证 1：相机所在区块的六个朝向面全部可见（修复前会被错误隐藏 3 个）----
  const cull = await page.evaluate(() => {
    const g = window.__VOXY__;
    const S = 16;
    const cp = g.camera.position;
    const key = Math.floor(cp.x / S) + ',' + Math.floor(cp.y / S) + ',' + Math.floor(cp.z / S);
    const e = g.chunkMap.get(key);
    if (!e) return { found: false };
    const exist = e.faceMeshes.filter((m) => m).length;
    const vis = e.faceMeshes.filter((m) => m && m.visible).length;
    return { found: true, exist, vis };
  });
  console.log('[cull] 相机所在区块:', JSON.stringify(cull));

  // ---- 近景：贴近阶梯地形观察（面剔除）----
  await page.evaluate(() => {
    const g = window.__VOXY__;
    // 找一处高原/阶梯地形
    const p = g.findBiome(3) || { x: 0, z: 0, h: 60 };
    g.player.state.x = p.x + 0.5; g.player.state.z = p.z + 0.5;
    g.player.state.y = p.h + 3; g.player.state.vy = 0; g.player.state.flying = true;
    g.controls.yaw = 0.6; g.controls.pitch = -0.25;
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'fix-close.png') });

  // ---- 远景：高视点朝地平线（LOD 加载）----
  await page.evaluate(() => {
    const g = window.__VOXY__;
    g.player.state.y = 130; g.player.state.vy = 0;
    g.controls.yaw = 0.6; g.controls.pitch = -0.12;
  });
  await page.waitForTimeout(3000);
  const lod = await page.evaluate(() => {
    const g = window.__VOXY__;
    let tris = 0; for (const m of g.lodMeshes.values()) tris += m.geometry.attributes.position.count / 3;
    return { levels: g.lodMeshes.size, tris: Math.round(tris), chunks: g.chunkMap.size };
  });
  await page.screenshot({ path: path.join(SHOT_DIR, 'fix-far.png') });
  console.log('[lod] 远景:', JSON.stringify(lod));

  await browser.close();
  console.log('console errors:', errors.length, errors.slice(0, 5));

  let fail = 0;
  const assert = (c, m) => { if (!c) { console.error('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };
  assert(cull.found, '定位到相机所在区块');
  assert(cull.found && cull.vis === cull.exist, `相机在区块内部时六向面全可见 (${cull.vis}/${cull.exist})`);
  assert(lod.levels >= 3, '远景 LOD 已加载 (' + lod.levels + ' 级)');
  assert(lod.tris > 0, '远景 LOD 有几何');
  assert(errors.length === 0, 'console 零 error');

  if (fail > 0) { console.error('[playview] 未通过'); process.exit(1); }
  console.log('实玩视角回归通过 ✓');
})().catch((e) => { console.error('异常:', e); process.exit(1); });
