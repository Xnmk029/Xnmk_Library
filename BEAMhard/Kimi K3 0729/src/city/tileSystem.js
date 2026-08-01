/**
 * tileSystem.js — QuadTree z/x/y tiling of the city + incremental chunk streaming.
 *
 * Tile math (square-ified bounds, z/x/y addressing) is pure JS and importable
 * in Node. three.js is only used for the chunk-building / frustum-culling part.
 *
 * Level → content rule:
 *   z == minZoom     : arterial roads + downtown buildings + ground plane
 *   z == minZoom + 1 : + collector roads + midtown buildings
 *   z >= minZoom + 2 : + local roads, suburb buildings, props (streetlights, signals), road markings
 *
 * Level → grid mapping (zoomBase = 10): the TileSystem slices the city into
 * 2^(z - zoomBase) tiles per axis, so minZoom 11 → 2 tiles/axis (~1024 m) and
 * maxZoom 16 → 64 tiles/axis (~32 m) for a 2048 m city. The generic exported
 * helpers (tileCount/tileBounds/lonLatStyleIndex) take raw "grid bits" g and
 * implement the standard 2^g × 2^g subdivision over square-ified bounds;
 * the TileSystem calls them with g = z - zoomBase.
 */

import * as THREE from '../../lib/three.module.js';
import { ribbonTriangles, extrudeTriangles } from './vectorMesh.js';
import { makeScreenLineMaterial, buildLineStripGeometry } from './lineShader.js';

/* ------------------------------------------------------- pure tile math -- */

/** Square-ify bounds around their center (tiles are square). */
function squareBounds(bounds) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxZ - bounds.minZ;
  const s = Math.max(w, h);
  return { minX: cx - s / 2, minZ: cz - s / 2, maxX: cx + s / 2, maxZ: cz + s / 2, size: s };
}

/**
 * Number of tiles along one axis at level z (total tiles = tileCount(z)^2).
 * @param {number} z zoom level
 * @returns {number} 2^z
 */
export function tileCount(z) {
  return 2 ** z;
}

/**
 * World-space bounds of tile z/x/y. y = 0 is the minZ (north) edge.
 * @param {{minX:number,minZ:number,maxX:number,maxZ:number}} bounds city bounds (square-ified internally)
 * @param {number} z @param {number} x @param {number} y
 * @returns {{minX:number,minZ:number,maxX:number,maxZ:number}}
 */
export function tileBounds(bounds, z, x, y) {
  const sq = squareBounds(bounds);
  const n = tileCount(z);
  const s = sq.size / n;
  return { minX: sq.minX + x * s, minZ: sq.minZ + y * s, maxX: sq.minX + (x + 1) * s, maxZ: sq.minZ + (y + 1) * s };
}

/**
 * Slippy-style tile index containing world point (px, pz) at level z.
 * @returns {{x:number, y:number}} clamped to [0, 2^z - 1]
 */
