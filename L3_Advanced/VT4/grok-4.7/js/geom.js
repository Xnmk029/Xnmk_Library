import {
  cross,
  mat4,
  mat4FromBasis,
  mat4Mul,
  mat4RotateX,
  mat4RotateY,
  mat4RotateZ,
  mat4TransformDir,
  mat4TransformPoint,
  mat4Translate,
  norm,
  sub,
  v3,
} from "./math.js";

const TAU = Math.PI * 2;

export class Builder {
  constructor() {
    this.verts = [];
    this.ranges = [];
    this.cur = { mat: 0, interior: 0, highlight: 0 };
  }

  get vertexCount() {
    return this.verts.length / 12;
  }

  set(mat, extra = {}) {
    this.cur = {
      mat,
      interior:
        extra.interior !== undefined ? (extra.interior ? 1 : 0) : this.cur.interior,
      highlight:
        extra.highlight !== undefined ? (extra.highlight ? 1 : 0) : this.cur.highlight,
    };
    return this;
  }

  range(meta, fn) {
    const first = this.vertexCount;
    const prev = this.cur;
    this.cur = {
      mat: meta.mat ?? prev.mat,
      interior: meta.interior ? 1 : 0,
      highlight: meta.highlight ? 1 : 0,
    };
    fn(this);
    const count = this.vertexCount - first;
    if (count > 0) {
      this.ranges.push({
        first,
        count,
        variants: meta.variants ?? 7,
        system: meta.system ?? "hull",
        space: meta.space ?? "hull",
        highlight: meta.highlight ? 1 : 0,
        explode: meta.explode || [0, 0, 0],
        shadow: meta.shadow !== false,
        interior: meta.interior ? 1 : 0,
      });
    }
    this.cur = prev;
    return this;
  }

  data() {
    return new Float32Array(this.verts);
  }

  _vert(p, n, u, v) {
    const ln = Math.hypot(n[0], n[1], n[2]) || 1;
    this.verts.push(
      p[0],
      p[1],
      p[2],
      n[0] / ln,
      n[1] / ln,
      n[2] / ln,
      u,
      v,
      this.cur.mat,
      this.cur.interior,
      this.cur.highlight,
      0
    );
  }

  tri(a, b, c) {
    const n = cross(sub(b, a), sub(c, a));
    this._vert(a, n, 0, 0);
    this._vert(b, n, 1, 0);
    this._vert(c, n, 1, 1);
  }

  quad(a, b, c, d, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
    const n = cross(sub(b, a), sub(c, a));
    this._vert(a, n, u0, v0);
    this._vert(b, n, u1, v0);
    this._vert(c, n, u1, v1);
    this._vert(a, n, u0, v0);
    this._vert(c, n, u1, v1);
    this._vert(d, n, u0, v1);
  }

