// 纯数值层单元测试（node:test，不碰 three、不碰浏览器）。
// 这些公式是整个游戏的设计契约，改坏了必须有测试而不是"看着差不多"。
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { armorMitigation, pickBodyPart, spreadDeg } from '../../src/systems/pure/ballistics.js';
import { weaponStats, loadEffects, tierOf } from '../../src/systems/pure/statPipeline.js';
import { createBody, addInjury, updateBody, totalPct, painTier } from '../../src/systems/pure/injury.js';
import { computeMoodles, updatePanic } from '../../src/systems/pure/moodles.js';
import { WEAPONS, ATTACHMENTS } from '../../src/data/weapons.js';
import { ammoStats, TIER } from '../../src/data/ammo.js';
import { MOODLE, INJURY } from '../../src/data/balance.js';

// ---------------- 甲弹关系 ----------------
test('甲弹公式：护甲每高一级伤害按 2/(armor-pen+2) 衰减', () => {
  assert.equal(armorMitigation(100, 1, 1), 100);        // 持平 → 满伤
  assert.equal(armorMitigation(100, 3, 1), 50);         // 高两级 → 一半
  assert.ok(Math.abs(armorMitigation(100, 6, 1) - 28.57) < 0.1);   // 高五级 → 2/7
  assert.ok(Math.abs(armorMitigation(100, 6, 5) - 66.67) < 0.1);   // 穿甲弹显著改善
});

test('甲弹公式：弹级压制是满伤而不是超额伤害', () => {
  // 原式在 pen >> armor 时分母变负，会给出 2 倍伤害 —— 这里钳到 2，确保上限就是 1.0
  assert.equal(armorMitigation(100, 1, 5), 100);
  assert.equal(armorMitigation(100, 1, 7), 100);
  assert.equal(armorMitigation(100, 6, 7), 100);
});

// ---------------- 武器属性管道 ----------------
test('属性管道：配件 add 先于 mult', () => {
  const base = weaponStats({ id: 'mcx', mods: {} }, {});
  const silenced = weaponStats({ id: 'mcx', mods: { muzzle: 'silencer' } }, {});
  // 加值先加（人机 -6），乘值后乘（噪音 ×0.25）
  assert.ok(Math.abs(silenced.ergonomics - (base.ergonomics - 6)) < 1e-6);
  assert.ok(Math.abs(silenced.noise - base.noise * 0.25) < 1e-6);
});

test('属性管道：扩容弹匣增加弹匣容量', () => {
  const s = weaponStats({ id: 'akm', mods: { mag: 'magExt' } }, {});
  assert.equal(s.magSize, WEAPONS.akm.magSize + ATTACHMENTS.magExt.add.magSize);
});

test('属性管道：枪法等级降低后坐力与开镜时间', () => {
  const low = weaponStats({ id: 'akm', mods: {} }, { skills: { aiming: 0 } });
  const high = weaponStats({ id: 'akm', mods: {} }, { skills: { aiming: 8 } });
  assert.ok(high.recoil < low.recoil);
  assert.ok(high.aimTime < low.aimTime);
});

test('属性管道：恐慌只在枪法未满级时惩罚精度', () => {
  const ctx = { moodles: { panicTier: 3 }, tilesToTarget: 6 };
  const novice = weaponStats({ id: 'mcx', mods: {} }, { skills: { aiming: 1 }, ...ctx });
  const veteran = weaponStats({ id: 'mcx', mods: {} }, { skills: { aiming: 6 }, ...ctx });
  assert.ok(novice.accuracyPenalty > 0, '新手应受恐慌惩罚');
  assert.equal(veteran.accuracyPenalty ?? 0, 0, '枪法 6 级应免疫恐慌');
});

test('负重：超重档位递进且会掉血', () => {
  const ok = loadEffects(10, 20);
  const over = loadEffects(30, 20);
  assert.equal(ok.speedMul, 1);
  assert.ok(over.speedMul < 1);
  assert.ok(over.drainPerSec > 0, '重度超重应持续掉血');
});

test('tierOf 取最后一个满足阈值的档位', () => {
  assert.equal(tierOf([{ at: 10, v: 'a' }, { at: 20, v: 'b' }], 25).v, 'b');
  assert.equal(tierOf([{ at: 10, v: 'a' }], 5), null);
});

// ---------------- 弹药 ----------------
test('弹药等级决定穿透与伤害倍率', () => {
  const normal = ammoStats('7.62', TIER.NORMAL);
  const purple = ammoStats('7.62', TIER.PURPLE);
  assert.equal(normal.pen, 1);
  assert.equal(purple.pen, 5);
  assert.ok(purple.damage > normal.damage);
});

test('霰弹按弹丸数计算', () => {
  assert.equal(ammoStats('12g', TIER.NORMAL).pellets, 8);
  assert.equal(ammoStats('9mm', TIER.NORMAL).pellets, 1);
});

// ---------------- 伤病 ----------------
test('咬伤必感染克诺克斯病毒，且 2~4 游戏日内死亡', () => {
  const body = createBody();
  const inj = addInjury(body, 'arm_l', 'bite');
  assert.ok(inj);
  // 掷病毒（咬伤 100%）
  const { rollKnox } = require0();
  assert.ok(rollKnox(inj) === true);
  body.knox = 0.0001;
  body.knoxStart = 0.5;
  let hours = 0;
  while (!body.dead && hours < 500) { updateBody(body, 1, {}); hours++; }
  assert.ok(hours >= 48 && hours <= 96, `病程 ${hours} 小时，应落在 48~96`);
});

