// 弹道与甲弹关系（纯逻辑，不依赖 three —— 可直接在 node 里单测）
import { COMBAT } from '../../data/balance.js';
import { BODY } from '../../data/balance.js';

/**
 * 文档 §4.2 原式的护甲穿透：
 *   实际伤害 = 基础伤害 × 2 / (护甲等级 − 子弹穿透等级 + 2)
 * 护甲高于弹级时伤害被极度削减；弹级等于或高于护甲时接近满伤。
 */
export function armorMitigation(base, armorLvl, penLvl) {
  const denom = armorLvl - penLvl + 2;
  // 钳到 2：弹级高于护甲时是"满额伤害"而不是超额伤害
  // （原式在 pen≫armor 时会出现 2 倍伤害，与"近乎满额"的设定不符）
  return base * (2 / Math.max(2, denom));
}

/** Boss 的正面盾（路障 6 级盾减伤 80%） */
export function directionalMul(target, hitAngleToTargetFacing) {
  if (!target.shield) return 1;
  const arc = target.shield.frontalArc ?? 1.5;
  return Math.abs(hitAngleToTargetFacing) <= arc / 2 ? (target.shield.damageMul ?? 0.2) : 1;
}

/** 部位命中：按相对高度与偏移抽一个部位 */
export function pickBodyPart(rng, { aimed = false, coverLow = false } = {}) {
  // 俯视角下"爆头"靠瞄准精度，不是靠玩家手动选部位
  const r = rng();
  if (aimed) {
    if (r < 0.16) return 'head';
    if (r < 0.28) return 'neck';
    if (r < 0.70) return rng() < 0.5 ? 'torso_up' : 'torso_low';
    if (r < 0.86) return rng() < 0.5 ? 'arm_l' : 'arm_r';
    return rng() < 0.5 ? 'leg_l' : 'leg_r';
  }
  if (coverLow) {                       // 躲在矮掩体后：只能打到上半身
    if (r < 0.12) return 'head';
    if (r < 0.62) return rng() < 0.5 ? 'torso_up' : 'torso_low';
    return rng() < 0.5 ? 'arm_l' : 'arm_r';
  }
  if (r < 0.06) return 'head';
  if (r < 0.09) return 'neck';
  if (r < 0.52) return rng() < 0.5 ? 'torso_up' : 'torso_low';
  if (r < 0.72) return rng() < 0.5 ? 'arm_l' : 'arm_r';
  return rng() < 0.5 ? 'leg_l' : 'leg_r';
}

/** 单次命中的完整结算：护甲 → 部位倍率 → 暴击 → 方向盾 */
export function resolveHit(rng, attacker, target, part, ammo, opts = {}) {
  const base = ammo.damage * (opts.damageMul ?? 1);
  const armorLvl = target.armorLevel ?? target.armor ?? 0;
  let dmg = armorMitigation(base, armorLvl, ammo.pen);

  // 部位倍率：头部致命但难中
  const partMul = part === 'head' ? 1.9 : part === 'neck' ? 1.5
    : part.startsWith('arm') ? 0.72 : part.startsWith('leg') ? 0.78 : 1.0;
  dmg *= partMul;

  const critChance = (COMBAT.critBase + (opts.critBonus ?? 0)) * (part === 'head' ? COMBAT.critHeadMul : 1);
  const crit = rng() < critChance;
  if (crit) dmg *= 1.85;

  dmg *= directionalMul(target, opts.angleToFacing ?? Math.PI);
  dmg *= (target.incomingMul ?? 1);
  return { damage: Math.max(1, dmg), crit, part, armorLvl, pen: ammo.pen };
}

/** 后坐力 → 散布角（度）。瞄准技能每级 −2，下限 0 */
export function spreadDeg(stats, opts = {}) {
  let s = stats.spread ?? 2;
  s *= (opts.aimMul ?? 1);
  s *= 1 + (opts.panicTier ?? 0) * 0.18;          // 恐慌放大散布
  s *= 1 + (opts.endurance ?? 0) * 0.35;          // 体力见底手会抖
  s *= (opts.moving ? 1.45 : 1) * (opts.sprinting ? 1.7 : 1);
  s *= opts.aiming ? 0.55 : 1;                     // 右键稳定瞄准
  s *= opts.sneaking ? 0.9 : 1;
  return Math.max(0.05, s);
}

/** 伤害 → 生命/部位扣减（M3 的伤病系统接在这里） */
export function applyDamageToBody(body, part, damage) {
  const max = BODY.partHp[part] ?? 20;
  const before = body[part] ?? max;
  const after = Math.max(0, before - damage);
  body[part] = after;
  return { part, before, after, overkill: Math.max(0, damage - before) };
}
