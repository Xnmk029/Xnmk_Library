// ============================================================
//  pathfind.js — A* 网格寻路 + 视线/弹道射线
// ============================================================

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
];

/** 二叉堆 */
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node) {
    const a = this.a; a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  }
}

/**
 * A* 寻路（可选：允许破坏门/家具的“攻城”模式）
 * @returns {Array<{x,y}>|null} 瓦片中心路径（不含起点）
 */
export function findPath(lv, sx, sy, tx, ty, opts = {}) {
  sx |= 0; sy |= 0; tx |= 0; ty |= 0;
  if (!lv.inB(sx, sy) || !lv.inB(tx, ty)) return null;
  const maxNodes = opts.maxNodes || 2200;
  const smash = !!opts.smash;
  const W = lv.w;
  const cost = (x, y) => {
    const idx = y * W + x;
    if (!lv.floor[idx]) return -1;
    if (lv.solid[idx]) {
      if (!smash) return -1;
      const dr = lv.doorMap.get(idx);
      const wn = lv.winMap.get(idx);
      if (dr) return dr.barricade > 0 ? 24 : (dr.locked ? 14 : 6);
      if (wn) return wn.barricade > 0 ? 22 : 8;
      const o = lv.obj[idx];
      if (o) return 16;
      return -1;
    }
    return 1 + lv.cover[idx] * 1.5;
  };
  if (cost(tx, ty) < 0) {
    // 目标不可达：找相邻可达格
    let best = null, bd = 1e9;
    for (const [dx, dy] of DIRS) {
      const nx = tx + dx, ny = ty + dy;
      if (!lv.inB(nx, ny) || cost(nx, ny) < 0) continue;
      const d = (nx - sx) ** 2 + (ny - sy) ** 2;
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
    if (!best) return null;
    tx = best[0]; ty = best[1];
  }
  const open = new Heap();
  const gScore = new Map();
  const came = new Map();
  const h = (x, y) => Math.hypot(x - tx, y - ty);
  const startKey = sy * W + sx;
  gScore.set(startKey, 0);
  open.push({ x: sx, y: sy, g: 0, f: h(sx, sy), k: startKey });
  let nodes = 0;
  let found = null;
  const closed = new Set();
  while (open.size && nodes < maxNodes) {
    const cur = open.pop();
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    nodes++;
    if (cur.x === tx && cur.y === ty) { found = cur; break; }
    for (const [dx, dy, w] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!lv.inB(nx, ny)) continue;
      const c = cost(nx, ny);
      if (c < 0) continue;
      if (dx && dy) {
        // 禁止穿角
        if (cost(cur.x + dx, cur.y) < 0 || cost(cur.x, cur.y + dy) < 0) continue;
      }
      const nk = ny * W + nx;
      if (closed.has(nk)) continue;
      const ng = cur.g + c * w;
      if (gScore.has(nk) && gScore.get(nk) <= ng) continue;
      gScore.set(nk, ng);
      came.set(nk, cur);
      open.push({ x: nx, y: ny, g: ng, f: ng + h(nx, ny) * 1.08, k: nk });
    }
  }
  if (!found) return null;
  const path = [];
  let n = found;
  while (n && n.k !== startKey) { path.push({ x: n.x + 0.5, y: n.y + 0.5 }); n = came.get(n.k); }
  path.reverse();
  return path;
}

/** 视线是否通畅（阻挡 = opaque） */
export function hasLOS(lv, x0, y0, x1, y1, maxDist = 40) {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  if (d > maxDist) return false;
  const steps = Math.ceil(d * 3);
  if (steps <= 0) return true;
  const sx = dx / steps, sy = dy / steps;
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    x += sx; y += sy;
    const tx = x | 0, ty = y | 0;
    if (!lv.inB(tx, ty)) return false;
    if (i < steps - 1 && lv.opaque[ty * lv.w + tx]) return false;
  }
  return true;
}

/** 累积遮蔽（灌木等半透明覆盖） */
export function coverAlong(lv, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  const steps = Math.ceil(d * 2);
  if (steps <= 0) return 0;
  let acc = 0;
  for (let i = 1; i <= steps; i++) {
    const x = (x0 + dx * (i / steps)) | 0, y = (y0 + dy * (i / steps)) | 0;
    if (!lv.inB(x, y)) break;
    acc += lv.cover[y * lv.w + x] * 0.5;
  }
  return Math.min(0.95, acc);
}

/**
 * 弹道射线：返回命中的第一个结构
 * @returns {{x,y,tx,ty,dist,hit:boolean}}
 */
export function raycastSolid(lv, x0, y0, dirX, dirY, maxDist) {
  const step = 0.14;
  let x = x0, y = y0;
  for (let t = 0; t < maxDist; t += step) {
    x += dirX * step; y += dirY * step;
    const tx = x | 0, ty = y | 0;
    if (!lv.inB(tx, ty)) return { x, y, tx, ty, dist: t, hit: true, oob: true };
    const idx = ty * lv.w + tx;
    if (lv.solid[idx]) {
      const wn = lv.winMap.get(idx);
      const o = lv.obj[idx];
      const low = wn || (o && lowObj(lv, idx));
      // 矮掩体：50% 概率被挡（贴地射击）
      if (low) return { x, y, tx, ty, dist: t, hit: true, low: true };
      return { x, y, tx, ty, dist: t, hit: true };
    }
  }
  return { x, y, tx: x | 0, ty: y | 0, dist: maxDist, hit: false };
}

function lowObj(lv, idx) {
  const o = lv.obj[idx];
  if (!o) return false;
  // 通过 tiles 表判断 low（避免循环依赖，直接读取缓存）
  return !lv.opaque[idx];
}
