// VOXY CRAFT — 方块基础色表
// 用途：M2 可视化顶点色、M8 远景代表色、物品图标底色。与 M4 SVG 贴图配色保持一致。
import { BLOCKS } from '../data/registry.js';

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// 具名方块色（原创配色）
const NAMED = {
  '草方块': '#5c8c3e', '泥土': '#73523a', '灰化土': '#6b5232', '沙子': '#d4c48c',
  '红沙': '#c07048', '砂岩': '#cdbd8c', '红砂岩': '#bd7048', '砾石': '#85807c',
  '石头': '#7f7f85', '圆石': '#75757b', '苔石': '#6c7a62', '花岗岩': '#9a6a60',
  '闪长岩': '#b8b8bc', '安山岩': '#8c8c90', '玄武岩': '#4c4c52', '深板岩': '#515158',
  '苔深板岩': '#4c5a4c', '基岩': '#333338',
  '雪块': '#eef2f8', '雪层': '#eef2f8', '冰': '#b3cdec', '浮冰': '#9ab8e6', '蓝冰': '#8cade6',
  '水': '#3568c0',
  '杉原木': '#6e5236', '棕榈原木': '#8a6a44', '樱花原木': '#7a5a44', '巨树原木': '#5a4630',
  '杉木板': '#9c7a4e', '棕榈木板': '#b8925e', '樱花木板': '#a8785a',
  '杉树叶': '#3f6e34', '棕榈叶': '#4f8a3a', '樱花叶': '#e79fc0', '巨树叶': '#356e2e',
  '草': '#5f9a44', '蕨': '#4f8a3e', '花': '#d85a7a', '仙人掌': '#4f8a44', '甘蔗': '#7fae5a',
  '红蘑菇': '#c0483a', '棕蘑菇': '#9a7a5a', '藤蔓': '#3f7a34', '睡莲': '#3f8a44', '竹子': '#7fae4a',
  '石砖': '#7a7a80', '苔石砖': '#6c7a62', '裂纹石砖': '#727278', '錾制石砖': '#82828a',
  '砂岩砖': '#cdbd8c', '红砂岩砖': '#bd7048', '石英块': '#e8e4dc', '石英砖': '#e4e0d8',
  '錾制石英': '#e6e2da', '砖块': '#9a5a48', '石瓦': '#6f6f76', '平滑石头': '#8a8a90',
  '玻璃': '#c8dce0',
  '工作台': '#8a6a44', '熔炉': '#6f6f76', '箱子': '#8a6a3a', '书架': '#8a6a44',
  '梯子': '#9c7a4e', '栅栏': '#9c7a4e', '门': '#8a6a44', '火把': '#e0b050',
  '萤石': '#e8c874', '海晶灯': '#d8e8e0', '南瓜': '#d88a3a', '南瓜灯': '#e8a040',
  'TNT': '#c04838', '花盆': '#9a5a48', '铁砧': '#4a4a50', '附魔台': '#6a4a5a',
  '酿造台': '#8a7a5a', '信标': '#a8d8e0', '海绵': '#d8c850',
};

// 矿石色（石头底 + 矿色点缀的平均近似）
const ORE_TINT = {
  '煤': '#3a3a40', '铁': '#c8a888', '铜': '#c07848', '金': '#e8c850',
  '钻石': '#5ad8d0', '红石': '#c0382a', '青金石': '#3a58c0', '翡翠': '#3ac060',
};

const CATEGORY_FALLBACK = {
  natural: '#7f7f85', ore: '#7f7f85', nature: '#7f7f85', wood: '#8a6a44',
  leaf: '#3f6e34', plant: '#5f9a44', build: '#8a8a90', func: '#7f7f85', dyed: '#cccccc',
};

// 预计算每个方块 id 的 [r,g,b]
const COLOR = new Array(BLOCKS.length);
for (let id = 0; id < BLOCKS.length; id++) {
  const b = BLOCKS[id];
  if (!b) { COLOR[id] = [1, 0, 1]; continue; }
  let c = null;
  if (b.dyeHex) c = hex(b.dyeHex);
  else if (NAMED[b.name]) c = hex(NAMED[b.name]);
  else {
    // 矿石：匹配 "X矿石"/"X块"
    for (const k in ORE_TINT) {
      if (b.name.startsWith(k)) { c = hex(ORE_TINT[k]); break; }
    }
  }
  if (!c) c = hex(CATEGORY_FALLBACK[b.category] || '#cccccc');
  COLOR[id] = c;
}

export function blockColor(id) {
  return COLOR[id] || [1, 0, 1];
}

// 面朝向明暗系数（模拟方向光，MC 风格）
export const FACE_SHADE = [0.72, 0.72, 1.0, 0.5, 0.86, 0.86]; // PX NX PY NY PZ NZ
