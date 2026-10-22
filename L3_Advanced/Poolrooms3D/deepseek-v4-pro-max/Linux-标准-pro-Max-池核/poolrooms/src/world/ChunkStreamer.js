// ChunkStreamer: keeps a ring of generated chunks resident around the player and answers
// collision / water queries against them. Generation + geometry build is amortised over frames so
// walking never hitches.

import * as THREE from 'three';
import { CHUNK, generateChunk, worldToChunk, chunkKey } from './WorldGen.js';
import { buildChunkGeometry } from './GeometryBuilder.js';

export { CHUNK };

export class ChunkStreamer {
  constructor({ scene, lib, water, seed = 1337, radius = 2, budgetMs = 6 }) {
    this.scene = scene;
    this.lib = lib;
    this.water = water;
    this.seed = seed;
    this.radius = radius;
    this.budgetMs = budgetMs;

    this.chunks = new Map(); // key -> { cx, cz, group, colliders, waters, lights, chunk }
    this.queue = [];
    this.center = [Infinity, Infinity];
    this.group = new THREE.Group();
    this.group.name = 'world';
    this.group.matrixAutoUpdate = false;
    scene.add(this.group);

    this.stats = { chunks: 0, boxes: 0, tris: 0, pending: 0 };
  }

  /** Immediately build everything inside the radius (used once at boot). */
  primeAround(x, z) {
    this._refresh(x, z);
    while (this.queue.length) this._buildOne();
  }

  update(x, z) {
    const [cx, cz] = worldToChunk(x, z);
    if (cx !== this.center[0] || cz !== this.center[1]) this._refresh(x, z);

    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < this.budgetMs) this._buildOne();
    this.stats.pending = this.queue.length;
  }

  _refresh(x, z) {
    const [cx, cz] = worldToChunk(x, z);
    this.center = [cx, cz];
    const r = this.radius;

    const wanted = new Set();
    const want = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const k = chunkKey(cx + dx, cz + dz);
        wanted.add(k);
        if (!this.chunks.has(k)) want.push({ cx: cx + dx, cz: cz + dz, d: dx * dx + dz * dz, key: k });
      }
    }
    want.sort((a, b) => a.d - b.d);
    const queued = new Set(this.queue.map((q) => q.key));
    for (const w of want) if (!queued.has(w.key)) this.queue.push(w);
    this.queue = this.queue.filter((q) => wanted.has(q.key));

    // Evict chunks that left the ring (radius + 1 hysteresis).
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - cx) > r + 1 || Math.abs(c.cz - cz) > r + 1) this._dispose(k, c);
    }
  }

  _buildOne() {
    const job = this.queue.shift();
    if (!job) return;
    if (this.chunks.has(job.key)) return;

    const chunk = generateChunk(job.cx, job.cz, this.seed);
    const built = buildChunkGeometry(chunk, this.lib);

    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.name = 'chunk_' + job.key;
    let tris = 0;
    for (const m of built.meshes) {
      group.add(m);
      tris += m.geometry.index ? m.geometry.index.count / 3 : 0;
    }
    this.group.add(group);

    // Lights are kept as data only. A fixed-size pool in LightPool.js binds the nearest few to real
    // THREE.PointLights, so the forward pass never evaluates more than a handful per fragment.
    const lights = built.lights || [];

    const record = {
      cx: job.cx,
      cz: job.cz,
      key: job.key,
      chunk,
      group,
      colliders: built.colliders,
      waters: built.waters,
      lights,
      tris,
    };
    this.chunks.set(job.key, record);
    if (this.water) this.water.addChunk(job.key, built.waters);

    this.stats.chunks = this.chunks.size;
    this.stats.boxes += chunk.boxes.length;
    this.stats.tris += tris;
  }

  _dispose(key, c) {
    this.group.remove(c.group);
    c.group.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    this.chunks.delete(key);
    if (this.water) this.water.removeChunk(key);
    this.stats.chunks = this.chunks.size;
    this.stats.tris -= c.tris;
  }

  /** Chunk records covering the 3x3 neighbourhood of a world position. */
  *near(x, z, ring = 1) {
    const [cx, cz] = worldToChunk(x, z);
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        const c = this.chunks.get(chunkKey(cx + dx, cz + dz));
        if (c) yield c;
      }
    }
  }

  /** Deepest water volume containing (x, z) at height y (or the one directly above y). */
  waterAt(x, z, y = -Infinity) {
    let best = null;
    for (const c of this.near(x, z, 1)) {
      for (const w of c.waters) {
        if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) continue;
        if (y > w.surface + 0.001) continue;
        if (!best || w.surface > best.surface) best = w;
      }
    }
    return best;
  }

  /** Any water rect containing (x,z), ignoring height — for the camera submersion test. */
  waterColumnAt(x, z) {
    let best = null;
    for (const c of this.near(x, z, 1)) {
      for (const w of c.waters) {
        if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) continue;
        if (!best || w.surface > best.surface) best = w;
      }
    }
    return best;
  }

  /** Highest solid surface under (x, z) below yMax — used for spawning. */
  groundHeight(x, z, yMax = 40) {
    let best = -Infinity;
    for (const c of this.near(x, z, 1)) {
      const a = c.colliders;
      for (let i = 0; i < a.length; i += 6) {
        if (x < a[i] - 0.15 || x > a[i + 3] + 0.15 || z < a[i + 2] - 0.15 || z > a[i + 5] + 0.15) continue;
        const top = a[i + 4];
        if (top <= yMax && top > best) best = top;
      }
    }
    return best === -Infinity ? 0 : best;
  }

  /** Swap all resident meshes onto their G-buffer (prepass) or forward materials. */
  setMaterialMode(mode) {
    for (const c of this.chunks.values()) {
      for (const m of c.group.children) {
        if (!m.isMesh) continue;
        m.material = mode === 'gbuf' ? m.userData.gbuf : m.userData.std;
      }
    }
  }
}
