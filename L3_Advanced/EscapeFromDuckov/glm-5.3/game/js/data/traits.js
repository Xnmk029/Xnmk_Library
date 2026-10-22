// ============================================================
// data/traits.js — 职业 & 特质（僵毁式开局构筑，点数预算制）
// ============================================================
'use strict';
DB.professions = [
  { id: 'unemployed', nm: '无业游民', pts: 4, desc: '没有特长，但有多余 4 点特质点数。', skills: {}, kit: [], mods: {} },
  { id: 'carpenter', nm: '木匠', pts: 0, desc: '木工+2。自带锤子/钉子/木板。', skills: { carpentry: 2 }, kit: [['t_hammer', 1], ['mat_nails', 2], ['mat_plank', 3]], mods: {} },
  { id: 'nurse', nm: '护士', pts: 0, desc: '急救+3。自带无菌绷带/酒精/夹板。', skills: { firstaid: 3 }, kit: [['m_bandS', 2], ['m_alcohol', 2], ['m_splint', 1]], mods: {} },
  { id: 'police', nm: '警官', pts: 0, desc: '枪法+2 装填+1。自带 M9 与 30 发弹。', skills: { aiming: 2, reloading: 1 }, kit: [['gun_m9', 1], ['a_9', 30], ['ar_vest', 1]], mods: {} },
  { id: 'veteran', nm: '退伍老兵', pts: -4, desc: '永远不恐慌。近战+1 枪法+1。点数-4。', skills: { blade: 1, aiming: 1 }, kit: [['wpn_knife', 1]], mods: { panicMul: 0 } },
  { id: 'trainer', nm: '健身教练', pts: 0, desc: '体质+2 力量+1。更壮更耐跑。', skills: { fitness: 2, strength: 1 }, kit: [['f_protein', 1]], mods: { hpAdd: 10 } },
  { id: 'burger', nm: '快餐店员', pts: 0, desc: '烹饪+2。带两罐储备粮。', skills: { cooking: 2 }, kit: [['f_canBeans', 2], ['w_bottle', 1]], mods: {} },
  { id: 'scavenger', nm: '拾荒鸭', pts: 0, desc: '搜集+2 潜行+1。带学生书包与木棍。', skills: { foraging: 2, sneaking: 1 }, kit: [['bag_school', 1], ['wpn_stick', 1], ['t_lighter', 1]], mods: {} },
  { id: 'medic', nm: '战地军医', pts: -2, desc: '急救+4，治疗速度+50%。点数-2。', skills: { firstaid: 4 }, kit: [['m_bandS', 1], ['m_medkit', 1]], mods: { healMul: 1.5 } },
];
DB.traits = [
  // 正特质（消耗点数）
  { id: 'brave',    nm: '勇敢',   pts: 4, desc: '恐慌积累速度 -60%。', mods: { panicMul: 0.4 } },
  { id: 'athletic', nm: '运动员', pts: 6, desc: '最大体力 +40%，冲刺更久。', mods: { stamMul: 1.4 } },
  { id: 'strong',   nm: '强壮',   pts: 5, desc: '近战伤害 +30%，击退 +50%。', mods: { meleeMul: 1.3, knockMul: 1.5 } },
  { id: 'thick',    nm: '厚皮',   pts: 4, desc: '被抓伤/咬伤概率 -35%。', mods: { guard: 0.65 } },
  { id: 'irongut',  nm: '钢肠',   pts: 3, desc: '食物中毒/脏水风险 -80%。', mods: { gut: 0.2 } },
  { id: 'fastheal', nm: '快速愈合', pts: 4, desc: '伤口愈合速度 +60%。', mods: { healMul: 1.6 } },
  { id: 'graceful', nm: '优雅',   pts: 3, desc: '脚步与开门噪音 -30%。', mods: { noiseMul: 0.7 } },
  { id: 'eagleeye', nm: '鹰眼',   pts: 3, desc: '视野距离 +25%。', mods: { visMul: 1.25 } },
  { id: 'nightowl', nm: '夜枭',   pts: 3, desc: '黑暗中视野衰减减半。', mods: { nightMul: 0.5 } },
  { id: 'lucky',    nm: '幸运',   pts: 5, desc: '搜刮高价值物品概率提升。', mods: { lootMul: 1.35 } },
  { id: 'packmule', nm: '背骡',   pts: 3, desc: '负重上限 +8kg。', mods: { capAdd: 8 } },
  // 负特质（换取点数）
  { id: 'coward',   nm: '胆小',   pts: -5, desc: '恐慌积累 +80%，瞄枪发抖。', mods: { panicMul: 1.8 } },
  { id: 'obese',    nm: '肥胖',   pts: -6, desc: '移速 -12%，体力消耗 +50%，目标更大。', mods: { spdMul: 0.88, stamUse: 1.5 } },
  { id: 'smoker',   nm: '老烟枪', pts: -4, desc: '长时间不抽烟会压力飙升。', mods: { smoker: 1 } },
  { id: 'loud',     nm: '大嗓门', pts: -3, desc: '所有噪音 +40%。', mods: { noiseMul: 1.4 } },
  { id: 'clumsy',   nm: '笨拙',   pts: -4, desc: '更容易被鸭尸看见（可见度+30%）。', mods: { visMul: 1.3 } },
  { id: 'slowheal', nm: '缓慢愈合', pts: -4, desc: '伤口愈合 -50%。', mods: { healMul: 0.5 } },
  { id: 'weakstom', nm: '胃弱',   pts: -3, desc: '食物中毒/脏水风险 +150%。', mods: { gut: 2.5 } },
  { id: 'shortsight', nm: '近视', pts: -3, desc: '视野距离 -20%。', mods: { visMul: 0.8 } },
  { id: 'unlucky',  nm: '倒霉',   pts: -5, desc: '搜刮出好东西的概率下降。', mods: { lootMul: 0.7 } },
];
window.DB = DB;
