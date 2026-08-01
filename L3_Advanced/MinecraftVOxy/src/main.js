// VOXY CRAFT — 入口 / 主循环
// M7：Worker 异步生成 + 流式加载 + 优先级队列。静态截图模式（focusWorld）保留供测试。
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { World, chunkKey } from './world/world.js';
import { createGenerator, BIOME, BIOME_NAMES, findSpawn } from './world/generator.js';
import { treeTypeAt } from './world/trees.js';
import { Chunk, S } from './world/chunk.js';
import { buildChunkGeometries, geometriesFromMeshData } from './mesh/mesher.js';
import { createVoxelMaterial } from './render/materials.js';
import { createWaterMaterial } from './render/water.js';
import { Sky } from './render/sky.js';
import { buildAtlas } from './data/textures.js';
import { Controls } from './player/controls.js';
import { Player } from './player/player.js';
import { Inventory } from './ui/inventory.js';
import { Settings } from './ui/settings.js';
import { itemIcon } from './ui/icons.js';
import { ITEMS, blockByName } from './data/registry.js';
import { WorkerPool } from './util/pool.js';
import { Streamer } from './world/streamer.js';
import { lodLevels } from './world/lod.js';

class Game {
  constructor() {
    this.container = document.getElementById('app');
    this.clock = new THREE.Clock();
    this.frames = 0; this.fpsAccum = 0; this.fps = 0; this.frameMs = 0;
    this.chunkMap = new Map();
    this.streaming = false;
    this.playerActive = false;
    this.longFrames = 0;   // 性能自检：>16ms 帧计数
  }

