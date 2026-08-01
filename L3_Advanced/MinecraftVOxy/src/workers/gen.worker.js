// VOXY CRAFT — 生成 + 网格化 Worker（模块 Worker，无 three 依赖）
// 接收 {type:'gen', cx,cy,cz, seed, overrides, ovVersion}，产出压缩网格原始数组并 transfer 回主线程。
import { Terrain } from '../world/generator.js';
import { Chunk, S } from '../world/chunk.js';
import { buildMeshData } from '../mesh/mesherCore.js';
import { buildLodRing } from '../world/lod.js';

let terrain = null, seed = -1;
let overrides = new Map();
let ovVersion = -1;
const cache = new Map();
const CACHE_MAX = 160;

function keyOf(cx, cy, cz) { return cx + ',' + cy + ',' + cz; }

function genChunkData(cx, cy, cz) {
  const key = keyOf(cx, cy, cz);
  let d = cache.get(key);
  if (d) return d;
  const chunk = new Chunk(cx, cy, cz);
  terrain.fillChunk(chunk); // 地形 + 树（确定性）
  const bx = cx * S, by = cy * S, bz = cz * S;
  for (const [k, id] of overrides) {
    const p = k.split(',');
    const wx = +p[0], wy = +p[1], wz = +p[2];
    if (wx >= bx && wx < bx + S && wy >= by && wy < by + S && wz >= bz && wz < bz + S)
      chunk.data[(wx - bx) + (wz - bz) * S + (wy - by) * S * S] = id;
  }
  d = chunk.data;
  cache.set(key, d);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return d;
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'lod') {
    if (msg.seed !== seed) { seed = msg.seed; terrain = new Terrain(seed); cache.clear(); }
    const { level, cell, innerR, outerR, centerX, centerZ } = msg;
    const ring = buildLodRing(terrain, seed, cell, innerR, outerR, centerX, centerZ);
    self.postMessage({ type: 'lodResult', level, positions: ring.positions, colors: ring.colors, tris: ring.tris },
      [ring.positions.buffer, ring.colors.buffer]);
    return;
  }
  if (msg.type !== 'gen') return;
  const { cx, cy, cz, seed: s, overrides: ov, ovVersion: ver } = msg;
  if (s !== seed) { seed = s; terrain = new Terrain(seed); cache.clear(); }
  if (ver !== ovVersion) {
    ovVersion = ver;
    overrides = new Map();
    if (ov) for (const it of ov) overrides.set(it[0] + ',' + it[1] + ',' + it[2], it[3]);
    cache.clear();
  }
  const data = genChunkData(cx, cy, cz);
  const vAt = (lx, ly, lz) => {
    if (lx >= 0 && lx < S && ly >= 0 && ly < S && lz >= 0 && lz < S) return data[lx + lz * S + ly * S * S];
    const ncx = cx + Math.floor(lx / S), ncy = cy + Math.floor(ly / S), ncz = cz + Math.floor(lz / S);
    const nd = genChunkData(ncx, ncy, ncz);
    const llx = ((lx % S) + S) % S, lly = ((ly % S) + S) % S, llz = ((lz % S) + S) % S;
    return nd[llx + llz * S + lly * S * S];
  };
  const md = buildMeshData(vAt);
  const transfer = [];
  const faces = md.faces.map((fr) => {
    if (!fr) return null;
    transfer.push(fr.pos.buffer, fr.dir.buffer, fr.ao.buffer, fr.tile.buffer, fr.uv.buffer);
    return fr;
  });
  if (md.water) transfer.push(md.water.pos.buffer, md.water.color.buffer);
  const chunkData = data.slice();   // 拷贝，避免 detach 缓存中的原数组
  transfer.push(chunkData.buffer);
  self.postMessage({ type: 'result', cx, cy, cz, faces, water: md.water, tris: md.tris, chunkData }, transfer);
};