  box(sx, sy, sz, matrix = mat4()) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const faces = [
      [
        [hx, -hy, hz],
        [hx, -hy, -hz],
        [hx, hy, -hz],
        [hx, hy, hz],
      ],
      [
        [-hx, -hy, -hz],
        [-hx, -hy, hz],
        [-hx, hy, hz],
        [-hx, hy, -hz],
      ],
      [
        [-hx, hy, hz],
        [hx, hy, hz],
        [hx, hy, -hz],
        [-hx, hy, -hz],
      ],
      [
        [-hx, -hy, -hz],
        [hx, -hy, -hz],
        [hx, -hy, hz],
        [-hx, -hy, hz],
      ],
      [
        [-hx, -hy, hz],
        [hx, -hy, hz],
        [hx, hy, hz],
        [-hx, hy, hz],
      ],
      [
        [hx, -hy, -hz],
        [-hx, -hy, -hz],
        [-hx, hy, -hz],
        [hx, hy, -hz],
      ],
    ];
    for (const f of faces) {
      const p = f.map((q) => mat4TransformPoint(matrix, q[0], q[1], q[2]));
      this.quad(p[0], p[1], p[2], p[3]);
    }
  }

  cylinder(radiusBottom, radiusTop, height, segments, matrix = mat4(), caps = true) {
    const hy = height / 2;
    const seg = Math.max(6, segments | 0);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * TAU;
      const a1 = ((i + 1) / seg) * TAU;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      const p0 = mat4TransformPoint(matrix, c0 * radiusBottom, -hy, s0 * radiusBottom);
      const p1 = mat4TransformPoint(matrix, c0 * radiusTop, hy, s0 * radiusTop);
      const p2 = mat4TransformPoint(matrix, c1 * radiusTop, hy, s1 * radiusTop);
      const p3 = mat4TransformPoint(matrix, c1 * radiusBottom, -hy, s1 * radiusBottom);
      this.quad(p0, p1, p2, p3, i / seg, 0, (i + 1) / seg, 1);
    }
    if (!caps) return;
    const top = [];
    const bot = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      top.push(mat4TransformPoint(matrix, c * radiusTop, hy, s * radiusTop));
      bot.push(mat4TransformPoint(matrix, c * radiusBottom, -hy, s * radiusBottom));
    }
    const cTop = mat4TransformPoint(matrix, 0, hy, 0);
    const cBot = mat4TransformPoint(matrix, 0, -hy, 0);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.tri(cTop, top[i], top[j]);
      this.tri(cBot, bot[j], bot[i]);
    }
  }

  sphere(radius, matrix = mat4(), segU = 16, segV = 12) {
    for (let y = 0; y < segV; y++) {
      const v0 = y / segV;
      const v1 = (y + 1) / segV;
      const th0 = v0 * Math.PI;
      const th1 = v1 * Math.PI;
      for (let x = 0; x < segU; x++) {
        const u0 = x / segU;
        const u1 = (x + 1) / segU;
        const ph0 = u0 * TAU;
        const ph1 = u1 * TAU;
        const p = (th, ph) => {
          const s = Math.sin(th);
          return mat4TransformPoint(
            matrix,
            Math.cos(ph) * s * radius,
            Math.cos(th) * radius,
            Math.sin(ph) * s * radius
          );
        };
        const a = p(th0, ph0);
        const b = p(th0, ph1);
        const c = p(th1, ph1);
        const d = p(th1, ph0);
        if (y > 0 && y < segV - 1) this.quad(a, b, c, d, u0, v0, u1, v1);
        else if (y === 0) this.tri(a, c, d);
        else this.tri(a, b, c);
      }
    }
  }

  tube(points, radius, segments = 7) {
    if (points.length < 2) return;
    const frames = points.map((p, i) => {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      let t = norm(sub(next, prev));
      if (Math.hypot(t[0], t[1], t[2]) < 1e-5) t = v3(0, 1, 0);
      const hint = Math.abs(t[1]) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
      let x = norm(cross(hint, t));
      let y = cross(t, x);
      x = norm(cross(y, t));
      return { p, x, y, t };
    });
    const seg = Math.max(5, segments | 0);
    for (let i = 0; i < points.length - 1; i++) {
      const a = frames[i];
      const b = frames[i + 1];
      for (let k = 0; k < seg; k++) {
        const u0 = (k / seg) * TAU;
        const u1 = ((k + 1) / seg) * TAU;
        const ring = (f, ang) => {
          const c = Math.cos(ang);
          const s = Math.sin(ang);
          return v3(
            f.p[0] + (f.x[0] * c + f.y[0] * s) * radius,
            f.p[1] + (f.x[1] * c + f.y[1] * s) * radius,
            f.p[2] + (f.x[2] * c + f.y[2] * s) * radius
          );
        };
        this.quad(ring(a, u0), ring(a, u1), ring(b, u1), ring(b, u0));
      }
    }
  }

  torus(R, r, maj = 18, min = 8, matrix = mat4()) {
    for (let i = 0; i < maj; i++) {
      const a0 = (i / maj) * TAU;
      const a1 = ((i + 1) / maj) * TAU;
      for (let j = 0; j < min; j++) {
        const b0 = (j / min) * TAU;
        const b1 = ((j + 1) / min) * TAU;
        const pt = (a, b) => {
          const cx = Math.cos(a) * (R + Math.cos(b) * r);
          const cy = Math.sin(b) * r;
          const cz = Math.sin(a) * (R + Math.cos(b) * r);
          return mat4TransformPoint(matrix, cx, cy, cz);
        };
        this.quad(pt(a0, b0), pt(a1, b0), pt(a1, b1), pt(a0, b1));
      }
    }
  }
}

export function T(x, y, z) {
  return mat4Translate(x, y, z);
}

export function RX(a) {
  return mat4RotateX(a);
}

export function RY(a) {
  return mat4RotateY(a);
}

export function RZ(a) {
  return mat4RotateZ(a);
}

export function M(...ms) {
  let m = ms[0] || mat4();
  for (let i = 1; i < ms.length; i++) m = mat4Mul(m, ms[i]);
  return m;
}

export function matFacing(xAxis, yAxis, zAxis, p) {
  return mat4FromBasis(norm(xAxis), norm(yAxis), norm(zAxis), p);
}

export function transformNormal(matrix, n) {
  return norm(mat4TransformDir(matrix, n[0], n[1], n[2]));
}
