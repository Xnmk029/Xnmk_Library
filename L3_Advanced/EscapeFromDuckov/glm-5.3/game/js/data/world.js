// ============================================================
// data/world.js — 地图配置 / 搜刮战利品表 / 配方 / 藏身处设施 / 商人
// ============================================================
'use strict';

// ---------- 战利品表：[物品ID, 权重, 数量范围, 稀有标记] ----------
DB.loot = {
  kitchen:   [['f_canBeans', 10, 1, 2], ['f_canCorn', 9, 1, 2], ['f_canSoup', 7, 1, 1], ['f_pbz', 5, 1, 1], ['f_choco', 6, 1, 2], ['f_cookie', 6, 1, 2], ['w_dirty', 5, 1, 1], ['t_lighter', 3, 1, 1], [null, 12]],
  fridge:    [['f_canSoup', 8, 1, 2], ['w_soda', 9, 1, 2], ['w_beer', 7, 1, 2], ['f_meatRaw', 6, 1, 2], ['f_canCorn', 6, 1, 2], ['w_bottle', 5, 1, 1], [null, 10]],
  wardrobe:  [['ar_cloth', 7, 1, 1], ['ar_leather', 4, 1, 1], ['ar_rain', 3, 1, 1], ['mat_sheet', 8, 2, 4], ['bag_school', 3, 1, 1], ['b_novel', 4, 1, 1], ['f_choco', 2, 1, 1], [null, 10]],
  medcab:    [['m_bandage', 10, 1, 2], ['m_alcohol', 8, 1, 2], ['m_pain', 7, 1, 2], ['m_bandS', 5, 1, 1], ['m_antibio', 4, 1, 1], ['w_puritab', 5, 1, 2], ['m_splint', 3, 1, 1], ['m_syr', 2, 1, 1, 1], [null, 8]],
  living:    [['b_novel', 6, 1, 1], ['f_choco', 5, 1, 1], ['b_aim', 2, 1, 1, 1], ['t_lighter', 3, 1, 1], ['v_cash', 4, 3, 14], ['w_soda', 4, 1, 1], ['m_bandage', 3, 1, 1], [null, 12]],
  toolbox:   [['t_hammer', 6, 1, 1], ['t_screw', 7, 1, 1], ['t_saw', 4, 1, 1], ['mat_nails', 8, 1, 2], ['mat_plank', 6, 1, 3], ['mat_scrap', 7, 1, 3], ['wpn_wrench', 4, 1, 1], ['mat_duct', 4, 1, 1], ['wpn_crow', 2, 1, 1], [null, 8]],
  shelf:     [['mat_scrap', 9, 2, 4], ['mat_elec', 4, 1, 2], ['mat_plank', 6, 1, 3], ['mat_duct', 4, 1, 1], ['v_gpu', 1, 1, 1, 1], ['v_cash', 5, 5, 20], ['f_ration', 4, 1, 2], [null, 8]],
  crate:     [['mat_scrap', 8, 2, 5], ['mat_plank', 7, 1, 4], ['mat_nails', 5, 1, 2], ['f_canBeans', 4, 1, 2], ['w_bottle', 4, 1, 2], ['wpn_axe', 2, 1, 1], ['v_gpu', 1, 1, 1, 1], [null, 8]],
  desk:      [['v_intel', 5, 1, 2], ['v_cash', 6, 4, 18], ['b_carp', 3, 1, 1], ['b_fa', 3, 1, 1], ['t_screw', 3, 1, 1], ['k_blue', 1, 1, 1, 1], [null, 10]],
  gunshelf:  [['a_9', 10, 6, 15], ['a_12', 8, 4, 10], ['a_762', 6, 5, 12], ['a_9ap', 4, 5, 10], ['gun_m9', 3, 1, 1], ['gun_shotgun', 2, 1, 1], ['gun_mp5', 1, 1, 1, 1], ['at_rdot', 2, 1, 1], ['h_cap', 2, 1, 1], [null, 6]],
  milcrate:  [['a_762ap', 9, 8, 18], ['a_762', 7, 8, 16], ['ar_plate3', 3, 1, 1, 1], ['h_mil', 3, 1, 1], ['gun_ak', 2, 1, 1, 1], ['gun_m14', 2, 1, 1, 1], ['a_308', 3, 5, 10], ['m_medkit', 3, 1, 1], ['f_ration', 5, 1, 2], ['at_sil', 2, 1, 1], [null, 5]],
  labbox:    [['mat_chem', 7, 1, 3], ['mat_elec', 8, 1, 3], ['a_762x', 4, 4, 8, 1], ['a_308x', 3, 4, 8, 1], ['at_thermal', 2, 1, 1, 1], ['g_thermal', 2, 1, 1, 1], ['ar_lab', 3, 1, 1], ['v_gpu', 4, 1, 1, 1], ['h_sf', 2, 1, 1, 1], ['m_surgery', 2, 1, 1, 1], [null, 5]],
  corpse:    [['v_cash', 8, 1, 6], ['mat_sheet', 5, 1, 2], ['m_bandage', 3, 1, 1], ['f_berry', 2, 1, 2], ['a_9', 2, 3, 6], [null, 8]],
  register:  [['v_cash', 14, 8, 30], ['v_intel', 2, 1, 1, 1], [null, 6]],
  medstore:  [['m_bandage', 9, 2, 3], ['m_bandS', 8, 1, 2], ['m_alcohol', 8, 2, 3], ['m_pain', 7, 1, 2], ['m_antibio', 5, 1, 2], ['m_medkit', 4, 1, 1], ['m_surgery', 2, 1, 1, 1], ['m_syr', 3, 1, 1], ['m_syrWt', 2, 1, 1], ['m_splint', 4, 1, 2], ['w_puritab', 5, 1, 3], [null, 5]],
};

