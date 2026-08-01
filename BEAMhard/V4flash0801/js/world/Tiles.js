/**
 * world/Tiles.js — 3D vector tile web pipeline
 *  - QuadTree tile hierarchy (z/x/y), feature home-level assignment & slicing
 *  - runtime vector -> mesh tessellation (roads ribbons, building extrusions, props)
 *  - dynamic chunk streaming with frustum-based load / dispose
 *  - screen-space constant-width line shader for road markings
 */
import * as THREE from 'three';
import { CFG } from '../config.js';
import { makeToonMaterial } from '../render/Toon.js';

/* ---------------- screen-space line material ---------------- */
const ssLineVert = /* glsl */`
attribute vec3 aDir;
attribute vec3 color;
uniform float uPx;
uniform vec2 uVP;
uniform float uFov;
varying vec3 vColor;
void main() {
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(length(mv.xyz), 0.1);
  float worldW = 2.0 * dist * tan(uFov * 0.5) / uVP.y * uPx;
  vec3 off = normalize(aDir) * worldW;
  gl_Position = projectionMatrix * (mv + vec4(off, 0.0));
}
`;
const ssLineFrag = /* glsl */`
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
}
`;

export function makeSSLineMaterial(color = 0xffffff, px = 3) {
  return new THREE.ShaderMaterial({
    vertexShader: ssLineVert,
    fragmentShader: ssLineFrag,
    uniforms: { uPx: { value: px }, uVP: { value: new THREE.Vector2(1600, 900) }, uFov: { value: 1.05 } },
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/* ---------------- window texture (procedural) ---------------- */
let windowTex = null;
export function getWindowTexture() {
  if (windowTex) return windowTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#39415c';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const lit = Math.random() < 0.16;
      ctx.fillStyle = lit ? '#ffe9a8' : '#505c78';
      const inset = 3;
      ctx.fillRect(x * 32 + inset, y * 32 + inset, 32 - inset * 2, 32 - inset * 2);
      ctx.strokeStyle = '#2c3348';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * 32 + inset, y * 32 + inset, 32 - inset * 2, 32 - inset * 2);
    }
  }
  windowTex = new THREE.CanvasTexture(c);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  return windowTex;
}

/* ---------------- TileSystem ---------------- */
const ORIGIN = -CFG.WORLD.tileRootSize / 2;   // -1024
const ROOT = CFG.WORLD.tileRootSize;          // 2048

function tileSize(z) { return ROOT / Math.pow(2, z); }
function tileKey(z, x, y) { return z + '/' + x + '/' + y; }

export class TileSystem {
  constructor(scene, city, camera) {
    this.scene = scene;
    this.city = city;
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'vector-tiles';
    scene.add(this.group);
    this.tiles = new Map();       // key -> chunk {group, level}
    this.home = {};               // key -> features[]
    this.minLevel = 1;
    this.maxLevel = CFG.WORLD.maxTileLevel;
    this.viewRadius = 200;        // metres beyond frustum to keep
    this.lastView = null;
    this.stats = { loaded: 0, drawn: 0, disposed: 0 };

    // shared materials
    this.roadMats = {
      arterial: this.vcolMat(0x2f3138),
      collector: this.vcolMat(0x34363e),
      avenue: this.vcolMat(0x2a2c33),
    };
    this.roadMatNoV = makeToonMaterial({ color: 0x2f3138, toonMix: 0, fogColor: 0x1b2f5c });
    this.buildMat = makeToonMaterial({ map: getWindowTexture(), color: 0xffffff, toonMix: 1, fogColor: 0x1b2f5c });
    this.buildMatFlat = makeToonMaterial({ color: 0xffffff, toonMix: 0, fogColor: 0x1b2f5c });
    this.lineMatYellow = makeSSLineMaterial(0xffd200, 3.2);
    this.lineMatWhite = makeSSLineMaterial(0xe8ecf4, 2.4);
    this.signalMat = new THREE.MeshBasicMaterial({ color: 0x22242c });
    this.signalRed = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    this.signalGreen = new THREE.MeshBasicMaterial({ color: 0x34c759 });
    this.signalYellow = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

    this.slice();
  }

