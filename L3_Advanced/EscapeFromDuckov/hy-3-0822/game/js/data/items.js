// ============================================================
//  items.js — 物资数据表（僵毁式深度物资 + 鸭科夫式装备/甲弹体系）
//  字段速查：
//    t   类型 food|drink|med|gun|melee|ammo|armor|helm|pack|att|tool|mat|key|book|throw|misc
//    w   重量 kg     v 现金价值     st 可堆叠上限
//    col 渲染主色    sh 形状（图标/地面掉落）
// ============================================================

export const AMMO_TIER_NAME = { 1: '常规', 2: '标准', 3: '蓝弹·穿甲', 4: '蓝弹+', 5: '紫弹·高穿', 6: '能量弹' };

export const ITEMS = {
  // ---------------- 食物（僵毁：热量 / 腐坏 / 生熟 / 病菌） ----------------
  canned_beans: { name: '罐头黄豆', t: 'food', w: 0.45, v: 30, st: 5, cal: 320, thirst: 4, perish: 0, col: '#8a6b3d', sh: 'can', desc: '铁皮罐头。不会腐坏，末世硬通货。' },
  canned_meat: { name: '午餐肉罐头', t: 'food', w: 0.5, v: 45, st: 5, cal: 420, thirst: 6, perish: 0, col: '#a5654a', sh: 'can' },
  mre: { name: '军用口粮', t: 'food', w: 0.8, v: 90, st: 3, cal: 780, thirst: 8, perish: 0, happy: 4, col: '#4d5340', sh: 'box' },
  chips: { name: '薯片', t: 'food', w: 0.2, v: 18, st: 4, cal: 210, thirst: 12, perish: 0, happy: 6, col: '#d8a13a', sh: 'box' },
  chocolate: { name: '巧克力', t: 'food', w: 0.15, v: 25, st: 6, cal: 260, thirst: 5, perish: 0, happy: 10, col: '#5a3a26', sh: 'box' },
  bread: { name: '面包', t: 'food', w: 0.35, v: 15, st: 3, cal: 240, thirst: 10, perish: 4, col: '#c39a5f', sh: 'box' },
  apple: { name: '苹果', t: 'food', w: 0.2, v: 12, st: 6, cal: 110, thirst: -8, perish: 6, happy: 4, col: '#a83b3b', sh: 'ball' },
  egg: { name: '鸭蛋', t: 'food', w: 0.12, v: 10, st: 8, cal: 90, thirst: 0, perish: 8, raw: true, sick: 0.35, cookTo: 'cooked_egg', col: '#efe3c8', sh: 'ball' },
  cooked_egg: { name: '煎蛋', t: 'food', w: 0.12, v: 16, st: 8, cal: 160, thirst: 2, perish: 3, happy: 5, col: '#f5d76e', sh: 'ball' },
  raw_patty: { name: '生肉饼', t: 'food', w: 0.4, v: 20, st: 4, cal: 200, thirst: 2, perish: 2, raw: true, sick: 0.7, cookTo: 'cooked_patty', col: '#a4564f', sh: 'ball' },
  cooked_patty: { name: '烤肉饼', t: 'food', w: 0.4, v: 48, st: 4, cal: 520, thirst: 6, perish: 3, happy: 8, col: '#8a5232', sh: 'ball' },
  instant_noodle: { name: '干泡面', t: 'food', w: 0.3, v: 14, st: 4, cal: 180, thirst: 18, perish: 0, cookTo: 'hot_noodle', col: '#d9a94b', sh: 'box' },
  hot_noodle: { name: '热汤面', t: 'food', w: 0.35, v: 30, st: 2, cal: 460, thirst: -14, perish: 1, happy: 12, warm: 6, col: '#e0b45c', sh: 'can' },
  cheese: { name: '奶酪块', t: 'food', w: 0.2, v: 22, st: 4, cal: 250, thirst: 8, perish: 7, col: '#e8c85a', sh: 'box' },
  honey: { name: '蜂蜜罐', t: 'food', w: 0.5, v: 60, st: 2, cal: 300, thirst: 6, perish: 0, happy: 8, med: { heal: 3 }, col: '#d99a1f', sh: 'can' },
  protein_powder: { name: '蛋白粉', t: 'food', w: 0.9, v: 120, st: 2, cal: 400, thirst: 14, perish: 0, quest: 'mud', col: '#c8c2b0', sh: 'box', desc: '泥巴一直在找这个（健身房扩建材料）。' },
  pickles: { name: '腌菜罐', t: 'food', w: 0.6, v: 20, st: 3, cal: 150, thirst: 16, perish: 0, col: '#6f7a3c', sh: 'can' },

  // ---------------- 饮品（水分单位 / 污水致病 / 咖啡因 / 酒精） ----------------
  water_bottle: { name: '水瓶', t: 'drink', w: 0.6, v: 20, water: 8, col: '#4a7f96', sh: 'bottle' },
  tainted_water: { name: '污水瓶', t: 'drink', w: 0.6, v: 4, water: 8, tainted: true, col: '#5b6b4a', sh: 'bottle', desc: '未净化。饮用有极高患病风险，煮沸后可安全饮用。' },
  empty_bottle: { name: '空瓶', t: 'drink', w: 0.15, v: 2, st: 4, water: 0, cap: 8, col: '#8fb6c4', sh: 'bottle' },
  soda: { name: '汽水', t: 'drink', w: 0.4, v: 18, water: 5, happy: 8, caffeine: 8, col: '#a8433f', sh: 'bottle' },
  coffee: { name: '速溶咖啡', t: 'drink', w: 0.25, v: 35, water: 3, caffeine: 30, col: '#4a3323', sh: 'can' },
  energy_drink: { name: '能量饮料', t: 'drink', w: 0.35, v: 55, water: 4, caffeine: 45, stamina: 40, col: '#7fc242', sh: 'can' },
  beer: { name: '啤酒', t: 'drink', w: 0.5, v: 25, water: 5, alcohol: 25, happy: 14, pain: 12, col: '#b8862c', sh: 'bottle' },
  milk: { name: '牛奶', t: 'drink', w: 0.7, v: 22, water: 7, cal: 120, perish: 5, col: '#e8e4d8', sh: 'bottle' },

  // ---------------- 医疗（部位伤情对症处理） ----------------
  bandage: { name: '绷带', t: 'med', w: 0.05, v: 25, st: 8, med: { bandage: 1, stopBleed: 1 }, time: 1.4, col: '#e6e2d4', sh: 'roll', desc: '快速止血。脏布条止血但会带来伤口感染风险。' },
  dirty_rag: { name: '脏布条', t: 'med', w: 0.05, v: 3, st: 8, med: { bandage: 2, stopBleed: 1, infect: 0.35 }, time: 1.6, col: '#8a8570', sh: 'roll' },
  splint: { name: '夹板', t: 'med', w: 0.3, v: 45, st: 3, med: { splint: 1 }, time: 4.5, col: '#a08a5f', sh: 'plank', desc: '固定骨折部位，恢复移动与瞄准稳定。' },
  painkiller: { name: '止痛药', t: 'med', w: 0.05, v: 40, st: 5, med: { pain: 55, dur: 240 }, time: 1.0, col: '#d8d8e0', sh: 'pill' },
  antibiotics: { name: '抗生素', t: 'med', w: 0.05, v: 90, st: 4, med: { woundInfect: -70, sick: -35, dur: 300 }, time: 1.2, col: '#e0a0a8', sh: 'pill' },
  disinfectant: { name: '医用酒精', t: 'med', w: 0.25, v: 55, st: 3, med: { disinfect: 1 }, time: 2.2, col: '#9fd3d8', sh: 'bottle' },
  first_aid_kit: { name: '急救包', t: 'med', w: 1.2, v: 160, st: 2, med: { heal: 45, stopBleed: 2, bandage: 1 }, time: 4.2, still: true, col: '#c23b3b', sh: 'box', desc: '大量回血，使用时必须保持静止。' },
  surgery_kit: { name: '手术包', t: 'med', w: 1.6, v: 260, st: 1, med: { stitch: 1, heal: 25, fixMax: 1 }, time: 8, still: true, safeOnly: false, col: '#b8322f', sh: 'box', desc: '缝合深伤口、修复生命上限，需长时间静止。' },
  recovery_syringe: { name: '恢复针', t: 'med', w: 0.15, v: 220, st: 3, med: { regen: 55, dur: 60 }, time: 0.9, col: '#7de3ff', sh: 'pill', desc: '可在移动中使用，持续缓慢回血。Boss 战核心道具。' },
  buff_syringe: { name: '负重针', t: 'med', w: 0.15, v: 180, st: 3, med: { carry: 25, dur: 180 }, time: 0.9, col: '#c77dff', sh: 'pill', desc: '短时间大幅提升负重上限。' },
  serum: { name: 'J-Lab 血清', t: 'med', w: 0.2, v: 900, st: 2, med: { cureInfect: 1, heal: 20 }, time: 3.5, still: true, col: '#7dffd4', sh: 'pill', desc: '实验室产物。可清除鸭瘟病毒感染。' },
  vitamins: { name: '维生素', t: 'med', w: 0.05, v: 30, st: 5, med: { fatigue: -20, dur: 120 }, time: 0.8, col: '#f0c04a', sh: 'pill' },

  // ---------------- 弹药 ----------------
  ammo_9: { name: '9mm 常规', t: 'ammo', w: 0.012, v: 3, st: 180, tier: 1, dmgMul: 1.0, col: '#b98b3a', sh: 'ammo' },
  ammo_9ap: { name: '9mm 蓝弹', t: 'ammo', w: 0.013, v: 12, st: 180, tier: 3, dmgMul: 0.95, col: '#4fc3ff', sh: 'ammo' },
  ammo_12g: { name: '12号霰弹', t: 'ammo', w: 0.05, v: 6, st: 90, tier: 1, dmgMul: 1.0, col: '#a8433f', sh: 'ammo' },
  ammo_556: { name: '5.56 常规', t: 'ammo', w: 0.014, v: 5, st: 180, tier: 2, dmgMul: 1.0, col: '#c8a04a', sh: 'ammo' },
  ammo_556ap: { name: '5.56 蓝弹', t: 'ammo', w: 0.015, v: 18, st: 180, tier: 4, dmgMul: 0.95, col: '#63d2ff', sh: 'ammo' },
  ammo_762: { name: '7.62 常规', t: 'ammo', w: 0.022, v: 8, st: 150, tier: 3, dmgMul: 1.0, col: '#b8862c', sh: 'ammo' },
  ammo_762ap: { name: '7.62 紫弹', t: 'ammo', w: 0.024, v: 30, st: 150, tier: 5, dmgMul: 1.0, col: '#c77dff', sh: 'ammo' },
  ammo_338: { name: '.338 狙击弹', t: 'ammo', w: 0.035, v: 40, st: 60, tier: 4, dmgMul: 1.0, col: '#63d2ff', sh: 'ammo' },
  ammo_energy: { name: '空间能量弹', t: 'ammo', w: 0.02, v: 120, st: 60, tier: 6, dmgMul: 1.1, col: '#7dffd4', sh: 'ammo' },

  // ---------------- 枪械（噪音 = 招引僵尸的核心风险） ----------------
  pistol_m9: {
    name: 'M9 手枪', t: 'gun', cls: 'pistol', w: 0.9, v: 300, dmg: 20, rpm: 380, mag: 15, ammo: ['ammo_9', 'ammo_9ap'],
    spread: 3.2, recoil: 1.0, ergo: 0.95, rangeT: 9, noise: 17, auto: false, reload: 2.1, slots: ['muzzle', 'scope'], col: '#3a3d44', sh: 'gun',
  },
  smg_mp5: {
    name: 'MP5', t: 'gun', cls: 'smg', w: 2.5, v: 850, dmg: 21, rpm: 750, mag: 30, ammo: ['ammo_9', 'ammo_9ap'],
    spread: 3.4, recoil: 1.05, ergo: 0.85, rangeT: 10, noise: 20, auto: true, reload: 2.6, slots: ['muzzle', 'scope', 'grip', 'stock'], col: '#33363c', sh: 'gun',
  },
  smg_vector: {
    name: 'Vector', t: 'gun', cls: 'smg', w: 2.7, v: 1500, dmg: 19, rpm: 1050, mag: 25, ammo: ['ammo_9', 'ammo_9ap'],
    spread: 3.0, recoil: 0.8, ergo: 0.88, rangeT: 10, noise: 20, auto: true, reload: 2.5, slots: ['muzzle', 'scope', 'grip', 'stock'], col: '#2f3238', sh: 'gun',
  },
  sg_m870: {
    name: 'M870 霰弹枪', t: 'gun', cls: 'shotgun', w: 3.2, v: 700, dmg: 13, pellets: 6, rpm: 75, mag: 6, ammo: ['ammo_12g'],
    spread: 7.5, recoil: 3.2, ergo: 0.7, rangeT: 6.5, noise: 30, auto: false, reload: 3.6, slots: ['muzzle', 'stock'], col: '#4a3526', sh: 'gun',
  },
  ar_ak103: {
    name: 'AK-103', t: 'gun', cls: 'ar', w: 3.6, v: 1400, dmg: 34, rpm: 600, mag: 30, ammo: ['ammo_762', 'ammo_762ap'],
    spread: 2.6, recoil: 1.75, ergo: 0.72, rangeT: 14, noise: 27, auto: true, reload: 3.0, slots: ['muzzle', 'scope', 'grip', 'stock'], col: '#4a3a28', sh: 'gun',
  },
  ar_m14: {
    name: 'M14', t: 'gun', cls: 'ar', w: 4.1, v: 1700, dmg: 46, rpm: 260, mag: 20, ammo: ['ammo_762', 'ammo_762ap'],
    spread: 1.6, recoil: 2.2, ergo: 0.65, rangeT: 17, noise: 28, auto: false, reload: 3.2, slots: ['muzzle', 'scope', 'grip', 'stock'], col: '#5a4128', sh: 'gun',
  },
  ar_m4: {
    name: 'MCX Spear', t: 'gun', cls: 'ar', w: 3.3, v: 2200, dmg: 32, rpm: 720, mag: 30, ammo: ['ammo_556', 'ammo_556ap'],
    spread: 2.0, recoil: 1.35, ergo: 0.82, rangeT: 15, noise: 26, auto: true, reload: 2.8, slots: ['muzzle', 'scope', 'grip', 'stock'], col: '#3d4038', sh: 'gun',
  },
  lmg_rpk: {
    name: 'RPK', t: 'gun', cls: 'lmg', w: 6.2, v: 2600, dmg: 33, rpm: 650, mag: 45, ammo: ['ammo_762', 'ammo_762ap'],
    spread: 3.2, recoil: 2.0, ergo: 0.5, rangeT: 15, noise: 30, auto: true, reload: 5.0, slots: ['muzzle', 'scope', 'stock'], col: '#43331f', sh: 'gun',
  },
  sr_sv98: {
    name: 'SV-98', t: 'gun', cls: 'sr', w: 5.1, v: 2400, dmg: 92, rpm: 42, mag: 5, ammo: ['ammo_338'],
    spread: 0.7, recoil: 3.6, ergo: 0.45, rangeT: 24, noise: 33, auto: false, reload: 4.0, slots: ['muzzle', 'scope', 'stock'], col: '#3a3628', sh: 'gun',
  },
  storm_gun: {
    name: '风暴枪', t: 'gun', cls: 'special', w: 4.4, v: 9000, dmg: 62, rpm: 420, mag: 24, ammo: ['ammo_energy'],
    spread: 1.4, recoil: 1.2, ergo: 0.8, rangeT: 18, noise: 22, auto: true, reload: 3.0, slots: ['scope'], col: '#2b4a52', sh: 'gun', desc: '四骑士的遗物。空间能量弹，穿透一切护甲。',
  },

  // ---------------- 近战（死亡不掉落插槽） ----------------
  fists: { name: '拳头', t: 'melee', w: 0, v: 0, dmg: 5, arc: 55, reach: 0.95, cd: 0.5, stam: 3, skill: 'blunt', knock: 0.4, crit: 1.5, col: '#ffd24a', sh: 'blade' },
  wood_stick: { name: '木棍', t: 'melee', w: 0.7, v: 8, dmg: 13, arc: 70, reach: 1.35, cd: 0.62, stam: 5, skill: 'blunt', knock: 0.9, crit: 2, col: '#8a6b3d', sh: 'plank', mat: true },
  wrench: { name: '扳手', t: 'melee', w: 1.1, v: 30, dmg: 18, arc: 60, reach: 1.15, cd: 0.6, stam: 6, skill: 'blunt', knock: 1.1, crit: 2.2, col: '#7d858c', sh: 'blade', tool: ['wrench'] },
  bat: { name: '球棒', t: 'melee', w: 1.4, v: 45, dmg: 24, arc: 80, reach: 1.5, cd: 0.72, stam: 8, skill: 'blunt', knock: 1.8, crit: 2.4, col: '#9a7440', sh: 'plank' },
  pan: { name: '平底锅', t: 'melee', w: 1.0, v: 20, dmg: 16, arc: 75, reach: 1.15, cd: 0.65, stam: 6, skill: 'blunt', knock: 1.4, crit: 2, noise: 9, col: '#4a4d52', sh: 'ball' },
  knife: { name: '匕首', t: 'melee', w: 0.4, v: 60, dmg: 15, arc: 40, reach: 1.0, cd: 0.42, stam: 3.5, skill: 'blade', knock: 0.3, crit: 6, sneakKill: true, col: '#b9c0c6', sh: 'blade', desc: '潜行背刺可一击必杀。' },
  axe: { name: '消防斧', t: 'melee', w: 3.2, v: 130, dmg: 36, arc: 65, reach: 1.35, cd: 0.95, stam: 12, skill: 'axe', knock: 1.5, crit: 3.2, col: '#a83b3b', sh: 'blade', tool: ['chop'] },
  crowbar: { name: '撬棍', t: 'melee', w: 1.8, v: 70, dmg: 21, arc: 60, reach: 1.3, cd: 0.7, stam: 7, skill: 'blunt', knock: 1.2, crit: 2.6, col: '#8a4a32', sh: 'blade', tool: ['pry', 'chop'], desc: '可撬开锁门与拆解家具。' },

  // ---------------- 护甲（1-6 级 + 元素抗性） ----------------
  vest_1: { name: '战术马甲 I', t: 'armor', w: 1.8, v: 120, level: 1, cover: { torso_upper: 0.85, torso_lower: 0.7 }, col: '#4d5340', sh: 'armor' },
  vest_2: { name: '插板携行具 II', t: 'armor', w: 3.4, v: 420, level: 2, cover: { torso_upper: 0.95, torso_lower: 0.8 }, col: '#3f4a35', sh: 'armor' },
  vest_4: { name: '重型防弹衣 IV', t: 'armor', w: 6.2, v: 1300, level: 4, cover: { torso_upper: 0.98, torso_lower: 0.9, l_arm: 0.4, r_arm: 0.4 }, col: '#2f3630', sh: 'armor' },
  vest_6: { name: '风暴装甲 VI', t: 'armor', w: 9.5, v: 4200, level: 6, cover: { torso_upper: 1, torso_lower: 0.95, l_arm: 0.6, r_arm: 0.6 }, resist: { spatial: 0.4 }, col: '#33414a', sh: 'armor' },
  vest_billy: { name: '比利防弹衣', t: 'armor', w: 3.0, v: 900, level: 2, cover: { torso_upper: 0.9, torso_lower: 0.8 }, resist: { fire: 0.75 }, col: '#7a3f2a', sh: 'armor' },
  vest_pala: { name: '啪啦防弹衣', t: 'armor', w: 3.0, v: 900, level: 2, cover: { torso_upper: 0.9, torso_lower: 0.8 }, resist: { poison: 0.75, spatial: 0.3 }, col: '#4a6b3f', sh: 'armor' },
  helm_1: { name: '钢盔 I', t: 'helm', w: 1.0, v: 90, level: 1, cover: { head: 0.75 }, col: '#5b6152', sh: 'armor' },
  helm_2: { name: '战术头盔 II', t: 'helm', w: 1.5, v: 380, level: 2, cover: { head: 0.9, neck: 0.4 }, col: '#3b4038', sh: 'armor' },
  helm_4: { name: '重型头盔 IV', t: 'helm', w: 2.8, v: 1250, level: 4, cover: { head: 0.97, neck: 0.6 }, col: '#2e332e', sh: 'armor' },
  helm_nvg: { name: '夜视仪头盔 III', t: 'helm', w: 2.2, v: 1600, level: 3, cover: { head: 0.92, neck: 0.45 }, nightVision: 0.55, power: true, col: '#39413a', sh: 'armor', desc: '需电池供能，夜间大幅提升可视范围。' },

  // ---------------- 背包 / 保险箱 ----------------
  pack_small: { name: '侦察背包', t: 'pack', w: 0.8, v: 100, cap: 14, col: '#6b6141', sh: 'box' },
  pack_mid: { name: '战术背包', t: 'pack', w: 1.6, v: 380, cap: 26, col: '#4d5340', sh: 'box' },
  pack_large: { name: '远征背囊', t: 'pack', w: 2.6, v: 1100, cap: 42, col: '#3f4638', sh: 'box' },
  pouch: { name: '保险箱', t: 'pack', w: 0.5, v: 0, cap: 3.5, safe: true, col: '#8a6b2a', sh: 'box', desc: '死亡后其中物品不会丢失。' },

  // ---------------- 配件 ----------------
  att_scope: { name: '战术瞄具', t: 'att', kind: 'scope', w: 0.4, v: 260, mods: { spread: -0.35, rangeT: 3, ergo: -0.08 }, col: '#2f3238', sh: 'box' },
  att_thermal: { name: '热成像瞄具', t: 'att', kind: 'scope', w: 0.9, v: 1800, mods: { spread: -0.2, rangeT: 2, ergo: -0.18 }, thermal: true, power: true, col: '#2a3a3f', sh: 'box', desc: '开镜进入热成像视野，可发现隐身怪。' },
  att_suppressor: { name: '消音器', t: 'att', kind: 'muzzle', w: 0.5, v: 620, mods: { noise: -14, recoil: -0.15, ergo: -0.06 }, col: '#33363c', sh: 'box', desc: '大幅降低枪声传播半径——僵尸潮的关键。' },
  att_comp: { name: '枪口补偿器', t: 'att', kind: 'muzzle', w: 0.2, v: 240, mods: { recoil: -0.45, noise: 2 }, col: '#3a3d44', sh: 'box' },
  att_grip: { name: '前握把', t: 'att', kind: 'grip', w: 0.2, v: 180, mods: { spread: -0.25, recoil: -0.2 }, col: '#2f3238', sh: 'box' },
  att_stock: { name: '战术枪托', t: 'att', kind: 'stock', w: 0.4, v: 220, mods: { recoil: -0.35, ergo: 0.06 }, col: '#3d4038', sh: 'box' },

  // ---------------- 工具 / 电子 ----------------
  hammer: { name: '锤子', t: 'tool', w: 1.0, v: 40, tool: ['hammer'], dmg: 15, arc: 55, reach: 1.05, cd: 0.6, stam: 5, skill: 'blunt', knock: 0.9, crit: 2, col: '#7d858c', sh: 'blade', desc: '加固门窗必备。' },
  saw: { name: '手锯', t: 'tool', w: 1.2, v: 55, tool: ['saw'], col: '#8a8f94', sh: 'blade' },
  screwdriver: { name: '螺丝刀', t: 'tool', w: 0.3, v: 25, tool: ['screwdriver'], dmg: 9, arc: 35, reach: 0.95, cd: 0.4, stam: 3, skill: 'blade', knock: 0.2, crit: 4, sneakKill: true, col: '#b04a3a', sh: 'blade' },
  lighter: { name: '打火机', t: 'tool', w: 0.05, v: 15, tool: ['fire'], st: 3, col: '#c8483a', sh: 'pill' },
  flashlight: { name: '手电筒', t: 'tool', w: 0.4, v: 80, tool: ['light'], power: true, light: 9.5, cone: 46, col: '#3a3d44', sh: 'box', desc: '黑暗环境唯一光源，但光束会暴露你的位置。' },
  thermal_goggles: { name: '热成像护目镜', t: 'tool', w: 0.7, v: 1500, tool: ['thermal'], power: true, col: '#2a3a3f', sh: 'box' },
  radio: { name: '收音机', t: 'tool', w: 0.9, v: 120, tool: ['radio'], power: true, col: '#5a5348', sh: 'box', desc: '收听紧急广播（降低无聊，播报僵尸潮动向）。' },
  battery: { name: '电池', t: 'mat', w: 0.1, v: 30, st: 12, charge: 1, col: '#2d5a3f', sh: 'ammo' },
  jerrycan: { name: '汽油桶', t: 'tool', w: 4.5, v: 150, gas: 10, col: '#a83b2a', sh: 'box' },
  campfire_kit: { name: '篝火套件', t: 'tool', w: 3.0, v: 60, place: 'campfire', col: '#8a6b3d', sh: 'box', desc: '按 G 放置：火源可取暖、烹饪、烧水，但火光会招来尸群。' },

  // ---------------- 材料 ----------------
  plank: { name: '木板', t: 'mat', w: 1.4, v: 12, st: 12, col: '#8a6b3d', sh: 'plank' },
  nails: { name: '钉子', t: 'mat', w: 0.01, v: 2, st: 200, col: '#8f969c', sh: 'ammo' },
  scrap: { name: '废金属', t: 'mat', w: 0.6, v: 18, st: 20, col: '#6d747a', sh: 'box' },
  sheet_metal: { name: '金属板', t: 'mat', w: 3.0, v: 70, st: 6, col: '#7d858c', sh: 'plank' },
  cloth: { name: '布条', t: 'mat', w: 0.05, v: 4, st: 30, col: '#b8b0a0', sh: 'roll' },
  rope: { name: '绳子', t: 'mat', w: 0.6, v: 25, st: 6, col: '#a8956a', sh: 'roll' },
  duct_tape: { name: '强力胶带', t: 'mat', w: 0.2, v: 35, st: 6, col: '#5a5f63', sh: 'roll' },
  electronics: { name: '电子元件', t: 'mat', w: 0.2, v: 60, st: 20, col: '#3f6b62', sh: 'box' },
  mech_parts: { name: '机械零件', t: 'mat', w: 0.8, v: 80, st: 15, col: '#6b6a63', sh: 'box' },
  chemicals: { name: '化学试剂', t: 'mat', w: 0.5, v: 110, st: 10, col: '#8fd85a', sh: 'bottle' },
  gpu: { name: '显卡', t: 'mat', w: 0.9, v: 850, st: 4, col: '#1f5c4a', sh: 'box', desc: '末世最保值的硬通货。' },
  gunpowder: { name: '火药', t: 'mat', w: 0.1, v: 40, st: 30, col: '#3a3a3a', sh: 'ammo' },

  // ---------------- 投掷 ----------------
  molotov: { name: '燃烧瓶', t: 'throw', w: 0.7, v: 90, st: 4, kind: 'fire', radius: 2.6, dmg: 28, noise: 14, col: '#d4632a', sh: 'bottle' },
  pipe_bomb: { name: '土制炸弹', t: 'throw', w: 1.0, v: 160, st: 3, kind: 'boom', radius: 3.4, dmg: 120, pen: 4, noise: 42, col: '#6b6a63', sh: 'can' },
  smoke: { name: '烟雾弹', t: 'throw', w: 0.5, v: 80, st: 4, kind: 'smoke', radius: 4.0, noise: 8, col: '#8f969c', sh: 'can' },
  marker_dart: { name: '显影飞镖', t: 'throw', w: 0.2, v: 130, st: 6, kind: 'mark', radius: 5.0, noise: 4, col: '#c77dff', sh: 'ammo', desc: '标记范围内的隐身实体，使其显形 20 秒。' },
  noise_maker: { name: '响铃诱饵', t: 'throw', w: 0.4, v: 70, st: 4, kind: 'lure', radius: 16, noise: 34, col: '#c8a04a', sh: 'can', desc: '把僵尸潮引向别处的救命道具。' },
  explosive_charge: { name: '爆破包', t: 'throw', w: 3.0, v: 500, st: 2, kind: 'breach', radius: 2.0, dmg: 200, noise: 60, col: '#a83b2a', sh: 'box', desc: '炸开地图之间的裂缝墙体。' },

  // ---------------- 钥匙 / 任务 / 货币 ----------------
  keycard_blue: { name: '蓝门禁卡', t: 'key', w: 0.02, v: 400, card: 'blue', col: '#4fc3ff', sh: 'card' },
  keycard_red: { name: '红门禁卡', t: 'key', w: 0.02, v: 600, card: 'red', col: '#e0503a', sh: 'card' },
  keycard_green: { name: '绿门禁卡', t: 'key', w: 0.02, v: 400, card: 'green', col: '#5ad46a', sh: 'card' },
  keycard_purple: { name: '紫门禁卡', t: 'key', w: 0.02, v: 700, card: 'purple', col: '#c77dff', sh: 'card' },
  keycard_yellow: { name: '黄门禁卡', t: 'key', w: 0.02, v: 500, card: 'yellow', col: '#e8c85a', sh: 'card' },
  keycard_black: { name: '黑门禁卡', t: 'key', w: 0.02, v: 1500, card: 'black', col: '#2f3238', sh: 'card' },
  credential_1: { name: '1级凭证', t: 'key', w: 0.05, v: 800, cred: 1, col: '#d8c05a', sh: 'card', desc: '进入 J-Lab 实验室的通行证。' },
  credential_3: { name: '3级凭证', t: 'key', w: 0.05, v: 2000, cred: 3, col: '#c77dff', sh: 'card', desc: '风暴区通行证。路障掉落。' },
  cash: { name: '现金', t: 'misc', w: 0.002, v: 1, st: 99999, money: true, col: '#6b8f5a', sh: 'coin' },
  ship_engine: { name: '飞船引擎', t: 'key', w: 8, v: 3000, ship: 1, col: '#7d858c', sh: 'box', desc: '星际飞船部件 1/5。' },
  ship_hull: { name: '飞船外壳', t: 'key', w: 9, v: 3000, ship: 2, col: '#8a9299', sh: 'box', desc: '星际飞船部件 2/5。' },
  ship_nav: { name: '导航仪', t: 'key', w: 3, v: 3000, ship: 3, col: '#3f6b62', sh: 'box', desc: '星际飞船部件 3/5。' },
  ship_fuel: { name: '同位素燃料', t: 'key', w: 5, v: 3500, ship: 4, col: '#7dffd4', sh: 'can', desc: '星际飞船部件 4/5。' },
  ship_core: { name: '空间核心', t: 'key', w: 4, v: 5000, ship: 5, col: '#c77dff', sh: 'ball', desc: '星际飞船部件 5/5。四骑士守护之物。' },
  ship_blueprint: { name: '神秘飞船图纸', t: 'key', w: 0.1, v: 4000, col: '#d8d0a8', sh: 'card', desc: '完美结局的关键。' },

  // ---------------- 技能书 ----------------
  book_carpentry: { name: '木工手册', t: 'book', w: 0.6, v: 200, skill: 'carpentry', xp: 120, col: '#7a5a3a', sh: 'box' },
  book_firstaid: { name: '战场急救手册', t: 'book', w: 0.5, v: 240, skill: 'firstaid', xp: 120, col: '#a83b3b', sh: 'box' },
  book_cooking: { name: '末世食谱', t: 'book', w: 0.5, v: 180, skill: 'cooking', xp: 120, col: '#c8963a', sh: 'box' },
  book_aiming: { name: '射击教范', t: 'book', w: 0.6, v: 300, skill: 'aiming', xp: 120, col: '#4d5340', sh: 'box' },
  book_fitness: { name: '体能训练指南', t: 'book', w: 0.5, v: 220, skill: 'fitness', xp: 120, col: '#3f6b62', sh: 'box' },
  book_electrical: { name: '电工基础', t: 'book', w: 0.6, v: 260, skill: 'electrical', xp: 120, col: '#c8c04a', sh: 'box' },
};

