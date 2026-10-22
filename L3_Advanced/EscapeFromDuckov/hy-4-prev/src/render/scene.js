// 把 World 数据烘成 three 场景：地面 / 道路 / 室内地板 / 墙体 / 道具 / 容器。
// 全部走 InstancedMesh（每类一个 draw call）+ 描边孪生体。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, gu } from '../gfx/materials/toon.js';
import { procTexture } from '../gfx/textures/proc.js';
import { propGeometries } from '../gfx/geo/props.js';
import { InstancePool, StaticPool } from './instancing.js';
import { LAYER_WORLD } from './camera.js';
import { TILE } from '../systems/world.js';
import { RENDER } from '../data/balance.js';

export class SceneView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.pools = {};
    this.disposables = [];
    this.build();
  }

  _toon(opts, flags) {
    const m = toon(opts, flags);
    this.disposables.push(m);
    return m;
  }

  build() {
    const w = this.world;
    const G = propGeometries();

    // ---- 地面：一整块 plane + 程序化贴图平铺 ----
    const groundName = w.def.ground;
    const tex = procTexture(groundName).clone();
    tex.needsUpdate = true;
    tex.repeat.set(w.w / 4, w.h / 4);
    const groundMat = this._toon({ map: tex });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(w.minX + w.w / 2, 0, w.minZ + w.h / 2);
    ground.receiveShadow = true;
    ground.layers.set(LAYER_WORLD);
    ground.name = 'ground';
    this.scene.add(ground);
    this.disposables.push(ground.geometry, tex);

    // ---- 道路 / 室内地板：合并成一块几何体 ----
    const roadQuads = [], floorQuads = [];
    for (let tz = 0; tz < w.h; tz++) {
      for (let tx = 0; tx < w.w; tx++) {
        const g = w.ground[tz * w.w + tx];
        if (!g) continue;
        const q = new THREE.PlaneGeometry(1, 1);
        q.rotateX(-Math.PI / 2);
        q.translate(w.minX + tx + 0.5, g === 2 ? 0.02 : 0.012, w.minZ + tz + 0.5);
        (g === 2 ? floorQuads : roadQuads).push(q);
      }
    }
    const addPatch = (quads, texName, y) => {
      if (!quads.length) return;
      const geo = mergeGeometries(quads, false);
      const t = procTexture(texName).clone();
      t.needsUpdate = true; t.repeat.set(0.5, 0.5);
      const mat = this._toon({ map: t });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = y;
      mesh.receiveShadow = true;
      mesh.layers.set(LAYER_WORLD);
      this.scene.add(mesh);
      this.disposables.push(geo, t);
      for (const q of quads) q.dispose();
    };
    addPatch(roadQuads, w.def.road === 'tile' ? 'tile' : w.def.road, 0);
    addPatch(floorQuads, w.def.theme === 'lab' ? 'tile' : 'wood', 0);

    // ---- 墙体：每个实心格一个实例（正交俯视下 2.6 高墙只遮挡 1.7 格，室内依然可见）----
    const wallGeo = G.box.clone();
    const wallTex = procTexture('concrete').clone();
    wallTex.needsUpdate = true;
    const wallMat = this._toon({ vertexColors: true, map: wallTex }, { fow: true });
    const walls = new StaticPool(wallGeo, wallMat, 4096, {
      outline: true, castShadow: true, receiveShadow: true,
    }).addTo(this.scene);
    for (let tz = 0; tz < w.h; tz++) {
      for (let tx = 0; tx < w.w; tx++) {
        const t = w.tiles[tz * w.w + tx];
        if (t !== TILE.SOLID) continue;
        const h = this.wallHeightAt(tx, tz);
        walls.push(w.minX + tx + 0.5, h / 2, w.minZ + tz + 0.5, 0, 1, h, 1, { fow: 0 });
      }
    }
    walls.commit();
    this.pools.walls = walls;

    // ---- 矮掩体（挡人不挡视线）----
    const lowMat = this._toon({ vertexColors: true }, { fow: true });
    const lows = new StaticPool(G.box.clone(), lowMat, 1024, { outline: true, castShadow: true, receiveShadow: true }).addTo(this.scene);
    for (let tz = 0; tz < w.h; tz++) {
      for (let tx = 0; tx < w.w; tx++) {
        if (w.tiles[tz * w.w + tx] !== TILE.LOW) continue;
        lows.push(w.minX + tx + 0.5, 0.42, w.minZ + tz + 0.5, 0, 0.98, 0.84, 0.98, { fow: 0 });
      }
    }
    lows.commit();
    this.pools.lows = lows;

    // ---- 道具：按 kind 分组，各自一个池。动态重建 → 盲区里的东西整个消失（不是变暗而已）----
    const swayMat = this._toon({ vertexColors: true }, { fow: true, sway: true });
    const staticMat = this._toon({ vertexColors: true }, { fow: true });
    const byKind = new Map();
    for (const p of w.props) {
      if (!byKind.has(p.kind)) byKind.set(p.kind, []);
      byKind.get(p.kind).push(p);
    }
    this.dynamic = [];
    for (const [kind, list] of byKind) {
      const geo = G[kind];
      if (!geo) continue;
      const isPlant = kind === 'tree';
      const mat = isPlant ? swayMat : staticMat;
      const pool = new StaticPool(geo.clone(), mat, Math.max(8, list.length), {
        outline: true, castShadow: true, receiveShadow: kind !== 'fence',
        sway: isPlant, fow: true,
      }).addTo(this.scene);
      this.pools['prop_' + kind] = pool;
      this.dynamic.push({ pool, list, height: isPlant ? 1.2 : 0.8 });
    }

    // ---- 容器：可搜刮 ----
    const contMat = this._toon({ vertexColors: true }, { fow: true, flash: true });
    const cont = new StaticPool(G.crate.clone(), contMat, Math.max(16, w.containers.length), {
      outline: true, castShadow: true, receiveShadow: true,
    }).addTo(this.scene);
    this.pools.containers = cont;
    this.dynamic.push({ pool: cont, list: w.containers, height: 0.8, scale: 0.85, flat: 0.7 });

    // ---- 撤离点：地面光圈 ----
    const ringGeo = new THREE.RingGeometry(1.6, 2.6, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4ad68a, transparent: true, opacity: 0.5, depthWrite: false });
    this.exitRings = w.exitPoints.map((e) => {
      const m = new THREE.Mesh(ringGeo, ringMat);
      m.position.set(e.x, 0.05, e.z);
      m.layers.set(LAYER_WORLD);
      m.renderOrder = 3;
      this.scene.add(m);
      return { e, mesh: m };
    });
    this.disposables.push(ringGeo, ringMat);
  }

  /** 判断某墙格属于哪栋建筑，取对应层高；不属于任何建筑则按默认矮墙 */
  wallHeightAt(tx, tz) {
    const w = this.world;
    for (const b of w.buildings) {
      if (tx >= b.tx - 1 && tx <= b.tx + b.w && tz >= b.tz - 1 && tz <= b.tz + b.d) return b.def.height;
    }
    return 2.2;
  }

  update(dt, time) {
    const pulse = 0.34 + Math.sin(time * 2.2) * 0.16;
    for (const r of this.exitRings || []) r.mesh.material.opacity = pulse;
  }

  /**
   * 按可见多边形重建动态实例：盲区内的道具/容器直接不进实例列表。
   * 这就是文档 §3.1 要求的"对盲区内的模型进行可见性剔除（防作弊式）"。
   */
  updateDynamic(vision) {
    this.drawnDynamic = 0;
    for (const d of this.dynamic) {
      const { pool, list } = d;
      pool.begin();
      for (const it of list) {
        if (vision && !this._visible(vision, it)) continue;
        const s = (it.s ?? 1) * (d.scale ?? 1);
        pool.push(it.x, 0, it.z, it.ry ?? 0, s, (d.flat ?? 1) * s, s, { fow: 0, flash: 0 });
        this.drawnDynamic++;
      }
      pool.commit();
    }
  }

  _visible(vision, it) {
    // 物体的"眼睛高度"：躲在矮墙后的箱子顶部仍是可见的
    return vision.inPolygon(it.x, it.z);
  }

  dispose() {
    for (const k in this.pools) this.pools[k].dispose();
    for (const d of this.disposables) d.dispose?.();
  }
}
