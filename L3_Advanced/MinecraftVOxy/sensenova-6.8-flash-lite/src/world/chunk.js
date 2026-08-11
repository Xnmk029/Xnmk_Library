// VOXY CRAFT — 区块数据结构
// 立方体区块 16×16×16，体素存于 Uint8Array(4096)（方块 id < 256）。
// 禁止每方块一个对象；一个 chunk → 至多一个合并 Mesh。
/*LOGIC_START*/
import { CONFIG } from '../config.js';

export const S = CONFIG.CHUNK_SIZE;      // 16
export const CHUNK_VOL = S * S * S;      // 4096

// 索引：i = x + z*S + y*S*S（Y 慢变，利于按层扫描）
export function idx(x, y, z) {
  return x + z * S + y * S * S;
}

export class Chunk {
  constructor(cx, cy, cz) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_VOL);
    this.dirty = true;        // 需要重新网格化
    this.generated = false;   // 是否已跑过生成器
    this.mesh = null;         // 关联的渲染 Mesh（主线程持有）
    this.edited = false;      // 是否含玩家改动
  }

  get(x, y, z) {
    return this.data[idx(x, y, z)];
  }

  set(x, y, z, id) {
    this.data[idx(x, y, z)] = id;
    this.dirty = true;
    this.edited = true;
  }

  fill(id) {
    this.data.fill(id);
    this.dirty = true;
  }
}
/*LOGIC_END*/