// 补全缺省字段
for (const id in ITEMS) {
  const it = ITEMS[id];
  it.id = id;
  if (it.st === undefined) it.st = 1;
  if (it.v === undefined) it.v = 10;
  if (it.w === undefined) it.w = 0.5;
  if (it.col === undefined) it.col = '#8a8f94';
  if (it.sh === undefined) it.sh = 'box';
}

export function itemDef(id) { return ITEMS[id] || ITEMS.scrap; }

/** 创建物品实例 */
export function mkItem(id, n = 1, extra = null) {
  const d = itemDef(id);
  const it = { id, n: Math.max(1, n | 0) };
  if (d.t === 'gun') { it.loaded = 0; it.ammoId = d.ammo[0]; it.cond = 1; it.att = {}; }
  if (d.t === 'melee' || d.t === 'tool') it.cond = 1;
  if (d.t === 'armor' || d.t === 'helm') it.cond = 1;
  if (d.perish) it.fresh = 1;
  if (d.t === 'drink') it.water = d.water !== undefined ? d.water : 0;
  if (d.power) it.charge = 1;
  if (d.gas) it.gas = d.gas;
  if (extra) Object.assign(it, extra);
  return it;
}

/** 单件重量（含内容物/弹药） */
export function itemWeight(it) {
  const d = itemDef(it.id);
  let w = d.w * it.n;
  if (it.loaded) w += it.loaded * (itemDef(it.ammoId || 'ammo_9').w);
  if (d.t === 'drink' && it.water) w += it.water * 0.05;
  return w;
}

