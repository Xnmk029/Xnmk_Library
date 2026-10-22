/**
 * core/ChunkManager.js — 分块流式加载 / 卸载 / LOD / 视锥剔除
 * ===========================================================================
 * 职责：把 ChunkBuilder 产出的纯数据变成 GPU 资源，并在相机移动时维护"无限世界"。
 *
 * ▍实例化策略（本文件最关键的设计）
 *   1. **几何体全局共享**：所有 chunk 的结构盒共用同一个单位立方体几何（24 顶点），
 *      道具共用元素库里的几何。每个 chunk 只额外持有一份 instanceMatrix 缓冲。
 *      → 上千平方米的瓷砖世界，几何显存占用几乎为零。
 *   2. **不用逐实例属性**：颜色/湿滑/脏化全部由 shader 从**世界坐标 + 世界法线**推导
 *      （见 Materials.js 的三平面映射）。这样才能共享几何体，也顺带消掉了顶点带宽。
 *   3. **逐 InstancedMesh 的 boundingSphere**：three r158+ 的 Frustum 支持
 *      `object.boundingSphere`（优先于 geometry.boundingSphere）。我们按 chunk 的
 *      真实 AABB 手动写入 → 共享几何体也能被引擎正确视锥剔除（相机与阴影两条通道都生效）。
 *   4. **chunk 级粗剔除**：再叠一层"整块可见性"判断（一次 Box3 测试代替上百次），
 *      不可见的 chunk 直接 group.visible = false，连遍历都省掉。
 *      阴影用膨胀后的视锥测试，避免视野外的投影物被误剔。
 *
 * ▍流式调度
 *   - 目标集合 = 相机所在 chunk 的 viewChunks 半径内（正方形，按真实距离排序）。
 *   - 生成走 ChunkBuilder 的**生成器**，每帧只花 PERF.chunkBudgetMs 毫秒，
 *     且每帧最多完成 maxChunkUploadsPerFrame 个 chunk（限制 GPU 上传尖峰）。
 *   - 卸载有 1 chunk 的滞后（hysteresis），避免站在边界来回抖动导致反复生成。
 *   - LOD 档变化只重建受影响的 chunk，先建后换（无空洞）。
 */

import * as THREE from 'three';
import { WORLD, PERF } from '../config.js';
import { ChunkBuilder, CHUNK_LOD } from '../gen/ChunkBuilder.js';

/** 渲染层：2 号层专供体积光遮挡图（天窗发光面） */
export const LAYER = Object.freeze({ DEFAULT: 0, LIGHT_MASK: 2 });

/** 道具 → 材质槽位 */
const PROP_MATERIAL = {
  columnSquare: 'tile', columnRound: 'tile', columnCluster: 'tile',
  archUnderwater: 'tile', balconyPlate: 'tile', oddMonolith: 'tile',
  oddTorus: 'gloss', oddSphere: 'gloss',
  railing: 'metal', divingBoard: 'metal', poolLadder: 'metal',
  windowFrameRect: 'metal', windowFrameArch: 'metal', windowFrameRound: 'metal',
  skylightFrame: 'metal',
  vistaPanel: 'vista',
  skylightPane: 'light',
};

export class ChunkManager {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {import('../gen/Field.js').Field} opts.field
   * @param {Map<string, THREE.BufferGeometry[]>} opts.elements
   * @param {Record<string, THREE.Material>} opts.materials  {tile, metal, gloss, vista, light, water}
   */
  constructor({ scene, field, elements, materials, quality }) {
    this.scene = scene;
    this.field = field;
    this.elements = elements;
    this.materials = materials;
    this.quality = quality;
    this.builder = new ChunkBuilder(field);

    /** 结构/道具挂在这里（按 chunk 分组，便于整块剔除） */
    this.root = new THREE.Group();
    this.root.name = 'chunks';
    this.root.matrixAutoUpdate = false;
    scene.add(this.root);

    /** 水面单独成组：折射/反射通道需要一键隐藏全部水面 */
    this.waterGroup = new THREE.Group();
    this.waterGroup.name = 'water';
    this.waterGroup.matrixAutoUpdate = false;
    scene.add(this.waterGroup);

    /** 水面单位平面（1×1，法线朝 +Y）；实例矩阵负责铺开 */
    this.waterGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.waterGeometry.rotateX(-Math.PI / 2);
    this.waterGeometry.computeBoundingSphere();

    /** @type {Map<string, ChunkRecord>} */
    this.chunks = new Map();
    /** @type {Map<string, {gen: Generator, ci: number, cj: number, lod: number}>} */
    this.pending = new Map();

    this._frustum = new THREE.Frustum();
    this._projScreen = new THREE.Matrix4();
    this._box = new THREE.Box3();
    this._sphere = new THREE.Sphere();
    this._vec = new THREE.Vector3();
    this._desired = [];

    this.stats = {
      loaded: 0, pending: 0, visible: 0, instances: 0, meshes: 0,
      builtTotal: 0, disposedTotal: 0, lastBuildMs: 0, budgetUsedMs: 0,
    };
  }

