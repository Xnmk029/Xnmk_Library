// Phase 3 — Procedural proving ground: Belgian cobblestone, asymmetric bumps,
// slalom, banked curve, wading pool with buoyancy, skidpad, drag strip.
'use strict';

const ProvingGround = (() => {

  function hash2(x, y, seed) {
    let h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return h - Math.floor(h);
  }

  class ProvingGround {
    constructor() {
      this.waterLevelGlobal = -999;
      this.cones = [];
      this.buildCones();
    }

    buildCones() {
      for (let i = 0; i < 14; i++) {
        const y = -168 - i * 6.2;
        const x = (i % 2 === 0 ? 1 : -1) * 2.4;
        this.cones.push({ x, y, r: 0.22, h: 0.62, color: [1, 0.35, 0.15] });
      }
    }

    inPool(x, y) {
      return x > -18 && x < 18 && y > -490 && y < -420;
    }

    onBanked(x, y) {
      const dx = x, dy = y + 292;
      const d = Math.sqrt(dx * dx + dy * dy);
      return Math.abs(d - 72) < 10;
    }

    inCobble(x, y) { return x > 11 && x < 43 && y > -150 && y < -18; }
    inBumps(x, y) { return x < -11 && x > -43 && y > -150 && y < -18; }
    inSlalom(x, y) { return Math.abs(x) < 6 && y > -250 && y < -158; }
    inSkidpad(x, y) { const d = Math.hypot(x - 70, y + 200); return d < 28; }

    zoneAt(x, y) {
      if (this.inPool(x, y)) return { name: 'Wading Pool', color: '#3aa7ff' };
      if (this.onBanked(x, y)) return { name: 'Banked Curve 18°', color: '#ffb84d' };
      if (this.inSlalom(x, y)) return { name: 'Slalom', color: '#ff6b6b' };
      if (this.inCobble(x, y)) return { name: 'Belgian Cobblestone', color: '#c9a66b' };
      if (this.inBumps(x, y)) return { name: 'Asymmetric Bumps', color: '#d98c8c' };
      if (this.inSkidpad(x, y)) return { name: 'Skidpad', color: '#8cd98c' };
      if (y > -150 && y < -10 && Math.abs(x) < 6) return { name: 'Drag Strip', color: '#9aa5ff' };
      if (y > 240) return { name: 'Procedural City', color: '#b0a0d8' };
      return { name: 'Proving Ground Pad', color: '#a8b0c0' };
    }

    heightOnly(x, y) {
      let h = 0;
      let surf = 'asphalt';
      if (this.inPool(x, y)) {
        h = -1.8;
        surf = 'water';
      } else if (this.onBanked(x, y)) {
        const dx = x, dy = y + 292;
        const d = Math.sqrt(dx * dx + dy * dy);
        const lat = d - 72; // negative = inside
        h = -lat * Math.tan(18 * Math.PI / 180);
        surf = 'banked';
      } else if (this.inCobble(x, y)) {
        h = 0.035 * Math.sin(x * 12.0 + y * 15.0) + 0.022 * Math.sin(x * 29.0 + y * 23.0 + 1.7)
          + (hash2(Math.floor(x * 2), Math.floor(y * 2), 7) - 0.5) * 0.035;
        surf = 'cobble';
      } else if (this.inBumps(x, y)) {
        const left = x < -26;
        h = 0.10 * Math.sin(y * 0.8 + (left ? 0 : 1.4)) + 0.06 * Math.sin(y * 2.1 + 0.5)
          + (left ? 0.04 * Math.sin(x * 0.7) : -0.04 * Math.sin(x * 0.7));
        surf = 'bumps';
      } else if (this.inSlalom(x, y)) {
        h = 0.0;
        surf = 'slalom';
      } else if (this.inSkidpad(x, y)) {
        h = 0.0;
        surf = 'skidpad';
      }
      if (y > 240) { h = 0; surf = 'city'; }
      return { h, surf };
    }

    sample(x, y) {
      const hh = this.heightOnly(x, y);
      const h = hh.h;
      const surf = hh.surf;
      const waterLevel = this.inPool(x, y) ? 0.15 : -999;
      // normal via finite differences
      const e = 0.25;
      const hx = this.heightOnly(x + e, y).h - this.heightOnly(x - e, y).h;
      const hy = this.heightOnly(x, y + e).h - this.heightOnly(x, y - e).h;
      const nx = -hx / (2 * e), ny = -hy / (2 * e), nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const mu = surf === 'cobble' ? 1.05 : (surf === 'bumps' ? 0.95 : (surf === 'water' ? 0.3 : 1.0));
      return { h, normal: [nx / l, ny / l, nz / l], surface: surf, surfaceMu: mu, waterLevel };
    }

    rawHeight(x, y) {
      return this.heightOnly(x, y).h;
    }

    // build a render mesh for the ground (grid heightfield)
    buildMesh(x0, x1, y0, y1, step) {
      const cols = Math.floor((x1 - x0) / step);
      const rows = Math.floor((y1 - y0) / step);
      const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
      const nrm = new Float32Array((cols + 1) * (rows + 1) * 3);
      const col = new Float32Array((cols + 1) * (rows + 1) * 3);
      const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
      const idx = new Uint32Array(cols * rows * 6);
      const surfaceColor = {
        asphalt: [0.24, 0.25, 0.27],
        cobble: [0.42, 0.38, 0.33],
        bumps: [0.35, 0.36, 0.34],
        slalom: [0.22, 0.23, 0.26],
        skidpad: [0.26, 0.27, 0.28],
        banked: [0.23, 0.24, 0.27],
        water: [0.15, 0.3, 0.42],
        city: [0.3, 0.42, 0.28]
      };
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const wx = x0 + c * step, wy = y0 + r * step;
          const s = this.sample(wx, wy);
          const i = (r * (cols + 1) + c);
          pos[i * 3] = wx; pos[i * 3 + 1] = wy; pos[i * 3 + 2] = s.h;
          nrm[i * 3] = s.normal[0]; nrm[i * 3 + 1] = s.normal[1]; nrm[i * 3 + 2] = s.normal[2];
          const sc = surfaceColor[s.surface] || surfaceColor.asphalt;
          // zone accents
          let tint = 1;
          if (s.surface === 'skidpad') {
            const d = Math.hypot(wx - 70, wy + 200);
            tint = Math.abs(d - 20) < 1.5 ? 1.25 : (Math.abs(d - 25) < 1.2 ? 0.55 : 1);
          }
          if (this.inSlalom(wx, wy) && Math.abs(wx) < 0.5) tint = 1.35;
          col[i * 3] = sc[0] * tint; col[i * 3 + 1] = sc[1] * tint; col[i * 3 + 2] = sc[2] * tint;
          uv[i * 2] = wx * 0.08; uv[i * 2 + 1] = wy * 0.08;
        }
      }
      let o = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
          idx[o++] = a; idx[o++] = d; idx[o++] = b;
          idx[o++] = b; idx[o++] = d; idx[o++] = e;
        }
      }
      return { pos, nrm, col, uv, idx };
    }

    buildWaterMesh() {
      const x0 = -18, x1 = 18, y0 = -490, y1 = -420, step = 3;
      const cols = Math.floor((x1 - x0) / step), rows = Math.floor((y1 - y0) / step);
      const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
      const idx = new Uint32Array(cols * rows * 6);
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const i = r * (cols + 1) + c;
          pos[i * 3] = x0 + c * step; pos[i * 3 + 1] = y0 + r * step; pos[i * 3 + 2] = 0.15;
        }
      }
      let o = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
          idx[o++] = a; idx[o++] = d; idx[o++] = b;
          idx[o++] = b; idx[o++] = d; idx[o++] = e;
        }
      }
      return { pos, idx };
    }

    buildConesMesh() {
      const pos = [], col = [], nrm = [];
      for (const cone of this.cones) {
        const segs = 12;
        const top = cone.h, r = cone.r;
        for (let i = 0; i < segs; i++) {
          const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
          const x0 = cone.x + Math.cos(a0) * r, y0 = cone.y + Math.sin(a0) * r;
          const x1 = cone.x + Math.cos(a1) * r, y1 = cone.y + Math.sin(a1) * r;
          pos.push(x0, y0, 0, x1, y1, 0, cone.x, cone.y, top);
          pos.push(x0, y0, 0, cone.x, cone.y, top, x1, y1, 0);
          for (let k = 0; k < 6; k++) { nrm.push(0, 0, 1); col.push(cone.color[0], cone.color[1], cone.color[2]); }
        }
      }
      return { pos: new Float32Array(pos), col: new Float32Array(col), nrm: new Float32Array(nrm) };
    }
  }

  return { ProvingGround };
})();

if (typeof globalThis !== 'undefined') globalThis.ProvingGround = ProvingGround;
if (typeof module !== 'undefined' && module.exports) module.exports = ProvingGround;