// ---------- 地图 ----------
DB.maps = {
  suburb: {
    nm: '鸭栖镇 · 零号区', en: 'ZONE 0 — DUCKROOST', risk: '低', riskCol: '#46c07a',
    desc: '安静的近郊住宅区。鸭尸密度低，物资温和，适合搜刮熟悉环境。北桥/南码头/东隧道/西公路共 4 处撤离点。',
    w: 96, h: 72, density: 0.3, limit: 2160, dark: false, weather: ['clear', 'clear', 'overcast', 'rain'],
    spawns: { shambler: 62, crawler: 12, sprinter: 10, screamer: 6, armored: 6, camo: 0, armored4: 0, boss_jailer: 0, boss_roadblock: 0, boss_storm: 0 },
    rareLoot: 1, nightBoost: 1.15
  },
  warehouse: {
    nm: '仓库区', en: 'WAREHOUSE DISTRICT', risk: '中', riskCol: '#f0b429',
    desc: '废弃工业带：集装箱堆场、货架大厅、地库。装甲鸭尸开始出现，地库深处传闻有「典狱长」镇守。',
    w: 96, h: 72, density: 0.42, limit: 2160, dark: false, weather: ['overcast', 'overcast', 'rain', 'clear'],
    spawns: { shambler: 40, crawler: 14, sprinter: 16, screamer: 8, armored: 16, camo: 0, armored4: 0, boss_jailer: 1, boss_roadblock: 0, boss_storm: 0 },
    rareLoot: 1.25, nightBoost: 1.2, require: { type: 'extractCount', val: 1, hint: '首次成功撤离零号区后解锁' }
  },
  lab: {
    nm: 'J-Lab 实验室', en: 'J-LAB FACILITY', risk: '高', riskCol: '#e07840',
    desc: 'B1 电力控制区 + B2 高阶彩卡实验区。室内永久断电，手电是命。隐形迷彩体与爬行鸭横行。B1 尽头镇守着「路障」。',
    w: 84, h: 64, density: 0.5, limit: 1800, dark: true, weather: [],
    spawns: { shambler: 18, crawler: 24, sprinter: 8, screamer: 4, armored: 20, camo: 14, armored4: 10, boss_jailer: 0, boss_roadblock: 1, boss_storm: 0 },
    rareLoot: 1.6, nightBoost: 1,
    require: { type: 'item', val: 'k_cred1', hint: '消耗 1级凭证进入（情报中心合成 / 商人购买）' }
  },
  storm: {
    nm: '风暴区', en: 'STORM ZONE', risk: '极险', riskCol: '#e5484d',
    desc: '永恒暴雨与落雷笼罩的毁灭区。视野极差、精英云集。中央废墟中的「雷暴骑士」持有风暴枪与神秘飞船图纸。',
    w: 96, h: 72, density: 0.55, limit: 1800, dark: false, storm: true, weather: ['storm'],
    spawns: { shambler: 22, crawler: 14, sprinter: 22, screamer: 10, armored: 20, camo: 8, armored4: 12, boss_jailer: 0, boss_roadblock: 0, boss_storm: 1 },
    rareLoot: 2, nightBoost: 1.25,
    require: { type: 'item', val: 'k_cred3', hint: '消耗 3级凭证进入（击败「路障」掉落）' }
  },
};
DB.mapOrder = ['suburb', 'warehouse', 'lab', 'storm'];

