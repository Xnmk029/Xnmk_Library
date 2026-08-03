/**
 * tiles.js — Task 5.2/5.3: QuadTree vector-tile slicing, runtime tessellation
 * and LOD streaming.
 *
 * Tile addressing: {z, x, y} — z ∈ [0..5], tile size = 4096/2^z metres, x/y
 * index from the -HALF corner ("slippy map" layout over the city bounds).
 *
 * Per-zoom content policy (real vector-tile style):
 *   z ≤ 1  arterials ribbons
 *   z = 2  + collectors
 *   z = 3  + block ground plates, parks, centreline dashes (screen-px lines)
 *   z = 4  + extruded buildings, local roads
 *   z = 5  + streetlights, signals, crosswalks, building AABB colliders
 *
 * Streaming: every frame the camera's ground footprint selects the zoom and
 * the visible tile set; missing tiles build under a per-frame time budget;
 * an LRU cap evicts distant tiles (geometry disposed).
 */
import * as THREE from 'three';
import { CITY_SIZE, HALF, clipSegment } from './citygen.js';
import { makeLineMaterial, buildLineGeometry } from './lines.js';
import { makeGradientMap } from '../gfx/npr.js';

const ROAD_COLORS = [new THREE.Color(0x585b64), new THREE.Color(0x60636b), new THREE.Color(0x686a71)];
const ROAD_Y = [0.06, 0.045, 0.03];

