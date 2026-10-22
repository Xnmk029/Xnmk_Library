// 网格 A*（二叉堆）+ 视线拉直。纯逻辑，不依赖 three。
// 只在"重新规划"时调用（失去目标/卡住/路径失效），不是每帧跑。
import { hasLineOfSight } from './movement.js';

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node, f) {
    const a = this.a;
    a.push({ node, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.node;
  }
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142],
];

export class Pathfinder {
  constructor(world) {
    this.world = world;
    const n = world.w * world.h;
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.mark = new Int32Array(n);       // 访问戳，避免每次清零
    this.stamp = 0;
  }

  /** 返回世界坐标航点数组（已拉直），失败返回 null */
  find(sx, sz, tx, tz, { maxNodes = 2600, allowLow = false } = {}) {
    const w = this.world;
    const s = w.toTile(sx, sz), t = w.toTile(tx, tz);
    if (!w.inBounds(s.tx, s.tz) || !w.inBounds(t.tx, t.tz)) return null;
    if (w.blocksMove(t.tx, t.tz)) {
      // 目标在实心格里：退到相邻可走格
      const alt = this._nearestOpen(t.tx, t.tz);
      if (!alt) return null;
      t.tx = alt.tx; t.tz = alt.tz;
    }
    const start = s.tz * w.w + s.tx;
    const goal = t.tz * w.w + t.tx;
    if (start === goal) return [{ x: tx, z: tz }];

    this.stamp++;
    const stamp = this.stamp;
    const { g, came, mark } = this;
    const open = new Heap();
    g[start] = 0; came[start] = -1; mark[start] = stamp;
    open.push(start, this._h(s.tx, s.tz, t.tx, t.tz));
    let expanded = 0;
    let found = false;

    while (open.size && expanded < maxNodes) {
      const cur = open.pop();
      if (cur === goal) { found = true; break; }
      expanded++;
      const cx = cur % w.w, cz = (cur / w.w) | 0;
      for (const [dx, dz, cost] of DIRS) {
        const nx = cx + dx, nz = cz + dz;
        if (!w.inBounds(nx, nz)) continue;
        if (w.blocksMove(nx, nz) && !(allowLow && w.tileAt(nx, nz) === 3)) continue;
        // 禁止穿角：斜向移动要求两个正交邻格都可走
        if (dx && dz && (w.blocksMove(cx + dx, cz) || w.blocksMove(cx, cz + dz))) continue;
        const ni = nz * w.w + nx;
        const ng = g[cur] + cost;
        if (mark[ni] === stamp && ng >= g[ni]) continue;
        mark[ni] = stamp;
        g[ni] = ng;
        came[ni] = cur;
        open.push(ni, ng + this._h(nx, nz, t.tx, t.tz));
      }
    }
    if (!found && mark[goal] !== stamp) return null;

    // 回溯
    const path = [];
    let cur = found ? goal : this._bestEffort(mark, stamp, t);
    let guard = 0;
    while (cur !== -1 && cur !== undefined && guard++ < 4000) {
      const cx = cur % w.w, cz = (cur / w.w) | 0;
      const p = w.toWorld(cx, cz);
      path.push(p);
      if (cur === start) break;
      cur = came[cur];
    }
    path.reverse();
    const pts = path.map((p) => ({ x: p.x, z: p.z }));
    if (pts.length) { pts[pts.length - 1] = { x: tx, z: tz }; }
    return this.smooth(pts);
  }

  _nearestOpen(tx, tz) {
    const w = this.world;
    for (let r = 1; r <= 4; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (!w.blocksMove(tx + dx, tz + dz)) return { tx: tx + dx, tz: tz + dz };
        }
      }
    }
    return null;
  }

  /** A* 没走完时退而求其次：取已探索区域里离目标最近的点 */
  _bestEffort(mark, stamp, t) {
    const w = this.world;
    let best = -1, bd = Infinity;
    for (let i = 0; i < mark.length; i++) {
      if (mark[i] !== stamp) continue;
      const cx = i % w.w, cz = (i / w.w) | 0;
      const d = (cx - t.tx) ** 2 + (cz - t.tz) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  _h(ax, az, bx, bz) {
    const dx = Math.abs(ax - bx), dz = Math.abs(az - bz);
    return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz);   // 八方向一致启发
  }

  /** 视线拉直：能直达就跳过中间点，避免贴着网格走出锯齿 */
  smooth(pts) {
    if (pts.length <= 2) return pts;
    const w = this.world;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      for (; j > i + 1; j--) {
        if (hasLineOfSight(w, pts[i].x, pts[i].z, pts[j].x, pts[j].z)) break;
      }
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
}
