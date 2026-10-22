// ============================================================
// data/enemies.js — 鸭尸图鉴（僵毁尸潮 AI × 鸭科夫精英/ Boss 设计）
// ============================================================
'use strict';
DB.zombies = {
  shambler: {
    nm: '鸭尸·游荡者', hp: 42, spd: 27, spdVar: 10, dmg: 8, armor: 0, size: 11,
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 8, hear: 1, atkRange: 24, atkCd: 1.1, xp: 12,
    col: { body: '#7d8464', body2: '#5f6650', beak: '#8a7a4a', eye: '#c9d24a' },
    loot: [['v_cash', 0.22, [1, 8]], ['mat_scrap', 0.14, [1, 2]], ['m_bandage', 0.06, [1, 1]], ['a_9', 0.05, [4, 9]]],
    desc: '最常见的感染鸭。行动迟缓，但从不独行。'
  },
  sprinter: {
    nm: '疾走鸭尸', hp: 38, spd: 82, spdVar: 12, dmg: 9, armor: 0, size: 10,
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 11, hear: 1.15, atkRange: 22, atkCd: 0.9, xp: 22,
    col: { body: '#8d7d58', body2: '#6d6046', beak: '#9a8a5a', eye: '#e0d24a' },
    loot: [['v_cash', 0.28, [2, 12]], ['mat_scrap', 0.1, [1, 2]], ['w_bottle', 0.05, [1, 1]]],
    desc: '新陈代谢异常的鸭尸，冲刺极快。夜里更危险。'
  },
  crawler: {
    nm: '断腿爬行鸭', hp: 26, spd: 22, spdVar: 6, dmg: 7, armor: 0, size: 9, low: true,
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 7, hear: 1, atkRange: 20, atkCd: 1.0, xp: 16,
    col: { body: '#6d7458', body2: '#525a44', beak: '#7d7045', eye: '#b8c24a' },
    loot: [['v_cash', 0.18, [1, 6]], ['mat_sheet', 0.12, [1, 2]]],
    desc: '拖着残躯爬行。草丛与黑暗里极难发现——低头看路。'
  },
  screamer: {
    nm: '尖啸鸭', hp: 36, spd: 40, spdVar: 8, dmg: 6, armor: 0, size: 11, scream: true,
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 13, hear: 1.3, atkRange: 22, atkCd: 1.2, xp: 26,
    col: { body: '#9a6a6a', body2: '#7a5050', beak: '#a88a5a', eye: '#ff6a5a' },
    loot: [['v_cash', 0.3, [3, 15]], ['m_alcohol', 0.1, [1, 2]]],
    desc: '发现猎物会仰天尖啸，召唤整片区域的鸭尸。优先击杀！'
  },
  armored: {
    nm: '军规装甲鸭尸', hp: 90, spd: 30, spdVar: 6, dmg: 13, armor: 3, size: 12,
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 9, hear: 1, atkRange: 24, atkCd: 1.15, xp: 45,
    col: { body: '#6d7458', body2: '#4e5741', beak: '#8a7a4a', eye: '#c9d24a', gear: '#4b573a' },
    loot: [['a_762ap', 0.3, [6, 14]], ['ar_plate3', 0.05, [1, 1]], ['h_mil', 0.05, [1, 1]], ['v_cash', 0.3, [5, 20]], ['mat_scrap', 0.25, [1, 3]]],
    desc: '穿着军规插板的检查站守卫。常规弹几乎无效——上蓝弹。'
  },
  armored4: {
    nm: 'B2 特化装甲鸭', hp: 120, spd: 34, spdVar: 6, dmg: 16, armor: 4, size: 12,
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 10, hear: 1, atkRange: 25, atkCd: 1.05, xp: 60,
    col: { body: '#646b52', body2: '#464e3c', beak: '#8a7a4a', eye: '#d8e04a', gear: '#394231' },
    loot: [['a_762x', 0.22, [5, 10]], ['h_sf', 0.06, [1, 1]], ['v_cash', 0.35, [8, 25]], ['mat_elec', 0.3, [1, 3]]],
    desc: '实验室深处的高级装甲个体。蓝弹打折，紫弹伺候。'
  },
  camo: {
    nm: '迷彩实验体', hp: 60, spd: 58, spdVar: 8, dmg: 20, armor: 2, size: 11, camo: true,
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 12, hear: 1.2, atkRange: 24, atkCd: 0.8, xp: 55,
    col: { body: '#5a6d7d', body2: '#44545f', beak: '#7a8a9a', eye: '#7ce8d8' },
    loot: [['mat_elec', 0.5, [1, 3]], ['v_cash', 0.3, [10, 30]], ['g_thermal', 0.04, [1, 1]]],
    desc: '光学迷彩近乎完全隐形，只有热成像或极近距离能识破。被偷袭很疼。'
  },
  // ======== Boss ========
  boss_jailer: {
    nm: '典狱长', hp: 750, spd: 30, spdVar: 0, dmg: 26, armor: 4, size: 17, boss: true,
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 12, hear: 1.5, atkRange: 34, atkCd: 1.6, xp: 260,
    col: { body: '#5a5f4a', body2: '#3f4436', beak: '#8a7a4a', eye: '#ffd24a', gear: '#2f3a2f' },
    loot: [['v_gpu', 1, [1, 1]], ['v_cash', 1, [80, 160]], ['m_surgery', 1, [1, 1]]],
    desc: '看守仓库区地库的巨鸭。重锤砸地，掀起冲击波。'
  },
  boss_roadblock: {
    nm: '路障', hp: 1500, spd: 26, spdVar: 0, dmg: 22, armor: 6, size: 19, boss: true, shield: true, shotgun: true, charge: true,
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 12, hear: 1.6, atkRange: 36, atkCd: 1.5, xp: 420,
    col: { body: '#4e5741', body2: '#373f30', beak: '#8a7a4a', eye: '#ff8a3a', gear: '#232b21' },
    loot: [['k_cred3', 1, [1, 1]], ['ar_viktor', 0.35, [1, 1]], ['a_762x', 1, [15, 25]], ['v_gold', 0.5, [1, 1]]],
    desc: 'J-Lab B1 镇守者：正面装甲 6 级且持盾减伤 80%，只有紫弹或绕背能撕开它。'
  },
  boss_storm: {
    nm: '雷暴骑士', hp: 2400, spd: 46, spdVar: 0, dmg: 30, armor: 6, size: 18, boss: true, dash: true, lightning: true, summon: 'sprinter',
    infect: { scratch: 0.07, laceration: 0.25, bite: 1.0 },
    sight: 16, hear: 1.8, atkRange: 34, atkCd: 1.2, xp: 800,
    col: { body: '#3f4a55', body2: '#2b333c', beak: '#5a6d7d', eye: '#7ce8ff', gear: '#1e262e' },
    loot: [['gun_storm', 1, [1, 1]], ['v_bpship', 1, [1, 1]], ['v_gold', 1, [1, 2]], ['a_cell', 1, [20, 30]]],
    desc: '风暴区终局 Boss。冲锋、落雷、召唤疾走鸭。击杀触发完美结局线索。'
  },
};
window.DB = DB;