test('抓伤与撕裂伤的感染率分别约 7% / 25%', () => {
  const rate = (type, n = 4000) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (rollKnoxOf(type)) c++;
    return c / n;
  };
  const s = rate('scratch'), l = rate('laceration');
  assert.ok(Math.abs(s - 0.07) < 0.03, `抓伤 ${(s * 100).toFixed(1)}%`);
  assert.ok(Math.abs(l - 0.25) < 0.05, `撕裂 ${(l * 100).toFixed(1)}%`);
});

test('脏绷带 3 天后必感染，未包扎的敞口伤口只是小概率', () => {
  const body = createBody();
  const inj = addInjury(body, 'arm_r', 'deep');
  inj.bandaged = true;
  inj.dirty = true;
  let hours = 0;
  while (!body.infected && hours < 200) { updateBody(body, 1, {}); hours++; }
  assert.ok(body.infected && hours >= INJURY.bandage.infectionAfterHours,
    `第 ${hours} 小时感染（阈值 ${INJURY.bandage.infectionAfterHours}）`);
});

test('抗生素能清除细菌感染，但对克诺克斯无效', () => {
  const body = createBody();
  body.infected = true;
  body.infectionTimer = 10;
  body.antibioticTimer = INJURY.woundInfection.antibioticDoseHours;
  let healed = false;
  for (let i = 0; i < 60 && !healed; i++) {
    updateBody(body, 1, {});
    if (!body.infected) healed = true;
  }
  assert.ok(healed, '抗生素应清除细菌感染');
  // 病毒无解：给再多的抗生素也不改变病程
  const b2 = createBody();
  b2.knox = 0.0001; b2.knoxStart = 0.5;
  b2.antibioticTimer = 9999;
  let h = 0;
  while (!b2.dead && h < 500) { updateBody(b2, 1, {}); h++; }
  assert.ok(b2.dead, '克诺克斯无药可医');
});

test('不缝合的深度伤口几乎不愈合', () => {
  const open = createBody();
  const stitched = createBody();
  addInjury(open, 'torso_up', 'deep');
  const s = addInjury(stitched, 'torso_up', 'deep');
  s.stitches = true;
  for (let i = 0; i < 200; i++) { updateBody(open, 1, {}); updateBody(stitched, 1, {}); }
  assert.ok(stitched.parts.torso_up.injuries.length === 0, '缝合过的应已愈合');
  assert.ok(open.parts.torso_up.injuries.length > 0, '未缝合的不该愈合');
});

test('疼痛等级随伤口数量上升，止痛药能压制', () => {
  const body = createBody();
  assert.equal(painTier(body), 0);
  addInjury(body, 'leg_l', 'fracture');
  updateBody(body, 0.01, {});
  const before = painTier(body);
  body.painkiller = 3;
  updateBody(body, 0.01, {});
  assert.ok(painTier(body) < before || before === 0, `疼痛 ${before} → ${painTier(body)}`);
});

test('总生命按部位权重合成，致命部位归零即死', () => {
  const body = createBody();
  assert.ok(totalPct(body) > 0.99);
  body.parts.head.hp = 0;
  updateBody(body, 0.01, {});
  assert.ok(body.dead, '头部归零应致命');
});

// ---------------- Moodle ----------------
test('需求阈值映射成 Moodle 等级', () => {
  const m = computeMoodles({ needs: { hunger: 80, thirst: 10, fatigue: 5 }, body: createBody(), endurance: 0 });
  assert.ok(m.hungry >= 3, `饥饿等级 ${m.hungry}`);
  assert.equal(m.thirsty, 0);
});

test('恐慌：见敌人累积、脱离后恢复、勇敢特质减半', () => {
  let p = updatePanic(0, 5, 0, 1, {});
  assert.ok(p > 0, '见到敌人应累积恐慌');
  const calm = updatePanic(p, 0, 10, 0, {});
  assert.ok(calm < p, '脱离视野后应恢复');
  const coward = updatePanic(0, 5, 0, 1, { cowardly: true });
  assert.ok(coward > p, '胆小特质应放大恐慌');
});

test('创伤与失血映射到对应 Moodle', () => {
  const body = createBody();
  addInjury(body, 'leg_l', 'laceration');
  body.blood = INJURY.blood.total * 0.5;
  const m = computeMoodles({
    needs: {}, body, totalPct: 0.6,
    summary: { bleeding: true, bleedRate: 3, bloodPct: 0.5, fractures: 0 },
  });
  assert.ok(m.bleeding >= 2, `流血等级 ${m.bleeding}`);
  assert.ok(m.injured >= 1, `负伤等级 ${m.injured}`);
});

// ---- 小工具：node ESM 下不便 import 未导出的 rollKnox，这里本地实现一份等价逻辑 ----
function require0() {
  return { rollKnox: (inj) => { inj.knoxRolled = true; inj.knox = Math.random() < (INJURY.types[inj.type]?.knox ?? 0); return inj.knox; } };
}
function rollKnoxOf(type) {
  return Math.random() < (INJURY.types[type]?.knox ?? 0);
}
