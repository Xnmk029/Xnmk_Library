/**
 * world/City.js — procedural city generation
 *  - Grid-graph road network (arterials + collectors) + L-system avenue
 *  - block subdivision, building footprint extrusion, props (streetlights, signals, trees)
 *  - vector feature model consumed by the 3D vector-tile pipeline (Tiles.js)
 */
import * as THREE from 'three';
import { CFG } from '../config.js';

export class City {
  constructor() {
    this.roads = [];       // {id, cls, pts:[[x,z]..], lanes, name}
    this.buildings = [];   // {x,z,w,d,h,color,seed}
    this.pois = [];        // {name,x,z,type,importance}
    this.streetlights = [];// {x,z,rot}
    this.signals = [];     // {x,z,rot}
    this.trees = [];       // {x,z,r}
    this.parks = [];       // {x0,z0,x1,z1}
    this.intersections = [];
    this.pgRect = CFG.WORLD.pgRect;
    this.extent = CFG.WORLD.cityExtent;
    this.avenueCells = new Set();
    this.generate();
  }

  inPG(x, z, pad = 10) {
    const r = this.pgRect;
    return x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  }

  generate() {
    const E = this.extent;
    const aSp = 240;                    // arterial spacing
    const cSp = 120;                    // collector spacing
    const grid = {};
    grid.arterialX = []; grid.arterialZ = [];
    for (let v = -E + 120; v <= E - 120; v += aSp) { grid.arterialX.push(v); grid.arterialZ.push(v); }
    grid.collectorX = []; grid.collectorZ = [];
    for (let v = -E + 60; v <= E - 60; v += cSp) {
      if (Math.abs(v) % aSp !== 0) { grid.collectorX.push(v); grid.collectorZ.push(v); }
    }

    // ---------- roads ----------
    let rid = 0;
    const addRoad = (cls, pts, lanes, name) => {
      const segs = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        // skip segments through proving ground
        if (this.segInPG(a, b, 26)) continue;
        segs.push(a, b);
      }
      if (segs.length) this.roads.push({ id: 'r' + (rid++), cls, pts: segs, lanes, name });
    };

    for (const v of grid.arterialX) addRoad('arterial', [[v, -E], [v, E]], 2, this.nameFor('A', v));
    for (const v of grid.arterialZ) addRoad('arterial', [[-E, v], [E, v]], 2, this.nameFor('A', v));
    for (const v of grid.collectorX) addRoad('collector', [[v, -E], [v, E]], 1, this.nameFor('C', v));
    for (const v of grid.collectorZ) addRoad('collector', [[-E, v], [E, v]], 1, this.nameFor('C', v));

    // ---------- L-system avenue (serpentine through the grid) ----------
    const avenue = this.lSystemAvenue(E);
    addRoad('avenue', avenue, 3, '中央大道 Central Avenue');

    // ---------- blocks & buildings ----------
    const allX = [...grid.arterialX, ...grid.collectorX].sort((a, b) => a - b);
    const allZ = [...grid.arterialZ, ...grid.collectorZ].sort((a, b) => a - b);
    const cellPts = [];
    for (let i = 0; i < allX.length - 1; i++) {
      for (let j = 0; j < allZ.length - 1; j++) {
        const x0 = allX[i], x1 = allX[i + 1], z0 = allZ[j], z1 = allZ[j + 1];
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (this.inPG(cx, cz, 30)) continue;
        const cellKey = this.cellKey(cx, cz);
        if (this.avenueCells.has(cellKey)) continue;
        cellPts.push({ x0, x1, z0, z1, cx, cz, key: cellKey });
      }
    }
    // parks: ~8% of cells
    const parks = [];
    for (const c of cellPts) {
      if (this.hash(c.key) % 100 < 8) { parks.push(c); this.parks.push({ x0: c.x0, z0: c.z0, x1: c.x1, z1: c.z1 }); }
    }
    const parkSet = new Set(parks.map(p => p.key));

    // buildings per cell (1-4 footprints)
    let bid = 0;
    for (const c of cellPts) {
      if (parkSet.has(c.key)) {
        // park trees
        const n = 6 + (this.hash(c.key + 't') % 10);
        for (let i = 0; i < n; i++) {
          const x = c.x0 + 18 + ((this.hash(c.key + i * 3) % 1000) / 1000) * (c.x1 - c.x0 - 36);
          const z = c.z0 + 18 + ((this.hash(c.key + i * 7 + 5) % 1000) / 1000) * (c.z1 - c.z0 - 36);
          this.trees.push({ x, z, r: 2.2 + (this.hash(c.key + i) % 40) / 20 });
        }
        continue;
      }
      const w = c.x1 - c.x0, d = c.z1 - c.z0;
      const sub = 1 + (this.hash(c.key) % 4);
      for (let s = 0; s < sub; s++) {
        const inset = 7 + (this.hash(c.key + s) % 9);
        const bw = (w - inset * 2) / Math.ceil(Math.sqrt(sub)) * (0.7 + (this.hash(c.key + s * 13) % 6) / 10);
        const bd = (d - inset * 2) / Math.ceil(Math.sqrt(sub)) * (0.7 + (this.hash(c.key + s * 29) % 6) / 10);
        const bx = c.x0 + inset + ((this.hash(c.key + s * 5) % 1000) / 1000) * (w - bw - inset * 2);
        const bz = c.z0 + inset + ((this.hash(c.key + s * 11) % 1000) / 1000) * (d - bd - inset * 2);
        const h = 10 + (this.hash(c.key + s * 7) % 46);
        const palette = [0x8a93a8, 0x6b7488, 0xa8a09a, 0x7d8ca5, 0x93a08d, 0xb0a08c, 0x77829a];
        const color = palette[this.hash(c.key + s * 3) % palette.length];
        this.buildings.push({ x: bx, z: bz, w: bw, d: bd, h, color, seed: this.hash(c.key + s * 17), id: 'b' + (bid++) });
        // landmark naming for tall ones
        if (h > 48 && this.pois.length < 14) {
          this.pois.push({ name: this.landmarkName(bid), x: bx + bw / 2, z: bz + bd / 2, type: 'landmark', importance: 1 });
        }
      }
    }