// ---------- 配方 ----------
DB.recipes = [
  { id: 'r_band', nm: '简易绷带', out: ['m_bandage', 1], ing: [['mat_sheet', 1]], desc: '布条缠一缠。不无菌但能救命。' },
  { id: 'r_splint', nm: '夹板', out: ['m_splint', 1], ing: [['mat_plank', 1], ['mat_sheet', 2]], desc: '骨折自救第一步。' },
  { id: 'r_cook', nm: '烤肉', out: ['f_meatCook', 1], ing: [['f_meatRaw', 1]], tool: 'lighter', time: 8, desc: '用打火机烤熟生肉。' },
  { id: 'r_puri', nm: '净化浑水', out: ['w_bottle', 1], ing: [['w_dirty', 1], ['w_puritab', 1]], desc: '浑水 → 可饮用水。' },
  { id: 'r_nbat', nm: '钉刺球棒', out: ['wpn_nbat', 1], ing: [['mat_plank', 2], ['mat_nails', 1]], tool: 'hammer', desc: '木板钉钉子，土法狼牙棒。' },
  { id: 'r_spear', nm: '长矛', out: ['wpn_spear', 1], ing: [['wpn_stick', 1], ['wpn_knife', 1], ['mat_sheet', 1]], desc: '消耗一把匕首换取最长攻击距离。' },
  // 工作台（藏身处设施）弹药压装
  { id: 'r_a9', nm: '压装 9mm×12', out: ['a_9', 12], ing: [['mat_case', 3], ['mat_powder', 1], ['mat_head', 3]], fac: ['wb', 1], desc: '基础手枪弹。' },
  { id: 'r_a9ap', nm: '压装 9mm穿甲×10', out: ['a_9ap', 10], ing: [['mat_case', 3], ['mat_powder', 1], ['mat_head', 3], ['mat_scrap', 1]], fac: ['wb', 1], desc: '蓝弹。' },
  { id: 'r_a762', nm: '压装 7.62×10', out: ['a_762', 10], ing: [['mat_case', 3], ['mat_powder', 2], ['mat_head', 3]], fac: ['wb', 1], desc: '步枪弹。' },
  { id: 'r_a762ap', nm: '压装 7.62穿甲×10', out: ['a_762ap', 10], ing: [['mat_case', 3], ['mat_powder', 2], ['mat_head', 3], ['mat_scrap', 2]], fac: ['wb', 2], desc: '蓝弹。' },
  { id: 'r_a308', nm: '压装 .308穿甲×8', out: ['a_308', 8], ing: [['mat_case', 3], ['mat_powder', 2], ['mat_head', 3], ['mat_scrap', 1]], fac: ['wb', 2], desc: '狙击蓝弹。' },
  { id: 'r_a762x', nm: '压装 7.62高级穿甲×8', out: ['a_762x', 8], ing: [['mat_case', 3], ['mat_powder', 2], ['mat_head', 3], ['mat_chem', 1]], fac: ['wb', 3], desc: '紫弹。穿甲 5。' },
  { id: 'r_a308x', nm: '压装 .308高级穿甲×6', out: ['a_308x', 6], ing: [['mat_case', 3], ['mat_powder', 2], ['mat_head', 3], ['mat_chem', 1]], fac: ['wb', 3], desc: '紫弹。穿甲 5。' },
  { id: 'r_acell', nm: '充能 风暴电池×8', out: ['a_cell', 8], ing: [['mat_elec', 2], ['mat_chem', 1], ['mat_scrap', 1]], fac: ['wb', 3], desc: '风暴枪弹药。' },
  { id: 'r_sil', nm: '自制消音器', out: ['at_sil', 1], ing: [['mat_scrap', 3], ['mat_duct', 1]], fac: ['wb', 1], tool: 'screw', desc: '枪声 -72%。潜行鸭福音。' },
  { id: 'r_rdot', nm: '红点镜', out: ['at_rdot', 1], ing: [['mat_elec', 1], ['mat_scrap', 1]], fac: ['wb', 2], desc: '散布 -30%。' },
  { id: 'r_mag', nm: '扩容弹匣', out: ['at_mag', 1], ing: [['mat_scrap', 2], ['mat_elec', 1]], fac: ['wb', 2], desc: '弹匣 +60%。' },
  { id: 'r_storm', nm: '组装 风暴枪', out: ['gun_storm', 1], ing: [['mat_elec', 6], ['mat_chem', 3], ['mat_scrap', 6]], fac: ['wb', 3], desc: '需要先获得风暴枪图纸（雷暴骑士掉落成品，图纸可复制备用）。' },
  { id: 'r_cred1', nm: '合成 1级凭证', out: ['k_cred1', 1], ing: [['v_intel', 2], ['v_cash', 30]], fac: ['intel', 2], desc: '情报中心 II 级：伪造 J-Lab 通行证。' },
];

