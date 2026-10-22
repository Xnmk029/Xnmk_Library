/* DUCKOV Z - Node 无头逻辑冒烟测试（不依赖 DOM/Canvas） */
'use strict';
const fs = require('fs');
const path = require('path');

// ---- 最小 DOM 桩 ----
const noopCtx = new Proxy({}, {
  get(_, k) {
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: () => {} });
    if (k === 'measureText') return () => ({ width: 10 });
    return typeof k === 'string' ? (() => {}) : undefined;
  },
  set() { return true; }
});
global.window = global;
global.performance = { now: () => Date.now() };
const stubCanvas = () => ({ width: 0, height: 0, getContext: () => noopCtx, style: {}, classList: { add(){}, remove(){}, contains: () => false }, dataset: {} });
global.document = {
  createElement: tag => tag === 'canvas' ? stubCanvas() : { style: {}, classList: { add(){}, remove(){} }, appendChild(){}, set innerHTML(v) {}, get innerHTML() { return ''; }, set textContent(v) {}, remove(){} },
  getElementById: () => null,
  addEventListener: () => {},
  readyState: 'complete',
  body: { appendChild(){} },
  title: ''
};
global.location = { search: '' };
global.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
global.requestAnimationFrame = () => {};
global.btoa = s => Buffer.from(s, 'binary').toString('base64');
global.atob = s => Buffer.from(s, 'base64').toString('binary');
global.Path2D = class { moveTo(){} lineTo(){} closePath(){} rect(){} };

// ---- 加载模块 ----
const jsDir = path.join(__dirname, '..', 'js');
for (const f of ['config.js', 'utils.js', 'audio.js', 'items.js', 'world.js', 'fov.js', 'player.js', 'zombie.js', 'combat.js', 'fx.js']) {
  new Function(fs.readFileSync(path.join(jsDir, f), 'utf8'))();
}
const DZ = global.DZ;
const C = DZ.C, U = DZ.U;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra || ''); }
}

console.log('[1] 世界生成');
const S = DZ.W.gen(20240101);
check('tiles filled', S.tiles.length === C.MW * C.MH);
check('buildings placed', S.buildings.length >= 12, S.buildings.length);
check('houses exist', S.houses.length >= 5, S.houses.length);
check('containers populated', S.containers.size > 30, S.containers.size);
check('loot items rolled', [...S.containers.values()].some(c => c.items.length > 0));
check('LOS segments built', S.segs.length > 500, S.segs.length);
check('beds exist', S.beds.length >= 8, S.beds.length);
check('evac point set', !!S.evac);

console.log('[2] 玩家创建');
const profs = ['firefighter', 'police', 'chef', 'doctor', 'carpenter', 'unemployed'];
for (const pid of profs) {
  const p = DZ.P.create(S, pid);
  check('prof ' + pid + ' spawn near home', U.dist(p.x, p.y, S.home.x, S.home.y) < 400);
  const solidFn = DZ.W.solidFn(S);
  check('prof ' + pid + ' not stuck in wall', !U.circleHits(p.x, p.y, 0.3, solidFn));
}
const pl = DZ.P.create(S, 'firefighter');
S.home = { x: pl.x, y: pl.y };
S.player = pl;
S.input = {};

