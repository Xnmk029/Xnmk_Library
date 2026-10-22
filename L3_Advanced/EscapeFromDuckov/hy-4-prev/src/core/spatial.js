// 均匀网格哈希：遮挡线段查询（视线的核心）、实体邻域查询、碰撞查询。
// 世界是 2D 的（XZ 平面），所以一切查询都退化为 2D，快且可单测。
export const CELL = 4;   // 世界单位

export class Spatial {
  constructor(worldW, worldH, cell = CELL) {
    this.cell = cell;
    this.cols = Math.ceil(worldW / cell);
    this.rows = Math.ceil(worldH / cell);
    this.ox = worldW / 2;      // 世界以 (0,0) 为中心 → 转索引
    this.oz = worldH / 2;
    this.segGrid = new Map();  // idx -> segment[]
    this.entGrid = new Map();  // idx -> entity[]
  }
  _idx(cx, cz) { return cz * this.cols + cx; }
  _ci(x) { return Math.floor((x + this.ox) / this.cell); }
  _cj(z) { return Math.floor((z + this.oz) / this.cell); }

  clearSegments() { this.segGrid.clear(); }
  addSegment(s) {
    // 沿线段覆盖的格子登记（DDA 采样，步长取半个格子，保证不漏）
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
    const seen = new Set();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = this._ci(s.ax + dx * t), cz = this._cj(s.az + dz * t);
      const k = this._idx(cx, cz);
      if (seen.has(k)) continue;
      seen.add(k);
      let a = this.segGrid.get(k);
      if (!a) { a = []; this.segGrid.set(k, a); }
      a.push(s);
    }
  }
  addSegments(list) { for (const s of list) this.addSegment(s); }

  /** 收集与 [minX..maxX]×[minZ..maxZ] 相交的所有格子里的线段（去重） */
  querySegments(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const c0 = Math.max(0, this._ci(minX)), c1 = Math.min(this.cols - 1, this._ci(maxX));
    const r0 = Math.max(0, this._cj(minZ)), r1 = Math.min(this.rows - 1, this._cj(maxZ));
    if (c1 < c0 || r1 < r0) return out;
    const seen = new Set();
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const a = this.segGrid.get(this._idx(c, r));
        if (!a) continue;
        for (const s of a) { if (!seen.has(s.id)) { seen.add(s.id); out.push(s); } }
      }
    }
    return out;
  }

  clearEntities() { this.entGrid.clear(); }
  addEntity(e) {
    const k = this._idx(this._ci(e.x), this._cj(e.z));
    let a = this.entGrid.get(k);
    if (!a) { a = []; this.entGrid.set(k, a); }
    a.push(e);
  }
  queryEntities(x, z, radius, out = []) {
    out.length = 0;
    const c0 = Math.max(0, this._ci(x - radius)), c1 = Math.min(this.cols - 1, this._ci(x + radius));
    const r0 = Math.max(0, this._cj(z - radius)), r1 = Math.min(this.rows - 1, this._cj(z + radius));
    const r2 = radius * radius;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const a = this.entGrid.get(this._idx(c, r));
        if (!a) continue;
        for (const e of a) {
          const dx = e.x - x, dz = e.z - z;
          if (dx * dx + dz * dz <= r2) out.push(e);
        }
      }
    }
    return out;
  }
}