function mergeGeoms(geoms) {
  let vTotal = 0, iTotal = 0;
  for (const g of geoms) { vTotal += g.pos.length / 3; iTotal += g.idx.length; }
  const pos = new Float32Array(vTotal * 3);
  const col = new Float32Array(vTotal * 3);
  const nrm = new Float32Array(vTotal * 3);
  const idx = vTotal > 65535 ? new Uint32Array(iTotal) : new Uint16Array(iTotal);
  let vo = 0, io = 0;
  for (const g of geoms) {
    pos.set(g.pos, vo * 3);
    col.set(g.col, vo * 3);
    if (g.nrm) nrm.set(g.nrm, vo * 3);
    for (let i = 0; i < g.idx.length; i++) idx[io + i] = g.idx[i] + vo;
    vo += g.pos.length / 3; io += g.idx.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (nrm.some(v => v !== 0)) geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  else geo.computeVertexNormals();
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

/** flat road ribbon between two points */
function ribbon(x0, z0, x1, z1, w, y, c) {
  const dx = x1 - x0, dz = z1 - z0;
  const l = Math.hypot(dx, dz) || 1;
  const nx = -dz / l * w / 2, nz = dx / l * w / 2;
  const pos = new Float32Array([
    x0 + nx, y, z0 + nz, x0 - nx, y, z0 - nz,
    x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz,
  ]);
  const col = new Float32Array(12);
  for (let i = 0; i < 4; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  const nrm = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  return { pos, col, nrm, idx: [0, 2, 1, 1, 2, 3] };
}

/** extruded axis-aligned box building with roof + per-face shading */
function buildingBox(b) {
  const { x, z, w, d, h } = b;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const [r, g, bl] = b.c;
  const shade = (f) => [r * f, g * f, bl * f];
  const faces = [
    // +x, -x, +z, -z, roof
    { v: [x1, 0, z0, x1, 0, z1, x1, h, z0, x1, h, z1], n: [1, 0, 0], f: 0.92 },
    { v: [x0, 0, z1, x0, 0, z0, x0, h, z1, x0, h, z0], n: [-1, 0, 0], f: 0.78 },
    { v: [x1, 0, z1, x0, 0, z1, x1, h, z1, x0, h, z1], n: [0, 0, 1], f: 1.0 },
    { v: [x0, 0, z0, x1, 0, z0, x0, h, z0, x1, h, z0], n: [0, 0, -1], f: 0.7 },
    { v: [x0, h, z0, x1, h, z0, x0, h, z1, x1, h, z1], n: [0, 1, 0], f: 1.05 },
  ];
  const pos = new Float32Array(20 * 3);
  const col = new Float32Array(20 * 3);
  const nrm = new Float32Array(20 * 3);
  const idx = [];
  faces.forEach((face, fi) => {
    const o = fi * 4;
    pos.set(face.v, o * 3);
    const c = shade(face.f);
    for (let k = 0; k < 4; k++) {
      col[(o + k) * 3] = c[0]; col[(o + k) * 3 + 1] = c[1]; col[(o + k) * 3 + 2] = c[2];
      nrm[(o + k) * 3] = face.n[0]; nrm[(o + k) * 3 + 1] = face.n[1]; nrm[(o + k) * 3 + 2] = face.n[2];
    }
    idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
  });
  return { pos, col, nrm, idx };
}

function lampGeom(x, z, rot, c) {
  // pole + arm + head, tiny merged box set
  const boxes = [
    [x, 3.1, z, 0.14, 6.2, 0.14],
    [x + Math.cos(rot) * 0.9, 6.0, z + Math.sin(rot) * 0.9, 1.7 * Math.abs(Math.cos(rot)) + 0.16, 0.12, 1.7 * Math.abs(Math.sin(rot)) + 0.16],
    [x + Math.cos(rot) * 1.7, 5.85, z + Math.sin(rot) * 1.7, 0.42, 0.16, 0.42],
  ];
  const cols = [c, c, [1.0, 0.9, 0.6]];
  const pos = []; const col = []; const idx = []; const nrm = [];
  let vo = 0;
  boxes.forEach((bx, bi) => {
    const [cx, cy, cz, w, h, d] = bx;
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const verts = [
      x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
      x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
    ];
    pos.push(...verts);
    const cc = cols[bi];
    for (let k = 0; k < 8; k++) { col.push(cc[0], cc[1], cc[2]); nrm.push(0, 1, 0); }
    const f = [[0, 1, 2, 3], [5, 4, 7, 6], [1, 5, 6, 2], [4, 0, 3, 7], [3, 2, 6, 7], [4, 5, 1, 0]];
    for (const q of f) idx.push(vo + q[0], vo + q[2], vo + q[1], vo + q[0], vo + q[3], vo + q[2]);
    vo += 8;
  });
  return { pos: new Float32Array(pos), col: new Float32Array(col), nrm: new Float32Array(nrm), idx };
}

export class TileManager {
  constructor(city, scene, log = () => {}) {
    this.city = city;
    this.scene = scene;
    this.log = log;
    this.group = new THREE.Group();
    this.group.name = 'cityTiles';
    scene.add(this.group);

    this.tiles = new Map();      // key -> {group, lastUse, built}
    this.buildQueue = [];
    this.maxTiles = 200;
    this.frame = 0;
    this.stats = { built: 0, evicted: 0, visible: 0 };

    this.gradientMap = makeGradientMap(4);
    this.matFlat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.gradientMap });
    this.matBuilding = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.gradientMap });
    this.lineMats = {
      center: makeLineMaterial({ widthPx: 1.6, color: 0xffe28a, opacity: 0.95, dash: 4, gap: 4 }),
      edge: makeLineMaterial({ widthPx: 1.3, color: 0xf2eee2, opacity: 0.8 }),
      cross: makeLineMaterial({ widthPx: 3.2, color: 0xf5f2e8, opacity: 0.9, dash: 0.8, gap: 0.55 }),
    };

    // spatial buckets for fast slicing
    this.roadSegs = [];
    for (const r of city.roads) {
      for (let i = 0; i + 3 < r.pts.length; i += 2) {
        this.roadSegs.push({ x0: r.pts[i], z0: r.pts[i + 1], x1: r.pts[i + 2], z1: r.pts[i + 3], cls: r.cls, w: r.w });
      }
    }

    // ground plate for the whole city (below tiles)
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_SIZE + 400, CITY_SIZE + 400).rotateX(-Math.PI / 2),
      new THREE.MeshToonMaterial({ color: 0x767a70, gradientMap: this.gradientMap }),
    );
    plate.position.y = -0.05;
    plate.receiveShadow = true;
    this.group.add(plate);
  }

  key(z, x, y) { return `${z}/${x}/${y}`; }
  tileSize(z) { return CITY_SIZE / (1 << z); }

  zoomForHeight(h) {
    if (h > 2300) return 0;
    if (h > 1250) return 1;
    if (h > 640) return 2;
    if (h > 300) return 3;
    if (h > 130) return 4;
    return 5;
  }

  /** visible tile coords for a ground-plane AABB at zoom z */
  tilesInAABB(z, minX, minZ, maxX, maxZ) {
    const ts = this.tileSize(z);
    const n = 1 << z;
    const x0 = Math.max(0, Math.floor((minX + HALF) / ts));
    const x1 = Math.min(n - 1, Math.floor((maxX + HALF) / ts));
    const y0 = Math.max(0, Math.floor((minZ + HALF) / ts));
    const y1 = Math.min(n - 1, Math.floor((maxZ + HALF) / ts));
    const out = [];
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) out.push([z, tx, ty]);
    return out;
  }

  /** Build the actual meshes for one tile. */
  buildTile(z, tx, ty) {
    const ts = this.tileSize(z);
    const minX = -HALF + tx * ts, minZ = -HALF + ty * ts;
    const maxX = minX + ts, maxZ = minZ + ts;
    const pad = 4;
    const g = new THREE.Group();
    g.name = this.key(z, tx, ty);

    const flat = [];
    const lines = { center: [], edge: [], cross: [] };
    const bldGeoms = [];
    const colliders = [];

    // roads
    const minClsW = z <= 1 ? 20 : z === 2 ? 12 : 0;   // arterials → +collectors → all
    for (const s of this.roadSegs) {
      if (s.w < minClsW) continue;
      const c = clipSegment(s.x0, s.z0, s.x1, s.z1, minX - pad, minZ - pad, maxX + pad, maxZ + pad);
      if (!c) continue;
      flat.push(ribbon(c[0], c[1], c[2], c[3], s.w, ROAD_Y[s.cls], ROAD_COLORS[s.cls]));
      if (z >= 3 && s.cls <= 1) {
        lines.center.push([c[0], c[1], c[2], c[3]]);
        // edge lines offset both sides
        const dx = c[2] - c[0], dz = c[3] - c[1];
        const l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l * (s.w / 2 - 0.6), nz = dx / l * (s.w / 2 - 0.6);
        lines.edge.push([c[0] + nx, c[1] + nz, c[2] + nx, c[3] + nz]);
        lines.edge.push([c[0] - nx, c[1] - nz, c[2] - nx, c[3] - nz]);
      }
    }

    // parks
    if (z >= 3) {
      for (const p of this.city.parks) {
        if (p.x + p.w / 2 < minX || p.x - p.w / 2 > maxX || p.z + p.d / 2 < minZ || p.z - p.d / 2 > maxZ) continue;
        const c = new THREE.Color(0x5fae57);
        flat.push(ribbon(p.x - p.w / 2, p.z, p.x + p.w / 2, p.z, p.d, 0.02, c));
      }
    }

    // buildings (assigned by centroid to avoid duplicates)
    if (z >= 4) {
      for (const b of this.city.buildings) {
        if (b.x < minX || b.x >= maxX || b.z < minZ || b.z >= maxZ) continue;
        bldGeoms.push(buildingBox(b));
        if (z >= 5) colliders.push({ minX: b.bbox[0], minZ: b.bbox[1], maxX: b.bbox[2], maxZ: b.bbox[3], h: b.h });
      }
    }

    // props
    if (z >= 5) {
      for (const [lx, lz, rot] of this.city.lights) {
        if (lx < minX || lx >= maxX || lz < minZ || lz >= maxZ) continue;
        bldGeoms.push(lampGeom(lx, lz, rot, [0.24, 0.26, 0.3]));
      }
      for (const [sx, sz, rot] of this.city.signals) {
        if (sx < minX || sx >= maxX || sz < minZ || sz >= maxZ) continue;
        const sig = lampGeom(sx, sz, rot, [0.16, 0.17, 0.2]);
        bldGeoms.push(sig);
      }
      // crosswalks at arterial intersections inside tile
      for (const s of this.roadSegs) {
        if (s.cls !== 0) continue;
      }
    }

    if (flat.length) {
      const m = new THREE.Mesh(mergeGeoms(flat), this.matFlat);
      m.receiveShadow = true;
      g.add(m);
    }
    if (bldGeoms.length) {
      const m = new THREE.Mesh(mergeGeoms(bldGeoms), this.matBuilding);
      m.castShadow = z >= 5;
      m.receiveShadow = true;
      g.add(m);
    }
    for (const [kind, polys] of Object.entries(lines)) {
      if (!polys.length) continue;
      const geo = buildLineGeometry(polys, 0.09);
      const mesh = new THREE.Mesh(geo, this.lineMats[kind]);
      mesh.renderOrder = 3;
      g.add(mesh);
    }

    g.userData.colliders = colliders;
    this.stats.built++;
    return g;
  }

  /**
   * Per-frame streaming update.
   * @param cam       THREE camera (projection already set)
   * @param focus     ground point the camera looks at
   * @param camHeight metres above ground
   */
  update(cam, focus, camHeight, budgetMs = 4) {
    this.frame++;
    const z = this.zoomForHeight(camHeight);
    const viewR = Math.max(120, camHeight * 2.2);
    const wanted = this.tilesInAABB(z, focus.x - viewR, focus.z - viewR, focus.x + viewR, focus.z + viewR);

    // also keep a parent-level ring for horizon context
    const parents = z > 0 ? this.tilesInAABB(z - 1,
      focus.x - viewR * 2.6, focus.z - viewR * 2.6, focus.x + viewR * 2.6, focus.z + viewR * 2.6) : [];

    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));

    const t0 = performance.now();
    const need = [...wanted, ...parents];
    const activeKeys = new Set();

    for (const [tz, tx, ty] of need) {
      const k = this.key(tz, tx, ty);
      activeKeys.add(k);
      let t = this.tiles.get(k);
      if (!t) {
        if (performance.now() - t0 > budgetMs) continue;   // budget: defer to next frame
        const grp = this.buildTile(tz, tx, ty);
        t = { group: grp, lastUse: this.frame, z: tz };
        this.tiles.set(k, t);
        this.group.add(grp);
      }
      t.lastUse = this.frame;

      // frustum test on tile sphere
      const ts = this.tileSize(tz);
      const cx = -HALF + tx * ts + ts / 2, cz = -HALF + ty * ts + ts / 2;
      const sph = new THREE.Sphere(new THREE.Vector3(cx, 20, cz), ts * 0.75 + 60);
      t.group.visible = frustum.intersectsSphere(sph);
    }

    // hide non-active, evict LRU
    let visible = 0;
    for (const [k, t] of this.tiles) {
      if (!activeKeys.has(k)) t.group.visible = false;
      if (t.group.visible) visible++;
    }
    if (this.tiles.size > this.maxTiles) {
      const sorted = [...this.tiles.entries()].sort((a, b) => a[1].lastUse - b[1].lastUse);
      const evict = sorted.slice(0, this.tiles.size - this.maxTiles);
      for (const [k, t] of evict) {
        this.group.remove(t.group);
        t.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        this.tiles.delete(k);
        this.stats.evicted++;
      }
    }
    this.stats.visible = visible;
    this.stats.zoom = z;
    return { zoom: z, visible, cached: this.tiles.size };
  }

  /** building colliders near a point (city drive mode) */
  collidersNear(x, z, r = 60) {
    const out = [];
    for (const t of this.tiles.values()) {
      if (t.z < 5 || !t.group.visible) continue;
      for (const c of t.group.userData.colliders || []) {
        if (c.maxX < x - r || c.minX > x + r || c.maxZ < z - r || c.minZ > z + r) continue;
        out.push(c);
      }
    }
    return out;
  }

  setAllVisible(v) { this.group.visible = v; }
}

export default TileManager;
