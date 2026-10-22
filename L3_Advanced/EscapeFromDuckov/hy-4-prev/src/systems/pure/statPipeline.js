// 属性合成管道：九阶段固定顺序。顺序本身就是设计契约 —— 换顺序会改变结果，
// 所以这个文件的阶段表是唯一真源，其它地方禁止自己算属性。
import { SKILL, COMBAT, MOODLE, INJURY } from '../../data/balance.js';
import { WEAPONS, ATTACHMENTS } from '../../data/weapons.js';
import { ammoStats } from '../../data/ammo.js';

export const CHANNELS = [
  'damage', 'rpm', 'recoil', 'ergonomics', 'noise', 'range', 'spread',
  'aimTime', 'weight', 'magSize', 'moveSpeed', 'meleeDamage', 'attackSpeed',
  'critChance', 'accuracy', 'sightRange', 'carryCapacity', 'healingRate',
];

/**
 * 阶段顺序：
 *  1 基础值 → 2 配件加值 → 3 配件乘值 → 4 弹药 → 5 技能
 *  → 6 Moodle → 7 环境 → 8 特质 → 9 钳制
 */
export function weaponStats(instance, ctx = {}) {
  const def = WEAPONS[instance.id];
  if (!def) return null;
  const s = { ...def.base, magSize: def.magSize, weight: def.base.weight || 0 };

  // 2) 配件加值
  if (instance.mods) {
    for (const slot in instance.mods) {
      const a = ATTACHMENTS[instance.mods[slot]];
      if (!a) continue;
      for (const k in a.add || {}) s[k] = (s[k] ?? 0) + a.add[k];
    }
  }
  // 3) 配件乘值
  if (instance.mods) {
    for (const slot in instance.mods) {
      const a = ATTACHMENTS[instance.mods[slot]];
      if (!a) continue;
      for (const k in a.mult || {}) s[k] = (s[k] ?? 0) * a.mult[k];
    }
  }
  // 4) 弹药（近战无弹药）
  if (def.caliber && instance.ammo) {
    const am = typeof instance.ammo === 'string' ? ammoStats(def.caliber, 1) : instance.ammo;
    s.damage = am.damage;
    s.pen = am.pen;
    s.pellets = am.pellets || 1;
    s.noise = (s.noise ?? 60) * (am.noise / 60);
    s.tracer = am.tracer;
  }
  // 5) 技能：枪法减后坐、减散布；灵巧降低脚步噪音
  const sk = ctx.skills || {};
  const aiming = sk.aiming ?? 0;
  s.recoil = Math.max(0, (s.recoil ?? 0) + aiming * SKILL.aiming.recoilPerLevel);
  if (aiming >= 3) { s.spread = (s.spread ?? 2) * (1 - 0.04 * aiming); s.range = (s.range ?? 20) * (1 + 0.05 * aiming); }
  s.aimTime = (s.aimTime ?? 0.3) * (1 - 0.045 * aiming);
  if (sk.maintenance) s.jamChance = COMBAT.jamChanceBase * (1 - 0.06 * sk.maintenance);

  // 6) Moodle：恐慌放大散布（枪法 ≥6 级免疫）、耐力砍近战伤害
  const moodles = ctx.moodles || {};
  if (moodles.panicTier > 0 && aiming < SKILL.aiming.panicImmuneLevel) {
    const penalty = moodles.panicTier * (MOODLE.panicAccuracy.base + MOODLE.panicAccuracy.perTile * (ctx.tilesToTarget ?? 0));
    s.accuracyPenalty = penalty;
  }
  if (moodles.enduranceTier) {
    const e = tierOf(MOODLE.endurance, moodles.enduranceSpent ?? 0, 'at');
    if (e) { s.meleeMul = e.melee; s.attackSpeedMul = (s.attackSpeedMul ?? 1) * e.atkSpeed; }
  }
  if (moodles.painTier > 0) s.meleeMul = (s.meleeMul ?? 1) * INJURY.pain.meleeDamageMul[Math.min(4, moodles.painTier)];

  // 7) 环境：低温、黑暗、雨天
  if (ctx.env) {
    if (ctx.env.hypoTier > 0) {
      const hypo = tierOf(MOODLE.hypo, ctx.env.coreTemp ?? 37, 'at', true);
      s.meleeMul = (s.meleeMul ?? 1) * (hypo?.combat ?? 1);
    }
    if (ctx.env.dark && !ctx.env.thermal) s.range = (s.range ?? 20) * 0.8;
  }
  // 8) 特质
  if (ctx.traits) {
    if (ctx.traits.brave) s.panicMul = 0.3;
    if (ctx.traits.cowardly) s.panicMul = 2;
    if (ctx.traits.strong) s.carryBonus = (s.carryBonus ?? 0) + 2.5;
  }
  // 9) 钳制
  s.spread = Math.max(0.05, s.spread ?? 2);
  s.recoil = Math.max(0, s.recoil ?? 0);
  s.aimTime = Math.max(0.05, s.aimTime ?? 0.3);
  return s;
}

/** 在一组按阈值排序的档位里取最后一个满足的档位 */
export function tierOf(list, value, key = 'at', descending = false) {
  let out = null;
  for (const e of list) {
    const hit = descending ? value <= e[key] : value >= e[key];
    if (hit) out = e;
  }
  return out;
}

/** 负重：容量占比 → 移速/暴击/攻速惩罚 + 超重掉血 */
export function loadEffects(carried, capacity) {
  const ratio = capacity > 0 ? carried / capacity : 2;
  const t = tierOf(MOODLE.heavyLoad, ratio, 'at');
  return {
    ratio,
    speedMul: t?.speed ?? 1,
    critAdd: t?.crit ?? 0,
    atkSpeedMul: t?.atkSpeed ?? 1,
    noSprint: !!t?.noSprint,
    noRun: !!t?.noRun,
    drainPerSec: t?.drain ?? 0,
    drainTo: t?.drainTo ?? 0,
  };
}

export const carryCapacity = (strength = 5, traits = {}, backpack = 0) =>
  COMBAT.carry.base + strength * COMBAT.carry.perStrength + (traits.strong ? 2.5 : 0) + backpack;