export function itemName(it) {
  const d = itemDef(it.id);
  let n = d.name;
  if (d.t === 'gun') n += ` [${it.loaded || 0}/${d.mag}]`;
  if (d.t === 'drink' && d.water) n += ` (${Math.round(it.water)}/${d.water})`;
  if (it.fresh !== undefined) {
    if (it.fresh <= 0) n = '腐烂的' + n;
    else if (it.fresh < 0.35) n = '不新鲜的' + n;
  }
  if (it.cooked) n = '熟' + n;
  if (it.n > 1) n += ` ×${it.n}`;
  return n;
}

/** 条件/新鲜度描述 */
export function itemSub(it) {
  const d = itemDef(it.id);
  const parts = [];
  if (it.cond !== undefined && d.t !== 'mat') parts.push('耐久 ' + Math.round(it.cond * 100) + '%');
  if (it.charge !== undefined) parts.push('电量 ' + Math.round(it.charge * 100) + '%');
  if (it.fresh !== undefined) parts.push('新鲜 ' + Math.round(Math.max(0, it.fresh) * 100) + '%');
  if (d.tier) parts.push(AMMO_TIER_NAME[d.tier] + ' · 穿透' + d.tier);
  if (d.level) parts.push('护甲 ' + d.level + ' 级');
  return parts.join(' · ');
}