  vcolMat(color) {
    const m = makeToonMaterial({ color: 0xffffff, toonMix: 0, fogColor: 0x1b2f5c });
    m.defines = m.defines || {};
    m.defines.VCOL = '';
    m.needsUpdate = true;
    m.userData.vcolColor = color;
    return m;
  }

  hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  tileRect(z, x, y) {
    const s = tileSize(z);
    return { x0: ORIGIN + x * s, z0: ORIGIN + y * s, x1: ORIGIN + (x + 1) * s, z1: ORIGIN + (y + 1) * s };
  }

  keyToXY(key) {
    const [z, x, y] = key.split('/').map(Number);
    return { z, x, y };
  }

  /** assign features to home tiles */
  slice() {
    const city = this.city;
    // roads: arterials/avenue -> level 1, collector -> level 2
    for (const r of city.roads) {
      const z = r.cls === 'collector' ? 2 : 1;
      const visited = new Set();
      for (let i = 0; i < r.pts.length; i += 2) {
        const k = this.homeTileKey(z, r.pts[i][0], r.pts[i][1]);
        if (!visited.has(k)) {
          visited.add(k);
          this.addHome(k, { type: 'road', road: r });
        }
      }
    }
    // buildings -> level 3
    for (const b of city.buildings) {
      const k = this.homeTileKey(3, b.x + b.w / 2, b.z + b.d / 2);
      this.addHome(k, { type: 'building', b });
    }
    // streetlights & signals & trees -> level 4
    for (const l of city.streetlights) this.addHome(this.homeTileKey(4, l.x, l.z), { type: 'light', l });
    for (const s of city.signals) this.addHome(this.homeTileKey(4, s.x, s.z), { type: 'signal', s });
    for (const t of city.trees) this.addHome(this.homeTileKey(4, t.x, t.z), { type: 'tree', t });
    // crosswalks at arterial intersections -> level 4
    for (const i of city.intersections) {
      this.addHome(this.homeTileKey(4, i.x, i.z), { type: 'crosswalk', i });
    }
    let n = 0;
    for (const k in this.home) n += this.home[k].length;
    console.log(`[BEAMGL][tiles] sliced ${n} features into ${Object.keys(this.home).length} home tiles`);
  }

  addHome(key, f) {
    if (!this.home[key]) this.home[key] = [];
    this.home[key].push(f);
  }

  homeTileKey(z, x, zz) {
    const s = tileSize(z);
    const tx = Math.floor((x - ORIGIN) / s);
    const ty = Math.floor((zz - ORIGIN) / s);
    return tileKey(z, tx, ty);
  }

