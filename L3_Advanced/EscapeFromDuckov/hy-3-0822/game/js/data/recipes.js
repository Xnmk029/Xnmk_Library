// ============================================================
//  recipes.js — 制作配方（僵毁式：工具 + 技能 + 工作台限制）
//  station: null 随地 | fire 火源 | kitchen 厨房 | workbench 工作台 | tech 技术中心
// ============================================================

export const SKILL_NAMES = {
  carpentry: '木工', firstaid: '急救', cooking: '烹饪', electrical: '电工', metal: '金属加工',
  mech: '机械', aiming: '枪法', reload: '装填', sneak: '潜行', sprint: '短跑', nimble: '灵巧',
  blunt: '钝器', blade: '刀具', axe: '斧类', fitness: '体能', strength: '力量',
};

export const RECIPES = [
  // ---- 医疗 ----
  { id: 'r_rag', name: '撕出脏布条', out: [['dirty_rag', 1]], in: [['cloth', 1]], time: 1.5, station: null, xp: { firstaid: 2 }, desc: '应急止血物。会带来伤口感染风险。' },
  { id: 'r_bandage', name: '制作无菌绷带', out: [['bandage', 1]], in: [['cloth', 2]], skill: { firstaid: 1 }, time: 3, station: null, xp: { firstaid: 8 } },
  { id: 'r_bandage2', name: '消毒脏布条', out: [['bandage', 2]], in: [['dirty_rag', 2], ['disinfectant', 1]], skill: { firstaid: 2 }, time: 4, station: null, xp: { firstaid: 10 } },
  { id: 'r_splint', name: '制作夹板', out: [['splint', 1]], in: [['wood_stick', 1], ['cloth', 2]], skill: { firstaid: 1 }, time: 5, station: null, xp: { firstaid: 12 } },
  { id: 'r_fak', name: '组装急救包', out: [['first_aid_kit', 1]], in: [['bandage', 3], ['disinfectant', 1], ['painkiller', 1]], skill: { firstaid: 3 }, time: 8, station: null, xp: { firstaid: 25 } },
  { id: 'r_serum', name: '合成血清', out: [['serum', 1]], in: [['chemicals', 3], ['electronics', 2]], skill: { electrical: 3 }, time: 14, station: 'tech', xp: { electrical: 40 }, desc: '唯一能清除鸭瘟感染的手段。' },

  // ---- 木工 / 材料 ----
  { id: 'r_stick', name: '锯短木板', out: [['wood_stick', 2]], in: [['plank', 1]], tool: ['saw'], time: 3, station: null, xp: { carpentry: 5 } },
  { id: 'r_plank_scrap', name: '木板→布条', out: [['cloth', 2]], in: [['plank', 1]], tool: ['saw'], time: 2, station: null },
  { id: 'r_sheet', name: '锻打金属板', out: [['sheet_metal', 1]], in: [['scrap', 5]], skill: { metal: 1 }, tool: ['hammer'], time: 8, station: 'workbench', xp: { metal: 18 } },
  { id: 'r_campfire', name: '制作篝火套件', out: [['campfire_kit', 1]], in: [['plank', 2], ['cloth', 1]], skill: { carpentry: 1 }, time: 5, station: null, xp: { carpentry: 10 }, desc: '可放置的火源：取暖、烤肉、烧开水。' },

  // ---- 投掷物 / 弹药 ----
  { id: 'r_molotov', name: '燃烧瓶', out: [['molotov', 1]], in: [['empty_bottle', 1], ['cloth', 1], ['gas', 1]], time: 4, station: null, xp: { metal: 5 } },
  { id: 'r_pipebomb', name: '土制炸弹', out: [['pipe_bomb', 1]], in: [['scrap', 2], ['gunpowder', 6], ['electronics', 1]], skill: { electrical: 2 }, time: 9, station: 'workbench', xp: { electrical: 25 } },
  { id: 'r_lure', name: '响铃诱饵', out: [['noise_maker', 1]], in: [['scrap', 1], ['electronics', 1], ['battery', 1]], skill: { electrical: 1 }, time: 5, station: null, xp: { electrical: 15 } },
  { id: 'r_dart', name: '显影飞镖', out: [['marker_dart', 2]], in: [['chemicals', 1], ['scrap', 1]], skill: { electrical: 1 }, time: 5, station: 'workbench', xp: { electrical: 15 } },
  { id: 'r_charge', name: '爆破包', out: [['explosive_charge', 1]], in: [['gunpowder', 12], ['scrap', 3], ['electronics', 2], ['duct_tape', 1]], skill: { electrical: 3 }, time: 15, station: 'workbench', xp: { electrical: 45 }, desc: '炸开地图之间被封堵的裂缝。' },
  { id: 'r_ammo9', name: '复装 9mm', out: [['ammo_9', 10]], in: [['gunpowder', 3], ['scrap', 1]], skill: { metal: 1 }, time: 8, station: 'workbench', xp: { metal: 12 } },
  { id: 'r_ammo762', name: '复装 7.62', out: [['ammo_762', 10]], in: [['gunpowder', 5], ['scrap', 2]], skill: { metal: 2 }, time: 10, station: 'workbench', xp: { metal: 16 } },
  { id: 'r_ap762', name: '改装紫弹 7.62', out: [['ammo_762ap', 5]], in: [['ammo_762', 8], ['chemicals', 1], ['scrap', 1]], skill: { metal: 3 }, time: 12, station: 'workbench', xp: { metal: 30 } },
  { id: 'r_ap556', name: '改装蓝弹 5.56', out: [['ammo_556ap', 5]], in: [['ammo_556', 8], ['chemicals', 1]], skill: { metal: 2 }, time: 11, station: 'workbench', xp: { metal: 24 } },

  // ---- 武器配件 ----
  { id: 'r_comp', name: '枪口补偿器', out: [['att_comp', 1]], in: [['scrap', 3], ['mech_parts', 2]], skill: { mech: 1 }, time: 10, station: 'workbench', xp: { mech: 20 } },
  { id: 'r_supp', name: '自制消音器', out: [['att_suppressor', 1]], in: [['sheet_metal', 1], ['mech_parts', 3], ['duct_tape', 1]], skill: { mech: 3 }, time: 16, station: 'workbench', xp: { mech: 45 } },
  { id: 'r_grip', name: '前握把', out: [['att_grip', 1]], in: [['plank', 1], ['duct_tape', 1], ['scrap', 1]], skill: { mech: 1 }, time: 7, station: 'workbench', xp: { mech: 15 } },

  // ---- 烹饪 / 净水 ----
  { id: 'r_boil', name: '烧开污水', out: [['water_bottle', 1]], in: [['tainted_water', 1]], time: 6, station: 'fire', xp: { cooking: 6 }, desc: '煮沸后可安全饮用。' },
  { id: 'r_noodle', name: '煮泡面', out: [['hot_noodle', 1]], in: [['instant_noodle', 1], ['water_bottle', 1]], time: 6, station: 'fire', xp: { cooking: 10 } },
  { id: 'r_patty', name: '烤肉饼', out: [['cooked_patty', 1]], in: [['raw_patty', 1]], time: 6, station: 'fire', xp: { cooking: 12 } },
  { id: 'r_egg', name: '煎蛋', out: [['cooked_egg', 1]], in: [['egg', 1]], time: 4, station: 'fire', xp: { cooking: 8 } },

  // ---- 技术中心 ----
  { id: 'r_cred1', name: '复制 1 级凭证', out: [['credential_1', 1]], in: [['electronics', 5], ['gpu', 1]], skill: { electrical: 2 }, time: 18, station: 'tech', xp: { electrical: 35 }, desc: '小明的技术活：伪造 J-Lab 通行证。' },
  { id: 'r_battery', name: '重制电池', out: [['battery', 2]], in: [['scrap', 2], ['chemicals', 1]], skill: { electrical: 1 }, time: 8, station: 'workbench', xp: { electrical: 12 } },
];

/** 虚拟材料：gas 从油桶中取用 */
export const VIRTUAL_MATS = { gas: '汽油(油桶)' };
export const CAMPFIRE_KIT = 'campfire_kit';