  setQuality(q) { this.quality = q; }

  /** 相机所在 chunk 坐标 */
  chunkOf(x, z) {
    return [Math.floor(x / WORLD.chunkSize), Math.floor(z / WORLD.chunkSize)];
  }

  /** 期望的 chunk LOD 档（按 chunk 距离） */
  _lodFor(dist) {
    const q = this.quality;
    if (dist <= q.fullDetailChunks) return CHUNK_LOD.FULL;
    if (dist <= Math.max(q.fullDetailChunks + 1, q.viewChunks - 1)) return CHUNK_LOD.MID;
    return CHUNK_LOD.FAR;
  }

  /**
   * 每帧调用。
   * @param {THREE.Camera} camera
   * @param {number} budgetMs 本帧允许用于生成的时间
   */
  update(camera, budgetMs = PERF.chunkBudgetMs) {
    const t0 = performance.now();
    const q = this.quality;
    const [ccx, ccz] = this.chunkOf(camera.position.x, camera.position.z);
    const R = q.viewChunks;

    // ── 1) 目标集合（按距离 + 是否在相机前方排序）───────────────────
    const desired = this._desired;
    desired.length = 0;
    const fwd = camera.getWorldDirection(this._vec).clone();
    for (let dj = -R; dj <= R; dj++) {
      for (let di = -R; di <= R; di++) {
        const dist = Math.max(Math.abs(di), Math.abs(dj));
        if (dist > R) continue;
        const ci = ccx + di, cj = ccz + dj;
        // 前方优先：把方向点积作为负权重，转身时也能优先补上视线内的块
        const dot = (di * fwd.x + dj * fwd.z) / (Math.hypot(di, dj) || 1);
        desired.push({ ci, cj, dist, lod: this._lodFor(dist), score: dist * 2 - dot * 1.5 });
      }
    }
    desired.sort((a, b) => a.score - b.score);

    // ── 2) 卸载（滞后 1 chunk）──────────────────────────────────────
    for (const [key, rec] of this.chunks) {
      const d = Math.max(Math.abs(rec.ci - ccx), Math.abs(rec.cj - ccz));
      if (d > R + 1) this._disposeChunk(key);
    }
    for (const [key, p] of this.pending) {
      const d = Math.max(Math.abs(p.ci - ccx), Math.abs(p.cj - ccz));
      if (d > R + 1) this.pending.delete(key);
    }

    // ── 3) 入队（缺失的 / LOD 档变了的）─────────────────────────────
    for (const want of desired) {
      const key = `${want.ci},${want.cj}`;
      const rec = this.chunks.get(key);
      if (rec && rec.lod === want.lod) continue;
      if (this.pending.has(key)) continue;
      if (this.pending.size >= 6) break;               // 队列上限，避免瞬移时爆量
      this.pending.set(key, {
        gen: this.builder.build(want.ci, want.cj, want.lod),
        ci: want.ci, cj: want.cj, lod: want.lod,
      });
    }

    // ── 4) 在预算内推进生成器 ───────────────────────────────────────
    let uploads = 0;
    const deadline = t0 + budgetMs;
    for (const [key, p] of this.pending) {
      if (performance.now() > deadline || uploads >= PERF.maxChunkUploadsPerFrame) break;
      let done = false, data = null;
      while (performance.now() <= deadline) {
        const step = p.gen.next();
        if (step.done) { done = true; data = step.value; break; }
      }
      if (done && data) {
        const tb = performance.now();
        this._createChunk(data);
        this.stats.lastBuildMs = performance.now() - tb;
        this.pending.delete(key);
        uploads++;
      }
    }

    // ── 5) chunk 级视锥剔除 ─────────────────────────────────────────
    this._projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._projScreen);
    let visible = 0, instances = 0, meshes = 0;
    for (const rec of this.chunks.values()) {
      const vis = this._frustum.intersectsBox(rec.box);
      rec.group.visible = vis;
      if (rec.waterMesh) rec.waterMesh.visible = vis;
      if (vis) { visible++; instances += rec.instances; meshes += rec.group.children.length + (rec.waterMesh ? 1 : 0); }
    }