  /** visible tile set for a camera + view level */
  visibleTiles(level, focus) {
    const s = tileSize(level);
    const cam = this.camera;
    const R = this.viewRadius;
    // frustum corners at ground
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    const corners = [
      new THREE.Vector3(-1, -1, 0.5), new THREE.Vector3(1, -1, 0.5),
      new THREE.Vector3(-1, 1, 0.5), new THREE.Vector3(1, 1, 0.5),
      new THREE.Vector3(-1, -1, 1), new THREE.Vector3(1, -1, 1),
      new THREE.Vector3(-1, 1, 1), new THREE.Vector3(1, 1, 1),
    ];
    const proj = new THREE.Vector4();
    for (const c of corners) {
      c.applyMatrix4(cam.projectionMatrixInverse).applyMatrix4(cam.matrixWorld);
      // extend ray to y=0 plane
      const t = c.y !== 0 ? -cam.position.y / c.y : 0;
      const gx = cam.position.x + c.x * t;
      const gz = cam.position.z + c.z * t;
      if (t > 0) {
        minX = Math.min(minX, gx); maxX = Math.max(maxX, gx);
        minZ = Math.min(minZ, gz); maxZ = Math.max(maxZ, gz);
      }
    }
    if (minX > maxX) { minX = focus.x - 600; maxX = focus.x + 600; minZ = focus.z - 600; maxZ = focus.z + 600; }
    minX -= R; maxX += R; minZ -= R; maxZ += R;
    const x0 = Math.max(0, Math.floor((minX - ORIGIN) / s));
    const x1 = Math.min(Math.pow(2, level) - 1, Math.floor((maxX - ORIGIN) / s));
    const y0 = Math.max(0, Math.floor((minZ - ORIGIN) / s));
    const y1 = Math.min(Math.pow(2, level) - 1, Math.floor((maxZ - ORIGIN) / s));
    const out = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) out.push(tileKey(level, x, y));
    }
    return out;
  }

  /** streaming update: load visible chunks, dispose far ones */
  update(focus, viewLevel) {
    // hysteresis: only re-stream when level changes or focus moved > 80m
    const key = viewLevel + '|' + Math.round(focus.x / 80) + '|' + Math.round(focus.z / 80);
    if (key === this.lastView) return;
    this.lastView = key;

    const want = new Set(this.visibleTiles(viewLevel, focus));
    // dispose
    for (const [k, chunk] of this.tiles) {
      if (!want.has(k)) {
        this.disposeChunk(chunk);
        this.tiles.delete(k);
        this.stats.disposed++;
      }
    }
    // load
    for (const k of want) {
      if (!this.tiles.has(k)) {
        const chunk = this.buildChunk(k, viewLevel);
        if (chunk) { this.tiles.set(k, chunk); this.stats.loaded++; }
      }
    }
    this.stats.drawn = this.tiles.size;
  }

  disposeChunk(chunk) {
    this.group.remove(chunk.group);
    chunk.group.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.isInstancedMesh && o.count) { /* keep materials shared */ }
      }
    });
  }

  /** collect features for a tile (itself + ancestors) */
  collectFeatures(z, x, y) {
    const out = [];
    for (let lz = this.minLevel; lz <= z; lz++) {
      // ancestor tile at level lz
      const scale = Math.pow(2, z - lz);
      const ax = Math.floor(x / scale), ay = Math.floor(y / scale);
      const list = this.home[tileKey(lz, ax, ay)];
      if (list) out.push(...list);
    }
    return out;
  }

  buildChunk(key, level) {
    const { z, x, y } = this.keyToXY(key);
    const rect = this.tileRect(z, x, y);
    const features = this.collectFeatures(z, x, y);
    if (!features.length) return null;

    const group = new THREE.Group();
    group.name = 'tile-' + key;
    const g = {
      group,
      roadPos: [], roadCol: [], roadIdx: [],
      linePos: [], lineCol: [], lineDir: [],
      bldPos: [], bldNor: [], bldUv: [], bldCol: [], bldIdx: [],
      lights: [], signals: [], trees: [],
      count: 0,
    };

    const showProps = level >= 3;
    const useWindows = level >= 2;

    for (const f of features) {
      if (f.type === 'road') this.tessellateRoad(g, f.road, rect, level);
      else if (f.type === 'building' && this.rectIntersect(rect, f.b)) this.tessellateBuilding(g, f.b, useWindows);
      else if (f.type === 'light' && showProps && this.rectIntersect(rect, f.l)) g.lights.push(f.l);
      else if (f.type === 'signal' && showProps && this.rectIntersect(rect, f.s)) g.signals.push(f.s);
      else if (f.type === 'tree' && showProps && this.rectIntersect(rect, f.t)) g.trees.push(f.t);
      else if (f.type === 'crosswalk' && level >= 4 && this.rectIntersect(rect, f.i)) this.tessellateCrosswalk(g, f.i);
    }

    this.finishRoadMesh(g);
    this.finishBuildingMesh(g);
    this.finishProps(g);
    if (g.count === 0 && !g.group.children.length) return null;
    this.group.add(group);
    return { group, level, key };
  }

  rectIntersect(rect, f) {
    const x0 = f.x ?? (f.x - f.w / 2), x1 = f.x ?? (f.x + f.w / 2);
    const z0 = f.z ?? (f.z - f.d / 2), z1 = f.z ?? (f.z + f.d / 2);
    if (f.w !== undefined) {
      return !(f.x + f.w < rect.x0 || f.x > rect.x1 || f.z + f.d < rect.z0 || f.z > rect.z1);
    }
    return x0 < rect.x1 && x1 > rect.x0 && z0 < rect.z1 && z1 > rect.z0;
  }

  /* ---------- tessellation: roads ---------- */
  tessellateRoad(g, road, rect, level) {
    const width = road.lanes * 3.6;
    const pts = road.pts;
    // clip polyline to rect (with pad)
    const PAD = 30;
    const R = { x0: rect.x0 - PAD, x1: rect.x1 + PAD, z0: rect.z0 - PAD, z1: rect.z1 + PAD };
    const clipped = this.clipPolyline(pts, R);
    if (clipped.length < 2) return;
    // ribbon
    for (let i = 0; i < clipped.length - 1; i++) {
      const ax = clipped[i][0], az = clipped[i][1];
      const bx = clipped[i + 1][0], bz = clipped[i + 1][1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-4) continue;
      const px = -dz / len, pz = dx / len;
      const base = g.roadPos.length / 3;
      const col = this.roadColor(road.cls);
      for (const [x, z] of [[ax + px * width / 2, az + pz * width / 2], [ax - px * width / 2, az - pz * width / 2], [bx - px * width / 2, bz - pz * width / 2], [bx + px * width / 2, bz + pz * width / 2]]) {
        g.roadPos.push(x, 0.02, z);
        g.roadCol.push(col[0], col[1], col[2]);
      }
      g.roadIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      g.count++;
    }
    // centerline dashes (screen-space width)
    if (road.lanes >= 2) {
      const dash = 3.4, gap = 3.2;
      let total = 0;
      for (let i = 0; i < clipped.length - 1; i++) total += Math.hypot(clipped[i + 1][0] - clipped[i][0], clipped[i + 1][1] - clipped[i][1]);
      // walk polyline emitting dash segments
      const segs = [];
      let cur = clipped[0], acc = 0, emit = 0;
      for (let i = 1; i < clipped.length; i++) {
        const nx = clipped[i][0], nz = clipped[i][1];
        let segLen = Math.hypot(nx - cur[0], nz - cur[1]);
        const dx = (nx - cur[0]) / segLen, dz = (nz - cur[1]) / segLen;
        while (segLen > 0.001) {
          const step = Math.min(segLen, dash + gap - acc);
          acc += step;
          cur = [cur[0] + dx * step, cur[1] + dz * step];
          segLen -= step;
          if (acc >= dash + gap) {
            if (emit === 1) { segs.push(cur[0], cur[1]); }
            acc = 0; emit = 0;
          } else if (emit === 0 && acc >= dash) {
            segs.push(cur[0] - dx * (acc - dash), cur[1] - dz * (acc - dash));
            segs.push(cur[0], cur[1]);
            emit = 1;
          }
        }
      }
      for (let i = 0; i + 3 < segs.length; i += 4) {
        this.pushLine(g, segs[i], segs[i + 1], segs[i + 2], segs[i + 3], 1.0, 0.82, 0.0);
      }
    }
    // edge lines
    const edgeCol = road.cls === 'avenue' ? [0.55, 0.6, 0.75] : [0.92, 0.95, 1.0];
    for (const side of [-1, 1]) {
      const edge = [];
      for (let i = 0; i < clipped.length; i++) {
        const ax = clipped[i][0], az = clipped[i][1];
        const bx = clipped[Math.min(i + 1, clipped.length - 1)][0], bz = clipped[Math.min(i + 1, clipped.length - 1)][1];
        const dx = bx - ax, dz = bz - az;
        const len = Math.hypot(dx, dz) || 1;
        const px = -dz / len, pz = dx / len;
        edge.push([ax + px * (width / 2 - 0.25) * side, az + pz * (width / 2 - 0.25) * side]);
      }
      for (let i = 0; i < edge.length - 1; i++) {
        this.pushLine(g, edge[i][0], edge[i][1], edge[i + 1][0], edge[i + 1][1], edgeCol[0], edgeCol[1], edgeCol[2]);
      }
    }
  }

  pushLine(g, ax, az, bx, bz, r, gc, b) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const base = g.linePos.length / 3;
    // perpendicular (world)
    g.linePos.push(ax, 0.03, az);
    g.linePos.push(bx, 0.03, bz);
    g.lineCol.push(r, gc, b, r, gc, b);
    const px = -dz / len, pz = dx / len;
    g.lineDir.push(px, 0, pz, px, 0, pz);
  }

  tessellateCrosswalk(g, i) {
    // white stripes across the z-road at intersection
    const w = 7.2;
    for (const s of [-1, 1]) {
      const z = i.z + s * 4.6;
      for (let k = 0; k < 4; k++) {
        const x0 = i.x + k * 1.9 - 3.8;
        const base = g.roadPos.length / 3;
        g.roadPos.push(x0, 0.025, z - 0.25, x0 + 1.1, 0.025, z - 0.25, x0 + 1.1, 0.025, z + 0.25, x0, 0.025, z + 0.25);
        g.roadCol.push(0.93, 0.95, 1.0, 0.93, 0.95, 1.0, 0.93, 0.95, 1.0, 0.93, 0.95, 1.0);
        g.roadIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }

  roadColor(cls) {
    if (cls === 'arterial') return [0.19, 0.2, 0.24];
    if (cls === 'avenue') return [0.17, 0.18, 0.22];
    return [0.21, 0.22, 0.26];
  }

  clipPolyline(pts, R) {
    // Liang–Barsky style clip each segment against rect, keep polyline continuity
    const out = [];
    let prevInside = false;
    const inside = (p) => p[0] >= R.x0 && p[0] <= R.x1 && p[1] >= R.z0 && p[1] <= R.z1;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const seg = this.clipSegment(a, b, R);
      if (seg) {
        if (!prevInside || out.length === 0 || out[out.length - 1][0] !== seg[0][0] || out[out.length - 1][1] !== seg[0][1]) {
          out.push(seg[0]);
        }
        out.push(seg[1]);
        prevInside = true;
      } else {
        prevInside = false;
      }
    }
    return out;
  }

  clipSegment(a, b, R) {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-9) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (!clip(-dx, a[0] - R.x0)) return null;
    if (!clip(dx, R.x1 - a[0])) return null;
    if (!clip(-dz, a[1] - R.z0)) return null;
    if (!clip(dz, R.z1 - a[1])) return null;
    return [[a[0] + t0 * dx, a[1] + t0 * dz], [a[0] + t1 * dx, a[1] + t1 * dz]];
  }

  /* ---------- tessellation: buildings ---------- */
  tessellateBuilding(g, b, useWindows) {
    const { x, z, w, d, h } = b;
    // color variation from seed
    const base = new THREE.Color(b.color);
    const v = 0.92 + (this.hash(b.seed + 'v') % 14) / 100;
    base.multiplyScalar(v);
    const topC = base.clone().multiplyScalar(0.82);
    const cx = x + w / 2, cz = z + d / 2;
    const hs = h / 2;
    const baseIdx = g.bldPos.length / 3;
    const uvScale = 1 + (this.hash(b.seed) % 30) / 10;
    // 4 sides + top
    const sides = [
      { n: [0, 0, -1], p: [[x, z], [x + w, z]] },        // -z face
      { n: [0, 0, 1], p: [[x, z + d], [x + w, z + d]] }, // +z face
      { n: [-1, 0, 0], p: [[x, z], [x, z + d]] },        // -x face
      { n: [1, 0, 0], p: [[x + w, z], [x + w, z + d]] }, // +x face
    ];
    for (const s of sides) {
      const [p0, p1] = s.p;
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const i = g.bldPos.length / 3;
      g.bldPos.push(p0[0], 0, p0[1], p1[0], 0, p1[1], p1[0], h, p1[1], p0[0], h, p0[1]);
      for (let k = 0; k < 4; k++) { g.bldNor.push(...s.n); }
      const c = k => { g.bldCol.push(base.r * k, base.g * k, base.b * k); };
      c(1); c(1); c(0.78); c(0.78);
      if (useWindows) {
        g.bldUv.push(0, 0, len / 3.2 * uvScale, 0, len / 3.2 * uvScale, h / 3.2 * uvScale, 0, h / 3.2 * uvScale);
      }
      g.bldIdx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
    // top
    const i = g.bldPos.length / 3;
    g.bldPos.push(x, h, z, x + w, h, z, x + w, h, z + d, x, h, z + d);
    for (let k = 0; k < 4; k++) g.bldNor.push(0, 1, 0);
    for (let k = 0; k < 4; k++) g.bldCol.push(topC.r, topC.g, topC.b);
    if (useWindows) g.bldUv.push(0, 0, w / 6, 0, w / 6, d / 6, 0, d / 6);
    g.bldIdx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    g.count++;
  }

  /* ---------- finish: meshes ---------- */
  finishRoadMesh(g) {
    if (g.roadPos.length >= 12) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.roadPos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.roadCol, 3));
      geo.setIndex(g.roadIdx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this.roadMatNoV);
      g.group.add(mesh);
    }
    if (g.linePos.length >= 6) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.linePos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.lineCol, 3));
      geo.setAttribute('aDir', new THREE.Float32BufferAttribute(g.lineDir, 3));
      const mat = new THREE.ShaderMaterial({
        vertexShader: ssLineVert,
        fragmentShader: ssLineFrag,
        uniforms: {
          uPx: { value: 3.2 },
          uVP: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          uFov: { value: 1.0 },
        },
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const lines = new THREE.LineSegments(geo, mat);
      g.group.add(lines);
      g.group.userData.lineMat = mat;
    }
  }

  finishBuildingMesh(g) {
    if (g.bldPos.length < 12) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.bldPos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.bldNor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.bldCol, 3));
    if (g.bldUv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.bldUv, 2));
    geo.setIndex(g.bldIdx);
    const mat = g.bldUv.length ? this.buildMat : this.buildMatFlat;
    const m = new THREE.Mesh(geo, mat);
    m.name = 'buildings';
    g.group.add(m);
  }

  finishProps(g) {
    if (g.lights.length) {
      const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 5.2, 6), new THREE.MeshStandardMaterial({ color: 0x3a3e48, roughness: 0.6 }), g.lights.length);
      const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.22, 0.35), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), g.lights.length);
      const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
      g.lights.forEach((l, i) => {
        p.set(l.x, 2.6, l.z);
        q.setFromEuler(new THREE.Euler(0, l.rot, 0));
        m4.compose(p, q, s);
        pole.setMatrixAt(i, m4);
        p.set(l.x + Math.sin(l.rot) * 0.55, 5.15, l.z + Math.cos(l.rot) * 0.55);
        m4.compose(p, q, s);
        head.setMatrixAt(i, m4);
      });
      g.group.add(pole, head);
    }
    if (g.signals.length) {
      const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), this.signalMat, g.signals.length);
      const headM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1.1, 0.5), this.signalMat, g.signals.length);
      const red = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), this.signalRed, g.signals.length);
      const yellow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), this.signalYellow, g.signals.length);
      const green = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), this.signalGreen, g.signals.length);
      const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion();
      g.signals.forEach((sg, i) => {
        q.setFromEuler(new THREE.Euler(0, sg.rot, 0));
        p.set(sg.x + 3.4, 1.7, sg.z);
        m4.compose(p, q, new THREE.Vector3(1, 1, 1));
        post.setMatrixAt(i, m4);
        p.set(sg.x + 3.4, 4.1, sg.z);
        m4.compose(p, q, new THREE.Vector3(1, 1, 1));
        headM.setMatrixAt(i, m4);
        const offs = [[0, 0.36, 0.28, red], [0, 0, 0.28, yellow], [0, -0.36, 0.28, green]];
        offs.forEach(([ox, oy, oz, im]) => {
          p.set(sg.x + 3.4 + ox, 4.1 + oy, sg.z + oz);
          m4.compose(p, q, new THREE.Vector3(1, 1, 1));
          im.setMatrixAt(i, m4);
        });
      });
      g.group.add(post, headM, red, yellow, green);
    }
    if (g.trees.length) {
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 5), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }), g.trees.length);
      const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 3, 7), new THREE.MeshStandardMaterial({ color: 0x3f7a4e, roughness: 1 }), g.trees.length);
      const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
      g.trees.forEach((t, i) => {
        p.set(t.x, 0.6, t.z);
        m4.compose(p, new THREE.Quaternion(), new THREE.Vector3(t.r / 2.4, t.r / 2.4, t.r / 2.4));
        trunk.setMatrixAt(i, m4);
        p.set(t.x, 2.4, t.z);
        m4.compose(p, new THREE.Quaternion(), new THREE.Vector3(t.r, t.r, t.r));
        crown.setMatrixAt(i, m4);
      });
      g.group.add(trunk, crown);
    }
  }

  /** update screen-space materials with viewport */
  updateViewport(vp, fov) {
    this.group.traverse((o) => {
      if (o.isLineSegments && o.material && o.material.uniforms && o.material.uniforms.uVP) {
        o.material.uniforms.uVP.value.copy(vp);
        o.material.uniforms.uFov.value = fov;
      }
    });
  }

  disposeAll() {
    for (const [, chunk] of this.tiles) this.disposeChunk(chunk);
    this.tiles.clear();
    this.lastView = null;
  }
}
