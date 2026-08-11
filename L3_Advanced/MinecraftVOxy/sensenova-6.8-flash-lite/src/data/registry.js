// VOXY CRAFT — 方块 / 物品注册表
// 数据驱动：BLOCKS[id] 用于体素存储与网格化；ITEMS[id] 用于物品栏。
// 方块 id < 256（Uint8Array 存储）。染色系列按 16 色展开为独立 id，但 countKinds() 按"一种"计。
// 贴图键（tile）在 data/textures.js（M4）中以 SVG 程序化定义。

export const BLOCKS = [];
export const ITEMS = [];
export const BLOCK_BY_NAME = Object.create(null);
export const ITEM_BY_NAME = Object.create(null);

let _bid = 0, _iid = 0;

function defineBlock(def) {
  def.id = _bid;
  def.solid = def.solid !== false;                 // 默认实心（参与面剔除）
  def.opaque = def.opaque !== false && !def.transparent;
  BLOCKS[_bid] = def;
  BLOCK_BY_NAME[def.name] = def;
  const bid = _bid++;
  if (def.item !== false) {
    defineItem({
      name: def.name, category: def.category || 'block', blockId: bid,
      icon: tileOf(def), series: def.series, stack: 64,
    });
  }
  return bid;
}

function defineItem(def) {
  def.id = _iid;
  def.stack = def.stack || 64;
  ITEMS[_iid] = def;
  ITEM_BY_NAME[def.name] = def;
  return _iid++;
}

function tileOf(def) {
  if (!def.tile) return null;
  if (typeof def.tile === 'string') return def.tile;
  return def.tile.side || def.tile.top || def.tile.all || null;
}

// ---- 染色调色板（原创命名与配色）----
export const DYES = [
  { key: 'white',     name: '白',   hex: '#e6e6e2' },
  { key: 'orange',    name: '橙',   hex: '#d8793a' },
  { key: 'magenta',   name: '品红', hex: '#b8499c' },
  { key: 'lightblue', name: '淡蓝', hex: '#4a9cd8' },
  { key: 'yellow',    name: '黄',   hex: '#d8c73a' },
  { key: 'lime',      name: '黄绿', hex: '#7ab83a' },
  { key: 'pink',      name: '粉',   hex: '#d8799c' },
  { key: 'gray',      name: '灰',   hex: '#4a4a52' },
  { key: 'lightgray', name: '淡灰', hex: '#9a9aa2' },
  { key: 'cyan',      name: '青',   hex: '#3a9c9c' },
  { key: 'purple',    name: '紫',   hex: '#7a39b8' },
  { key: 'blue',      name: '蓝',   hex: '#3a49b8' },
  { key: 'brown',     name: '棕',   hex: '#7a593a' },
  { key: 'green',     name: '绿',   hex: '#4a7a39' },
  { key: 'red',       name: '红',   hex: '#b8393a' },
  { key: 'black',     name: '黑',   hex: '#20202a' },
];

// ============================================================
//  方块定义
// ============================================================

// 0 = 空气（特殊）
defineBlock({ name: '空气', solid: false, opaque: false, item: false, tile: null });