  async init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.RENDER.pixelRatioCap));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.timeOfDay = 0.32;      // 清晨
    this.dayAuto = false;       // 自动昼夜循环（设置面板可开）
    this.elapsed = 0;
    this.scene.fog = new THREE.Fog(0xbcd6ee, 80, 230);

    this.camera = new THREE.PerspectiveCamera(CONFIG.RENDER.fov, innerWidth / innerHeight, CONFIG.RENDER.near, CONFIG.RENDER.far);

    this.world = new World(CONFIG.SEED);
    this.genFn = createGenerator(CONFIG.SEED);
    this.world.setGenerator(this.genFn);
    this.terrain = this.genFn.terrain;

    this.atlas = await buildAtlas();
    this.voxelMat = createVoxelMaterial(this.atlas);
    this.waterMat = createWaterMaterial();
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    // ---- Worker 池 + 流式管理 ----
    const poolSize = CONFIG.WORKER_POOL || Math.min(navigator.hardwareConcurrency || 4, 8);
    this.pool = new WorkerPool('./src/workers/gen.worker.js', poolSize, (d) => this._onWorkerResult(d));
    this.streamer = new Streamer(this.pool, {
      radius: 5, vRadius: 2, seed: CONFIG.SEED,
      surfaceCyAt: (cx, cz) => Math.floor(this.terrain.heightAt(cx * S + 8, cz * S + 8) / S),
      install: (cx, cy, cz, data) => this._installStreamed(cx, cy, cz, data),
      uninstall: (key, e) => {
        this._disposeEntry(e);
        this.chunkMap.delete(key);
        const p = key.split(',');
        this.world.removeChunk(+p[0], +p[1], +p[2]);
      },
    });

    // ---- 远景 LOD ----
    this.viewDist = CONFIG.VIEW.default;
    this.lodMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.lodMeshes = new Map();   // level -> Mesh
    this.lodCenter = null;
    this.lodGroup = new THREE.Group();
    this.scene.add(this.lodGroup);
    this._applyFog();

    // ---- 玩家 ----
    this.controls = new Controls(this.renderer.domElement);
    this.player = new Player(this.world, this.camera, this.controls);
    this.player.onEdit = (x, y, z) => this._onEdit(x, y, z);
    this.controls.onBreak = () => this.player.breakTarget();
    this.controls.onPlace = () => this.player.placeTarget();
    this.scene.add(this.player.highlight);
    document.addEventListener('pointerlockchange', () => {
      if (this.controls.locked) this._enterPlayerMode();
      this.playerActive = this.controls.locked;
    });

    // ---- UI ----
    this.inventory = new Inventory(this);
    this.settings = new Settings(this);
    this.hotbar = new Array(9).fill(null);
    this.selectedSlot = 0;
    const starters = ['草方块', '石头', '杉木板', '玻璃', '砖块', '沙子', '雪块', '樱花叶', '萤石'];
    starters.forEach((n, i) => {
      const b = blockByName(n);
      if (b) this.hotbar[i] = ITEMS.find((it) => it.blockId === b.id) || null;
    });
    this.player.selectedBlock = this.hotbar[0] ? this.hotbar[0].blockId : 1;
    this._buildHotbar();
    this._bindUIKeys();

    addEventListener('resize', () => this._onResize());
    const boot = document.getElementById('boot');
    if (boot) boot.classList.add('hide');

    // 出生点：平坦草地 + 附近有高山（出生即见立体远景）
    this.spawnPoint = findSpawn(this.terrain);
    this.focusWorld(this.spawnPoint.x, this.spawnPoint.z, 5);
    const sp = this.spawnPoint;
    const sh = this.terrain.heightAt(sp.x, sp.z);
    this.camera.position.set(sp.x + 0.5, sh + 18, sp.z + 0.5);
    this.camera.lookAt(sp.peakX, this.terrain.heightAt(sp.peakX, sp.peakZ) * 0.75 + sh * 0.25, sp.peakZ);

    this.renderer.setAnimationLoop(() => this._loop());
    console.info(`[VOXY] M7 流式加载就绪 · workers=${poolSize} · three r${THREE.REVISION}`);
  }

  _enterPlayerMode() {
    if (!this.streaming) this.startStreaming();
    const f = this.focus || { wx: 0, wz: 0 };
    this.player.spawnAt(f.wx, f.wz);
  }

  // ---- UI ----
  _buildHotbar() {
    const bar = document.getElementById('hotbar');
    bar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = `<span class="num">${i + 1}</span>`;
      bar.appendChild(slot);
    }
    this.updateHotbar();
  }

  updateHotbar() {
    const slots = document.getElementById('hotbar').children;
    for (let i = 0; i < 9; i++) {
      const slot = slots[i];
      slot.classList.toggle('sel', i === this.selectedSlot);
      const old = slot.querySelector('img');
      if (old) old.remove();
      const it = this.hotbar[i];
      if (it) {
        const img = document.createElement('img');
        img.src = itemIcon(it);
        slot.appendChild(img);
      }
    }
  }

  selectItem(item) {
    this.hotbar[this.selectedSlot] = item;
    this.player.selectedBlock = item.blockId != null ? item.blockId : 0;
    this.updateHotbar();
  }

  _bindUIKeys() {
    document.addEventListener('keydown', (e) => {
      const modalOpen = this.inventory.isOpen || this.settings.isOpen;
      if (e.code === 'KeyE') {
        if (this.controls.locked) document.exitPointerLock();
        this.settings.close();
        this.inventory.toggle();
        e.preventDefault();
        return;
      }
      if (e.code === 'Escape') {
        if (this.inventory.isOpen) { this.inventory.close(); return; }
        if (!this.controls.locked) this.settings.toggle();
        return;
      }
      if (e.code === 'F3') {
        document.getElementById('debug').classList.toggle('open');
        e.preventDefault();
        return;
      }
      if (modalOpen) return;
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) { this.selectedSlot = n - 1; this._syncHeld(); this.updateHotbar(); }
      }
    });
    this.renderer.domElement.addEventListener('wheel', (e) => {
      if (this.inventory.isOpen || this.settings.isOpen) return;
      this.selectedSlot = (this.selectedSlot + (e.deltaY > 0 ? 1 : 8)) % 9;
      this._syncHeld();
      this.updateHotbar();
    });
  }

  _syncHeld() {
    const it = this.hotbar[this.selectedSlot];
    this.player.selectedBlock = it && it.blockId != null ? it.blockId : 0;
  }

  startStreaming() {
    this.clearWorld();
    this.streaming = true;
    this.streamer.lastPC = null;
    this.streamer.setOverrides(this.world.overrides);
  }

  stopStreaming() { this.streaming = false; }

  // ---- 区块 Mesh 管理 ----
  _disposeEntry(e) {
    if (!e) return;
    for (const m of e.faceMeshes) if (m) { this.worldGroup.remove(m); m.geometry.dispose(); }
    if (e.waterMesh) { this.worldGroup.remove(e.waterMesh); e.waterMesh.geometry.dispose(); }
  }

  _addChunkEntry(cx, cy, cz, geoms) {
    const key = chunkKey(cx, cy, cz);
    const old = this.chunkMap.get(key);
    if (old) this._disposeEntry(old);
    const ox = cx * S, oy = cy * S, oz = cz * S;
    const faceMeshes = new Array(6).fill(null);
    for (let f = 0; f < 6; f++) {
      if (!geoms.faces[f]) continue;
      const m = new THREE.Mesh(geoms.faces[f], this.voxelMat);
      m.position.set(ox, oy, oz);
      this.worldGroup.add(m);
      faceMeshes[f] = m;
    }
    let waterMesh = null;
    if (geoms.water) { waterMesh = new THREE.Mesh(geoms.water, this.waterMat); waterMesh.position.set(ox, oy, oz); this.worldGroup.add(waterMesh); }
    const entry = { ox, oy, oz, faceMeshes, waterMesh };
    this.chunkMap.set(key, entry);
    return entry;
  }

  buildChunkMeshes(chunk) {
    const geoms = buildChunkGeometries(this.world, chunk);
    chunk.dirty = false;
    return this._addChunkEntry(chunk.cx, chunk.cy, chunk.cz, geoms);
  }

  _installStreamed(cx, cy, cz, data) {
    let chunk = this.world.getChunk(cx, cy, cz);
    if (!chunk) { chunk = new Chunk(cx, cy, cz); this.world.addChunk(chunk); }
    if (data.chunkData) { chunk.data.set(data.chunkData); chunk.generated = true; }
    const geoms = geometriesFromMeshData(data);
    return this._addChunkEntry(cx, cy, cz, geoms);
  }

  clearWorld() {
    for (const e of this.chunkMap.values()) this._disposeEntry(e);
    this.chunkMap.clear();
    this.world.chunks.clear();
    this.clearLOD();
  }

  _onEdit(x, y, z) {
    this.rebuildAround(x, y, z);
    this.streamer.setOverrides(this.world.overrides);
  }

  rebuildAround(x, y, z) {
    const [cx, cy, cz] = this.world.chunkCoord(x, y, z);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const c = this.world.getChunk(cx + dx, cy + dy, cz + dz);
          if (c) this.buildChunkMeshes(c);
        }
  }

  // ---- 远景 LOD ----
  _onWorkerResult(d) {
    if (d.type === 'result') this.streamer.onResult(d);
    else if (d.type === 'lodResult') this._onLodResult(d);
  }

  _applyFog() {
    const near = this.viewDist * 0.45, far = this.viewDist * 1.02;
    const col = this.sky ? this.sky.horizonColor().getHex() : 0xbcd6ee;
    this.scene.fog = new THREE.Fog(col, near, far);
  }

  setViewDistance(v) {
    this.viewDist = Math.max(CONFIG.VIEW.min, Math.min(CONFIG.VIEW.max, v | 0));
    this._applyFog();
    this.lodCenter = null;
  }

  setTimeOfDay(t) { this.timeOfDay = ((t % 1) + 1) % 1; }
  toggleDayAuto() { this.dayAuto = !this.dayAuto; return this.dayAuto; }

  clearLOD() {
    for (const m of this.lodMeshes.values()) { this.lodGroup.remove(m); m.geometry.dispose(); }
    this.lodMeshes.clear();
    this.lodCenter = null;
  }

  updateLOD(px, pz) {
    const snap = 32;
    const cx = Math.round(px / snap) * snap, cz = Math.round(pz / snap) * snap;
    if (this.lodCenter && this.lodCenter[0] === cx && this.lodCenter[1] === cz) return;
    this.lodCenter = [cx, cz];
    this._rebuildLOD(cx, cz);
  }

  _rebuildLOD(cx, cz) {
    const levels = lodLevels(this.viewDist);
    for (let i = 0; i < levels.length; i++) {
      const L = levels[i];
      this.pool.submit({
        type: 'lod', level: i, cell: L.cell, innerR: L.innerR, outerR: L.outerR,
        centerX: cx, centerZ: cz, seed: CONFIG.SEED, _transfer: [],
      }, 1000 + i); // 低于近景区块优先级
    }
  }

  _onLodResult(d) {
    const old = this.lodMeshes.get(d.level);
    if (old) { this.lodGroup.remove(old); old.geometry.dispose(); }
    if (!d.positions || d.positions.length === 0) { this.lodMeshes.delete(d.level); return; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(d.colors, 3));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.lodMat);
    mesh.frustumCulled = false;
    this.lodGroup.add(mesh);
    this.lodMeshes.set(d.level, mesh);
  }

  // ---- 静态截图模式（测试用，同步生成）----
  focusWorld(wx, wz, r = 5) {
    this.streaming = false;
    this.clearWorld();
    const ccx = Math.floor(wx / S), ccz = Math.floor(wz / S);
    let minCy = Infinity, maxCy = -Infinity;
    for (let cx = ccx - r - 1; cx <= ccx + r + 1; cx++)
      for (let cz = ccz - r - 1; cz <= ccz + r + 1; cz++) {
        const h = this.terrain.heightAt(cx * S + 8, cz * S + 8);
        const scy = Math.floor(h / S);
        if (scy < minCy) minCy = scy;
        if (scy > maxCy) maxCy = scy;
      }
    const cyLo = minCy - 1, cyHi = maxCy + 2;
    for (let cx = ccx - r - 1; cx <= ccx + r + 1; cx++)
      for (let cz = ccz - r - 1; cz <= ccz + r + 1; cz++)
        for (let cy = cyLo; cy <= cyHi; cy++)
          this.world.ensureChunk(cx, cy, cz);
    for (let cx = ccx - r; cx <= ccx + r; cx++)
      for (let cz = ccz - r; cz <= ccz + r; cz++)
        for (let cy = cyLo; cy <= cyHi; cy++) {
          const chunk = this.world.getChunk(cx, cy, cz);
          if (chunk) this.buildChunkMeshes(chunk);
        }
    let tris = 0;
    for (const e of this.chunkMap.values()) for (const m of e.faceMeshes) if (m) tris += m.geometry.attributes.position.count / 3;
    const h = this.terrain.heightAt(wx, wz);
    const cy = Math.max(h, CONFIG.WORLD_SEA_LEVEL) + 1;
    this.camera.position.set(wx + 26, cy + 22, wz + 26);
    this.camera.lookAt(wx, cy - 2, wz);
    this.focus = { wx, wz, h, tris: Math.round(tris), chunks: this.chunkMap.size };
    this.lodCenter = [wx, wz];
    this._rebuildLOD(wx, wz);
    this._cullFaces();
    this._updateHud();
    return this.focus;
  }

  _cullFaces() {
    const cp = this.camera.position;
    for (const co of this.chunkMap.values()) {
      // 用区块包围盒判定（保守）：相机在区块内部时六向全可见，避免破洞
      const x0 = co.ox, x1 = co.ox + S, y0 = co.oy, y1 = co.oy + S, z0 = co.oz, z1 = co.oz + S;
      const fm = co.faceMeshes;
      if (fm[0]) fm[0].visible = cp.x > x0;   // +X 面：相机在其最小 x 之右才可见
      if (fm[1]) fm[1].visible = cp.x < x1;   // -X 面
      if (fm[2]) fm[2].visible = cp.y > y0;   // +Y 面
      if (fm[3]) fm[3].visible = cp.y < y1;   // -Y 面
      if (fm[4]) fm[4].visible = cp.z > z0;   // +Z 面
      if (fm[5]) fm[5].visible = cp.z < z1;   // -Z 面
    }
  }

  findBiome(biomeId, maxR = 8000, step = 48) {
    const t = this.terrain;
    for (let ring = 0; ring < maxR; ring += step)
      for (let x = -ring; x <= ring; x += step)
        for (let z = -ring; z <= ring; z += step) {
          if (Math.abs(x) !== ring && Math.abs(z) !== ring) continue;
          const h = t.heightAt(x, z);
          if (t.biomeAt(x, z, h) === biomeId) return { x, z, h };
        }
    return null;
  }
  focusBiome(biomeId, r = 5) {
    const p = this.findBiome(biomeId);
    if (!p) return null;
    const f = this.focusWorld(p.x, p.z, r);
    f.biome = BIOME_NAMES[biomeId];
    return f;
  }
  findTree(type, maxR = 6000, step = 4) {
    for (let ring = 0; ring < maxR; ring += step)
      for (let x = -ring; x <= ring; x += step)
        for (let z = -ring; z <= ring; z += step) {
          if (Math.abs(x) !== ring && Math.abs(z) !== ring) continue;
          if (treeTypeAt(x, z, this.terrain, this.world.seed) === type)
            return { x, z, h: this.terrain.heightAt(x, z) };
        }
    return null;
  }
  focusTree(type, r = 4) {
    const p = this.findTree(type);
    if (!p) return null;
    const f = this.focusWorld(p.x, p.z, type === 'giant' ? 5 : 4);
    if (type === 'giant') { this.camera.position.set(p.x + 30, p.h + 22, p.z + 30); this.camera.lookAt(p.x + 0.5, p.h + 12, p.z + 0.5); }
    else { this.camera.position.set(p.x + 14, p.h + 9, p.z + 14); this.camera.lookAt(p.x, p.h + 6, p.z); }
    this._cullFaces();
    f.tree = type;
    return f;
  }

  _onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  _loop() {
    const t0 = performance.now();
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const modalOpen = this.inventory.isOpen || this.settings.isOpen;
    if (this.streaming && !modalOpen) {
      this.player.update(dt);
      const yaw = this.controls.yaw;
      this.streamer.update(this.player.state.x, this.player.state.y, this.player.state.z, -Math.sin(yaw), -Math.cos(yaw));
      this.updateLOD(this.player.state.x, this.player.state.z);
    } else if (this.playerActive && !modalOpen) {
      this.player.update(dt);
    }
    this._cullFaces();

    // ---- 昼夜 + 渲染参数联动 ----
    this.elapsed += dt;
    if (this.dayAuto) this.timeOfDay = (this.timeOfDay + dt / 600) % 1;
    this.sky.setTime(this.timeOfDay);
    this.sky.mesh.position.copy(this.camera.position);
    const wu = this.waterMat.uniforms;
    wu.uTime.value = this.elapsed;
    wu.uSunDir.value.copy(this.sky.sunDir);
    wu.uSkyColor.value.copy(this.sky.horizonColor());
    wu.uCamPos.value.copy(this.camera.position);
    wu.uDay.value = this.sky.dayFactor;
    this.voxelMat.uniforms.uAmbient.value = this.sky.ambientIntensity();
    this.lodMat.color.setScalar(this.sky.ambientIntensity());
    this.scene.fog.color.copy(this.sky.horizonColor());

    this.renderer.render(this.scene, this.camera);
    const frameTime = performance.now() - t0;
    if (frameTime > 16) this.longFrames++;
    this.frames++; this.fpsAccum += dt; this.frameMs = dt * 1000;
    if (this.fpsAccum >= 0.5) {
      this.fps = this.frames / this.fpsAccum;
      this.frames = 0; this.fpsAccum = 0;
      this._updateHud();
    }
  }

  _updateHud() {
    const info = this.renderer.info.render;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('h-fps', this.fps.toFixed(0));
    set('h-frame', this.frameMs.toFixed(1) + ' ms');
    set('h-draw', info.calls);
    set('h-tri', info.triangles.toLocaleString());
    const p = this.camera.position;
    set('h-pos', `${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`);
    // 群系
    const h = this.terrain.heightAt(Math.floor(p.x), Math.floor(p.z));
    set('h-biome', BIOME_NAMES[this.terrain.biomeAt(Math.floor(p.x), Math.floor(p.z), h)]);
    set('h-chunks', this.chunkMap.size);
    // F3 调试
    set('d-loaded', this.streamer.loadedCount);
    set('d-pending', this.pool.pending + ' / busy ' + this.pool.busy);
    set('d-lod', this.lodMeshes.size);
    set('d-sub', this.streamer.stats.submitted + ' / ' + this.streamer.stats.installed);
    set('d-long', this.longFrames);
    set('d-view', this.viewDist);
    set('d-time', this.timeOfDay.toFixed(2) + (this.dayAuto ? ' ⟳' : ''));
    const fpsEl = document.getElementById('h-fps');
    if (fpsEl) fpsEl.style.color = this.fps >= 50 ? 'var(--good)' : this.fps >= 30 ? 'var(--warn)' : 'var(--bad)';
  }
}

const game = new Game();
game.init();
window.__VOXY__ = game;
window.__BIOME__ = BIOME;
window.__BIOME_NAMES__ = BIOME_NAMES;