export function lonLatStyleIndex(bounds, px, pz, z) {
  const sq = squareBounds(bounds);
  const n = tileCount(z);
  const x = Math.floor(((px - sq.minX) / sq.size) * n);
  const y = Math.floor(((pz - sq.minZ) / sq.size) * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

/**
 * Map camera height above ground to a discrete zoom level.
 * ~1600 m → 11, halving the height adds one level.
 * @param {number} cameraHeight meters above ground
 * @returns {number} integer zoom level (clamped 0..16)
 */
export function pickZoomLevel(cameraHeight) {
  const z = Math.round(11 + Math.log2(1600 / Math.max(1, cameraHeight)));
  return Math.max(0, Math.min(16, z));
}

/* ------------------------------------------------------------- chunk build -- */

const CLASS_COLORS = { arterial: 0x33363c, collector: 0x3a3d44, local: 0x41444b };
const DISTRICT_TINTS = { downtown: 0x8fa3b8, midtown: 0xa89e93, suburb: 0xc7b9a8 };
const POI_IMPORTANCE = { tower: 3, mall: 2, station: 2, park: 1, shrine: 1 };

function roadBBox(r) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of r.points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const pad = r.width * 0.5 + 2;
  return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
}

function bboxIntersects(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

function centroid2(footprint) {
  let x = 0, z = 0;
  for (const p of footprint) { x += p[0]; z += p[1]; }
  return [x / footprint.length, z / footprint.length];
}

/** Merge arrays of {positions, normals, indices} (with optional per-part color) into one geometry. */
function mergeParts(THREE_, parts) {
  const pos = [], norm = [], col = [], idx = [];
  let base = 0;
  const c = new THREE_.Color();
  for (const part of parts) {
    c.set(part.color !== undefined ? part.color : 0xffffff);
    const n = part.positions.length / 3;
    for (let i = 0; i < n; i++) {
      pos.push(part.positions[i * 3], part.positions[i * 3 + 1], part.positions[i * 3 + 2]);
      norm.push(part.normals ? part.normals[i * 3] : 0, part.normals ? part.normals[i * 3 + 1] : 1, part.normals ? part.normals[i * 3 + 2] : 0);
      col.push(c.r, c.g, c.b);
    }
    for (const i of part.indices) idx.push(i + base);
    base += n;
  }
  const g = new THREE_.BufferGeometry();
  g.setAttribute('position', new THREE_.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE_.Float32BufferAttribute(norm, 3));
  g.setAttribute('color', new THREE_.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/* -------------------------------------------------------------- TileSystem -- */

export class TileSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {ReturnType<import('./cityGen.js').generateCity>} cityData
   * @param {object} [opts]
   * @param {number} [opts.minZoom=11]
   * @param {number} [opts.maxZoom=16]
   * @param {number} [opts.budgetMs=4] per-frame build time budget
   */
  constructor(scene, cityData, { minZoom = 11, maxZoom = 16, budgetMs = 4 } = {}) {
    this.scene = scene;
    this.city = cityData;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.budgetMs = budgetMs;
    this.maxChunks = 96;
    /** Grid-bits shift: tiles per axis at level z = 2^(z - zoomBase). */
    this.zoomBase = 10;

    /** @type {Map<string, {group:THREE.Group, z:number, lastUsed:number}>} */
    this.chunks = new Map();
    this.buildQueue = [];
    this.level = minZoom;
    this.time = 0;
    this.vehicle = null;
    this._culled = 0;
    this._desired = new Set();

    // precompute assignment caches
    this._roadBBox = cityData.roads.map(roadBBox);
    this._buildingCentroid = cityData.buildings.map(b => centroid2(b.footprint));

    // shared line materials
    this.centerLineMat = makeScreenLineMaterial(THREE, { color: 0xd8d4c0, widthPx: 2, opacity: 0.9, dashed: true });
    this.edgeLineMat = makeScreenLineMaterial(THREE, { color: 0xb9bdc6, widthPx: 1.5, opacity: 0.6 });
    this.resolution = { w: 1920, h: 1080 };

    this._frustum = new THREE.Frustum();
    this._mat4 = new THREE.Matrix4();
  }

  /** Update shared line-material resolution uniforms (call on resize). */
  setResolution(w, h) {
    this.resolution.w = w; this.resolution.h = h;
    this.centerLineMat.uniforms.resolution.value.set(w, h);
    this.edgeLineMat.uniforms.resolution.value.set(w, h);
  }

  /** Ensure the tile under the vehicle is always desired, top-priority and full detail. */
  setVehiclePosition(x, z) {
    this.vehicle = { x, z };
  }

  /** @returns {Array<{id:number,name:string,kind:string,x:number,z:number,importance:number}>} POIs in currently loaded tiles */
  getVisiblePOIs() {
    const out = [];
    const z = this.level;
    const g = z - this.zoomBase;
    for (const poi of this.city.pois) {
      const { x, y } = lonLatStyleIndex(this.city.bounds, poi.x, poi.z, g);
      if (this.chunks.has(`${z}/${x}/${y}`)) {
        out.push({ id: poi.id, name: poi.name, kind: poi.kind, x: poi.x, z: poi.z, importance: POI_IMPORTANCE[poi.kind] || 1 });
      }
    }
    out.sort((a, b) => b.importance - a.importance);
    return out;
  }

  /** @returns {{level:number, loaded:number, building:number, culled:number}} */
  stats() {
    return { level: this.level, loaded: this.chunks.size, building: this.buildQueue.length, culled: this._culled };
  }

  /**
   * Per-frame update: pick zoom from camera height, compute desired tiles from
   * the view frustum, build missing chunks within the time budget, evict LRU.
   * @param {THREE.Camera} camera
   * @param {number} dt seconds
   */
  update(camera, dt) {
    this.time += dt;
    const height = camera.position.y;
    this.level = Math.max(this.minZoom, Math.min(this.maxZoom, pickZoomLevel(height)));
    const z = this.level;

    // frustum of the active camera
    this._mat4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._mat4);

    // candidate tiles: scan an index window around the camera, then keep only
    // tiles whose 3D box intersects the view frustum.
    const g = z - this.zoomBase;
    const n = tileCount(g);
    const camIdx = lonLatStyleIndex(this.city.bounds, camera.position.x, camera.position.z, g);
    const sq = squareBounds(this.city.bounds);
    const tileSize = sq.size / n;
    // generous world radius covering the visible ground, then frustum-filter
    const radius = Math.max(tileSize * 1.5, height * 3);
    const rTiles = Math.min(n, Math.ceil(radius / tileSize) + 1);
    const desired = new Set();
    const box = new THREE.Box3();
    for (let ty = Math.max(0, camIdx.y - rTiles); ty <= Math.min(n - 1, camIdx.y + rTiles); ty++) {
      for (let tx = Math.max(0, camIdx.x - rTiles); tx <= Math.min(n - 1, camIdx.x + rTiles); tx++) {
        const tb = tileBounds(this.city.bounds, g, tx, ty);
        box.min.set(tb.minX, -2, tb.minZ);
        box.max.set(tb.maxX, 220, tb.maxZ);
        if (this._frustum.intersectsBox(box)) desired.add(`${z}/${tx}/${ty}`);
      }
    }
    // vehicle tile: always desired, always full detail at current level
    let vehicleKey = null;
    if (this.vehicle) {
      const vi = lonLatStyleIndex(this.city.bounds, this.vehicle.x, this.vehicle.z, g);
      vehicleKey = `${z}/${vi.x}/${vi.y}`;
      desired.add(vehicleKey);
    }
    this._desired = desired;

    // queue missing chunks, vehicle first, then by distance to camera tile
    this.buildQueue.length = 0;
    for (const key of desired) {
      if (!this.chunks.has(key)) this.buildQueue.push(key);
    }
    const keyDist = (k) => {
      const [zz, tx, ty] = k.split('/').map(Number);
      return (tx - camIdx.x) ** 2 + (ty - camIdx.y) ** 2;
    };
    this.buildQueue.sort((a, b) => (a === vehicleKey ? -1 : b === vehicleKey ? 1 : keyDist(a) - keyDist(b)));

    // incremental, time-boxed building
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    while (this.buildQueue.length && ((typeof performance !== 'undefined' ? performance : Date).now() - t0) < this.budgetMs) {
      const key = this.buildQueue.shift();
      if (this.chunks.has(key)) continue;
      const [zz, tx, ty] = key.split('/').map(Number);
      const group = this._buildChunk(zz, tx, ty);
      this.chunks.set(key, { group, z: zz, lastUsed: this.time });
      this.scene.add(group);
    }

    // touch used chunks; count culled (loaded but not desired)
    let culled = 0;
    for (const [key, chunk] of this.chunks) {
      if (desired.has(key)) { chunk.lastUsed = this.time; chunk.group.visible = true; }
      else { culled++; chunk.group.visible = chunk.z === z ? false : false; }
    }
    this._culled = culled;

    // LRU eviction beyond cap (and hard-drop chunks from other levels past cap/2)
    if (this.chunks.size > this.maxChunks) {
      const victims = [...this.chunks.entries()]
        .filter(([key]) => !desired.has(key))
        .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (const [key, chunk] of victims) {
        if (this.chunks.size <= this.maxChunks) break;
        this._disposeChunk(key, chunk);
      }
    }
    // hard cap: never exceed 2x cap even with all-desired chunks
    if (this.chunks.size > this.maxChunks * 2) {
      const victims = [...this.chunks.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (const [key, chunk] of victims) {
        if (this.chunks.size <= this.maxChunks) break;
        if (!desired.has(key)) this._disposeChunk(key, chunk);
      }
    }
  }

  _disposeChunk(key, chunk) {
    this.scene.remove(chunk.group);
    chunk.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material !== this.centerLineMat && o.material !== this.edgeLineMat) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    this.chunks.delete(key);
  }

  /** Level → content filter. */
  _contentFor(z) {
    const d = z - this.minZoom;
    return {
      classes: d <= 0 ? ['arterial'] : d === 1 ? ['arterial', 'collector'] : ['arterial', 'collector', 'local'],
      districts: d <= 0 ? ['downtown'] : d === 1 ? ['downtown', 'midtown'] : ['downtown', 'midtown', 'suburb'],
      props: d >= 2,
      markings: d >= 2,
    };
  }

  /** Build one tile chunk (group of merged meshes). */
  _buildChunk(z, x, y) {
    const tb = tileBounds(this.city.bounds, z - this.zoomBase, x, y);
    const content = this._contentFor(z);
    const group = new THREE.Group();
    group.name = `tile:${z}/${x}/${y}`;

    // ground plane, subtle per-tile tint
    const size = tb.maxX - tb.minX;
    const groundGeom = new THREE.PlaneGeometry(size, size, 1, 1);
    groundGeom.rotateX(-Math.PI / 2);
    groundGeom.translate((tb.minX + tb.maxX) / 2, 0, (tb.minZ + tb.maxZ) / 2);
    const h = (x * 7 + y * 13 + z * 31) % 8;
    const gCol = new THREE.Color(0x2a2d31).offsetHSL(0, 0, (h - 4) * 0.004);
    const ground = new THREE.Mesh(groundGeom, new THREE.MeshLambertMaterial({ color: gCol }));
    ground.receiveShadow = true;
    group.add(ground);

    // roads: assigned if bbox intersects tile; merged per class
    const byClass = {};
    const centerPolys = [], edgePolys = [];
    for (let i = 0; i < this.city.roads.length; i++) {
      const road = this.city.roads[i];
      if (!content.classes.includes(road.klass)) continue;
      if (!bboxIntersects(this._roadBBox[i], tb)) continue;
      (byClass[road.klass] = byClass[road.klass] || []).push(road);
      if (content.markings) {
        // lifted marking polylines (reuse vectorMesh lift logic inline)
        const pts = road.points;
        const lift = (offset, yy) => pts.map((p, k) => {
          let dx = 0, dz = 0;
          if (k > 0) { dx += p[0] - pts[k - 1][0]; dz += p[1] - pts[k - 1][1]; }
          if (k < pts.length - 1) { dx += pts[k + 1][0] - p[0]; dz += pts[k + 1][1] - p[1]; }
          const L = Math.hypot(dx, dz) || 1;
          return [p[0] + (-dz / L) * offset, yy, p[1] + (dx / L) * offset];
        });
        centerPolys.push(lift(0, 0.09));
        const eo = road.width * 0.5 - 0.4;
        edgePolys.push(lift(eo, 0.08), lift(-eo, 0.08));
      }
    }
    for (const klass of Object.keys(byClass)) {
      const parts = byClass[klass].map((road) => {
        const { positions, indices } = ribbonTriangles(road.points, road.width);
        for (let i = 1; i < positions.length; i += 3) positions[i] = 0.05;
        return { positions, normals: null, indices, color: CLASS_COLORS[klass] };
      });
      const geom = mergeParts(THREE, parts);
      const mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true }));
      mesh.receiveShadow = true;
      mesh.renderOrder = 1;
      group.add(mesh);
    }

    // buildings: assigned by centroid; merged into one vertex-colored mesh
    const bParts = [];
    for (let i = 0; i < this.city.buildings.length; i++) {
      const b = this.city.buildings[i];
      if (!content.districts.includes(b.district)) continue;
      const [cx, cz] = this._buildingCentroid[i];
      if (cx < tb.minX || cx >= tb.maxX || cz < tb.minZ || cz >= tb.maxZ) continue;
      const { positions, normals, indices } = extrudeTriangles(b.footprint, b.height);
      const tint = new THREE.Color(DISTRICT_TINTS[b.district]);
      tint.offsetHSL(0, 0, ((((b.id * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.08);
      bParts.push({ positions, normals, indices, color: tint.getHex() });
    }
    if (bParts.length) {
      const geom = mergeParts(THREE, bParts);
      const mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true }));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // props (deep zoom only)
    if (content.props) {
      const inTile = (p) => p.x >= tb.minX && p.x < tb.maxX && p.z >= tb.minZ && p.z < tb.maxZ;
      const lights = this.city.streetlights.filter(inTile);
      const signals = this.city.signals.filter(inTile);
      // lazy import avoidance: reuse a tiny local instanced builder
      if (lights.length) group.add(this._propInstanced(lights, 'streetlight'));
      if (signals.length) group.add(this._propInstanced(signals, 'signal'));
    }

    // road markings via screen-space line shader
    if (content.markings && centerPolys.length) {
      const cg = buildLineStripGeometry(THREE, centerPolys);
      const cm = new THREE.Mesh(cg, this.centerLineMat);
      cm.renderOrder = 2; cm.frustumCulled = true;
      group.add(cm);
      const eg = buildLineStripGeometry(THREE, edgePolys);
      const em = new THREE.Mesh(eg, this.edgeLineMat);
      em.renderOrder = 2;
      group.add(em);
    }

    return group;
  }

  /** Small local instanced-prop builder (pole + head), kept here to avoid per-chunk vectorMesh imports of materials. */
  _propInstanced(props, kind) {
    const poleH = kind === 'streetlight' ? 8 : 5.5;
    const parts = [];
    const addBox = (w, hgt, d, cx, cy, cz, arr) => {
      const g = new THREE.BoxGeometry(w, hgt, d);
      g.translate(cx, cy, cz);
      arr.push(g);
    };
    addBox(0.2, poleH, 0.2, 0, poleH / 2, 0, parts);
    if (kind === 'streetlight') addBox(1.4, 0.22, 0.4, 0.6, poleH - 0.1, 0, parts);
    else addBox(0.5, 1.4, 0.35, 0, poleH + 0.7, 0, parts);
    const geom = mergeParts(THREE, parts.map(g => ({
      positions: Array.from(g.getAttribute('position').array),
      normals: Array.from(g.getAttribute('normal').array),
      indices: Array.from(g.getIndex().array),
    })));
    parts.forEach(g => g.dispose());
    const mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ color: kind === 'streetlight' ? 0x2c2f33 : 0x222428 }), props.length);
    const m = new THREE.Matrix4();
    for (let i = 0; i < props.length; i++) {
      m.makeTranslation(props[i].x, 0, props[i].z);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
}
