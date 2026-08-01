// 闭合样条赛道：centripetal Catmull-Rom + 弧长参数化；柏油/路肩/砾石/草地（不同 mu）。

export const TRACK_HALF_WIDTH = 4.5;
export const CURB_HALF_WIDTH = 5.0;
export const GRAVEL_HALF_WIDTH = 8.0;

const CONTROL_POINTS = [
  [0, 0], [90, 0], [170, 30], [235, 110], [215, 205], [130, 250],
  [30, 235], [-50, 170], [-70, 85], [-35, 25]
];

function catmullRom(p0, p1, p2, p3, t, alpha) {
  function tj(ti, pi, pj) {
    const dx = pj[0] - pi[0], dy = pj[1] - pi[1];
    return Math.pow(dx * dx + dy * dy, alpha * 0.5) + ti;
  }
  const t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
  const u = t1 + t * (t2 - t1);
  function blend(i, ti) {
    const a1 = (ti === t0 ? 0 : (t1 - ti) / (t1 - t0)) * (ti === t1 ? 0 : (t2 - ti) / (t2 - t1));
    const a2 = (ti === t0 ? 0 : (t1 - ti) / (t1 - t0)) * (ti === t2 ? 0 : (t3 - ti) / (t3 - t2));
    const a3 = (ti === t1 ? 0 : (t2 - ti) / (t2 - t1)) * (ti === t2 ? 0 : (t3 - ti) / (t3 - t2));
    const a4 = (ti === t1 ? 0 : (t2 - ti) / (t2 - t1)) * (ti === t3 ? 0 : (t3 - ti) / (t3 - t2));
    return a1 * p0[i] + a2 * p1[i] + a3 * p2[i] + a4 * p3[i];
  }
  return [blend(0, u), blend(1, u)];
}

export class Track {
  constructor(points) {
    this.points = points || CONTROL_POINTS;
    this.N = 1200;
    this.pts = [];
    this.arc = new Float64Array(this.N + 1);
    const n = this.points.length;
    for (let i = 0; i < this.N; i++) {
      const u = i / this.N;
      const seg = u * n;
      const i0 = Math.floor(seg) % n, i1 = (i0 + 1) % n, i2 = (i1 + 1) % n, i3 = (i2 + 1) % n;
      const t = seg - Math.floor(seg);
      this.pts.push(catmullRom(this.points[i0], this.points[i1], this.points[i2], this.points[i3], t, 0.5));
    }
    for (let i = 1; i <= this.N; i++) {
      const a = this.pts[i - 1], b = this.pts[i % this.N];
      this.arc[i] = this.arc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    this.length = this.arc[this.N];
  }

  // u ∈ [0,1) → 位置/切向/曲率
  sample(u) {
    u = ((u % 1) + 1) % 1;
    const s = u * this.length;
    // 弧长二分
    let lo = 0, hi = this.N;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.arc[mid] < s) lo = mid; else hi = mid;
    }
    const a = this.pts[lo], b = this.pts[(lo + 1) % this.N];
    const frac = (s - this.arc[lo]) / Math.max(1e-9, this.arc[lo + 1] - this.arc[lo]);
    const x = a[0] + (b[0] - a[0]) * frac;
    const z = a[1] + (b[1] - a[1]) * frac;
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const prev = this.pts[(lo - 1 + this.N) % this.N];
    const cur = this.pts[lo], next = this.pts[(lo + 1) % this.N];
    const angPrev = Math.atan2(cur[1] - prev[1], cur[0] - prev[0]);
    const angNext = Math.atan2(next[1] - cur[1], next[0] - cur[0]);
    let dAng = angNext - angPrev;
    while (dAng > Math.PI) dAng -= Math.PI * 2;
    while (dAng < -Math.PI) dAng += Math.PI * 2;
    const ds = (this.arc[lo + 1] - this.arc[lo]) || 1;
    return { x, z, dx, dz, angle: Math.atan2(dx, dz), curvature: dAng / ds, s };
  }

  // 投影：最近弧长 u、侧向偏移（右为正）、路面类型与 mu 缩放
  project(x, z) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.N; i += 4) {
      const p = this.pts[i];
      const d = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
      if (d < bestD) { bestD = d; best = i; }
    }
    for (let d = -6; d <= 6; d++) {
      const i = (best + d + this.N) % this.N;
      const p = this.pts[i];
      const dd = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    const p = this.pts[best], q = this.pts[(best + 1) % this.N];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const l = Math.hypot(dx, dz) || 1;
    // 侧向：法线 (-dz, dx)/l，右为正
    const lateral = ((x - p[0]) * (-dz) + (z - p[1]) * dx) / l;
    const u = ((this.arc[best] / this.length) % 1 + 1) % 1;
    const absL = Math.abs(lateral);
    let surface, mu;
    if (absL <= TRACK_HALF_WIDTH - 0.4) { surface = 'asphalt'; mu = 1.0; }
    else if (absL <= CURB_HALF_WIDTH) { surface = 'curb'; mu = 0.72; }
    else if (absL <= GRAVEL_HALF_WIDTH) { surface = 'gravel'; mu = 0.55; }
    else { surface = 'grass'; mu = 0.38; }
    return { u, lateral, surface, mu, s: this.arc[best] };
  }

  startLine() { return this.sample(0); }
}