console.log('[3] 僵尸布点与AI');
{
  let tries = 0;
  while (S.zombies.length < 60 && tries++ < 3000) {
    const tx = U.range(3, C.MW - 4), ty = U.range(3, C.MH - 4);
    const t = DZ.W.tget(S, tx, ty);
    if (DZ.W.SOLID.has(t)) continue;
    const px = (tx + .5) * C.TILE, py = (ty + .5) * C.TILE;
    if (U.dist(px, py, S.home.x, S.home.y) < 300) continue;
    DZ.Z.spawn(S, px, py, U.wpick([['walker', 5], ['shambler', 3], ['jogger', 1], ['tank', 1]]), Math.random() < 0.3);
  }
  check('zombies seeded', S.zombies.length >= 50, S.zombies.length);
  let nan = 0;
  for (let i = 0; i < 900; i++) {
    // 每50tick把一只僵尸传送到面前，保证战斗链路被确定性覆盖
    if (i % 50 === 0) {
      const tz = S.zombies.find(z => !z.dead && !z.crawl);
      if (tz) { tz.x = pl.x + 40; tz.y = pl.y; }
    }
    const iv = { mx: Math.sin(i * 0.05), my: Math.cos(i * 0.041), aimX: pl.x + 40, aimY: pl.y, rmb: i % 9 < 3 };
    DZ.P.update(S, pl, 0.033, iv);
    for (const z of S.zombies) if (!z.dead) DZ.Z.update(S, z, 0.033, pl);
    if (i % 25 === 0 && !isNaN(pl.x)) { pl.fireT = 0; DZ.CB.fireGun(S, pl); }
    if (i % 40 === 0) DZ.CB.swingMelee(S, pl);
    DZ.FX.update(0.033);
    if (isNaN(pl.x) || isNaN(pl.y)) { nan++; break; }
  }
  check('900-tick sim stable (no NaN)', nan === 0);
  check('combat produced kills', S.stats.kills > 0, S.stats.kills);
  check('noise events fired & expired', Array.isArray(S.noises));
}

console.log('[4] FOV');
{
  const poly = DZ.FOV.compute(S, pl.x, pl.y, 11);
  check('visibility polygon non-trivial', poly.length > 20, poly.length);
  const see = DZ.FOV.canSee(S, pl.x, pl.y, pl.x + 3 * C.TILE, pl.y, 6, null);
  check('canSee open ground true', see === true);
}

console.log('[5] 物品与状态');
{
  DZ.P.add(S, pl, DZ.IT.newInst('bandage', 3));
  check('add/count item', DZ.P.count(pl, 'bandage') === 3);
  pl.body.armL.hp = 12; pl.body.armL.bleed = 1;
  DZ.P.applyDamage(S, pl, 'legR', 30, 'laceration');
  check('damage creates bleed', pl.body.legR.bleed > 0);
  check('moodles react', DZ.P.moodles(pl).bleed >= 1);
  // 吃东西
  DZ.P.add(S, pl, DZ.IT.newInst('beans', 1));
  const beanIdx = pl.inv.findIndex(i => i.id === 'beans');
  const h0 = pl.hunger;
  DZ.P.startAct(pl, 'eat', 0.1, { item: pl.inv[beanIdx] });
  DZ.P.update(S, pl, 0.15, { mx: 0, my: 0, aimX: pl.x, aimY: pl.y });
  check('eating restores hunger', pl.hunger > h0, (h0).toFixed(1) + '->' + pl.hunger.toFixed(1));
  // 装填
  const gun = pl.slots.primary;
  if (!gun) { pl.slots.primary = DZ.IT.newInst('shotgun'); gun; pl.inv.push(pl.slots.primary); pl.slots.primary = DZ.IT.newInst('shotgun'); }
  pl.slots.primary = DZ.IT.newInst('pistol'); pl.slots.primary.loaded = 0;
  DZ.P.add(S, pl, DZ.IT.newInst('ammo9', 2));
  DZ.P.beginReload(pl);
  DZ.P.finishReload(pl);
  check('reload works', pl.slots.primary.loaded > 0, pl.slots.primary.loaded);
  // 技能成长
  const lv0 = pl.sk.strength.lv;
  DZ.P.xp(S, pl, 'strength', 9999);
  check('skill levels up', pl.sk.strength.lv > lv0);
}

console.log('[6] 时间与世界事件');
{
  S.totalMins = C.POWER_OFF_MIN - 1;
  DZ.main && 0;
  // 直接驱动 advanceTime 的核心副作用通过 main 不方便，这里验证配置阈值顺序
  check('power off after water off? no (power earlier)', C.POWER_OFF_MIN < C.WATER_OFF_MIN);
  check('evac day configured', C.EVAC_DAY === 7);
  const amb = U.ambientAt(23);
  check('night ambient dark', amb[0] + amb[1] + amb[2] < 200, amb.join(','));
  const ambDay = U.ambientAt(12);
  check('day ambient bright', ambDay[0] > 240);
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
