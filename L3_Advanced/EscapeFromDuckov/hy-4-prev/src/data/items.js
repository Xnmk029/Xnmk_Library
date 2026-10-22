// 物品总表：消耗品 / 材料 / 贵重品 / 钥匙卡 / 弹药。医疗在 medical.js，武器在 weapons.js。
// grid 是背包占格（宽×高），重量单位 kg —— 直接影响负重 moodle。
export const ITEMS = {
  // ---- 弹药盒 ----
  ammo_9mm: { id: 'ammo_9mm', name: '9mm 弹药盒', cat: 'ammo', caliber: '9mm', tier: 1, count: 30, grid: [1, 1], weight: 0.4, value: 40 },
  ammo_556: { id: 'ammo_556', name: '5.56 弹药盒', cat: 'ammo', caliber: '5.56', tier: 1, count: 30, grid: [1, 1], weight: 0.5, value: 60 },
  ammo_762: { id: 'ammo_762', name: '7.62 弹药盒', cat: 'ammo', caliber: '7.62', tier: 1, count: 30, grid: [1, 1], weight: 0.6, value: 75 },
  ammo_762_ap: { id: 'ammo_762_ap', name: '7.62 蓝弹', cat: 'ammo', caliber: '7.62', tier: 3, count: 30, grid: [1, 1], weight: 0.6, value: 190 },
  ammo_556_purple: { id: 'ammo_556_purple', name: '5.56 紫弹', cat: 'ammo', caliber: '5.56', tier: 5, count: 30, grid: [1, 1], weight: 0.5, value: 320 },
  ammo_storm: { id: 'ammo_storm', name: '风暴能量弹', cat: 'ammo', caliber: '5.56', tier: 7, count: 20, grid: [1, 1], weight: 0.45, value: 780 },

  // ---- 消耗品 ----
  canned_food: { id: 'canned_food', name: '罐头', cat: 'food', grid: [1, 1], weight: 0.35, value: 30, hunger: -42, calories: 380, thirst: 4 },
  energy_bar: { id: 'energy_bar', name: '能量棒', cat: 'food', grid: [1, 1], weight: 0.1, value: 18, hunger: -18, calories: 240 },
  water_bottle: { id: 'water_bottle', name: '瓶装水', cat: 'drink', grid: [1, 1], weight: 0.6, value: 22, thirst: -55 },
  cooked_meat: { id: 'cooked_meat', name: '熟肉', cat: 'food', grid: [1, 1], weight: 0.3, value: 45, hunger: -55, calories: 520 },
  raw_meat: { id: 'raw_meat', name: '生肉', cat: 'food', grid: [1, 1], weight: 0.3, value: 15, hunger: -22, calories: 300, poison: 0.55 },

  // ---- 材料（藏身处升级 / 制作）----
  scrap: { id: 'scrap', name: '废金属', cat: 'material', grid: [1, 1], weight: 0.8, value: 12 },
  plank: { id: 'plank', name: '木板', cat: 'material', grid: [2, 1], weight: 2.2, value: 20 },
  nail: { id: 'nail', name: '钉子', cat: 'material', grid: [1, 1], weight: 0.15, value: 8 },
  wire: { id: 'wire', name: '电线', cat: 'material', grid: [1, 1], weight: 0.2, value: 14 },
  electronic: { id: 'electronic', name: '电子元件', cat: 'material', grid: [1, 1], weight: 0.1, value: 95 },
  gunpowder: { id: 'gunpowder', name: '火药', cat: 'material', grid: [1, 1], weight: 0.3, value: 55 },
  fuel: { id: 'fuel', name: '燃料桶', cat: 'material', grid: [2, 2], weight: 6.0, value: 130 },
  medparts: { id: 'medparts', name: '医疗零件', cat: 'material', grid: [1, 1], weight: 0.2, value: 70 },
};

// ---- 贵重品 / 任务 ----
ITEMS.gpu ={ id: 'gpu', name: '显卡', cat: 'valuable', grid: [1, 1], weight: 0.6, value: 900 };
ITEMS.blueprint = { id: 'blueprint', name: '蓝图', cat: 'valuable', grid: [1, 1], weight: 0.05, value: 600 };
ITEMS.protein_powder = { id: 'protein_powder', name: '蛋白粉', cat: 'quest', grid: [1, 1], weight: 1.2, value: 120, desc: '泥巴要的东西 —— 用来扩建健身房。' };
ITEMS.cash = { id: 'cash', name: '现金', cat: 'valuable', grid: [1, 1], weight: 0.01, value: 1, stack: 9999 };
ITEMS.totem = { id: 'totem', name: '开荒图腾', cat: 'valuable', grid: [1, 1], weight: 0.4, value: 1500 };