    this.stats.loaded = this.chunks.size;
    this.stats.pending = this.pending.size;
    this.stats.visible = visible;
    this.stats.instances = instances;
    this.stats.meshes = meshes;
    this.stats.budgetUsedMs = performance.now() - t0;
    return this.stats;
  }

  /** 把 ChunkData 变成 InstancedMesh */
  _createChunk(data) {
    const old = this.chunks.get(data.key);
    const group = new THREE.Group();
    group.name = `chunk_${data.key}`;
    group.matrixAutoUpdate = false;

    const [minX, minY, minZ, maxX, maxY, maxZ] = data.bounds;
    const box = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const castShadow = data.lodTier <= CHUNK_LOD.MID && this.quality.shadows;

    const makeInstanced = (geometry, material, matrices, count, opts = {}) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.instanceMatrix = new THREE.InstancedBufferAttribute(matrices, 16);
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.count = count;
      mesh.frustumCulled = true;
      // 共享几何体 + 逐 mesh 包围球 → 引擎自带的视锥/阴影剔除依然精确
      mesh.boundingSphere = sphere.clone();
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = opts.castShadow ?? castShadow;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      if (opts.layer !== undefined) mesh.layers.enable(opts.layer);
      return mesh;
    };

    // 结构（地板/池壁/墙/天花）：整块地形一次 draw call
    if (data.structure.count > 0) {
      const slab = this.elements.get('slab')[0];
      group.add(makeInstanced(slab, this.materials.tile, data.structure.matrices, data.structure.count));
    }

    // 道具
    for (const [kind, g] of Object.entries(data.props)) {
      const geoms = this.elements.get(kind);
      if (!geoms) continue;
      const lodIndex = Math.min(geoms.length - 1, Math.max(0, data.lodTier + (this.quality.propLodBias | 0)));
      const slot = PROP_MATERIAL[kind] || 'tile';
      const mat = this.materials[slot] || this.materials.tile;
      const isLight = slot === 'light';
      const mesh = makeInstanced(geoms[lodIndex], mat, g.matrices, g.count, {
        castShadow: isLight ? false : castShadow,
        receiveShadow: !isLight,
        layer: isLight ? LAYER.LIGHT_MASK : undefined,
      });
      mesh.name = kind;
      group.add(mesh);
    }

    // 水面（单独挂 waterGroup，方便折射/反射通道整组隐藏）
    let waterMesh = null;
    if (data.water.count > 0) {
      waterMesh = makeInstanced(this.waterGeometry, this.materials.water, data.water.matrices, data.water.count, {
        castShadow: false, receiveShadow: false,
      });
      waterMesh.name = `water_${data.key}`;
      waterMesh.renderOrder = 2;
      this.waterGroup.add(waterMesh);
    }

    this.root.add(group);
    this.chunks.set(data.key, {
      key: data.key, ci: data.ci, cj: data.cj, lod: data.lodTier,
      group, waterMesh, box, sphere,
      instances: data.stats.instances,
      stats: data.stats,
    });
    this.stats.builtTotal++;
    // 先建后换：新块就绪后再销毁旧档，避免出现空洞
    if (old) this._destroyRecord(old);
  }

  _disposeChunk(key) {
    const rec = this.chunks.get(key);
    if (!rec) return;
    this.chunks.delete(key);
    this._destroyRecord(rec);
    this.stats.disposedTotal++;
  }

  /** 释放：只销毁逐 chunk 的 instanceMatrix（几何体/材质是共享的，绝不能 dispose） */
  _destroyRecord(rec) {
    for (const child of rec.group.children) {
      if (child.isInstancedMesh) child.dispose();
    }
    rec.group.clear();
    this.root.remove(rec.group);
    if (rec.waterMesh) {
      rec.waterMesh.dispose();
      this.waterGroup.remove(rec.waterMesh);
    }
  }

  /** 折射/反射通道用：隐藏/恢复全部水面 */
  setWaterVisible(v) { this.waterGroup.visible = v; }

  /** 当前已加载 chunk 的聚合统计（HUD 用） */
  aggregate() {
    let waterCells = 0, deepest = 0, structure = 0, props = 0;
    for (const rec of this.chunks.values()) {
      waterCells += rec.stats.waterCells;
      deepest = Math.max(deepest, rec.stats.deepest);
      structure += rec.stats.structure;
      props += rec.stats.props;
    }
    return { waterCells, deepest, structure, props };
  }

  dispose() {
    for (const key of [...this.chunks.keys()]) this._disposeChunk(key);
    this.pending.clear();
    this.waterGeometry.dispose();
    this.scene.remove(this.root);
    this.scene.remove(this.waterGroup);
  }
}

export default ChunkManager;