// ---------- 藏身处设施 ----------
DB.facilities = [
  { id: 'wb', nm: '工作台', max: 3, cost: lv => ({ mat_plank: 4 + lv * 2, mat_scrap: 4 + lv * 3, mat_elec: lv, v_cash: 20 * lv }), dsc: ['弹药压装与基础改装（消音器）', '高级穿甲弹 / 红点 / 扩容弹匣', '紫弹、风暴电池、风暴枪组装'] },
  { id: 'kitchen', nm: '厨房', max: 3, cost: lv => ({ mat_plank: 3 + lv, mat_scrap: 2 + lv, v_cash: 15 * lv }), dsc: ['出击携带 1 份熟食', '出击携带 2 份熟食 + 净水×2', '出击携带 3 份熟食 + 净水×4 + 咖啡×2'] },
  { id: 'gym', nm: '健身房', max: 3, cost: lv => ({ mat_plank: 3 + lv * 2, mat_scrap: 3 + lv * 2, f_protein: 1 }), dsc: ['生命上限 +8 / 体力上限 +8%', '生命上限 +16 / 体力上限 +16%', '生命上限 +24 / 体力上限 +24%'] },
  { id: 'med', nm: '医疗站', max: 3, cost: lv => ({ mat_elec: lv, mat_scrap: 2 + lv, v_cash: 25 * lv }), dsc: ['出击附赠：无菌绷带×1 酒精×1', '+止痛药×1 抗生素×1', '+急救包×1 手术包×1'] },
  { id: 'intel', nm: '情报中心', max: 3, cost: lv => ({ mat_elec: 1 + lv, v_intel: lv, v_cash: 30 * lv }), dsc: ['战局地图常显撤离点', '+显示鸭尸热区 / 合成1级凭证', '+商人稀有货架 / 解锁风暴区情报'] },
];

// ---------- 神秘商人（只收现金） ----------
DB.merchant = [
  { id: 'm_bandage', price: 25, stock: 8 }, { id: 'm_bandS', price: 55, stock: 5 }, { id: 'm_alcohol', price: 20, stock: 8 },
  { id: 'm_pain', price: 35, stock: 6 }, { id: 'm_antibio', price: 80, stock: 4 }, { id: 'm_splint', price: 45, stock: 4 },
  { id: 'm_medkit', price: 160, stock: 3 }, { id: 'm_syr', price: 300, stock: 2 }, { id: 'm_syrWt', price: 240, stock: 2 },
  { id: 'w_bottle', price: 15, stock: 10 }, { id: 'f_ration', price: 30, stock: 6 }, { id: 'w_puritab', price: 12, stock: 8 },
  { id: 'a_9', price: 4, stock: 60, per: 10 }, { id: 'a_9ap', price: 9, stock: 40, per: 10 }, { id: 'a_762ap', price: 14, stock: 30, per: 10 },
  { id: 'a_12', price: 7, stock: 30, per: 10 }, { id: 'it_batt', price: 18, stock: 8 }, { id: 'fl_tact', price: 200, stock: 2 },
  { id: 'bag_tac', price: 380, stock: 2 }, { id: 't_hammer', price: 30, stock: 2 }, { id: 'k_cred1', price: 1400, stock: 1 },
  { id: 'g_thermal', price: 1600, stock: 1 },
];

// 商人稀有货架（情报中心 III 解锁）
DB.merchantRare = [
  { id: 'at_thermal', price: 1800, stock: 1 }, { id: 'ar_plate4', price: 1500, stock: 1 }, { id: 'h_sf', price: 1100, stock: 1 },
  { id: 'a_762x', price: 30, stock: 20, per: 5 }, { id: 'gun_m14', price: 1500, stock: 1 }, { id: 'm_surgery', price: 400, stock: 2 },
];

window.DB = DB;
