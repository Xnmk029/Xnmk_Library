// 敌对生物（文档 §5.2）。faction 决定阵营内讧，perception 决定"怎么发现你"。
export const FACTION = { PLAYER: 'player', SCAV: 'scav', BOSS: 'boss', WILD: 'wild' };

export const ENEMIES = {
  scav: {
    id: 'scav', name: '游荡鸭', faction: FACTION.SCAV, tier: 1,
    hp: 62, armor: 1, speed: 2.5, sprint: 3.6, damage: 9, reach: 1.3, attackCd: 1.15,
    sight: 14, hearing: 1.0, fovDeg: 100, memory: 5,
    equip: [], tint: 0xd8d2c0,
    knox: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    loot: { table: 'scav', rolls: [1, 2] }, xp: 12,
    desc: '装备最差的基础敌人，成群出现才危险。',
  },
  scavArmed: {
    id: 'scavArmed', name: '持枪游荡者', faction: FACTION.SCAV, tier: 2,
    hp: 78, armor: 2, speed: 2.4, sprint: 3.4, damage: 8, reach: 1.3, attackCd: 1.1,
    sight: 16, hearing: 1.1, fovDeg: 105, memory: 6,
    ranged: { damage: 20, range: 18, spread: 4.5, rpm: 90, burst: 3, cd: 2.4, noise: 90 },
    equip: ['helmet'], tint: 0xc8bfa8,
    knox: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    loot: { table: 'scavArmed', rolls: [2, 3] }, xp: 22,
    desc: '会开枪、会找掩体，枪声会引来更多同类。',
  },
  rampager: {
    id: 'rampager', name: '狂暴搜刮者', faction: FACTION.SCAV, tier: 4,
    hp: 140, armor: 3, speed: 3.0, sprint: 6.4, damage: 42, reach: 1.5, attackCd: 1.5,
    sight: 18, hearing: 1.3, fovDeg: 130, memory: 9,
    equip: ['pauldron'], tint: 0xb05a4a,
    telegraph: { at: 0.8, hold: 0.35, damageMul: 1.6 },   // 冲锋前摇：红光预警，靠翻滚无敌帧躲
    charge: { range: 11, cd: 4.5, speedMul: 1.0 },
    knox: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    loot: { table: 'rampager', rolls: [2, 4] }, xp: 65,
    desc: '冲锋前身体会亮起红光 —— 那是让你翻滚的信号，不是特效。',
  },
  invisible: {
    id: 'invisible', name: '隐身实体', faction: FACTION.SCAV, tier: 5,
    hp: 95, armor: 2, speed: 2.9, sprint: 4.2, damage: 34, reach: 1.4, attackCd: 1.3,
    sight: 20, hearing: 1.5, fovDeg: 140, memory: 12,
    equip: [], tint: 0x8fa8b8, invisible: true,
    knox: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    loot: { table: 'lab', rolls: [2, 3] }, xp: 70,
    desc: '肉眼几乎看不见。热成像、或让它在光锥/手电下现形。',
  },
  warden: {
    id: 'warden', name: '典狱长', faction: FACTION.BOSS, tier: 6, boss: true,
    hp: 900, armor: 5, speed: 2.3, sprint: 3.9, damage: 46, reach: 1.9, attackCd: 1.4,
    sight: 22, hearing: 1.4, fovDeg: 140, memory: 14,
    equip: ['helmet', 'vest', 'pauldron'], tint: 0x6a6a72, scale: 1.45,
    slam: { range: 5.5, cd: 7, damage: 60, radius: 3.4, shake: 0.7 },
    knox: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    loot: { table: 'boss', rolls: [4, 6] }, xp: 400,
    desc: '零号区的隐藏 Boss。血量极高，击败掉落开荒极品图腾。',
  },
  roadblock: {
    id: 'roadblock', name: '路障', faction: FACTION.BOSS, tier: 7, boss: true,
    hp: 1500, armor: 6, speed: 2.0, sprint: 3.2, damage: 58, reach: 2.1, attackCd: 1.3,
    sight: 20, hearing: 1.2, fovDeg: 130, memory: 16,
    equip: ['helmet', 'vest', 'backpack', 'pauldron'], tint: 0x4a5a6a, scale: 1.55,
    shield: { frontalArc: 1.5, damageMul: 0.2 },           // 正面 6 级盾：减伤 80%
    slam: { range: 6.5, cd: 6, damage: 70, radius: 4.2, shake: 0.9 },
    knox: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    loot: { table: 'boss', rolls: [5, 7], guaranteed: ['credential3'] }, xp: 900,
    desc: 'J-Lab B1 镇守者。正面几乎免疫，绕背或上紫弹。',
  },
  fourKnights: {
    id: 'fourKnights', name: '四骑士', faction: FACTION.BOSS, tier: 8, boss: true,
    hp: 1100, armor: 6, speed: 2.8, sprint: 5.0, damage: 52, reach: 1.8, attackCd: 1.0,
    sight: 24, hearing: 1.5, fovDeg: 150, memory: 20, count: 4,
    equip: ['helmet', 'vest', 'pauldron'], tint: 0x7a4a8a, scale: 1.3,
    ranged: { damage: 26, range: 26, spread: 2.6, rpm: 140, burst: 6, cd: 1.6, noise: 140 },
    barrage: { cd: 12, bullets: 24, damage: 18, spread: 360 },
    knox: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    loot: { table: 'boss', rolls: [6, 8], guaranteed: ['stormGunBp'] }, xp: 1600,
    desc: '风暴区的最终组合。全屏弹幕 + 重火力，走位与掩体缺一不可。',
  },
  farmMine: {
    id: 'farmMine', name: '矿场监工', faction: FACTION.BOSS, tier: 5, boss: true,
    hp: 620, armor: 4, speed: 2.5, sprint: 4.2, damage: 40, reach: 1.7, attackCd: 1.2,
    sight: 18, hearing: 1.3, fovDeg: 130, memory: 12,
    equip: ['helmet', 'vest'], tint: 0x8a7a4a, scale: 1.25,
    loot: { table: 'boss', rolls: [3, 5], guaranteed: ['keycardBlue'] }, xp: 300,
    desc: '守卫矿场，掉落实验室蓝门禁卡。',
  },
  farmLumber: {
    id: 'farmLumber', name: '伐木场工头', faction: FACTION.BOSS, tier: 5, boss: true,
    hp: 680, armor: 4, speed: 2.6, sprint: 4.0, damage: 44, reach: 2.0, attackCd: 1.1,
    sight: 18, hearing: 1.3, fovDeg: 130, memory: 12,
    equip: ['helmet', 'pauldron'], tint: 0x6a5a3a, scale: 1.3,
    loot: { table: 'boss', rolls: [3, 5], guaranteed: ['keycardPurple'] }, xp: 320,
    desc: '锯木厂守卫，周围刷新紫门禁卡。',
  },
  redQuestion: {
    id: 'redQuestion', name: '红问号', faction: FACTION.BOSS, tier: 7, boss: true,
    hp: 1000, armor: 5, speed: 3.2, sprint: 5.6, damage: 50, reach: 1.6, attackCd: 0.9,
    sight: 26, hearing: 1.6, fovDeg: 160, memory: 18,
    equip: ['helmet', 'vest', 'pauldron'], tint: 0xaa2a2a, scale: 1.2,
    loot: { table: 'boss', rolls: [4, 6], guaranteed: ['keycardRed'] }, xp: 700,
    desc: '随机刷新的神秘高难度 Boss，掉落红门禁卡。',
  },
};

/** 阵营敌对关系：非玩家阵营之间也会内讧（文档 §7.3） */
export function isHostile(a, b) {
  if (a === b) return false;
  if (a === FACTION.WILD || b === FACTION.WILD) return a !== b;   // 野生单位对所有人不友好
  return true;
}