    // ---------- intersections (for signals) ----------
    for (const vx of grid.arterialX) {
      for (const vz of grid.arterialZ) {
        if (!this.inPG(vx, vz, 16)) {
          this.intersections.push({ x: vx, z: vz });
          if ((this.hash(vx * 31 + vz) % 100) < 70) {
            this.signals.push({ x: vx, z: vz, rot: 0 });
          }
        }
      }
    }

    // ---------- streetlights along arterials ----------
    for (const r of this.roads) {
      if (r.cls !== 'arterial') continue;
      for (let i = 0; i + 1 < r.pts.length; i += 2) {
        const a = [r.pts[i][0], r.pts[i][1]], b = [r.pts[i + 1][0], r.pts[i + 1][1]];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.floor(len / 42);
        const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
        const px = -dz, pz = dx;
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1);
          const x = a[0] + dx * len * t, z = a[1] + dz * len * t;
          if (this.inPG(x, z, 20)) continue;
          this.streetlights.push({ x: x + px * 4.2, z: z + pz * 4.2, rot: Math.atan2(dx, dz) });
        }
      }
    }

    // ---------- POIs ----------
    this.pois.unshift(
      { name: 'CCF 试验场', x: 0, z: 100, type: 'pg', importance: 1 },
      { name: '比利时石路段', x: 0, z: 105, type: 'zone', importance: 2 },
      { name: '非对称起伏', x: 0, z: 190, type: 'zone', importance: 2 },
      { name: '绕桩赛道', x: 0, z: 330, type: 'zone', importance: 2 },
      { name: '高速银行弯', x: 0, z: -150, type: 'zone', importance: 2 },
      { name: '涉水池', x: -180, z: -250, type: 'zone', importance: 2 },
      { name: '中央商务区 CBD', x: 480, z: -480, type: 'district', importance: 2 },
      { name: '旧城中心', x: -480, z: 480, type: 'district', importance: 2 },
      { name: '东湾工业区', x: 600, z: 480, type: 'district', importance: 2 },
      { name: '北部公园', x: -480, z: -600, type: 'district', importance: 2 },
    );
    console.log(`[BEAMGL][city] roads=${this.roads.length} buildings=${this.buildings.length} lights=${this.streetlights.length} signals=${this.signals.length} trees=${this.trees.length} pois=${this.pois.length} parks=${this.parks.length}`);
  }

  segInPG(a, b, pad) {
    // sample the segment
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(2, Math.ceil(len / 40));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (this.inPG(x, z, pad)) return true;
    }
    return false;
  }

  cellKey(x, z) {
    return `${Math.round(x / 120)}:${Math.round(z / 120)}`;
  }

  hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  /** L-system: serpentine avenue generated by turtle rules on the grid */
  lSystemAvenue(E) {
    // rules: F = forward one grid step(120), + = turn right, - = turn left
    // axiom: F+F+F+F with a rewrite that produces a long serpentine
    const rules = { 'F': 'F+F-F-F+F', 'A': 'F-F+F+AF' };
    let s = 'F-F+F+AF-F+F-AF';
    for (let i = 0; i < 2; i++) {
      s = s.split('').map(c => rules[c] || c).join('');
    }
    const pts = [];
    let x = -E + 60, z = -E + 60;
    let dir = 0; // 0:+z 1:+x 2:-z 3:-x
    pts.push([x, z]);
    const step = 120;
    for (const c of s) {
      if (c === 'F') {
        // bound check + avoid PG
        const nx = dir === 1 ? x + step : dir === 3 ? x - step : x;
        const nz = dir === 0 ? z + step : dir === 2 ? z - step : z;
        if (nx < -E || nx > E || nz < -E || nz > E) { dir = (dir + 1) % 4; continue; }
        x = nx; z = nz;
        pts.push([x, z]);
        this.avenueCells.add(this.cellKey(x, z));
      } else if (c === '+') dir = (dir + 1) % 4;
      else if (c === '-') dir = (dir + 3) % 4;
    }
    return pts;
  }

  nameFor(cls, v) {
    const names = ['樱花大道', '中山路', '解放路', '工业大道', '滨海路', '学院街', '建设街', '人民路'];
    const i = Math.abs(Math.round(v / 240)) % names.length;
    return names[i] + (cls === 'arterial' ? ' (A)' : ' (C)');
  }

  landmarkName(i) {
    const names = ['CCF 中心大厦', '天际双子塔', '环球金融中心', '东方明珠塔', '晴空酒店', '银河广场', '未来科技楼', '云顶大厦'];
    return names[i % names.length];
  }

  /** ground rect of the city (for tile bounds) */
  bounds() {
    return { x0: -this.extent, x1: this.extent, z0: -this.extent, z1: this.extent };
  }
}
