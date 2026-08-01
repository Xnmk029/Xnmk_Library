// Phase 5 — Procedural city + 3D vector tile engine:
// grid/arterial road network, block subdivision, extruded buildings, POIs,
// quadtree tiles with LOD streaming, and vector-to-mesh tessellation.
'use strict';

const City = (() => {

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const EXTENT = 2048;
  const MAX_Z = 4;
  const MAJOR = 256;
  const MINOR = 64;

  const POI_NAMES = ['Sakura Dori', 'Harbor Plaza', 'Central Station', 'Akatsuki Ave', 'Neon Crossing', 'Vertex Park', 'Vector Square', 'Cel Shade Blvd', 'Lumen Pier', 'Kaminari Gate'];

  class City {
    constructor(centerY) {
      this.cx = 0;
      this.cy = centerY;
      this.extent = EXTENT;
      this.loaded = new Map();
      this.pois = [];
      this.roads = []; // {a:[x,y], b:[x,y], major}
      this.buildNetwork();
    }

    buildNetwork() {
      const y0 = this.cy - EXTENT / 2, y1 = this.cy + EXTENT / 2;
      const x0 = -EXTENT / 2, x1 = EXTENT / 2;
      // arterials
      for (let x = x0; x <= x1; x += MAJOR) this.roads.push({ a: [x, y0], b: [x, y1], major: true });
      for (let y = y0; y <= y1; y += MAJOR) this.roads.push({ a: [x0, y], b: [x1, y], major: true });
      // diagonal avenue
      this.roads.push({ a: [x0, y0], b: [x1, y1], major: true });
      // minor streets
      for (let x = x0 + MINOR; x < x1; x += MINOR) {
        if (x % MAJOR === 0) continue;
        this.roads.push({ a: [x, y0], b: [x, y1], major: false });
      }
      for (let y = y0 + MINOR; y < y1; y += MINOR) {
        if (y % MAJOR === 0) continue;
        this.roads.push({ a: [x0, y], b: [x1, y], major: false });
      }
      // POIs at arterial intersections
      let pi = 0;
      for (let x = x0 + MAJOR; x < x1; x += MAJOR * 2) {
        for (let y = y0 + MAJOR; y < y1; y += MAJOR * 2) {
          this.pois.push({ name: POI_NAMES[pi++ % POI_NAMES.length], x, y });
        }
      }
    }

    tileSize(z) { return EXTENT / Math.pow(2, z); }

    tileRect(z, tx, ty) {
      const s = this.tileSize(z);
      return {
        x0: this.cx - EXTENT / 2 + tx * s,
        y0: this.cy - EXTENT / 2 + ty * s,
        x1: this.cx - EXTENT / 2 + (tx + 1) * s,
        y1: this.cy - EXTENT / 2 + (ty + 1) * s
      };
    }

    // deterministic tile content
    tileData(z, tx, ty) {
      const rng = mulberry32((z * 73856093) ^ (tx * 19349663) ^ (ty * 83492791));
      const r = this.tileRect(z, tx, ty);
      const roads = [];
      for (const rd of this.roads) {
        if (this.segIntersectsRect(rd.a, rd.b, r)) roads.push(rd);
      }
      const buildings = [];
      const blockSize = MINOR;
      if (z >= 2) {
        const bx0 = Math.floor(r.x0 / blockSize), bx1 = Math.floor(r.x1 / blockSize);
        const by0 = Math.floor(r.y0 / blockSize), by1 = Math.floor(r.y1 / blockSize);
        for (let bx = bx0; bx <= bx1; bx++) {
          for (let by = by0; by <= by1; by++) {
            if (bx % (MAJOR / MINOR) === 0 || by % (MAJOR / MINOR) === 0) continue;
            const nb = Math.floor(rng() * 3) + 1;
            for (let b = 0; b < nb; b++) {
              const w = 8 + rng() * 16, d = 8 + rng() * 14;
              const px = bx * blockSize + 5 + rng() * (blockSize - w - 10);
              const py = by * blockSize + 5 + rng() * (blockSize - d - 10);
              const h = 7 + Math.floor(rng() * rng() * 34);
              if (px + w > r.x0 && px < r.x1 && py + d > r.y0 && py < r.y1) {
                buildings.push({ x: px, y: py, w, d, h, color: [0.55 + rng() * 0.4, 0.5 + rng() * 0.35, 0.52 + rng() * 0.35] });
              }
            }
          }
        }
      }
      return { roads, buildings };
    }

    segIntersectsRect(a, b, r) {
      const minx = Math.min(a[0], b[0]), maxx = Math.max(a[0], b[0]);
      const miny = Math.min(a[1], b[1]), maxy = Math.max(a[1], b[1]);
      return maxx >= r.x0 && minx <= r.x1 && maxy >= r.y0 && miny <= r.y1;
    }

    desiredZ(zoom, dist) {
      if (zoom > 0.75) return MAX_Z;
      if (zoom > 0.45) return 3;
      if (zoom > 0.2) return 2;
      return 1;
    }

    update(camera, viewProj) {
      const z = this.desiredZ(camera.zoom, 0);
      const s = this.tileSize(z);
      const n = Math.ceil(EXTENT / s);
      const cx = Math.floor((camera.target[0] - (this.cx - EXTENT / 2)) / s);
      const cy = Math.floor((camera.target[1] - (this.cy - EXTENT / 2)) / s);
      const want = new Set();
      const view = 2;
      for (let tx = cx - view; tx <= cx + view; tx++) {
        for (let ty = cy - view; ty <= cy + view; ty++) {
          if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
          const key = z + '/' + tx + '/' + ty;
          want.add(key);
          if (!this.loaded.has(key)) this.loadTile(z, tx, ty, key);
        }
      }
      for (const key of [...this.loaded.keys()]) {
        if (!want.has(key)) { this.unloadTile(key); }
      }
    }

    loadTile(z, tx, ty, key) {
      const data = this.tileData(z, tx, ty);
      const r = this.tileRect(z, tx, ty);
      const meshes = this.tessellate(data, r, z);
      this.loaded.set(key, { z, tx, ty, meshes });
    }

    unloadTile(key) {
      const t = this.loaded.get(key);
      if (!t) return;
      this.loaded.delete(key);
      if (this.onUnload) this.onUnload(t);
    }

    tessellate(data, r, z) {
      const pos = [], col = [], nrm = [];
      const idx = [];
      const pushQuad = (x0, y0, x1, y1, h, c, up) => {
        const b = pos.length / 3;
        pos.push(x0, y0, h, x1, y0, h, x1, y1, h, x0, y1, h);
        for (let k = 0; k < 4; k++) {
          col.push(c[0], c[1], c[2]);
          nrm.push(0, 0, up ? 1 : -1);
        }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      };
      // road polygons (slightly raised)
      for (const rd of data.roads) {
        const w = rd.major ? 7 : 3.2;
        const dx = rd.b[0] - rd.a[0], dy = rd.b[1] - rd.a[1];
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l * w / 2, ny = dx / l * w / 2;
        const ax = Math.max(r.x0, Math.min(r.x1, rd.a[0])), ay = Math.max(r.y0, Math.min(r.y1, rd.a[1]));
        const bx = Math.max(r.x0, Math.min(r.x1, rd.b[0])), by = Math.max(r.y0, Math.min(r.y1, rd.b[1]));
        const c = rd.major ? [0.16, 0.17, 0.19] : [0.19, 0.2, 0.22];
        pushQuad(ax - nx, ay - ny, bx + nx, by + ny, 0.015, c, true);
      }
      // buildings
      for (const b of data.buildings) {
        const base = 0.03;
        // top
        pushQuad(b.x, b.y, b.x + b.w, b.y + b.d, base + b.h, b.color, true);
        // sides
        const side = [b.color[0] * 0.72, b.color[1] * 0.72, b.color[2] * 0.72];
        const side2 = [b.color[0] * 0.5, b.color[1] * 0.5, b.color[2] * 0.5];
        for (const wall of [
          [b.x, b.y, b.x + b.w, b.y, 'x'], [b.x + b.w, b.y, b.x + b.w, b.y + b.d, 'y'],
          [b.x + b.w, b.y + b.d, b.x, b.y + b.d, 'x'], [b.x, b.y + b.d, b.x, b.y, 'y']
        ]) {
          const b0 = pos.length / 3;
          pos.push(wall[0], wall[1], base, wall[2], wall[3], base, wall[2], wall[3], base + b.h, wall[0], wall[1], base + b.h);
          for (let k = 0; k < 4; k++) {
            col.push(k < 2 ? side[0] : side2[0], k < 2 ? side[1] : side2[1], k < 2 ? side[2] : side2[2]);
            if (wall[4] === 'x') nrm.push(wall[1] > b.y + b.d / 2 ? 0 : 0, 1, 0);
            else nrm.push(0, wall[2] > b.x + b.w / 2 ? -1 : 1, 0);
          }
          idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
        }
      }
      return { pos: new Float32Array(pos), col: new Float32Array(col), nrm: new Float32Array(nrm), idx: new Uint32Array(idx) };
    }
  }

  return { City, mulberry32 };
})();

if (typeof globalThis !== 'undefined') globalThis.City = City;
if (typeof module !== 'undefined' && module.exports) module.exports = City;
