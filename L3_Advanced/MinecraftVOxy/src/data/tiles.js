// VOXY CRAFT — 贴图 tile 索引系统
// 收集所有方块的 tile 键并分配整数索引；提供按面朝向解析 tile。
// M3 用 tilePalette() 顶点调色；M4 用 tile 索引采样图集。
import { BLOCKS } from './registry.js';
import { blockColor } from '../mesh/colors.js';

const tileKeys = [];
const tileIndexMap = Object.create(null);
const tileOwner = [];   // 首个拥有该 tile 的方块 id（用于取代表色）

function regTile(key, blockId) {
  if (key == null) return;
  if (tileIndexMap[key] === undefined) {
    tileIndexMap[key] = tileKeys.length;
    tileKeys.push(key);
    tileOwner.push(blockId);
  }
}

for (const b of BLOCKS) {
  if (!b || !b.tile) continue;
  if (typeof b.tile === 'string') regTile(b.tile, b.id);
  else for (const k of ['top', 'side', 'bottom', 'front', 'all']) if (b.tile[k]) regTile(b.tile[k], b.id);
}

export const TILE_COUNT = tileKeys.length;
export const TILE_KEYS = tileKeys;
export function tileIndex(key) { const i = tileIndexMap[key]; return i === undefined ? 0 : i; }

// 面朝向 0..5 = PX NX PY NY PZ NZ，返回该面的 tile 索引
export function faceTile(block, face) {
  const t = block.tile;
  if (t == null) return 0;
  if (typeof t === 'string') return tileIndex(t);
  if (face === 2) return tileIndex(t.top ?? t.side ?? t.all);       // PY 顶
  if (face === 3) return tileIndex(t.bottom ?? t.side ?? t.all);    // NY 底
  if (face === 4 && t.front) return tileIndex(t.front);             // PZ 正面（熔炉/南瓜）
  return tileIndex(t.side ?? t.top ?? t.all);                       // 侧面
}

// M3 调色板：每个 tile 的代表色（Float32 RGB）
export function tilePalette() {
  const arr = new Float32Array(TILE_COUNT * 3);
  for (let i = 0; i < TILE_COUNT; i++) {
    const c = blockColor(tileOwner[i]);
    arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2];
  }
  return arr;
}
