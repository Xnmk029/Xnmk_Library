// VOXY CRAFT — 世界管理
// Map<key,Chunk> + 稀疏覆盖层（玩家改动叠加在确定性生成之上）。
/*LOGIC_START*/
import { CONFIG } from '../config.js';
import { Chunk, S } from './chunk.js';

export function chunkKey(cx, cy, cz) { return cx + ',' + cy + ',' + cz; }
export function worldKey(x, y, z) { return x + ',' + y + ',' + z; }

export class World {
  constructor(seed = CONFIG.SEED) {
    this.seed = seed >>> 0;
    this.chunks = new Map();
    this.overrides = new Map();   // worldKey -> blockId（玩家改动，保证种子世界可复现）
    this.generator = null;        // M2 注入：function(chunk, world)
  }

  setGenerator(gen) { this.generator = gen; }

  // 世界坐标 → chunk 坐标（负坐标正确向下取整）
  chunkCoord(wx, wy, wz) {
    return [Math.floor(wx / S), Math.floor(wy / S), Math.floor(wz / S)];
  }

  getChunk(cx, cy, cz) { return this.chunks.get(chunkKey(cx, cy, cz)); }

  hasChunk(cx, cy, cz) { return this.chunks.has(chunkKey(cx, cy, cz)); }

  // 获取或创建 chunk；若配置了生成器则首次创建时生成
  ensureChunk(cx, cy, cz) {
    const key = chunkKey(cx, cy, cz);
    let c = this.chunks.get(key);
    if (!c) {
      c = new Chunk(cx, cy, cz);
      this.chunks.set(key, c);
      if (this.generator) {
        this.generator(c, this);
        c.generated = true;
      }
      this._applyOverrides(c);
    }
    return c;
  }

  addChunk(c) { this.chunks.set(chunkKey(c.cx, c.cy, c.cz), c); }

  removeChunk(cx, cy, cz) {
    const key = chunkKey(cx, cy, cz);
    const c = this.chunks.get(key);
    if (c) {
      if (c.mesh && c.mesh.dispose) c.mesh.dispose();
      this.chunks.delete(key);
    }
    return c;
  }

  getBlock(wx, wy, wz) {
    const ok = worldKey(wx, wy, wz);
    if (this.overrides.has(ok)) return this.overrides.get(ok);
    const [cx, cy, cz] = this.chunkCoord(wx, wy, wz);
    const c = this.getChunk(cx, cy, cz);
    if (!c) return 0;
    return c.get(wx - cx * S, wy - cy * S, wz - cz * S);
  }

  setBlock(wx, wy, wz, id) {
    const [cx, cy, cz] = this.chunkCoord(wx, wy, wz);
    const c = this.getChunk(cx, cy, cz);
    if (!c) return false;
    const lx = wx - cx * S, ly = wy - cy * S, lz = wz - cz * S;
    c.set(lx, ly, lz, id);
    this.overrides.set(worldKey(wx, wy, wz), id);
    // 边界改动需让相邻 chunk 重建（边界面可见性变化）
    if (lx === 0) this._markDirty(cx - 1, cy, cz);
    if (lx === S - 1) this._markDirty(cx + 1, cy, cz);
    if (ly === 0) this._markDirty(cx, cy - 1, cz);
    if (ly === S - 1) this._markDirty(cx, cy + 1, cz);
    if (lz === 0) this._markDirty(cx, cy, cz - 1);
    if (lz === S - 1) this._markDirty(cx, cy, cz + 1);
    return true;
  }

  _markDirty(cx, cy, cz) {
    const c = this.getChunk(cx, cy, cz);
    if (c) c.dirty = true;
  }

  _applyOverrides(c) {
    const baseX = c.cx * S, baseY = c.cy * S, baseZ = c.cz * S;
    for (const [k, id] of this.overrides) {
      const p = k.split(',');
      const wx = +p[0], wy = +p[1], wz = +p[2];
      if (wx >= baseX && wx < baseX + S && wy >= baseY && wy < baseY + S && wz >= baseZ && wz < baseZ + S) {
        c.data[wx - baseX + (wz - baseZ) * S + (wy - baseY) * S * S] = id;
      }
    }
    c.dirty = true;
  }

  get size() { return this.chunks.size; }
}
/*LOGIC_END*/
