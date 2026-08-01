// VOXY CRAFT — 流式区块管理（异步 Worker 生成 + 优先级 + 动态回收）
import { chunkKey } from './world.js';
import { S } from './chunk.js';

export class Streamer {
  constructor(pool, opts) {
    this.pool = pool;
    this.radius = opts.radius || 4;
    this.vRadius = opts.vRadius || 2;
    this.seed = opts.seed;
    this.surfaceCyAt = opts.surfaceCyAt || (() => 0); // (cx,cz) => 地表 chunk cy
    this.install = opts.install;       // (cx,cy,cz,meshData) => entry
    this.uninstall = opts.uninstall;   // (entry) => void
    this.loaded = new Map();           // key -> entry
    this.pending = new Set();
    this.needed = new Set();
    this.overrides = [];               // [[x,y,z,id],...]
    this.ovVersion = 0;
    this.lastPC = null;
    this.stats = { submitted: 0, installed: 0, discarded: 0, unloaded: 0 };
  }

  setOverrides(map) {
    this.overrides = [];
    for (const [k, id] of map) { const p = k.split(','); this.overrides.push([+p[0], +p[1], +p[2], id]); }
    this.ovVersion++;
  }

  _computeNeeded(pcx, pcy, pcz) {
    this.needed.clear();
    const R = this.radius, vR = this.vRadius;
    for (let dx = -R; dx <= R; dx++)
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue; // 圆形水平范围
        const cx = pcx + dx, cz = pcz + dz;
        for (let dy = -vR; dy <= vR; dy++)
          this.needed.add(chunkKey(cx, pcy + dy, cz));
        // 始终包含地表层：玩家飞高后俯视，脚下地面仍有满精度区块（避免空洞）
        const scy = this.surfaceCyAt(cx, cz);
        this.needed.add(chunkKey(cx, scy, cz));
        this.needed.add(chunkKey(cx, scy - 1, cz));
      }
  }

  update(px, py, pz, forwardX, forwardZ) {
    const pcx = Math.floor(px / S), pcy = Math.floor(py / S), pcz = Math.floor(pz / S);
    const moved = !this.lastPC || this.lastPC[0] !== pcx || this.lastPC[1] !== pcy || this.lastPC[2] !== pcz;
    if (moved) {
      this.lastPC = [pcx, pcy, pcz];
      this._computeNeeded(pcx, pcy, pcz);
      // 卸载越界区块
      for (const [key, entry] of this.loaded) {
        if (!this.needed.has(key)) { this.uninstall(key, entry); this.loaded.delete(key); this.stats.unloaded++; }
      }
      // 提交新增区块（按优先级）
      for (const key of this.needed) {
        if (this.loaded.has(key) || this.pending.has(key)) continue;
        const p = key.split(',');
        const cx = +p[0], cy = +p[1], cz = +p[2];
        const dx = cx - pcx, dy = cy - pcy, dz = cz - pcz;
        const dist = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5);
        const facing = dx * forwardX + dz * forwardZ;
        const priority = dist * 10 - facing * 4;   // 近 + 前方 优先
        this.pending.add(key);
        this.pool.submit({
          type: 'gen', cx, cy, cz, seed: this.seed,
          overrides: this.overrides, ovVersion: this.ovVersion, _transfer: [],
        }, priority);
        this.stats.submitted++;
      }
    }
  }

  onResult(data) {
    const key = chunkKey(data.cx, data.cy, data.cz);
    this.pending.delete(key);
    if (!this.needed.has(key)) { this.stats.discarded++; return; } // 已移出范围，丢弃
    if (this.loaded.has(key)) return;
    const entry = this.install(data.cx, data.cy, data.cz, data);
    if (entry) { this.loaded.set(key, entry); this.stats.installed++; }
  }

  // 编辑后强制重建某区块（同步路径在 Game 处理；此处仅失效 pending/loaded 标记）
  invalidate(x, y, z) {
    const cx = Math.floor(x / S), cy = Math.floor(y / S), cz = Math.floor(z / S);
    this.loaded.delete(chunkKey(cx, cy, cz));
  }

  get loadedCount() { return this.loaded.size; }
}
