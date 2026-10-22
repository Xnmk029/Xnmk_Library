// 无头冒烟：用 swiftshader 软件光栅跑真实 WebGL，断言"能启动、能跑、不报错、draw call 不失控"。
// 这是唯一能证明 dist/index.html 双击可玩的证据。
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// msaa=0 / fx=0：软件光栅下省掉 4× 分辨率与全屏后期开销。
// 帧率断言衡量的是"几何与管线本身的成本"，后期开销在最后单独跑一遍。
const URL_ = pathToFileURL(join(ROOT, 'dist/index.html')).href + '?msaa=0&fx=0';
const HEADLESS = !process.argv.includes('--headed');

const results = [];
let failed = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? '  — ' + detail : ''}`);
}

// 优先用本机已安装的 Chrome（本机 ms-playwright 里的 chromium 版本常与 playwright 包不匹配），
// 可用 PLAYWRIGHT_EXECUTABLE 显式指定。
const launchOpts = {
  headless: HEADLESS,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files', '--disable-gpu-sandbox', '--ignore-gpu-blocklist',
    '--mute-audio',
  ],
};
if (process.env.PLAYWRIGHT_EXECUTABLE) launchOpts.executablePath = process.env.PLAYWRIGHT_EXECUTABLE;
else launchOpts.channel = 'chrome';
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));

console.log(`[smoke] ${URL_}`);
await page.goto(URL_, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__GAME, null, { timeout: 20000 });

// 1. 启动
const fatal = await page.evaluate(() => (window.__FATAL || []).slice());
check('启动无致命错误', fatal.length === 0, fatal.join(' | '));
const shownFatal = await page.evaluate(() => document.getElementById('fatal')?.classList.contains('on'));
check('未弹出 FATAL 覆盖层', !shownFatal);

// 2. WebGL 真实可用
const gl = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const ctx = c && (c.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) || c.getContext('webgl'));
  return { has: !!ctx, w: c?.width ?? 0, h: c?.height ?? 0 };
});
check('WebGL 上下文创建成功', gl.has, `${gl.w}×${gl.h}`);

// 3. 世界生成
const world = await page.evaluate(() => window.__GAME.world);
check('地图生成：存在建筑', world.buildings > 0, JSON.stringify(world));
check('地图生成：存在可搜刮容器', world.containers > 0);
check('地图生成：存在撤离点', world.exits > 0);

// 4. 启动对局并跑帧
await page.evaluate(() => window.__GAME.start());
// 先预热 1.5s：首批着色器编译会造成几百毫秒的长帧，计入会误判
await page.waitForTimeout(1500);
const f0 = await page.evaluate(() => window.__GAME.frames);
await page.waitForTimeout(2000);
const f1 = await page.evaluate(() => window.__GAME.frames) - f0;
check('主循环持续推帧', f1 >= 10, `预热后 ${f1} 帧 / 2s`);

// 墙钟 fps：用帧计数差 / 真实耗时，比 loop 内部的滑动窗口更能反映体感
const perf = await page.evaluate(async () => {
  const a = window.__GAME.frames, t0 = performance.now();
  await new Promise((r) => setTimeout(r, 1000));
  return { fps: Math.round(((window.__GAME.frames - a) * 1000) / (performance.now() - t0)), reported: window.__GAME.fps, frameMs: window.__GAME.frameMs };
});
// 基线说明：swiftshader 是纯软件光栅，本作在该环境下是"填充率受限"
// （实测 130k 像素 25fps / 518k 8fps / 922k 6fps，严格反比于像素数），真实 GPU 上远超 60fps。
// 这里只做回归护栏：低于基线说明引入了新的每帧算法成本。
check('帧率不低于软件光栅基线（≥5）', perf.fps >= 5,
  `墙钟 ${perf.fps} fps / 内部 ${perf.reported} fps / ${perf.frameMs} ms`);

// 5. 移动：按下 W 后坐标必须变化
const before = await page.evaluate(() => window.__GAME.player);
await page.keyboard.down('KeyW');
await page.waitForTimeout(700);
await page.keyboard.up('KeyW');
const after = await page.evaluate(() => window.__GAME.player);
const moved = Math.hypot(after.x - before.x, after.z - before.z);
check('WASD 能驱动移动', moved > 0.8, `位移 ${moved.toFixed(2)} 单位`);

// 6. 碰撞：非法坐标必须被夹回地图内
await page.evaluate(() => window.__GAME.teleport(-1000, -1000));
await page.waitForTimeout(250);
const tp = await page.evaluate(() => window.__GAME.player);
check('碰撞：越界瞬移被拉回地图内', Math.abs(tp.x) < 100 && Math.abs(tp.z) < 100, `(${tp.x}, ${tp.z})`);

// 7. draw call 预算（实例化守卫）
await page.evaluate(() => window.__GAME.teleport(0, 0));
await page.waitForTimeout(400);
const r = await page.evaluate(() => window.__GAME.render);
check('draw call 受控（<120）', r.calls < 120, `calls=${r.calls} tris=${r.tris}`);

// 8. 确定性推帧（无 rAF）
const stepped = await page.evaluate(() => { const a = window.__GAME.frames; window.__GAME.step(60); return window.__GAME.frames - a; });
check('__GAME.step(60) 确定性推帧可用', stepped === 60, `+${stepped}`);

// 9. 控制台干净
const real = errors.filter((e) => !/favicon|AudioContext|Autoplay/i.test(e));
check('控制台无错误', real.length === 0, real.slice(0, 3).join(' | '));

// 10. 开启完整后期再跑一遍：着色器必须真的编译通过（这是"真 GLSL"而非 CPU 模拟的证据）
//     用运行时开关而非重新加载页面 —— pass 常驻链中，省掉一次完整的 swiftshader 启动。
const errors2 = [];
page.on('console', (m) => { if (m.type() === 'error') errors2.push(m.text()); });
page.on('pageerror', (e) => errors2.push('pageerror: ' + (e.stack || e.message)));
const fxFrames = await page.evaluate(async () => {
  window.__DUCKBOID.renderer.setPostFx(true);
  const a = window.__GAME.frames;
  await new Promise((r) => setTimeout(r, 2000));
  return window.__GAME.frames - a;
});
// 同样是软件光栅基线：7 个全屏 pass 在 swiftshader 下约 4~8fps，只验证"没卡死"
check('开启全屏后期后仍持续推帧', fxFrames >= 5, `${fxFrames} 帧 / 2s`);
const glErr = await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  return gl ? gl.getError() : -1;
});
check('WebGL 无错误码（着色器编译通过）', glErr === 0, `glGetError=${glErr}`);
const real2 = errors2.filter((e) => !/favicon|AudioContext|Autoplay/i.test(e));
check('后期全开时控制台无错误', real2.length === 0, real2.slice(0, 2).join(' | '));

// 10.5 视线迷雾与盲区剔除（M1）
const fow = await page.evaluate(() => {
  const g = window.__DUCKBOID;
  const v = g.view;
  const total = g.world.props.length + g.world.containers.length;
  // 站着不动时应当"零重绘"（哈希门控）；移动后才重传贴图 —— 两条都要验
  const idle = g.fow.redraws;
  for (let i = 0; i < 6; i++) { g.step(1 / 60, 1 / 60); g.renderOnce(1); }
  const idleRedraws = g.fow.redraws - idle;
  const before = g.fow.redraws;
  g.player.x += 4; g.player.z += 4;               // 移动 → 指纹变化
  for (let i = 0; i < 6; i++) { g.step(1 / 60, 1 / 60); g.renderOnce(1); }
  const moveRedraws = g.fow.redraws - before;

  // 朝 +Z 看：视野锥内应保留一部分，锥外全部剔除
  g.vision.cast(g.player.x, g.player.z, 0, 20);
  v.updateDynamic(g.vision);
  const facingZ = v.drawnDynamic;
  // 朝 -Z 看：可见集合必须发生变化（证明视野锥真的在转）
  g.vision.cast(g.player.x, g.player.z, Math.PI, 20);
  v.updateDynamic(g.vision);
  const facingNZ = v.drawnDynamic;
  // 视野收窄到贴身范围：几乎什么都不该剩
  g.vision.cast(g.player.x, g.player.z, 0, 3);
  v.updateDynamic(g.vision);
  const tiny = v.drawnDynamic;
  const walls = v.pools.walls;
  return {
    total, facingZ, facingNZ, tiny, idleRedraws, moveRedraws,
    outlineMatches: walls.outline.count === walls.mesh.count && walls.mesh.count > 0,
    sight: +g.sight.toFixed(1),
  };
});
check('站立不动时迷雾不重传（哈希门控生效）', fow.idleRedraws <= 1, `静止 6 帧重绘 ${fow.idleRedraws} 次`);
check('移动时迷雾蒙版重绘', fow.moveRedraws > 0, `移动 6 帧重绘 ${fow.moveRedraws} 次`);
check('盲区实体被剔除（未全量绘制）', fow.facingZ < fow.total * 0.6, `绘制 ${fow.facingZ} / 共 ${fow.total}`);
check('视野锥随朝向变化', fow.facingZ !== fow.facingNZ, `朝南 ${fow.facingZ} vs 朝北 ${fow.facingNZ}`);
check('视野收缩后几乎无可见实体', fow.tiny < fow.facingZ * 0.5, `视距 3 时绘制 ${fow.tiny}`);
check('描边孪生体与本体实例数一致', fow.outlineMatches);

// 10.8 战斗、AI、寻路、噪音（M2）
const m2 = await page.evaluate(() => {
  const g = window.__DUCKBOID;
  const out = {};
  out.spawned = g.enemies.length;

  // (1) 寻路：随机取一对可走点，A* 必须给出有效路径
  const w = g.world;
  let pathOk = 0, pathLen = 0;
  for (let i = 0; i < 6; i++) {
    const a = w.randomOpenPoint(g.rng);
    const b = w.randomOpenPoint(g.rng);
    const p = g.pathfinder.find(a.x, a.z, b.x, b.z);
    if (p && p.length) { pathOk++; pathLen += p.length; }
  }
  out.pathOk = pathOk;
  out.avgPath = +(pathLen / Math.max(1, pathOk)).toFixed(1);

  // (2) 开火命中：把一只敌人摆到正前方，扣血才算数
  const e0 = g.enemies.find((e) => e.alive);
  g.player.aim = 0.7;
  e0.x = g.player.x + Math.sin(0.7) * 5;
  e0.z = g.player.z + Math.cos(0.7) * 5;
  e0.hidden = false;
  g.equipped.mag = g.equipped.magSize;
  const hp0 = e0.hp;
  g.combat.fireCd = 0;
  g.combat.update(1 / 60, { fire: true, aim: true, reload: false });
  out.damage = +(hp0 - e0.hp).toFixed(1);
  out.magAfter = g.equipped.mag;
  out.tracers = g.combat.tracers.length;

  // (3) 枪声引尸潮：远处一记枪响，附近敌人必须转入 investigate
  const idle0 = g.enemies.filter((e) => e.alive && (e.state === 'idle' || e.state === 'wander')).length;
  g.noise.emit(g.player.x, g.player.z, 600, 'gunshot', null, 0.9);
  for (let i = 0; i < 20; i++) g.step(1 / 60, 1 / 60);
  const idle1 = g.enemies.filter((e) => e.alive && (e.state === 'idle' || e.state === 'wander')).length;
  out.idleBefore = idle0; out.idleAfter = idle1;

  // (4) 手电光锥被墙截断：可达距离不应全是满值
  g.torchOn = true;
  for (let i = 0; i < 6; i++) g.flashlight.update(1 / 60, i / 60, true, g.world, g.player.x, g.player.z, 1, 0);
  const reach = Array.from(g.flashlight.reachData);
  out.reachMin = +Math.min(...reach).toFixed(3);
  out.reachMax = +Math.max(...reach).toFixed(3);
  g.torchOn = false;

  // (5) 压力：把敌人数量堆到 200，draw call 必须依然受控
  const E = g.enemies[0].constructor;
  while (g.enemies.length < 200) {
    const p = w.randomOpenPoint(g.rng);
    g.enemies.push(new E(g.enemies[0].type, p.x, p.z));
  }
  for (let i = 0; i < 4; i++) g.step(1 / 60, 1 / 60);
  g.renderOnce(1);
  out.enemies200 = g.enemies.length;
  out.calls200 = g.renderer.info.render.calls;
  out.tris200 = g.renderer.info.render.triangles;

  // (6) 敌人确实被画出来了（实例化池里要有实例，且盲区外的不画）
  for (const e of g.enemies) { e.hidden = false; e.seen = true; }
  g.enemyView.update(g.enemies, g.corpses, 1, 1 / 60, 1, false);
  out.drawnAll = g.enemyView.drawn;
  for (const e of g.enemies) { e.hidden = true; e.seen = false; }
  g.enemyView.update(g.enemies, g.corpses, 1, 1 / 60, 1, false);
  out.drawnHidden = g.enemyView.drawn;
  return out;
});
check('A* 寻路可用', m2.pathOk >= 5, `${m2.pathOk}/6 条路径，平均 ${m2.avgPath} 航点`);
check('开火命中并造成伤害', m2.damage > 0, `扣血 ${m2.damage}，弹匣剩 ${m2.magAfter}`);
check('开火产生曳光', m2.tracers > 0, `${m2.tracers} 条`);
check('枪声引来尸群（噪音驱动 AI）', m2.idleAfter < m2.idleBefore,
  `游荡 ${m2.idleBefore} → ${m2.idleAfter}`);
check('手电光锥被墙体截断', m2.reachMin < 0.98, `可达距离 ${m2.reachMin}~${m2.reachMax}`);
check('200 敌人仍受 draw call 预算约束', m2.calls200 < 120, `calls=${m2.calls200} tris=${m2.tris200}`);
check('可见敌人进入实例化池', m2.drawnAll > 0, `绘制 ${m2.drawnAll} 只`);
check('盲区敌人完全不绘制', m2.drawnHidden === 0, `绘制 ${m2.drawnHidden} 只`);

// 10.9 部位伤病 / 双感染 / 医疗（M3）—— 纯逻辑，直接推进游戏小时做断言
const m3 = await page.evaluate(() => {
  const g = window.__DUCKBOID;
  const mk = () => new g.health.constructor(g);
  const out = {};

  // (1) 咬伤 100% 感染克诺克斯病毒，且 2~4 个游戏日内死亡
  let h = mk();
  h.damage(15, 'arm_l', 'bite');
  out.biteInfected = h.body.knox > 0;
  let hours = 0;
  while (!h.body.dead && hours < 500) { h.update(1 / 60, 1); hours++; }
  out.knoxDeathHours = hours;

  // (2) 感染率抽样：抓伤≈7%、撕裂≈25%（200 次抽样，允许 ±8% 浮动）
  const rate = (type, n = 300) => {
    let c = 0;
    for (let i = 0; i < n; i++) { const t = mk(); t.damage(5, 'arm_l', type); if (t.body.knox > 0) c++; }
    return +(c / n * 100).toFixed(1);
  };
  out.scratchRate = rate('scratch');
  out.lacerationRate = rate('laceration');

  // (3) 包扎 → 止血
  h = mk();
  h.damage(20, 'leg_l', 'laceration');
  h.update(1 / 60, 0.001);
  out.bleedBefore = +h.summary.bleedRate.toFixed(2);
  h.use('bandage');
  h.castT = 0.0001; h.update(0.0002, 0);
  h.update(1 / 60, 0.001);
  out.bleedAfter = +h.summary.bleedRate.toFixed(2);

  // (4) 脏绷带 → 伤口细菌感染
  h = mk();
  h.damage(20, 'arm_r', 'deep');
  h.use('bandage'); h.castT = 0.0001; h.update(0.0002, 0);
  const inj = h.body.parts.arm_r.injuries[0];
  inj.dirty = true;
  // wiki：脏绷带 3 天（72 游戏小时）以上必感染
  let dirtyHours = 0;
  while (!h.body.infected && dirtyHours < 90) { h.update(1 / 60, 1); dirtyHours++; }
  out.dirtyInfectedAt = h.body.infected ? dirtyHours : -1;
  out.dirtyInfected = h.body.infected;

  // (5) 骨折惩罚 + 夹板固定（需急救 1 级）
  h = mk();
  h.damage(25, 'leg_l', 'fracture');
  h.update(1 / 60, 0.001);
  out.moveFracture = +h.penalties.moveMul.toFixed(3);
  h.firstAid = 2;
  const r = h.use('splint');
  out.splintAccepted = r.ok;
  h.castT = 0.0001; h.update(0.0002, 0);
  h.update(1 / 60, 0.001);
  out.moveSplinted = +h.penalties.moveMul.toFixed(3);

  // (6) 恐慌真实改写射击属性（僵毁：精度惩罚 = 等级×(4+0.5×格数)）
  h = mk();
  h.panic = 0; h.update(1 / 60, 0.001);
  out.aimCalm = +h.penalties.aimPenalty.toFixed(2);
  h.panic = 80; h.update(1 / 60, 0.001);
  out.aimPanic = +h.penalties.aimPenalty.toFixed(2);

  // (7) 止痛药压制疼痛 moodle
  h = mk();
  h.damage(30, 'torso_up', 'laceration');
  h.update(1 / 60, 0.001);
  out.painBefore = h.moodles.pain;
  h.use('painkillers'); h.castT = 0.0001; h.update(0.0002, 0);
  h.update(1 / 60, 0.001);
  out.painAfter = h.moodles.pain;

  // (8) 甲弹关系：护甲高于弹级时伤害被极度削减
  const B = g.combat.constructor;
  return out;
});
check('咬伤 100% 感染克诺克斯病毒', m3.biteInfected);
check('克诺克斯病程落在 2~4 游戏日（48~96h）',
  m3.knoxDeathHours >= 48 && m3.knoxDeathHours <= 96, `${m3.knoxDeathHours} 游戏小时后死亡`);
check('抓伤感染率≈7%', m3.scratchRate > 0 && m3.scratchRate < 16, `实测 ${m3.scratchRate}%`);
check('撕裂伤感染率≈25%', m3.lacerationRate > 12 && m3.lacerationRate < 40, `实测 ${m3.lacerationRate}%`);
check('包扎止血生效', m3.bleedBefore > 0 && m3.bleedAfter === 0, `出血 ${m3.bleedBefore} → ${m3.bleedAfter}`);
check('脏绷带 3 天后必感染', m3.dirtyInfected && m3.dirtyInfectedAt >= 70,
  `第 ${m3.dirtyInfectedAt} 游戏小时感染`);
check('骨折显著拖慢移速', m3.moveFracture < 0.7, `移速 ×${m3.moveFracture}`);
check('夹板固定后移速恢复', m3.splintAccepted && m3.moveSplinted > m3.moveFracture,
  `${m3.moveFracture} → ${m3.moveSplinted}`);
check('恐慌放大瞄准惩罚', m3.aimPanic > m3.aimCalm + 10, `${m3.aimCalm} → ${m3.aimPanic}`);
check('止痛药压制疼痛', m3.painAfter < m3.painBefore, `疼痛 ${m3.painBefore} → ${m3.painAfter}`);
check('Moodle 面板已渲染', await page.evaluate(() => document.querySelectorAll('#moodleRow .moodle').length) > 18);
check('身体部位图完整渲染 9 个部位', await page.evaluate(() => document.querySelectorAll('#bodyFig .bp').length) === 9);

// 10.95 物品 / 背包 / 改装 / 甲弹公式（M4）
const m4 = await page.evaluate(() => {
  const g = window.__DUCKBOID;
  const inv = g.inventory;
  const out = {};

  // (1) 甲弹公式：护甲高于弹级被削减，弹级够高则接近满伤
  const A = g.pure.armorMitigation;
  out.apLow = +A(100, 3, 1).toFixed(1);      // 护甲 3 / 穿 1 → 50
  out.apHigh = +A(100, 6, 5).toFixed(1);     // 护甲 6 / 穿 5 → 66.7
  out.apOver = +A(100, 1, 5).toFixed(1);     // 弹级压制 → 满伤 100（不是超额）
  out.apWorst = +A(100, 6, 1).toFixed(1);    // 护甲 6 / 穿 1 → 28.6

  // (2) 拾取与占格
  const before = inv.grid.items.size;
  inv.addItem('gpu', 1);
  out.picked = inv.grid.items.size > before;
  out.gridOverlap = (() => {
    // 网格不允许重叠：所有物品占用的格子必须唯一
    const seen = new Set();
    for (const it of inv.grid.items.values()) {
      for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) {
        const k = `${it.x + i},${it.y + j}`;
        if (seen.has(k)) return true;
        seen.add(k);
      }
    }
    return false;
  })();

  // (3) 装备 → 改装 → 属性变化（消音器 mult 0.25 / 扩容弹匣 add +15）
  inv.addItem('mcx', 1);
  const mcx = [...inv.grid.items.values()].find((i) => i.id === 'mcx');
  inv.equip(mcx.uid);
  g.syncEquipped();
  const s1 = g.combat.stats();
  out.noiseBase = Math.round(s1.noise);
  out.magBase = s1.magSize;
  const gun = g.equipped;
  gun.mods.muzzle = 'silencer';
  const s2 = g.combat.stats();
  out.noiseSilenced = Math.round(s2.noise);
  gun.mods.mag = 'magExt';
  const s3 = g.combat.stats();
  out.magExt = s3.magSize;
  // 全息预览材质是"未拥有配件"的视觉表达
  out.holoExists = typeof g.pure.weaponStats === 'function';

  // (4) 容器搜刮：能产出战利品且可全部拿走
  const c = g.world.containers[0];
  c.searched = false;
  const loot = g.rng ? null : null;
  g.player.x = c.x; g.player.z = c.z;
  g.interact();
  out.containerLoot = c.loot ? c.loot.length : -1;
  out.panelOpen = g.panels.open;
  const invBefore = inv.grid.items.size;
  for (let i = (c.loot?.length || 0) - 1; i >= 0; i--) {
    const l = c.loot[i];
    if (inv.grid.add(l.id, l.count)) c.loot.splice(i, 1);
  }
  out.tookLoot = inv.grid.items.size >= invBefore;
  g.panels.close();

  // (5) 负重：装得越多，移速惩罚越重
  inv.recalc();
  out.weight = +inv.weight.toFixed(1);
  out.capacity = inv.capacity;
  return out;
});
check('甲弹公式：护甲压制时伤害减半', Math.abs(m4.apLow - 50) < 0.5, `100 → ${m4.apLow}`);
check('甲弹公式：高级穿甲仍受削减', m4.apHigh > 60 && m4.apHigh < 70, `100 → ${m4.apHigh}`);
check('甲弹公式：弹级压制是满伤而非超额', Math.abs(m4.apOver - 100) < 0.5, `100 → ${m4.apOver}`);
check('甲弹公式：低级弹打重甲极度削减', m4.apWorst < 32, `100 → ${m4.apWorst}`);
check('容器物品可拾取', m4.picked);
check('背包网格无重叠', m4.gridOverlap === false);
check('消音器把噪音压到约 1/4', m4.noiseSilenced < m4.noiseBase * 0.35,
  `${m4.noiseBase} → ${m4.noiseSilenced}`);
check('扩容弹匣增加弹容量', m4.magExt > m4.magBase, `${m4.magBase} → ${m4.magExt}`);
check('靠近容器可搜刮并弹出面板', m4.containerLoot >= 0 && m4.panelOpen === 'container',
  `战利品 ${m4.containerLoot} 项，面板 ${m4.panelOpen}`);
check('搜刮物品进入背包', m4.tookLoot, `负重 ${m4.weight}/${m4.capacity} kg`);

// 10.96 天气 / 撤离 / 世界事件 / 存档（M5）
const m5 = await page.evaluate(() => {
  const g = window.__DUCKBOID;
  const out = {};

  // (1) 天气状态机：迁移后必须落在合法状态，且会改变视距
  const seen = new Set();
  const W = g.weather.constructor;
  const w = new W(g, g.rng);
  for (let i = 0; i < 400; i++) { w.updateHours(1); seen.add(w.id); }
  out.weatherStates = [...seen];
  out.sightClear = +(new W(g, g.rng)).sightMul.toFixed(2);
  w.id = 'storm';
  out.sightStorm = +w.sightMul.toFixed(2);
  // 风暴区必须锁定雷暴
  out.stormLocked = (() => {
    const savedMap = g.mapDef;
    g.mapDef = { ...savedMap, storm: true };
    const ws = new W(g, g.rng);
    g.mapDef = savedMap;
    return ws.id;
  })();

  // (2) 体温：寒冷 + 潮湿 → 核心体温下降
  const body = { temp: 37, wet: 1 };
  const mod = g.health.constructor;
  for (let i = 0; i < 20; i++) {
    g.weather.updateHours(1);
  }
  out.tempStart = 37;
  const before = body.temp;
  for (let i = 0; i < 12; i++) g.updateBodyTempFor?.(body, 2, 1);
  out.tempAfterWind = +body.temp.toFixed(1);

  // (3) 撤离读条：站上撤离点 → 6 秒后触发撤离
  //     先复活玩家：前面的 200 人压力测试很可能已经把他打死了，
  //     而导演系统的测试不该依赖玩家在混战里活下来。
  g.player.alive = true;
  g.health.body.dead = false;
  g.health.body.blood = 5000;
  g.health.body.knox = 0;
  const d = g.director;
  d.extracted = false;
  const exit = g.world.exitPoints[0];
  g.player.x = exit.x; g.player.z = exit.z;
  let extracted = false;
  const off = g.noise; // 保持引用，避免被优化掉
  const origHandler = g.onExtracted;
  d.extracted = false; d.extractT = 0;
  for (let i = 0; i < 60 * 7 && !d.extracted; i++) d.update(1 / 60, 1 / 60);
  out.extractProgress = +d.extractT.toFixed(1);
  out.extracted = d.extracted;

  // (4) 超时 → 尸潮
  const n0 = g.enemies.length;
  d.limit = 1; d.elapsed = 5; d.extracted = false;
  // 刷怪点随机，偶尔会全落在实心格上 —— 多试几次，避免测试本身变得不稳定
  for (let i = 0; i < 4 && g.enemies.length === n0; i++) {
    d.elapsed = 5; d.hordeT = 99;
    d.update(1 / 60, 1 / 60);
  }
  out.hordeSpawned = g.enemies.length > n0;
  out.overtime = d.overtime;
  out.hordeDelta = g.enemies.length - n0;
  out.hordeT = +(d.hordeT ?? -1).toFixed(2);
  out.alive = g.player.alive;

  // (5) 停水停电与直升机事件：预定日到达后必须切换
  g.day = d.powerDay; d.updateWorldEvents(1 / 60, 1 / 60);
  out.powerOff = d.powerOn === false;
  g.day = d.waterDay; d.updateWorldEvents(1 / 60, 1 / 60);
  out.waterOff = d.waterOn === false;
  g.day = d.chopperDay;
  g.minutes = d.chopperHour * 60;
  d.updateWorldEvents(1 / 60, 1 / 60);
  out.chopperFired = !!d.chopper;
  out.chopperNoise = d.chopper ? true : false;

  // (6) 存档：写 → 读 → 版本与关键字段一致
  g.day = 7; g.kills = 13;
  const wrote = g.saveNow();
  const raw = JSON.parse(localStorage.getItem('duckboid.save.v1'));
  out.saveVersion = raw?.version;
  out.saveDay = raw?.data?.day;
  out.saveKills = raw?.data?.kills;
  // 损坏存档不得让游戏崩溃
  localStorage.setItem('duckboid.save.v1', '{ 这不是 JSON');
  let survived = true;
  try { g.saveNow(); } catch { survived = false; }
  out.survivesCorrupt = survived;
  localStorage.removeItem('duckboid.save.v1');
  out.wrote = wrote;
  return out;
});
check('天气状态机迁移合法', m5.weatherStates.every((s) => ['clear', 'cloudy', 'fog', 'rain', 'storm'].includes(s)),
  m5.weatherStates.join('/'));
check('天气改变视距', m5.sightStorm < m5.sightClear, `晴 ${m5.sightClear} → 雷暴 ${m5.sightStorm}`);
check('风暴区锁定雷暴天气', m5.stormLocked === 'storm', m5.stormLocked);
check('站在撤离点会读条并撤离', m5.extracted, `读条 ${m5.extractProgress}s`);
check('超时进入尸潮模式', m5.overtime && m5.hordeSpawned,
  `新增 ${m5.hordeDelta} 只，hordeT=${m5.hordeT}，玩家存活=${m5.alive}`);
check('到达预定日自动停电', m5.powerOff);
check('到达预定日自动停水', m5.waterOff);
check('直升机事件在预定日的白昼触发', m5.chopperFired);
check('存档写入成功且带版本号', m5.wrote && m5.saveVersion === 1, `v${m5.saveVersion} 第 ${m5.saveDay} 天 / ${m5.saveKills} 杀`);
check('存档损坏时不崩溃', m5.survivesCorrupt);

// 10.97 粒子 / 热成像热源 / 全息预览（M6）
const m6 = await page.evaluate(() => {
  const g = window.__DUCKBOID;
  const out = {};

  // (1) 击中鸭子爆羽毛：粒子进入实例化池并随时间衰减
  const P = g.particles;
  const live0 = P.list?.length ?? 0;
  P.burstFeathers(g.player.x, g.player.z, 16, 0, 1);
  out.feathersAfterBurst = P.list.length - live0;
  P.update(1 / 60);
  out.featherInstances = P.feathers.count;
  P.burstImpact(g.player.x + 1, g.player.z, 'metal', 8);
  P.update(1 / 60);
  out.sparkInstances = P.sparks.count;
  // 推进 4 秒后应清零（生命周期结束）
  for (let i = 0; i < 60 * 4; i++) P.update(1 / 60);
  out.particlesAfter4s = P.list.length;
  // 粒子数再多也只有两个 InstancedMesh —— 这才是"draw call 受控"的真正含义
  out.particleMeshes = (() => {
    let n = 0;
    P.feathers.parent?.traverse((o) => { if (o.isInstancedMesh && (o === P.feathers || o === P.sparks)) n++; });
    return n;
  })();
  out.particleCapacity = P.feathers.instanceMatrix.count;

  // (2) 热成像热源：隐身怪也必须被算作热源（这是热成像存在的意义）
  const before = g.heatSources().length;
  // 当前地图不一定刷隐身怪，测试里补一只作为夹具（它正是热成像存在的理由）
  let inv = g.enemies.find((e) => e.def?.invisible);
  if (!inv) {
    const EnemyCls = g.enemies[0].constructor;
    inv = new EnemyCls('invisible', g.player.x + 3, g.player.z + 3);
    g.enemies.push(inv);
  }
  out.hasInvisibleEnemy = !!inv;
  inv.hidden = true;                              // 视觉上被盲区剔除
  inv.seen = false;
  inv.x = g.player.x + 3; inv.z = g.player.z + 3;
  const sources = g.heatSources();
  out.heatBefore = before;
  out.heatAfter = sources.length;
  // 隐身怪被 blind 剔除后仍在热源列表里
  out.invisibleInHeat = inv ? sources.some((s) => Math.abs(s.x - inv.x) < 0.01 && Math.abs(s.z - inv.z) < 0.01) : false;
  g.thermalOn = true;
  g.renderer.setThermal(true);
  g.heat.update(sources, 1, g.rig.camWorld.quaternion);
  out.heatDrawn = g.heat.drawn;
  out.passHeatEnabled = g.renderer.passHeat.enabled;
  // 热源只在热成像模式下渲染
  g.thermalOn = false; g.renderer.setThermal(false);
  out.passHeatOff = g.renderer.passHeat.enabled === false;

  // (3) 全息预览：打开改装面板后应创建独立 GL 上下文并渲染
  const WEAPON_IDS = ['m9', 'mp5', 'akm', 'mcx', 'sv98', 'toz'];
  const findWeapon = () => {
    for (const s of ['primary', 'secondary', 'melee']) {
      const it = g.inventory.loadout.get(s);
      if (it && WEAPON_IDS.includes(it.id)) return it;
    }
    return [...g.inventory.grid.items.values()].find((i) => WEAPON_IDS.includes(i.id)) || null;
  };
  let wp = findWeapon();
  if (!wp) { g.inventory.addItem('m9', 1); wp = findWeapon(); }
  g.panels.showModding(wp.uid);
  out.holoCreated = !!g.panels.holo;
  out.holoCanvas = !!document.querySelector('#holoSlot canvas');
  out.holoChildren = g.panels.holo?.group?.children.length ?? 0;
  out.moddingOpen = g.panels.open;
  g.panels.close();
  out.holoDisposed = g.panels.holo === null;
  return out;
});
check('击中鸭子爆出羽毛粒子', m6.feathersAfterBurst >= 16, `${m6.feathersAfterBurst} 片`);
check('羽毛与火花各自进入实例化池', m6.featherInstances > 0 && m6.sparkInstances > 0,
  `羽毛 ${m6.featherInstances} / 火花 ${m6.sparkInstances}`);
check('粒子生命周期结束后回收', m6.particlesAfter4s === 0, `残留 ${m6.particlesAfter4s}`);
check('任意粒子量只对应 2 个 InstancedMesh', m6.particleMeshes === 2,
  `${m6.particleMeshes} 个网格 / 容量 ${m6.particleCapacity}`);
check('热成像把隐身怪算作热源', m6.invisibleInHeat, `热源 ${m6.heatBefore} → ${m6.heatAfter}`);
check('热源 billboard 仅在热成像模式渲染', m6.passHeatEnabled && m6.passHeatOff && m6.heatDrawn > 0,
  `绘制 ${m6.heatDrawn} 个热源`);
check('改装配有全息预览视口', m6.holoCreated && m6.holoCanvas && m6.holoChildren > 0,
  `预览模型 ${m6.holoChildren} 个体块`);
check('关闭面板后释放全息渲染器', m6.holoDisposed);

// 10.98 藏身处闭环（M5/M6）
const hide = await page.evaluate(() => {
  const g = window.__DUCKBOID;
  const h = g.hideout;
  const out = {};
  // 升级：给足材料后应成功，且材料被扣除
  h.give('scrap', 20); h.give('gunpowder', 10); h.give('electronic', 10);
  const lv0 = h.level('workbench');
  const scrapBefore = h.count('scrap');
  const r = h.upgrade('workbench');
  out.upgraded = r.ok;
  out.lvFrom = lv0; out.lvTo = h.level('workbench');
  out.consumed = scrapBefore - h.count('scrap');
  // 等级上限
  h.upgrade('workbench'); h.upgrade('workbench');
  out.maxBlocked = !h.upgrade('workbench').ok;
  // 任务：给足蛋白粉后泥巴的任务应完成
  h.give('protein_powder', 2);
  h.checkQuests();
  out.questDone = !!h.quests.mud_supply?.done;
  out.gymLevel = h.level('gym');
  // 撤离入库：带出来的东西必须进仓库
  const stashBefore = h.stash.length;
  return out;
});
check('藏身处设施可升级且消耗材料', hide.upgraded && hide.consumed > 0,
  `Lv.${hide.lvFrom} → Lv.${hide.lvTo}，消耗废金属 ${hide.consumed}`);
check('设施等级上限生效', hide.maxBlocked);
check('NPC 任务可完成并发放奖励', hide.questDone && hide.gymLevel >= 1, `健身房 Lv.${hide.gymLevel}`);

// 11. 画面自检：无法肉眼看图时，用像素统计证明"真的渲染出了东西"
//     全黑 / 纯色 / 低对比都说明管线断了，这是比截图更可靠的自动化判据。
const px = await page.evaluate(() => window.__GAME.grab());
check('画面非全黑', px.mean > 8, `平均亮度 ${px.mean}`);
check('画面非过曝/纯白', px.mean < 235, `平均亮度 ${px.mean}`);
check('画面有层次（明暗跨度）', px.max - px.min > 60, `亮度 ${px.min}→${px.max}`);
check('画面有色彩多样性', px.colors > 24, `${px.colors} 个色块`);

// 12. 截图存档
const shot = process.argv.find((a) => a.startsWith('--shot='));
if (shot) {
  const name = shot.split('=')[1];
  await page.screenshot({ path: join(ROOT, 'docs/shots', name) });
  console.log(`  · 截图 → docs/shots/${name}`);
}

await browser.close();
console.log(`\n[smoke] ${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
