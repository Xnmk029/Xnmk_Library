/* ============================================================
 * world.js — 程序化沙砾地面 / 碎石 / GPU 扬尘粒子 / 环境光预设
 * ============================================================ */
"use strict";
(function () {
  const M = VT4.M, P = VT4.P, A = VT4.MAT;

  /* ---------- 值噪声 ---------- */
  function makeNoise(seed) {
    const r = M.rng(seed), g = new Float32Array(256 * 256);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, z) => {
      const xi = Math.floor(x), zi = Math.floor(z);
      const xf = x - xi, zf = z - zi;
      const sx = xf * xf * (3 - 2 * xf), sz = zf * zf * (3 - 2 * zf);
      const h = (a, b) => g[((a & 255) * 131 + (b & 255) * 197 + 65536 * 7) & 65535];
      const v00 = h(xi, zi), v10 = h(xi + 1, zi), v01 = h(xi, zi + 1), v11 = h(xi + 1, zi + 1);
      return (v00 * (1 - sx) + v10 * sx) * (1 - sz) + (v01 * (1 - sx) + v11 * sx) * sz;
    };
  }

  /* ---------- 沙砾地面 (含履带碾压痕) ---------- */
  VT4.buildTerrain = function () {
    const noise = makeNoise(20260912);
    const noise2 = makeNoise(77);
    const SIZE = 90, RES = 150;
    const mb = new VT4.MB();
    const H = (x, z) => {
      let h = (noise(x * 0.045 + 50, z * 0.045) - 0.5) * 1.35
        + (noise(x * 0.16, z * 0.16 + 30) - 0.5) * 0.38
        + (noise2(x * 0.55, z * 0.55) - 0.5) * 0.10;
      // 坦克周边整平 + 履带碾压槽
      const ax = Math.abs(x);
      const inTrack = Math.exp(-((ax - 1.30) * (ax - 1.30)) / (2 * 0.30 * 0.30));
      const inPad = Math.exp(-(x * x + z * z) / (2 * 6.5 * 6.5));
      h *= (1 - inPad * 0.85);
      const along = Math.max(0, 1 - Math.abs(z) / 6.5);
      h -= inTrack * along * 0.14;                       // 压槽
      h += Math.exp(-((ax - 1.78) ** 2) / 0.02) * along * 0.045; // 槽缘浮土
      h += Math.exp(-((ax - 0.82) ** 2) / 0.02) * along * 0.045;
      return h;
    };
    const verts = [], norms = [], inds = [];
    const step = SIZE / RES, half = SIZE / 2;
    for (let iz = 0; iz <= RES; iz++) for (let ix = 0; ix <= RES; ix++) {
      const x = -half + ix * step, z = -half + iz * step;
      verts.push(x, H(x, z), z);
      const e = step;
      const nx = H(x - e, z) - H(x + e, z), nz = H(x, z - e) - H(x, z + e);
      const n = M.norm([nx, 2 * e, nz]);
      norms.push(n[0], n[1], n[2]);
    }
    for (let iz = 0; iz < RES; iz++) for (let ix = 0; ix < RES; ix++) {
      const b = iz * (RES + 1) + ix;
      inds.push(b, b + 1, b + RES + 2, b, b + RES + 2, b + RES + 1);
    }
    // 顶点按是否处于压槽分配材质(SAND / SAND_D)
    mb.mat = A.SAND; mb.part = P.GROUND;
    const nm = M.ident();
    for (let i = 0; i < verts.length; i += 3) {
      const x = verts[i], ax = Math.abs(x);
      const inTrack = Math.exp(-((ax - 1.30) * (ax - 1.30)) / (2 * 0.34 * 0.34));
      const mat = inTrack > 0.35 && Math.abs(verts[i + 2]) < 6.5 ? A.SAND_D : A.SAND;
      const save = mb.mat; mb.mat = mat;
      mb._push([verts[i], verts[i + 1], verts[i + 2]], [norms[i], norms[i + 1], norms[i + 2]]);
      mb.mat = save;
    }
    for (const t of inds) mb.idx.push(t);

    // —— 碎石散布 ——
    const r = M.rng(991);
    mb.set(A.ROCK, P.ROCKS);
    for (let i = 0; i < 260; i++) {
      const a = r() * M.TAU, d = 4.5 + r() * 38;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.abs(x) < 2.2 && Math.abs(z) < 7) continue;
      const s = 0.04 + r() * r() * 0.22;
      mb.sphere(1, 6, 4, M.mul(M.trans(x, H(x, z) + s * 0.3, z),
        M.mul(M.rotY(r() * M.TAU), M.scl(s * (0.7 + r() * 0.7), s * (0.5 + r() * 0.4), s * (0.7 + r() * 0.7)))));
    }
    return mb.finalize();
  };

  /* ---------- 扬尘粒子系统 (CPU 状态 → GPU 实例化) ---------- */
  class Dust {
    constructor(n) {
      this.n = n;
      this.data = new Float32Array(n * 6);   // x y z size alpha seed
      this.pos = new Float32Array(n * 3);
      this.vel = new Float32Array(n * 3);
      this.life = new Float32Array(n);
      this.r = M.rng(4242);
      for (let i = 0; i < n; i++) this.spawn(i, true);
      this.density = 0.55;
      this.wind = [0.55, 0, 0.22];
    }
    spawn(i, randY) {
      const r = this.r;
      const kind = r();
      if (kind < 0.62) {         // 地面浮尘(集中于履带/车体周边)
        this.pos[i * 3] = (r() - 0.5) * 22;
        this.pos[i * 3 + 1] = 0.1 + r() * (randY ? 1.6 : 0.5);
        this.pos[i * 3 + 2] = (r() - 0.5) * 22;
      } else {                    // 高空浮尘
        this.pos[i * 3] = (r() - 0.5) * 40;
        this.pos[i * 3 + 1] = 0.5 + r() * 7;
        this.pos[i * 3 + 2] = (r() - 0.5) * 40;
      }
      this.vel[i * 3] = (r() - 0.5) * 0.3;
      this.vel[i * 3 + 1] = 0.04 + r() * 0.16;
      this.vel[i * 3 + 2] = (r() - 0.5) * 0.3;
      this.life[i] = 4 + r() * 14;
      this.data[i * 6 + 3] = 0.02 + r() * r() * 0.13;   // size
      this.data[i * 6 + 5] = r() * 10;                  // seed
    }
    update(dt, t) {
      const n = this.n, d = this.data, p = this.pos, v = this.vel;
      const vis = Math.floor(n * this.density);
      for (let i = 0; i < n; i++) {
        this.life[i] -= dt;
        if (this.life[i] <= 0 || i >= vis) { this.spawn(i); if (i >= vis) { d[i * 6 + 4] = 0; continue; } }
        const i3 = i * 3;
        const sw = Math.sin(t * 0.7 + d[i * 6 + 5] * 3.1) * 0.25;
        p[i3] += (v[i3] + this.wind[0] + sw * 0.4) * dt;
        p[i3 + 1] += v[i3 + 1] * dt * (1 + 0.3 * Math.sin(t + i));
        p[i3 + 2] += (v[i3 + 2] + this.wind[2] + Math.cos(t * 0.5 + d[i * 6 + 5]) * 0.12) * dt;
        if (p[i3 + 1] > 9) { this.life[i] = 0; }
        d[i * 6] = p[i3]; d[i * 6 + 1] = p[i3 + 1]; d[i * 6 + 2] = p[i3 + 2];
        const hFade = Math.max(0, 1 - p[i3 + 1] / 9);
        d[i * 6 + 4] = Math.min(1, this.life[i] / 2.5) * hFade * 0.55;
      }
    }
    count() { return Math.floor(this.n * this.density); }
  }
  VT4.Dust = Dust;

  /* ---------- HDRI 环境预设 (程序化天光) ---------- */
  VT4.ENVS = {
    noon: {   // 正午沙场: 强烈直射 + 高亮蓝灰天
      zenith: [0.26, 0.42, 0.68], horizon: [0.80, 0.74, 0.60], ground: [0.36, 0.30, 0.22],
      sunDir: [0.42, 0.86, 0.28], sunCol: [1.0, 0.94, 0.82], sunI: 3.6, amb: 0.42,
      sunR: 0.025, haze: 0.30
    },
    overcast: { // 阴天兵营: 柔和漫射
      zenith: [0.42, 0.47, 0.54], horizon: [0.62, 0.64, 0.64], ground: [0.38, 0.36, 0.30],
      sunDir: [0.3, 0.75, 0.4], sunCol: [0.9, 0.9, 0.88], sunI: 0.9, amb: 0.9,
      sunR: 0.09, haze: 0.6
    },
    studio: {   // 影棚: 深背景 + 强主光
      zenith: [0.05, 0.06, 0.09], horizon: [0.12, 0.12, 0.15], ground: [0.08, 0.07, 0.07],
      sunDir: [-0.5, 0.72, -0.48], sunCol: [1.0, 0.92, 0.80], sunI: 4.2, amb: 0.28,
      sunR: 0.018, haze: 0.0
    },
    dusk: {     // 黄昏: 低角度暖光
      zenith: [0.16, 0.22, 0.42], horizon: [0.95, 0.55, 0.30], ground: [0.30, 0.24, 0.18],
      sunDir: [-0.75, 0.16, -0.35], sunCol: [1.0, 0.62, 0.35], sunI: 2.6, amb: 0.4,
      sunR: 0.03, haze: 0.5
    },
  };
})();