// ---- 门禁卡 / 凭证 ----
for (const [id, name, color] of [
  ['keycardRed', '红门禁卡', '#c0392b'],
  ['keycardBlue', '蓝门禁卡', '#2980b9'],
  ['keycardGreen', '绿门禁卡', '#27ae60'],
  ['keycardPurple', '紫门禁卡', '#8e44ad'],
  ['keycardYellow', '黄门禁卡', '#f1c40f'],
  ['keycardBlack', '黑门禁卡', '#2c3e50'],
]) {
  ITEMS[id] = { id, name, cat: 'key', grid: [1, 1], weight: 0.02, value: 400, color };
}
ITEMS.credential1 = { id: 'credential1', name: '1 级凭证', cat: 'key', grid: [1, 1], weight: 0.05, value: 500, desc: '进入 J-Lab 的许可，情报中心可购。' };
ITEMS.credential3 = { id: 'credential3', name: '3 级凭证', cat: 'key', grid: [1, 1], weight: 0.05, value: 1500, desc: '击败实验室 Boss「路障」掉落，通往风暴区。' };
ITEMS.stormGunBp = { id: 'stormGunBp', name: '风暴枪图纸', cat: 'valuable', grid: [1, 1], weight: 0.1, value: 3000 };
ITEMS.spacecraftBp = { id: 'spacecraftBp', name: '神秘飞船图纸', cat: 'valuable', grid: [1, 1], weight: 0.1, value: 5000, desc: '达成完美结局的关键。' };

// ---- 防具（1~6 级）----
ITEMS.armor1 = { id: 'armor1', name: '轻型防弹衣', cat: 'armor', armorLevel: 1, grid: [2, 2], weight: 3.0, value: 180 };
ITEMS.armor3 = { id: 'armor3', name: '三级战术背心', cat: 'armor', armorLevel: 3, grid: [2, 2], weight: 5.5, value: 620 };
ITEMS.armor5 = { id: 'armor5', name: '五级重装甲', cat: 'armor', armorLevel: 5, grid: [2, 3], weight: 9.0, value: 1600 };
ITEMS.helmet2 = { id: 'helmet2', name: '二级头盔', cat: 'armor', armorLevel: 2, slot: 'head', grid: [2, 2], weight: 1.6, value: 340 };

// ---- 背包 ----
ITEMS.backpack_s = { id: 'backpack_s', name: '小背包', cat: 'backpack', capacity: 8, grid: [2, 2], weight: 0.6, value: 60 };
ITEMS.backpack_m = { id: 'backpack_m', name: '战术背包', cat: 'backpack', capacity: 16, grid: [2, 3], weight: 1.2, value: 240 };
ITEMS.backpack_l = { id: 'backpack_l', name: '远征背包', cat: 'backpack', capacity: 26, grid: [3, 3], weight: 2.0, value: 700 };

// ---- 工具 ----
ITEMS.sledgehammer = { id: 'sledgehammer', name: '大锤', cat: 'tool', grid: [3, 1], weight: 5.0, value: 90, desc: '拆解家具与封死的门。' };
ITEMS.flashlight = { id: 'flashlight', name: '手电筒', cat: 'tool', grid: [1, 1], weight: 0.3, value: 55 };
ITEMS.battery = { id: 'battery', name: '电池', cat: 'tool', grid: [1, 1], weight: 0.1, value: 25 };

export const ITEM_CAT = {
  ammo: '弹药', food: '食物', drink: '饮水', material: '材料', valuable: '贵重品',
  key: '钥匙', armor: '防具', backpack: '背包', tool: '工具', quest: '任务',
  weapon: '武器', medical: '医疗',
};

// 武器与医疗分表存放（字段差异大），但背包/战利品/装备栏都必须能统一查到它们，
// 否则"装备手枪"会因为查不到物品定义而静默失败。
import { WEAPONS } from './weapons.js';
import { MEDICAL } from './medical.js';

const WEAPON_GRID = { melee: [1, 2], pistol: [2, 1], smg: [2, 2], ar: [3, 2], sr: [3, 2], shotgun: [3, 2] };

export function itemDef(id) {
  if (ITEMS[id]) return ITEMS[id];
  const w = WEAPONS[id];
  if (w) {
    return {
      id, name: w.name, cat: 'weapon', desc: w.desc,
      grid: WEAPON_GRID[w.kind] || [2, 2],
      weight: w.base?.weight ?? 2, value: (w.tier ?? 1) * 140,
    };
  }
  const m = MEDICAL[id];
  if (m) return { id, name: m.name, cat: 'medical', desc: m.desc, grid: [1, 1], weight: m.weight ?? 0.1, value: m.value ?? 20 };
  return null;
}
