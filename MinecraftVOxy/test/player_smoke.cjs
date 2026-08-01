// VOXY CRAFT — 玩家交互冒烟（M6，无头直接驱动 player）
// 运行：NODE_PATH=".../node_modules" node test/player_smoke.cjs
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

  const result = await page.evaluate(() => {
    const g = window.__VOXY__;
    g.focusWorld(0, 0, 4);
    const p = g.player;
    const h = g.terrain.heightAt(0, 0);
    p.state.x = 0.5; p.state.z = 0.5; p.state.y = h + 3; p.state.vy = 0; p.state.flying = true;
    p.setLook(0, -1.5); // 近似垂直向下
    for (let i = 0; i < 6; i++) p.update(1 / 60);

    const t0 = p.target;
    const out = { surfaceH: h, hit: t0.hit, tx: t0.x, ty: t0.y, tz: t0.z };
    if (!t0.hit) return out;
    const id0 = g.world.getBlock(t0.x, t0.y, t0.z);
    out.id0 = id0;

    // 破坏
    const broke = p.breakTarget();
    out.broke = broke;
    out.afterBreak = g.world.getBlock(t0.x, t0.y, t0.z);

    // 重新瞄准后放置
    for (let i = 0; i < 3; i++) p.update(1 / 60);
    const t1 = p.target;
    const placed = p.placeTarget(id0);
    out.placed = placed;
    if (t1.hit) {
      out.px = t1.x + t1.nx; out.py = t1.y + t1.ny; out.pz = t1.z + t1.nz;
      out.placeId = g.world.getBlock(out.px, out.py, out.pz);
    }
    // 飞行切换
    const flyBefore = p.state.flying;
    p.toggleFly();
    out.flyToggled = (p.state.flying !== flyBefore);
    return out;
  });

  await page.screenshot({ path: path.join(SHOT_DIR, 'm6-player.png') });
  await browser.close();

  console.log('[M6] 结果:', JSON.stringify(result));
  console.log('console errors:', errors.length, errors.slice(0, 5));

  let fail = 0;
  const assert = (c, m) => { if (!c) { console.error('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };
  assert(result.hit, '射线命中地面');
  assert(result.ty <= result.surfaceH, '命中高度合理');
  assert(result.broke && result.afterBreak === 0, '破坏后该格变为空气');
  assert(result.placed && result.placeId === result.id0, '放置回原方块');
  assert(result.flyToggled, '飞行切换生效');
  assert(errors.length === 0, 'console 零 error');

  if (fail > 0) { console.error('[M6] 未通过'); process.exit(1); }
  console.log('M6 玩家交互冒烟通过 ✓');
})().catch((e) => { console.error('异常:', e); process.exit(1); });
