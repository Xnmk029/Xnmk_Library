// ============================================================
//  traits.js — 建角：职业 + 正/负面特质（僵毁式点数平衡）
// ============================================================

export const TRAIT_BUDGET = 8;

export const OCCUPATIONS = {
  unemployed: { name: '无业游鸭', skills: {}, bonus: 4, desc: '什么都不会，但额外获得 4 点特质点数。' },
  guard: { name: '村口保安', skills: { aiming: 1, blunt: 2, fitness: 1 }, bonus: 0, desc: '杰夫的老部下。钝器与基础枪法。' },
  medic: { name: '赤脚医生', skills: { firstaid: 3, cooking: 1 }, bonus: 0, desc: '包扎、缝合、消毒都是本能。' },
  carpenter: { name: '木匠', skills: { carpentry: 3, blunt: 1 }, bonus: 0, desc: '加固门窗的速度与强度大幅提升。' },
  electrician: { name: '电工', skills: { electrical: 3, mech: 1 }, bonus: 0, desc: '看得懂 J-Lab 的配电箱。' },
  cook: { name: '厨子', skills: { cooking: 3, blade: 1 }, bonus: 0, desc: '同样的食材能榨出更多热量。' },
  mechanic: { name: '机修工', skills: { mech: 3, metal: 1 }, bonus: 0, desc: '枪械改装与修理的行家。' },
  hunter: { name: '猎鸭人', skills: { aiming: 2, sneak: 2, blade: 1 }, bonus: 0, desc: '潜行与精准射击。' },
  trainer: { name: '健身教练', skills: { fitness: 3, strength: 2 }, bonus: 0, desc: '负重与体力天生优势。' },
  scav: { name: '老拾荒者', skills: { sneak: 1, nimble: 1, sprint: 1, metal: 1, firstaid: 1 }, bonus: 2, desc: '样样通，样样松。' },
};

export const TRAITS = {
  // ---- 正面 ----
  strong: { name: '力大鸭壮', cost: 6, good: true, eff: { skills: { strength: 2 }, carry: 8 }, desc: '近战伤害与负重显著提升。' },
  fit: { name: '健身狂', cost: 4, good: true, eff: { skills: { fitness: 2 }, staminaMul: 1.25 }, desc: '体力上限与恢复提升。' },
  marksman: { name: '神射手', cost: 5, good: true, eff: { skills: { aiming: 2 }, spreadMul: 0.85 }, desc: '弹道散布更小。' },
  nimble: { name: '灵巧', cost: 4, good: true, eff: { skills: { nimble: 2 }, aimMoveMul: 1.25 }, desc: '举枪状态下移动更快。' },
  catfoot: { name: '猫步', cost: 4, good: true, eff: { skills: { sneak: 2 }, noiseMul: 0.7 }, desc: '脚步噪音大幅降低。' },
  fasthealer: { name: '快速康复', cost: 5, good: true, eff: { healMul: 1.4 }, desc: '伤口愈合速度 +40%。' },
  ironstomach: { name: '铁胃', cost: 3, good: true, eff: { sickMul: 0.45 }, desc: '食物中毒与患病概率大幅降低。' },
  painless: { name: '钝痛感', cost: 4, good: true, eff: { painMul: 0.6 }, desc: '疼痛带来的行动惩罚降低。' },
  nightowl: { name: '夜猫子', cost: 3, good: true, eff: { visionNight: 1.35 }, desc: '夜间与暗处视野更远。' },
  calm: { name: '冷静', cost: 3, good: true, eff: { panicMul: 0.45 }, desc: '恐慌积累减半，抖动更小。' },
  fasthands: { name: '快手', cost: 3, good: true, eff: { skills: { reload: 2 } }, desc: '换弹更快。' },
  organized: { name: '收纳达鸭', cost: 3, good: true, eff: { carry: 5 }, desc: '负重上限 +5kg。' },
  resilient: { name: '抗体', cost: 6, good: true, eff: { infectMul: 0.4 }, desc: '被咬后感染鸭瘟的概率大幅降低。' },

  // ---- 负面（返还点数） ----
  weak: { name: '弱不禁风', cost: -6, eff: { skills: { strength: -2 }, carry: -6 }, desc: '近战伤害与负重下降。' },
  sedentary: { name: '久坐生活', cost: -4, eff: { skills: { fitness: -2 }, staminaMul: 0.75 }, desc: '体力差。' },
  myopia: { name: '近视', cost: -4, eff: { visionMul: 0.75 }, desc: '视野半径 -25%。' },
  glassstomach: { name: '玻璃胃', cost: -3, eff: { sickMul: 1.8 }, desc: '生食与污水几乎必病。' },
  hemophobia: { name: '惧血', cost: -3, eff: { panicMul: 1.9 }, desc: '见到尸群极易恐慌。' },
  slowhands: { name: '慢手', cost: -3, eff: { skills: { reload: -2 } }, desc: '换弹缓慢。' },
  heavybreather: { name: '沉重呼吸', cost: -3, eff: { noiseMul: 1.5 }, desc: '脚步声传得更远。' },
  weakimmune: { name: '免疫低下', cost: -5, eff: { infectMul: 1.6, sickMul: 1.4 }, desc: '鸭瘟与伤口感染风险大增。' },
  oldwound: { name: '旧伤', cost: -5, eff: { hpMul: 0.85 }, desc: '生命上限 -15%。' },
  thinskin: { name: '皮薄', cost: -4, eff: { dmgTakenMul: 1.2 }, desc: '受到的伤害 +20%。' },
};

/** 合并特质/职业效果为一个修正器 */
export function buildModifiers(occId, traitIds) {
  const m = {
    skills: {}, carry: 0, staminaMul: 1, spreadMul: 1, aimMoveMul: 1, noiseMul: 1, healMul: 1,
    sickMul: 1, painMul: 1, visionMul: 1, visionNight: 1, panicMul: 1, infectMul: 1, hpMul: 1, dmgTakenMul: 1,
  };
  const occ = OCCUPATIONS[occId] || OCCUPATIONS.unemployed;
  for (const k in occ.skills) m.skills[k] = (m.skills[k] || 0) + occ.skills[k];
  for (const id of traitIds) {
    const t = TRAITS[id];
    if (!t) continue;
    for (const k in t.eff) {
      if (k === 'skills') {
        for (const s in t.eff.skills) m.skills[s] = (m.skills[s] || 0) + t.eff.skills[s];
      } else if (k.endsWith('Mul')) {
        m[k] *= t.eff[k];
      } else if (k === 'visionNight') {
        m.visionNight *= t.eff[k];
      } else {
        m[k] += t.eff[k];
      }
    }
  }
  return m;
}

export function traitCostSum(traitIds) {
  let s = 0;
  for (const id of traitIds) s += (TRAITS[id]?.cost || 0);
  return s;
}
