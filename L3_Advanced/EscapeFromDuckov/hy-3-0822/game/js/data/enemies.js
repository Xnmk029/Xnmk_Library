// ============================================================
//  enemies.js — 敌对实体（感染鸭群 / 拾荒鸭 / 精英 / Boss）
//  融合：僵毁的感知-调查-追击 AI 数值 + 鸭科夫的怪物设定
// ============================================================

export const ENEMIES = {
  // ---------------- 基础尸群 ----------------
  z_wander: {
    name: '游荡鸭', faction: 'zed', hp: 62, spd: 0.95, dmg: 9, armor: 0, tier: 1,
    sight: 7.5, fov: 150, hearing: 13, atkCd: 1.1, reach: 1.0, infect: 0.28,
    body: '#a8c86a', gear: null, size: 1.0, xp: 6,
    loot: [['cloth', 0.35, 1, 2], ['cash', 0.5, 5, 25], ['scrap', 0.18, 1, 1], ['canned_beans', 0.07, 1, 1]],
    desc: '被鸭瘟感染的普通居民。听觉远好于视觉。',
  },
  z_shambler: {
    name: '蹒跚鸭', faction: 'zed', hp: 85, spd: 0.62, dmg: 12, armor: 0, tier: 1,
    sight: 6, fov: 130, hearing: 15, atkCd: 1.3, reach: 1.05, infect: 0.3,
    body: '#8fae57', gear: null, size: 1.1, xp: 7,
    loot: [['cloth', 0.4, 1, 3], ['cash', 0.5, 5, 30], ['dirty_rag', 0.15, 1, 2]],
  },
  z_crawler: {
    name: '爬行鸭', faction: 'zed', hp: 45, spd: 0.72, dmg: 11, armor: 0, tier: 1,
    sight: 5, fov: 200, hearing: 11, atkCd: 1.0, reach: 0.95, infect: 0.35,
    body: '#7f9a4e', gear: null, size: 0.78, xp: 6, crawler: true,
    loot: [['cloth', 0.3, 1, 2], ['cash', 0.4, 5, 20]],
    desc: '断腿后仍在地面爬行，极难在草丛中发现。',
  },
  z_sprinter: {
    name: '疾行鸭', faction: 'zed', hp: 54, spd: 2.95, dmg: 10, armor: 0, tier: 2,
    sight: 9.5, fov: 160, hearing: 15, atkCd: 0.85, reach: 1.0, infect: 0.3,
    body: '#c2d45a', gear: null, size: 0.95, xp: 12, sprinter: true,
    loot: [['cash', 0.6, 10, 40], ['ammo_9', 0.2, 4, 10], ['cloth', 0.2, 1, 2]],
  },
  z_fat: {
    name: '肿胀鸭', faction: 'zed', hp: 185, spd: 0.7, dmg: 20, armor: 1, tier: 2,
    sight: 6, fov: 140, hearing: 12, atkCd: 1.5, reach: 1.2, infect: 0.45,
    body: '#9ab04a', gear: null, size: 1.35, xp: 22, burst: 'poison',
    loot: [['chemicals', 0.25, 1, 1], ['cash', 0.7, 20, 60], ['canned_meat', 0.15, 1, 1]],
    desc: '死亡时爆开一片毒云。',
  },
  z_armored: {
    name: '装甲鸭', faction: 'zed', hp: 130, spd: 1.15, dmg: 17, armor: 3, tier: 3,
    sight: 8, fov: 150, hearing: 13, atkCd: 1.1, reach: 1.05, infect: 0.3,
    body: '#8fae57', gear: { vest: '#3f4a35', helm: '#3b4038' }, size: 1.1, xp: 30,
    loot: [['vest_2', 0.16, 1, 1], ['helm_2', 0.12, 1, 1], ['ammo_556', 0.3, 10, 25], ['cash', 0.8, 40, 90]],
    desc: '穿着防弹插板的感染者。常规子弹几乎无效——换蓝弹。',
  },

  // ---------------- 拾荒鸭（持枪敌人，会与尸群内讧） ----------------
  z_scav: {
    name: '拾荒鸭', faction: 'scav', hp: 72, spd: 1.5, dmg: 8, armor: 1, tier: 1,
    sight: 11, fov: 110, hearing: 14, atkCd: 1.2, reach: 1.0, infect: 0,
    body: '#ffd24a', gear: { vest: '#4d5340' }, size: 1.0, xp: 14,
    gun: { dmg: 17, rpm: 200, spread: 6.5, range: 9.5, burst: 2, ammoTier: 1, noise: 17, reloadT: 2.4, mag: 12 },
    loot: [['pistol_m9', 0.18, 1, 1], ['ammo_9', 0.55, 8, 22], ['cash', 0.9, 30, 90], ['bandage', 0.2, 1, 2], ['canned_beans', 0.12, 1, 1]],
    desc: '尚未感染的暴徒。他们也会向感染鸭开火。',
  },
  z_scav_smg: {
    name: '拾荒鸭·冲锋', faction: 'scav', hp: 84, spd: 1.6, dmg: 8, armor: 2, tier: 2,
    sight: 12, fov: 110, hearing: 14, atkCd: 1.0, reach: 1.0, infect: 0,
    body: '#ffb347', gear: { vest: '#3f4a35', helm: '#3b4038' }, size: 1.0, xp: 26,
    gun: { dmg: 20, rpm: 620, spread: 7.5, range: 10, burst: 5, ammoTier: 2, noise: 20, reloadT: 2.6, mag: 30 },
    loot: [['smg_mp5', 0.14, 1, 1], ['ammo_9', 0.6, 15, 35], ['cash', 0.9, 60, 150], ['vest_1', 0.2, 1, 1], ['first_aid_kit', 0.1, 1, 1]],
  },
  z_scav_sniper: {
    name: '拾荒鸭·冷枪', faction: 'scav', hp: 68, spd: 1.35, dmg: 8, armor: 1, tier: 3,
    sight: 17, fov: 90, hearing: 12, atkCd: 2.4, reach: 1.0, infect: 0,
    body: '#e8b04a', gear: { vest: '#4d5340', helm: '#39413a' }, size: 1.0, xp: 34,
    gun: { dmg: 48, rpm: 45, spread: 2.0, range: 17, burst: 1, ammoTier: 3, noise: 30, reloadT: 3.4, mag: 5 },
    loot: [['ammo_338', 0.3, 5, 12], ['cash', 0.9, 80, 180], ['sr_sv98', 0.08, 1, 1], ['att_scope', 0.18, 1, 1]],
  },

  // ---------------- 精英 ----------------
  z_rampage: {
    name: '狂暴搜刮者', faction: 'zed', hp: 240, spd: 1.5, dmg: 38, armor: 2, tier: 3,
    sight: 11, fov: 170, hearing: 16, atkCd: 1.6, reach: 1.5, infect: 0.5,
    body: '#c86a4a', gear: { vest: '#2f3630' }, size: 1.22, xp: 60, elite: true,
    charge: { tell: 0.85, spd: 5.4, dur: 1.1, dmg: 48 },
    loot: [['axe', 0.25, 1, 1], ['cash', 1, 120, 260], ['ammo_762', 0.35, 10, 25], ['mech_parts', 0.3, 1, 3], ['recovery_syringe', 0.15, 1, 1]],
    desc: '冲锋前全身泛起红光——那是翻滚的信号。',
  },
  z_invis: {
    name: '隐身鸭', faction: 'zed', hp: 105, spd: 2.2, dmg: 32, armor: 2, tier: 4,
    sight: 12, fov: 200, hearing: 18, atkCd: 1.2, reach: 1.1, infect: 0.6,
    body: '#7de3ff', gear: null, size: 1.0, xp: 70, invisible: true,
    loot: [['chemicals', 0.5, 1, 2], ['cash', 1, 150, 300], ['serum', 0.12, 1, 1], ['keycard_green', 0.1, 1, 1]],
    desc: 'J-Lab 的失败产物。热成像或显影飞镖才能锁定。',
  },
  z_lab_hunter: {
    name: '实验体·猎手', faction: 'zed', hp: 190, spd: 2.4, dmg: 26, armor: 3, tier: 4,
    sight: 13, fov: 170, hearing: 16, atkCd: 0.9, reach: 1.2, infect: 0.5,
    body: '#8f7de3', gear: { vest: '#33414a' }, size: 1.15, xp: 80,
    loot: [['ammo_556ap', 0.4, 10, 25], ['gpu', 0.2, 1, 1], ['cash', 1, 180, 350], ['electronics', 0.5, 2, 5]],
  },
  z_storm_walker: {
    name: '风暴行者', faction: 'zed', hp: 260, spd: 1.7, dmg: 34, armor: 4, tier: 5,
    sight: 12, fov: 160, hearing: 15, atkCd: 1.0, reach: 1.25, infect: 0.55,
    body: '#5a8fa8', gear: { vest: '#33414a', helm: '#2e332e' }, size: 1.2, xp: 110,
    loot: [['ammo_762ap', 0.45, 10, 25], ['vest_4', 0.12, 1, 1], ['cash', 1, 250, 500], ['gpu', 0.15, 1, 1]],
  },

  // ---------------- Boss ----------------
  boss_warden: {
    name: '典狱长', faction: 'boss', hp: 950, spd: 1.25, dmg: 42, armor: 3, tier: 2,
    sight: 14, fov: 200, hearing: 22, atkCd: 1.5, reach: 1.9, infect: 0.5,
    body: '#6d5b8f', gear: { vest: '#2f3630', helm: '#2e332e' }, size: 1.75, xp: 260, boss: true,
    slam: { cd: 6.5, tell: 1.0, radius: 3.6, dmg: 46 },
    summon: { cd: 12, type: 'z_wander', n: 4 },
    loot: [['ship_hull', 1, 1, 1], ['cash', 1, 600, 1100], ['vest_2', 1, 1, 1], ['ammo_762', 1, 30, 60], ['book_fitness', 0.5, 1, 1]],
    desc: '零号区监狱的旧主。震地波会打断你的一切动作。',
  },
  boss_miner: {
    name: '矿场主', faction: 'boss', hp: 780, spd: 1.4, dmg: 36, armor: 4, tier: 3,
    sight: 13, fov: 190, hearing: 20, atkCd: 1.2, reach: 1.7, infect: 0.45,
    body: '#8a6b3d', gear: { vest: '#3f4a35', helm: '#3b4038' }, size: 1.6, xp: 220, boss: true,
    charge: { tell: 0.7, spd: 6.0, dur: 1.2, dmg: 44 },
    loot: [['keycard_blue', 1, 1, 1], ['cash', 1, 400, 800], ['ship_nav', 1, 1, 1], ['gpu', 0.6, 1, 2], ['mech_parts', 1, 4, 8]],
  },
  boss_logger: {
    name: '伐木工头', faction: 'boss', hp: 820, spd: 1.3, dmg: 40, armor: 3, tier: 3,
    sight: 13, fov: 190, hearing: 20, atkCd: 1.35, reach: 2.0, infect: 0.45,
    body: '#a05a3a', gear: { vest: '#4d5340' }, size: 1.62, xp: 230, boss: true,
    slam: { cd: 7, tell: 0.9, radius: 3.2, dmg: 40 },
    loot: [['keycard_purple', 1, 1, 1], ['cash', 1, 400, 800], ['axe', 1, 1, 1], ['book_carpentry', 0.6, 1, 1], ['plank', 1, 6, 12]],
  },
  boss_roadblock: {
    name: '路障', faction: 'boss', hp: 1650, spd: 1.15, dmg: 48, armor: 5, tier: 4,
    sight: 15, fov: 200, hearing: 24, atkCd: 1.4, reach: 2.1, infect: 0.5,
    body: '#4a5560', gear: { vest: '#2f3630', helm: '#2e332e' }, size: 1.95, xp: 520, boss: true,
    slam: { cd: 5.5, tell: 0.95, radius: 4.0, dmg: 52 },
    gun: { dmg: 22, rpm: 420, spread: 8, range: 11, burst: 8, ammoTier: 4, noise: 26, reloadT: 3.0, mag: 60 },
    summon: { cd: 14, type: 'z_lab_hunter', n: 2 },
    loot: [['credential_3', 1, 1, 1], ['ship_fuel', 1, 1, 1], ['cash', 1, 1200, 2000], ['vest_4', 1, 1, 1], ['ammo_762ap', 1, 25, 50], ['gpu', 1, 2, 4]],
    desc: '实验室 B1 的镇守者。击败他是通往风暴区的唯一途径。',
  },
  boss_knight: {
    name: '四骑士', faction: 'boss', hp: 720, spd: 1.6, dmg: 44, armor: 5, tier: 5,
    sight: 16, fov: 220, hearing: 24, atkCd: 1.2, reach: 1.6, infect: 0.5,
    body: '#3f4a5a', gear: { vest: '#2b3540', helm: '#242a30' }, size: 1.5, xp: 400, boss: true,
    barrage: { cd: 5.0, tell: 0.8, n: 16, dmg: 26, pen: 5 },
    gun: { dmg: 26, rpm: 300, spread: 5, range: 13, burst: 4, ammoTier: 5, noise: 28, reloadT: 2.6, mag: 30 },
    loot: [['ammo_energy', 1, 15, 30], ['cash', 1, 800, 1600], ['vest_6', 0.35, 1, 1], ['gpu', 1, 2, 3]],
    desc: '风暴区的终局。四体同心，全屏弹幕。',
  },

  // ---------------- 中立 ----------------
  merchant: {
    name: '神秘商人', faction: 'neutral', hp: 9999, spd: 0, dmg: 0, armor: 6, tier: 0,
    sight: 8, fov: 360, hearing: 8, atkCd: 9, reach: 1, infect: 0, immune: true,
    body: '#3f6b62', gear: { helm: '#2a2c33' }, size: 1.15, xp: 0, vendor: true,
    loot: [], desc: '只认现金。免疫一切伤害。',
  },
};

/** 各地图 tier 的刷怪权重表 */
export const SPAWN_TABLE = {
  1: [['z_wander', 46], ['z_shambler', 22], ['z_crawler', 12], ['z_scav', 16], ['z_sprinter', 4]],
  2: [['z_wander', 30], ['z_shambler', 18], ['z_crawler', 10], ['z_sprinter', 14], ['z_fat', 8], ['z_scav', 12], ['z_scav_smg', 8]],
  3: [['z_wander', 20], ['z_shambler', 12], ['z_sprinter', 16], ['z_fat', 10], ['z_armored', 12], ['z_scav_smg', 12], ['z_scav_sniper', 6], ['z_rampage', 8], ['z_crawler', 4]],
  4: [['z_armored', 20], ['z_sprinter', 14], ['z_invis', 14], ['z_lab_hunter', 18], ['z_rampage', 12], ['z_fat', 8], ['z_scav_sniper', 8], ['z_shambler', 6]],
  5: [['z_storm_walker', 26], ['z_armored', 16], ['z_rampage', 16], ['z_invis', 12], ['z_lab_hunter', 14], ['z_sprinter', 10], ['z_scav_sniper', 6]],
};

export function enemyDef(id) { return ENEMIES[id] || ENEMIES.z_wander; }