// ---- 自然地表 ----
defineBlock({ name: '草方块', category: 'natural', tile: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' } });
defineBlock({ name: '泥土', category: 'natural', tile: 'dirt' });
defineBlock({ name: '灰化土', category: 'natural', tile: 'podzol' });
defineBlock({ name: '沙子', category: 'natural', tile: 'sand' });
defineBlock({ name: '红沙', category: 'natural', tile: 'red_sand' });
defineBlock({ name: '砂岩', category: 'natural', tile: { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_bottom' } });
defineBlock({ name: '红砂岩', category: 'natural', tile: { top: 'red_sandstone_top', side: 'red_sandstone_side', bottom: 'red_sandstone_bottom' } });
defineBlock({ name: '砾石', category: 'natural', tile: 'gravel' });
defineBlock({ name: '石头', category: 'natural', tile: 'stone' });
defineBlock({ name: '圆石', category: 'natural', tile: 'cobblestone' });
defineBlock({ name: '苔石', category: 'natural', tile: 'mossy_cobble' });
defineBlock({ name: '花岗岩', category: 'natural', tile: 'granite' });
defineBlock({ name: '闪长岩', category: 'natural', tile: 'diorite' });
defineBlock({ name: '安山岩', category: 'natural', tile: 'andesite' });
defineBlock({ name: '玄武岩', category: 'natural', tile: 'basalt' });
defineBlock({ name: '深板岩', category: 'natural', tile: 'deepslate' });
defineBlock({ name: '苔深板岩', category: 'natural', tile: 'mossy_deepslate' });
defineBlock({ name: '基岩', category: 'natural', tile: 'bedrock' });

// ---- 矿物（矿石 + 金属块）----
const ORES = [
  ['煤', 'coal'], ['铁', 'iron'], ['铜', 'copper'], ['金', 'gold'],
  ['钻石', 'diamond'], ['红石', 'redstone'], ['青金石', 'lapis'], ['翡翠', 'emerald'],
];
for (const [cn, en] of ORES) {
  defineBlock({ name: `${cn}矿石`, category: 'ore', tile: `${en}_ore` });
  defineBlock({ name: `${cn}块`, category: 'ore', tile: `${en}_block` });
}

// ---- 水冰雪 ----
defineBlock({ name: '水', category: 'nature', solid: false, opaque: false, transparent: true, liquid: true, tile: 'water' });
defineBlock({ name: '冰', category: 'nature', transparent: true, tile: 'ice' });
defineBlock({ name: '浮冰', category: 'nature', tile: 'packed_ice' });
defineBlock({ name: '蓝冰', category: 'nature', tile: 'blue_ice' });
defineBlock({ name: '雪块', category: 'nature', tile: 'snow_block' });
defineBlock({ name: '雪层', category: 'nature', transparent: true, tile: 'snow_layer' });

// ---- 木与叶（4 种树）----
defineBlock({ name: '杉原木', category: 'wood', tile: { top: 'fir_log_top', side: 'fir_log_side' } });
defineBlock({ name: '棕榈原木', category: 'wood', tile: { top: 'palm_log_top', side: 'palm_log_side' } });
defineBlock({ name: '樱花原木', category: 'wood', tile: { top: 'sakura_log_top', side: 'sakura_log_side' } });
defineBlock({ name: '巨树原木', category: 'wood', tile: { top: 'giant_log_top', side: 'giant_log_side' } });
defineBlock({ name: '杉木板', category: 'wood', tile: 'fir_planks' });
defineBlock({ name: '棕榈木板', category: 'wood', tile: 'palm_planks' });
defineBlock({ name: '樱花木板', category: 'wood', tile: 'sakura_planks' });
defineBlock({ name: '杉树叶', category: 'leaf', transparent: true, opaque: false, tile: 'fir_leaves' });
defineBlock({ name: '棕榈叶', category: 'leaf', transparent: true, opaque: false, tile: 'palm_leaves' });
defineBlock({ name: '樱花叶', category: 'leaf', transparent: true, opaque: false, tile: 'sakura_leaves' });
defineBlock({ name: '巨树叶', category: 'leaf', transparent: true, opaque: false, tile: 'giant_leaves' });

// ---- 植物（非实心，alpha-test）----
defineBlock({ name: '草', category: 'plant', solid: false, opaque: false, transparent: true, cross: true, tile: 'tallgrass' });
defineBlock({ name: '蕨', category: 'plant', solid: false, opaque: false, transparent: true, cross: true, tile: 'fern' });
defineBlock({ name: '花', category: 'plant', solid: false, opaque: false, transparent: true, cross: true, tile: 'flower', series: 'flower' });
defineBlock({ name: '仙人掌', category: 'plant', tile: { top: 'cactus_top', side: 'cactus_side' } });
defineBlock({ name: '甘蔗', category: 'plant', solid: false, opaque: false, transparent: true, cross: true, tile: 'sugarcane' });
defineBlock({ name: '红蘑菇', category: 'plant', solid: false, opaque: false, transparent: true, cross: true, tile: 'mushroom_red' });
defineBlock({ name: '棕蘑菇', category: 'plant', solid: false, opaque: false, transparent: true, cross: true, tile: 'mushroom_brown' });
defineBlock({ name: '藤蔓', category: 'plant', solid: false, opaque: false, transparent: true, tile: 'vine' });
defineBlock({ name: '睡莲', category: 'plant', solid: false, opaque: false, transparent: true, tile: 'lilypad' });
defineBlock({ name: '竹子', category: 'plant', solid: false, opaque: false, transparent: true, cross: true, tile: 'bamboo' });

// ---- 建筑石 / 砖 ----
defineBlock({ name: '石砖', category: 'build', tile: 'stone_bricks' });
defineBlock({ name: '苔石砖', category: 'build', tile: 'mossy_stone_bricks' });
defineBlock({ name: '裂纹石砖', category: 'build', tile: 'cracked_stone_bricks' });
defineBlock({ name: '錾制石砖', category: 'build', tile: 'chiseled_stone_bricks' });
defineBlock({ name: '砂岩砖', category: 'build', tile: 'sandstone_bricks' });
defineBlock({ name: '红砂岩砖', category: 'build', tile: 'red_sandstone_bricks' });
defineBlock({ name: '石英块', category: 'build', tile: { top: 'quartz_top', side: 'quartz_side', bottom: 'quartz_bottom' } });
defineBlock({ name: '石英砖', category: 'build', tile: 'quartz_bricks' });
defineBlock({ name: '錾制石英', category: 'build', tile: { top: 'quartz_top', side: 'chiseled_quartz' } });
defineBlock({ name: '砖块', category: 'build', tile: 'bricks' });
defineBlock({ name: '石瓦', category: 'build', tile: 'stone_tiles' });
defineBlock({ name: '平滑石头', category: 'build', tile: 'smooth_stone' });
defineBlock({ name: '玻璃', category: 'build', transparent: true, opaque: false, tile: 'glass' });

// ---- 功能 / 装饰 ----
defineBlock({ name: '工作台', category: 'func', tile: { top: 'crafting_top', side: 'crafting_side' } });
defineBlock({ name: '熔炉', category: 'func', tile: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front' } });
defineBlock({ name: '箱子', category: 'func', tile: { top: 'chest_top', side: 'chest_side', front: 'chest_front' } });
defineBlock({ name: '书架', category: 'func', tile: { top: 'fir_planks', side: 'bookshelf' } });
defineBlock({ name: '梯子', category: 'func', solid: false, opaque: false, transparent: true, tile: 'ladder' });
defineBlock({ name: '栅栏', category: 'func', transparent: true, opaque: false, tile: 'fir_planks' });
defineBlock({ name: '门', category: 'func', solid: false, opaque: false, transparent: true, tile: 'door' });
defineBlock({ name: '火把', category: 'func', solid: false, opaque: false, transparent: true, lightEmit: 14, tile: 'torch' });
defineBlock({ name: '萤石', category: 'func', lightEmit: 15, tile: 'glowstone' });
defineBlock({ name: '海晶灯', category: 'func', lightEmit: 15, tile: 'sea_lantern' });
defineBlock({ name: '南瓜', category: 'func', tile: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_front' } });
defineBlock({ name: '南瓜灯', category: 'func', lightEmit: 15, tile: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_lantern' } });
defineBlock({ name: 'TNT', category: 'func', tile: { top: 'tnt_top', side: 'tnt_side', bottom: 'tnt_bottom' } });
defineBlock({ name: '花盆', category: 'func', solid: false, opaque: false, transparent: true, tile: 'flower_pot' });
defineBlock({ name: '铁砧', category: 'func', transparent: true, opaque: false, tile: 'anvil' });
defineBlock({ name: '附魔台', category: 'func', transparent: true, opaque: false, tile: { top: 'enchant_top', side: 'enchant_side' } });
defineBlock({ name: '酿造台', category: 'func', solid: false, opaque: false, transparent: true, tile: 'brewing_stand' });
defineBlock({ name: '信标', category: 'func', transparent: true, opaque: false, lightEmit: 15, tile: 'beacon' });
defineBlock({ name: '海绵', category: 'func', tile: 'sponge' });

// ---- 染色系列方块（16 色 × 6 系列）----
for (const d of DYES) {
  defineBlock({ name: `${d.name}羊毛`, category: 'dyed', series: '羊毛', tile: `wool_${d.key}`, dyeHex: d.hex });
}
for (const d of DYES) {
  defineBlock({ name: `${d.name}混凝土`, category: 'dyed', series: '混凝土', tile: `concrete_${d.key}`, dyeHex: d.hex });
}
for (const d of DYES) {
  defineBlock({ name: `${d.name}陶瓦`, category: 'dyed', series: '陶瓦', tile: `terracotta_${d.key}`, dyeHex: d.hex });
}
for (const d of DYES) {
  defineBlock({ name: `${d.name}地毯`, category: 'dyed', series: '地毯', transparent: true, opaque: false, tile: `carpet_${d.key}`, dyeHex: d.hex });
}
for (const d of DYES) {
  defineBlock({ name: `${d.name}染色玻璃`, category: 'dyed', series: '染色玻璃', transparent: true, opaque: false, tile: `glass_${d.key}`, dyeHex: d.hex });
}
for (const d of DYES) {
  defineBlock({ name: `${d.name}床`, category: 'dyed', series: '床', transparent: true, opaque: false, tile: `bed_${d.key}`, dyeHex: d.hex });
}

// ============================================================
//  物品定义（非方块：工具 / 器械 / 食物 / 材料）
// ============================================================

// ---- 工具：5 材质 × 5 类 = 25 ----
const TIERS = [['木', 'wood'], ['石', 'stone'], ['铁', 'iron'], ['金', 'gold'], ['钻石', 'diamond']];
const TOOLS = [['镐', 'pickaxe'], ['斧', 'axe'], ['锹', 'shovel'], ['锄', 'hoe'], ['剑', 'sword']];
for (const [tc, te] of TIERS) for (const [kc, ke] of TOOLS) {
  defineItem({ name: `${tc}${kc}`, category: 'tool', icon: `${te}_${ke}`, stack: 1 });
}

// ---- 器械 ----
const MECH = ['弓', '弩', '剪刀', '钓鱼竿', '打火石', '刷子', '望远镜', '盾牌'];
for (const m of MECH) defineItem({ name: m, category: 'tool', icon: 'item_' + m, stack: 1 });

// ---- 食物 ----
const FOODS = [
  '面包', '苹果', '金苹果', '胡萝卜', '金胡萝卜', '马铃薯', '烤马铃薯', '甜菜根',
  '西瓜片', '南瓜派', '曲奇', '蛋糕', '生牛肉', '牛排', '生猪排', '熟猪排',
  '生鸡肉', '熟鸡肉', '生鳕鱼', '熟鳕鱼', '生三文鱼', '熟三文鱼', '河豚', '热带鱼',
  '蜘蛛眼', '腐肉', '紫颂果', '蜂蜜瓶', '甜浆果', '发光浆果', '牛奶桶', '蘑菇煲',
];
for (const f of FOODS) defineItem({ name: f, category: 'food', icon: 'food_' + f, stack: f === '蛋糕' ? 1 : 64 });

// ---- 材料 / 杂项 ----
const MATS = [
  '木棍', '煤炭', '木炭', '铁锭', '金锭', '铜锭', '下界合金锭', '钻石', '翡翠', '青金石',
  '红石粉', '石英', '骨粉', '线', '羽毛', '燧石', '皮革', '纸', '书', '附魔书',
  '玻璃瓶', '水桶', '岩浆桶', '雪球', '鸡蛋', '末影珍珠', '烈焰棒', '火药', '粘液球',
  '命名牌', '鞍', '指南针', '时钟', '地图', '箭', '唱片',
];
for (const m of MATS) defineItem({ name: m, category: 'material', icon: 'mat_' + m, stack: m === '附魔书' || m === '唱片' || m === '鞍' || m === '命名牌' ? 1 : 64 });

// ============================================================
//  查询辅助
// ============================================================
export const AIR = 0;
export function getBlock(id) { return BLOCKS[id]; }
export function isSolid(id) { const b = BLOCKS[id]; return !!b && b.solid; }
export function isOpaque(id) { const b = BLOCKS[id]; return !!b && b.opaque; }
export function isTransparent(id) { const b = BLOCKS[id]; return !b || b.transparent; }
export function isLiquid(id) { const b = BLOCKS[id]; return !!b && b.liquid; }
export function blockByName(n) { return BLOCK_BY_NAME[n]; }

// 物品种类计数（染色系列按一种计）——用于验收 ≥80 门槛
export function countKinds() {
  const seen = new Set();
  for (const it of ITEMS) {
    if (!it) continue;
    seen.add(it.series ? `series:${it.series}` : it.name);
  }
  return seen.size;
}
