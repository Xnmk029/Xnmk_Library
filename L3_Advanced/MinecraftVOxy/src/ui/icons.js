// VOXY CRAFT — 物品图标（全部 SVG 程序化，零外部图片）
import { BLOCKS } from '../data/registry.js';
import { tileSVG } from '../data/textures.js';

function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360},52%,56%)`;
}

// 非方块物品：按类别生成像素徽标
function emblem(item) {
  const c = hashColor(item.name);
  const cat = item.category;
  let shape;
  if (cat === 'tool') {
    shape = `<path d="M3 13 L8 8 L10 10 L5 15 Z" fill="#8a6a44"/>` +
            `<path d="M7 2 L14 2 L14 9 L11 9 L11 5 L7 5 Z" fill="${c}"/>`;
  } else if (cat === 'food') {
    shape = `<circle cx="8" cy="9" r="5" fill="${c}"/>` +
            `<circle cx="6" cy="8" r="1" fill="rgba(255,255,255,.45)"/>` +
            `<rect x="7" y="2" width="2" height="3" fill="#5f9a44"/>`;
  } else {
    shape = `<rect x="3" y="5" width="10" height="6" fill="${c}"/>` +
            `<rect x="3" y="5" width="10" height="2" fill="rgba(255,255,255,.35)"/>` +
            `<rect x="3" y="9" width="10" height="2" fill="rgba(0,0,0,.25)"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#1b2028"/>${shape}</svg>`;
}

const cache = new Map();
export function itemIcon(item) {
  if (cache.has(item.id)) return cache.get(item.id);
  let svg = null;
  if (item.blockId != null && BLOCKS[item.blockId]) {
    const b = BLOCKS[item.blockId];
    const key = typeof b.tile === 'string' ? b.tile : (b.tile.side || b.tile.top || b.tile.all);
    if (key) svg = tileSVG(key);
  }
  if (!svg) svg = emblem(item);
  const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  cache.set(item.id, uri);
  return uri;
}
