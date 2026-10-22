import * as THREE from "three";
import {
  AIR, BEDROCK, BLOCKS, CACTUS, CHUNK, CRAFTING_TABLE, DEAD_BUSH, DIRT, FACE_DIRS, GRASS, HEIGHT, ITEMS, LAVA, OBSIDIAN, SAND,
  SEA_LEVEL, SNOWY_GRASS, WATER, canSupport, isBlockItem, itemIdByName, itemMaxStack, type BlockDef,
} from "./blocks";
import { initIcons } from "./icons";
import { Inventory, matchRecipe, type ItemStack } from "./inventory";
import { ItemManager, itemGeometry } from "./items";
import { createAtlasTexture, createEntityMaterial, createWorldMaterials, Sky } from "./materials";
import { buildChunkGeometry } from "./mesher";
import { MobManager, type Mob } from "./mobs";
import { boxIntersectsBlock, rayBox, raycast, type RayHit } from "./physics";
import { Player } from "./player";
import { sfx } from "./sfx";
import { Biome, mulberry32, TerrainGen } from "./terrain";
import { tileImageData } from "./textures";
import { TickSystem } from "./ticks";
import { Chunk, World } from "./world";

export type Screen = "loading" | "title" | "playing" | "paused" | "inventory" | "crafting" | "dead";
const DAY_LENGTH = 600;

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  world = new World();
  terrain: TerrainGen;
  player = new Player();
  items: ItemManager;
  mobs: MobManager;
  ticks: TickSystem;
  sky = new Sky();
  mats: ReturnType<typeof createWorldMaterials>;
  keys = new Set<string>();
  renderDistance = 6;
  private offsets: [number, number, number][] = [];
  screen: Screen = "loading";
  loadingProgress = 0;
  time = 0.06; // day fraction
  elapsed = 0;
  day = 1;
  fps = 0;
  version = 0;
  listeners = new Set<() => void>();
  message = "";
  private messageTimer = 0;
  hurtFlash = 0;
  flash = 0;
  underwater = false;
  inLava = false;
  debug = false;
  target: RayHit | null = null;
  breaking: { x: number; y: number; z: number; progress: number } | null = null;
  private breakCooldown = 0;
  private leftDown = false;
  private rightDown = false;
  private placeTimer = 0;
  private digSoundTimer = 0;
  private selectionBox: THREE.LineSegments;
  private crackMesh: THREE.Mesh;
  private crackTextures: THREE.CanvasTexture[] = [];
  private hand = new THREE.Group();
  private handMesh: THREE.Mesh | null = null;
  private handMat: THREE.ShaderMaterial;
  private handId = -1;
  private swing = 1;
  private lastInvVersion = -1;
  private lastHealth = -1;
  private spawnTimer = 0;
  private fusing = new Set<Mob>();
  private uiTimer = 0;
  private raf = 0;
  private lastTime = 0;
  private disposed = false;
  spawnX = 0;
  spawnZ = 0;
  // crafting UI
  craftSize: 2 | 3 = 2;
  craftGrid: (ItemStack | null)[] = new Array(9).fill(null);
  cursor: ItemStack | null = null;
  pointerLocked = false;

  constructor(public canvas: HTMLCanvasElement, seed = Math.floor(Math.random() * 1e9)) {
    this.terrain = new TerrainGen(seed);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1200);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    const atlas = createAtlasTexture();
    this.mats = createWorldMaterials(atlas);
    initIcons(this.mats.uniforms);
    this.scene.add(this.sky.group);
    this.scene.fog = new THREE.Fog(0xbcd6f7, 60, 96);
    this.items = new ItemManager(this.world, this.mats.uniforms, this.scene);
    this.mobs = new MobManager(this.world, this.scene, {
      explode: (x, y, z, r) => this.explode(x, y, z, r),
      attackPlayer: (dmg, fx, fz) => { this.player.damage(dmg); this.player.knockback(fx, fz); },
      dropItem: (id, count, x, y, z) => { this.items.spawn(id, count, x, y, z); },
    });
    this.ticks = new TickSystem(this.world, (x, y, z, id, meta) => this.dropBlockItems(x, y, z, id, meta, null));
    this.world.listeners.push((x, y, z, o, n) => this.ticks.onBlockChanged(x, y, z, o, n));
    this.player.onHurt = () => { this.hurtFlash = 1; sfx.hurt(); this.notify(); };
    this.player.onDeath = () => { this.setScreen("dead"); document.exitPointerLock(); };

    // selection box & crack overlay
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.selectionBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);
    for (let i = 0; i < 10; i++) {
      const img = tileImageData("crack_" + i)!;
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      c.getContext("2d")!.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      this.crackTextures.push(t);
    }
    this.crackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({ map: this.crackTextures[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    );
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);
    // hand
    this.handMat = createEntityMaterial(this.mats.uniforms);
    this.camera.add(this.hand);
    this.setRenderDistance(6);
    this.bindInput();
  }

  // ---------------- lifecycle ----------------
  start() {
    const [sx, sz] = this.findSpawn();
    this.spawnX = sx;
    this.spawnZ = sz;
    this.player.pos.set(sx + 0.5, 100, sz + 0.5);
    // small starter kit
    const inv = this.player.inventory;
    inv.add(itemIdByName("torch"), 16);
    inv.add(itemIdByName("crafting_table"), 1);
    inv.add(itemIdByName("oak_planks"), 16);
    inv.add(itemIdByName("wooden_pickaxe"), 1);
    inv.add(itemIdByName("apple"), 3);
    this.lastTime = performance.now();
    const loop = (t: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - this.lastTime) / 1000);
      this.lastTime = t;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  notify() {
    this.version++;
    for (const l of this.listeners) l();
  }
  setScreen(s: Screen) {
    if (this.screen === s) return;
    this.screen = s;
    this.notify();
  }
  showMessage(m: string) {
    this.message = m;
    this.messageTimer = 2.5;
    this.notify();
  }
  setRenderDistance(r: number) {
    this.renderDistance = r;
    this.offsets = [];
    const R = r + 2;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) if (dx * dx + dz * dz <= R * R + 1) this.offsets.push([dx, dz, dx * dx + dz * dz]);
    this.offsets.sort((a, b) => a[2] - b[2]);
    this.notify();
  }

  private findSpawn(): [number, number] {
    for (let r = 0; r < 60; r++) {
      const n = r === 0 ? 1 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * r * 14), z = Math.round(Math.sin(a) * r * 14);
        const info = this.terrain.column(x, z);
        if (info.height > SEA_LEVEL + 2 && info.height < 90 && info.biome !== Biome.Ocean && info.biome !== Biome.River && info.biome !== Biome.Beach && info.biome !== Biome.Desert) return [x, z];
      }
    }
    return [0, 0];
  }

  // ---------------- main frame ----------------
  private frame(dt: number) {
    this.elapsed += dt;
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    if (this.screen === "loading") {
      this.updateChunks(40);
      // progress: chunks within radius 3 generated & meshed
      let need = 0, have = 0;
      const pcx = Math.floor(this.player.pos.x) >> 4, pcz = Math.floor(this.player.pos.z) >> 4;
      for (const [dx, dz, d2] of this.offsets) {
        if (d2 > 9) continue;
        need++;
        const c = this.world.getChunk(pcx + dx, pcz + dz);
        if (c && c.generated && !c.dirty) have++;
      }
      this.loadingProgress = have / Math.max(1, need);
      this.notify();
      if (have >= need) {
        // place the player on the surface
        const c = this.world.getChunk(pcx, pcz)!;
        const h = c.height[(Math.floor(this.player.pos.x) & 15) * CHUNK + (Math.floor(this.player.pos.z) & 15)];
        this.player.pos.y = h + 0.1;
        this.player.spawn.copy(this.player.pos);
        this.setScreen("title");
      }
      this.updateEnvironment(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const playing = this.screen === "playing";
    this.updateChunks(playing ? 7 : 3);
    const simulate = playing || this.screen === "inventory" || this.screen === "crafting";
    if (simulate) {
      const t0 = performance.now();
      this.player.update(dt, this.world, playing ? this.keys : new Set());
      if (this.time > 0) this.time += dt / DAY_LENGTH;
      this.ticks.update(dt);
      this.items.update(dt, this.player, (id, count) => {
        const left = this.player.inventory.add(id, count);
        if (left < count) sfx.pop();
        return left;
      }, this.day);
      this.mobs.update(dt, this.player.pos, this.day);
      for (const m of this.mobs.mobs) {
        if (m.state === "fuse" && !this.fusing.has(m)) { this.fusing.add(m); sfx.hiss(); }
        if (m.state !== "fuse") this.fusing.delete(m);
      }
      this.updateSpawning(dt);
      if (playing) this.updateInteraction(dt);
      else { this.breaking = null; }
      void t0;
    }
    if (this.messageTimer > 0) { this.messageTimer -= dt; if (this.messageTimer <= 0) { this.message = ""; this.notify(); } }
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2);
    this.updateCamera(dt);
    this.updateEnvironment(dt);
    this.updateHand(dt);
    this.updateOverlays();
    this.renderer.render(this.scene, this.camera);
    // UI sync
    this.uiTimer += dt;
    const inv = this.player.inventory;
    if (inv.version !== this.lastInvVersion || Math.ceil(this.player.health) !== this.lastHealth || this.uiTimer > 0.25) {
      this.lastInvVersion = inv.version;
      this.lastHealth = Math.ceil(this.player.health);
      this.uiTimer = 0;
      this.notify();
    }
  }

  // ---------------- chunks ----------------
  private updateChunks(budgetMs: number) {
    const start = performance.now();
    const pcx = Math.floor(this.player.pos.x) >> 4, pcz = Math.floor(this.player.pos.z) >> 4;
    const R = this.renderDistance;
    // generation
    for (const [dx, dz] of this.offsets) {
      const cx = pcx + dx, cz = pcz + dz;
      const c = this.world.getChunk(cx, cz);
      if (c && c.generated) continue;
      const chunk = this.world.getOrCreateChunk(cx, cz);
      this.terrain.generate(chunk);
      this.world.lightChunk(chunk);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) { const n = this.world.getChunk(cx + ox, cz + oz); if (n) n.dirty = true; }
      if (performance.now() - start > budgetMs) break;
    }
    // meshing (nearest dirty first)
    const dirty: [Chunk, number][] = [];
    for (const c of this.world.chunks.values()) {
      if (!c.generated || !c.dirty) continue;
      const dx = c.cx - pcx, dz = c.cz - pcz, d2 = dx * dx + dz * dz;
      if (d2 > R * R + 1) continue;
      let ok = true;
      for (let ox = -1; ox <= 1 && ok; ox++) for (let oz = -1; oz <= 1 && ok; oz++) { const n = this.world.getChunk(c.cx + ox, c.cz + oz); if (!n || !n.generated) ok = false; }
      if (ok) dirty.push([c, d2]);
    }
    dirty.sort((a, b) => a[1] - b[1]);
    for (const [c] of dirty) {
      this.remesh(c);
      if (performance.now() - start > budgetMs * 1.5) break;
    }
    // visibility / unload
    for (const c of this.world.chunks.values()) {
      const dx = c.cx - pcx, dz = c.cz - pcz, d2 = dx * dx + dz * dz;
      const far = d2 > (R + 3) * (R + 3);
      if (far) {
        if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; c.dirty = true; }
        if (c.waterMesh) { this.scene.remove(c.waterMesh); c.waterMesh.geometry.dispose(); c.waterMesh = null; }
      } else {
        const vis = d2 <= R * R + 1;
        if (c.mesh) c.mesh.visible = vis;
        if (c.waterMesh) c.waterMesh.visible = vis;
      }
    }
  }
  private remesh(c: Chunk) {
    const geo = buildChunkGeometry(this.world, c);
    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (c.waterMesh) { this.scene.remove(c.waterMesh); c.waterMesh.geometry.dispose(); c.waterMesh = null; }
    if (geo.solid) {
      const m = new THREE.Mesh(geo.solid, this.mats.solid);
      m.position.set(c.cx * CHUNK, 0, c.cz * CHUNK);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.scene.add(m);
      c.mesh = m;
    }
    if (geo.liquid) {
      const m = new THREE.Mesh(geo.liquid, this.mats.liquid);
      m.position.set(c.cx * CHUNK, 0, c.cz * CHUNK);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.renderOrder = 10;
      this.scene.add(m);
      c.waterMesh = m;
    }
    c.dirty = false;
    if (!c.decorated) {
      c.decorated = true;
      if (this.mobs.count(false) < 28) this.mobs.spawnAnimalsInChunk(c.cx, c.cz, mulberry32((c.cx * 73856093) ^ (c.cz * 19349663) ^ this.terrain.seed));
    }
  }

  // ---------------- spawning ----------------
  private updateSpawning(dt: number) {
    this.spawnTimer += dt;
    if (this.spawnTimer < 1) return;
    this.spawnTimer = 0;
    if (this.mobs.count(true) >= 10) return;
    const p = this.player.pos;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 22;
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (!this.world.hasChunkAt(x, z)) continue;
      const y = Math.floor(Math.max(2, p.y - 26) + Math.random() * 40);
      if (y >= HEIGHT - 2) continue;
      if (this.world.getBlock(x, y, z) !== AIR || this.world.getBlock(x, y + 1, z) !== AIR) continue;
      const below = this.world.getBlock(x, y - 1, z);
      if (!BLOCKS[below].solid || !BLOCKS[below].opaque) continue;
      const packed = this.world.getLightPacked(x, y, z);
      const skyEff = Math.round((packed >> 4) * (0.27 + 0.73 * this.day));
      if (Math.max(skyEff, packed & 15) > 7) continue;
      this.mobs.spawn(Math.random() < 0.55 ? "zombie" : "creeper", x + 0.5, y, z + 0.5);
      break;
    }
  }

  // ---------------- interaction ----------------
  private mobUnderCursor(maxDist = 4): Mob | null {
    const eye = this.player.getEye(), dir = this.player.getDir();
    let best: Mob | null = null, bestT = maxDist;
    const min = new THREE.Vector3(), max = new THREE.Vector3();
    for (const m of this.mobs.mobs) {
      if (m.dead) continue;
      if (m.pos.distanceToSquared(eye) > 36) continue;
      min.set(m.pos.x - m.halfW, m.pos.y, m.pos.z - m.halfW);
      max.set(m.pos.x + m.halfW, m.pos.y + m.height, m.pos.z + m.halfW);
      const t = rayBox(eye, dir, min, max);
      if (t >= 0 && t < bestT) { bestT = t; best = m; }
    }
    if (best && this.target && this.target.dist < bestT) return null;
    return best;
  }

  private updateInteraction(dt: number) {
    const eye = this.player.getEye(), dir = this.player.getDir();
    this.target = raycast(this.world, eye, dir, 5);
    if (this.breakCooldown > 0) this.breakCooldown -= dt;
    if (this.leftDown && this.breakCooldown <= 0 && !this.mobUnderCursor()) {
      const t = this.target;
      if (t) {
        if (!this.breaking || this.breaking.x !== t.x || this.breaking.y !== t.y || this.breaking.z !== t.z) this.breaking = { x: t.x, y: t.y, z: t.z, progress: 0 };
        const bt = this.breakTime(BLOCKS[t.id]);
        if (bt === Infinity) this.breaking.progress = 0;
        else this.breaking.progress += bt <= 0 ? 1 : dt / bt;
        this.digSoundTimer -= dt;
        if (this.digSoundTimer <= 0) { this.digSoundTimer = 0.25; sfx.dig(1, 0.06); this.swing = 0; }
        if (this.breaking.progress >= 1) {
          this.breakBlock(t.x, t.y, t.z);
          this.breaking = null;
          this.breakCooldown = 0.3;
        }
      } else this.breaking = null;
    } else if (!this.leftDown) this.breaking = null;
    if (this.rightDown) {
      this.placeTimer -= dt;
      if (this.placeTimer <= 0) { this.placeTimer = 0.25; this.useItem(); }
    }
  }

  private toolOf(): { type: string; tier: number; speed: number; attack: number } | null {
    const s = this.player.inventory.selectedStack();
    if (!s || isBlockItem(s.id)) return null;
    const it = ITEMS.get(s.id);
    if (!it || !it.tool) return null;
    return { ...it.tool, attack: it.attack ?? 1 };
  }
  private breakTime(def: BlockDef): number {
    if (def.hardness < 0) return Infinity;
    if (def.hardness === 0) return 0;
    const tool = this.toolOf();
    const needsTool = def.minTier !== undefined;
    const properTool = !!tool && tool.type === def.tool;
    const canHarvest = !needsTool || (properTool && tool!.tier >= (def.minTier ?? 0));
    let speed = properTool ? tool!.speed : 1;
    if (this.player.headInWater) speed /= 5;
    if (!this.player.onGround && !this.player.flying) speed /= 5;
    if (this.player.flying) speed *= 1.5;
    return canHarvest ? (def.hardness * 1.5) / speed : (def.hardness * 5) / speed;
  }
  private dropsFor(def: BlockDef, tool: { type: string; tier: number } | null): [number, number][] {
    if (def.drop === null) return [];
    if (def.minTier !== undefined) {
      if (!tool || tool.type !== def.tool || tool.tier < def.minTier) return [];
    }
    const name = def.drop ?? def.name;
    const id = itemIdByName(name);
    const count = def.dropCount ? def.dropCount[0] + Math.floor(Math.random() * (def.dropCount[1] - def.dropCount[0] + 1)) : 1;
    return count > 0 ? [[id, count]] : [];
  }
  private dropBlockItems(x: number, y: number, z: number, id: number, _meta: number, tool: { type: string; tier: number } | null) {
    for (const [iid, n] of this.dropsFor(BLOCKS[id], tool)) this.items.spawnBlockDrop(iid, n, x, y, z);
  }
  breakBlock(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    if (id === AIR) return;
    const def = BLOCKS[id];
    if (def.hardness < 0) return;
    const meta = this.world.getMeta(x, y, z);
    this.world.setBlock(x, y, z, AIR, 0);
    this.dropBlockItems(x, y, z, id, meta, this.toolOf());
    sfx.dig(def.tool === "shovel" ? 0.8 : 1.1, 0.2);
  }

  private useItem() {
    const stack = this.player.inventory.selectedStack();
    const t = this.target;
    if (t && t.id === CRAFTING_TABLE && !this.player.sneaking) {
      this.openCrafting();
      this.rightDown = false;
      return;
    }
    if (!stack) return;
    if (!isBlockItem(stack.id)) {
      const it = ITEMS.get(stack.id);
      if (it?.food && this.player.health < this.player.maxHealth) {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + it.food);
        this.player.inventory.consumeSelected();
        sfx.pop();
        this.swing = 0;
      }
      return;
    }
    if (!t) return;
    const def = BLOCKS[stack.id];
    const tdef = BLOCKS[t.id];
    let px: number, py: number, pz: number;
    if (tdef.replaceable) { px = t.x; py = t.y; pz = t.z; }
    else { const d = FACE_DIRS[t.face]; px = t.x + d[0]; py = t.y + d[1]; pz = t.z + d[2]; }
    if (py < 0 || py >= HEIGHT) return;
    const cur = this.world.getBlock(px, py, pz);
    if (!(cur === AIR || BLOCKS[cur].replaceable)) return;
    if (def.solid) {
      if (boxIntersectsBlock(this.player.pos, this.player.halfW, this.player.height, px, py, pz)) return;
      for (const m of this.mobs.mobs) if (boxIntersectsBlock(m.pos, m.halfW, m.height, px, py, pz)) return;
    }
    let meta = 0;
    const below = this.world.getBlock(px, py - 1, pz);
    if (def.render === "torch") {
      const horizontal = t.face === 0 || t.face === 1 || t.face === 4 || t.face === 5;
      if (t.face === 2 && canSupport(t.id) && !tdef.replaceable) meta = 0;
      else if (horizontal && canSupport(t.id)) meta = [1, 0, 2, 3, 5, 4][t.face] + 1;
      else if (canSupport(below)) meta = 0;
      else return;
    } else if (def.needsSupport) {
      if (stack.id === DEAD_BUSH) { if (below !== SAND) return; }
      else if (!(below === GRASS || below === DIRT || below === SNOWY_GRASS)) return;
    } else if (stack.id === CACTUS) {
      if (!(below === SAND || below === CACTUS)) return;
    } else if (def.tex.front) {
      const s = Math.sin(this.player.yaw), c = Math.cos(this.player.yaw);
      meta = Math.abs(s) > Math.abs(c) ? (s > 0 ? 3 : 1) : c > 0 ? 0 : 2;
    }
    this.world.setBlock(px, py, pz, stack.id, meta);
    this.player.inventory.consumeSelected();
    sfx.place();
    this.swing = 0;
  }

  private attack() {
    const m = this.mobUnderCursor();
    this.swing = 0;
    if (m) {
      const tool = this.toolOf();
      m.damage(tool ? tool.attack : 1, this.player.pos.x, this.player.pos.z);
      sfx.dig(0.5, 0.1);
      return true;
    }
    return false;
  }

  explode(x: number, y: number, z: number, r: number) {
    sfx.explode();
    this.flash = 1;
    const R = Math.ceil(r) + 1;
    for (let dx = -R; dx <= R; dx++)
      for (let dy = -R; dy <= R; dy++)
        for (let dz = -R; dz <= R; dz++) {
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > r * (0.8 + Math.random() * 0.35)) continue;
          const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
          const id = this.world.getBlock(bx, by, bz);
          if (id === AIR || id === BEDROCK || id === OBSIDIAN || id === WATER || id === LAVA) continue;
          this.world.setBlock(bx, by, bz, AIR, 0);
          if (Math.random() < 0.3) this.dropBlockItems(bx, by, bz, id, 0, { type: "pickaxe", tier: 2 });
        }
    const pd = Math.hypot(this.player.pos.x - x, this.player.pos.y + 0.9 - y, this.player.pos.z - z);
    if (pd < r * 2.2) {
      this.player.damage(Math.round(22 * (1 - pd / (r * 2.2))));
      this.player.knockback(x, z, 10);
    }
    for (const m of this.mobs.mobs) {
      const md = m.pos.distanceTo(new THREE.Vector3(x, y, z));
      if (md < r * 2 && !m.dead) m.damage(Math.round(20 * (1 - md / (r * 2))), x, z);
    }
  }

  // ---------------- camera / env ----------------
  private updateCamera(dt: number) {
    const p = this.player;
    if (this.screen === "title") {
      p.yaw += dt * 0.08;
      p.pitch = -0.08;
    }
    const eye = p.getEye();
    const bobX = Math.sin(p.bob) * 0.02, bobY = -Math.abs(Math.cos(p.bob)) * 0.03;
    this.camera.position.set(eye.x + bobX * Math.cos(p.yaw), eye.y + bobY, eye.z - bobX * Math.sin(p.yaw));
    this.camera.rotation.set(p.pitch, p.yaw, 0);
    const targetFov = this.underwater ? p.fovTarget * 0.9 : p.fovTarget;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }
  }
  private updateEnvironment(dt: number) {
    void dt;
    const cam = this.camera.position;
    const env = this.sky.update(this.time % 1, cam, this.elapsed);
    this.day = env.day;
    const u = this.mats.uniforms;
    u.uTime.value = this.elapsed;
    u.uDay.value = 0.28 + 0.72 * env.day;
    const tint = new THREE.Color(0.55, 0.65, 1.0).lerp(new THREE.Color(1, 1, 1), env.day).lerp(new THREE.Color(1, 0.85, 0.72), env.sunset * 0.4);
    u.uSkyTint.value.copy(tint);
    // underwater / lava
    const bx = Math.floor(cam.x), by = Math.floor(cam.y), bz = Math.floor(cam.z);
    const b = this.world.getBlock(bx, by, bz);
    let under = false;
    if (b === WATER) {
      const m = this.world.getMeta(bx, by, bz);
      const lvl = m & 8 ? 0 : m & 7;
      const h = this.world.getBlock(bx, by + 1, bz) === WATER ? 1 : 1 - (lvl + 1) / 9;
      under = cam.y - by < h;
    }
    this.underwater = under;
    this.inLava = b === LAVA;
    const fog = this.scene.fog as THREE.Fog;
    const R = this.renderDistance * CHUNK;
    if (this.inLava) {
      u.uFogColor.value.setRGB(0.6, 0.12, 0.02); u.uFogNear.value = 0; u.uFogFar.value = 1.5;
    } else if (under) {
      const c = new THREE.Color(0.02, 0.09, 0.32).multiplyScalar(0.3 + 0.7 * env.day);
      u.uFogColor.value.copy(c); u.uFogNear.value = 1; u.uFogFar.value = 16;
    } else {
      u.uFogColor.value.copy(env.horizon); u.uFogNear.value = R * 0.6; u.uFogFar.value = R * 0.97;
    }
    fog.color.copy(u.uFogColor.value);
    fog.near = u.uFogNear.value;
    fog.far = u.uFogFar.value;
  }
  private updateOverlays() {
    const t = this.target;
    if (t && this.screen === "playing") {
      const def = BLOCKS[t.id];
      this.selectionBox.visible = true;
      this.selectionBox.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
      if (def.render === "cross") this.selectionBox.scale.set(0.7, 0.8, 0.7), this.selectionBox.position.y = t.y + 0.4;
      else if (def.render === "torch") this.selectionBox.scale.set(0.25, 0.65, 0.25), this.selectionBox.position.y = t.y + 0.325;
      else this.selectionBox.scale.set(1, 1, 1);
    } else this.selectionBox.visible = false;
    if (this.breaking && this.breaking.progress > 0) {
      this.crackMesh.visible = true;
      this.crackMesh.position.set(this.breaking.x + 0.5, this.breaking.y + 0.5, this.breaking.z + 0.5);
      const stage = Math.min(9, Math.floor(this.breaking.progress * 10));
      (this.crackMesh.material as THREE.MeshBasicMaterial).map = this.crackTextures[stage];
    } else this.crackMesh.visible = false;
  }
  private updateHand(dt: number) {
    const stack = this.player.inventory.selectedStack();
    const id = stack ? stack.id : 0;
    if (id !== this.handId) {
      this.handId = id;
      if (this.handMesh) { this.hand.remove(this.handMesh); this.handMesh = null; }
      if (id) {
        this.handMesh = new THREE.Mesh(itemGeometry(id), this.handMat);
        const isCube = isBlockItem(id) && BLOCKS[id].render === "cube";
        this.handMesh.scale.setScalar(isCube ? 1.7 : 1.4);
        this.handMesh.rotation.set(0, isCube ? -0.5 : -0.2, isCube ? 0 : 0.5);
        this.hand.add(this.handMesh);
      } else {
        const g = new THREE.BoxGeometry(0.22, 0.22, 0.6);
        const m = new THREE.MeshBasicMaterial({ color: 0xc89b7a });
        this.handMesh = new THREE.Mesh(g, m);
        this.handMesh.rotation.set(0.3, -0.35, 0);
        this.hand.add(this.handMesh);
      }
    }
    if (this.swing < 1) this.swing = Math.min(1, this.swing + dt * 4);
    const s = Math.sin(this.swing * Math.PI);
    const p = this.player;
    const bobX = Math.sin(p.bob) * 0.03, bobY = -Math.abs(Math.cos(p.bob)) * 0.03;
    this.hand.position.set(0.52 + bobX - s * 0.25, -0.5 + bobY - s * 0.32, -0.85 + s * 0.1);
    this.hand.rotation.set(-s * 1.2, s * 0.6, 0);
    this.hand.visible = this.screen !== "title" && this.screen !== "loading";
    const packed = this.world.getLightPacked(Math.floor(p.pos.x), Math.floor(p.pos.y + 1.5), Math.floor(p.pos.z));
    this.handMat.uniforms.uSky.value = (packed >> 4) / 15;
    this.handMat.uniforms.uBlock.value = (packed & 15) / 15;
    if (this.handMesh && (this.handMesh.material as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
      const br = Math.max(((packed >> 4) / 15) * this.day, (packed & 15) / 15);
      (this.handMesh.material as THREE.MeshBasicMaterial).color.setRGB(0.78 * br + 0.05, 0.6 * br + 0.04, 0.47 * br + 0.03);
    }
  }

  // ---------------- input ----------------
  private bindInput() {
    const c = this.canvas;
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === c;
      if (this.pointerLocked) this.everLocked = true;
      if (!this.pointerLocked && this.screen === "playing") this.setScreen("paused");
      if (this.pointerLocked && (this.screen === "paused" || this.screen === "title")) this.setScreen("playing");
      this.keys.clear();
      this.leftDown = this.rightDown = false;
      this.notify();
    });
    document.addEventListener("pointerlockerror", () => this.onLockFailed());
    document.addEventListener("mousemove", (e) => {
      if (this.screen !== "playing") return;
      if (!this.pointerLocked && !(this.lockFailed && this.dragging)) return;
      const sens = 0.0022;
      this.player.yaw -= e.movementX * sens;
      this.player.pitch -= e.movementY * sens;
      this.player.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.player.pitch));
    });
    c.addEventListener("mousedown", (e) => {
      if (this.screen !== "playing" || !(this.pointerLocked || this.lockFailed)) return;
      e.preventDefault();
      this.dragging = true;
      if (e.button === 0) { this.leftDown = true; if (this.attack()) this.breakCooldown = 0.2; }
      if (e.button === 2) { this.rightDown = true; this.placeTimer = 0; }
      if (e.button === 1 && this.target) {
        // pick block
        const inv = this.player.inventory;
        const idx = inv.slots.findIndex((s, i) => i < 9 && s && s.id === this.target!.id);
        if (idx >= 0) inv.selected = idx;
        else if (this.player.flying) { inv.slots[inv.selected] = { id: this.target.id, count: 64 }; }
        inv.touch();
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.leftDown = false;
      if (e.button === 2) this.rightDown = false;
      if (!e.buttons) this.dragging = false;
    });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("wheel", (e) => {
      if (this.screen !== "playing") return;
      const inv = this.player.inventory;
      inv.selected = (inv.selected + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      inv.touch();
    }, { passive: true });
    document.addEventListener("keydown", (e) => {
      if (e.code === "F3") { e.preventDefault(); this.debug = !this.debug; this.notify(); return; }
      if (this.screen === "playing") {
        if (e.code === "Escape" && this.lockFailed) { this.setScreen("paused"); return; }
        this.keys.add(e.code);
        if (e.code.startsWith("Digit")) {
          const n = parseInt(e.code.slice(5));
          if (n >= 1 && n <= 9) { this.player.inventory.selected = n - 1; this.player.inventory.touch(); }
        }
        if (e.code === "KeyE") { this.openInventory(); }
        if (e.code === "KeyF") { this.player.toggleFly(); this.showMessage(this.player.flying ? "Flying enabled" : "Flying disabled"); }
        if (e.code === "KeyQ") this.dropSelected();
        if (e.code === "KeyW" && !e.repeat) {
          const now = performance.now();
          if (now - this.player.lastSpaceTap < 300) this.player.sprinting = true;
          this.player.lastSpaceTap = now;
        }
        if (e.code === "Space" || e.code === "Tab") e.preventDefault();
      } else if (this.screen === "inventory" || this.screen === "crafting") {
        if (e.code === "KeyE" || e.code === "Escape") this.closeUI();
      }
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("resize", () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
    window.addEventListener("blur", () => this.keys.clear());
  }

  lockFailed = false;
  private dragging = false;
  requestLock() {
    if (this.lockFailed) { this.setScreen("playing"); return; }
    try {
      const p = (this.canvas.requestPointerLock as unknown as () => Promise<void> | undefined).call(this.canvas);
      if (p && typeof p.catch === "function") p.catch(() => this.onLockFailed());
    } catch {
      this.onLockFailed();
    }
  }
  private everLocked = false;
  private onLockFailed() {
    if (this.lockFailed) return;
    if (this.everLocked) { this.showMessage("Click again to capture the mouse"); return; }
    this.lockFailed = true;
    this.showMessage("Pointer lock unavailable — drag with the mouse to look around");
    if (this.screen === "title" || this.screen === "paused") this.setScreen("playing");
  }
  play() {
    if (this.screen === "dead") return;
    this.requestLock();
    sfx.click();
  }
  respawn() {
    this.player.respawn();
    this.setScreen("paused");
    this.requestLock();
  }
  dropSelected() {
    const s = this.player.inventory.selectedStack();
    if (!s) return;
    const eye = this.player.getEye(), dir = this.player.getDir();
    const vel = dir.clone().multiplyScalar(7).add(new THREE.Vector3(0, 2, 0));
    this.items.spawn(s.id, 1, eye.x + dir.x * 0.3, eye.y - 0.3, eye.z + dir.z * 0.3, vel, 1.5);
    this.player.inventory.consumeSelected(1);
  }

  // ---------------- inventory / crafting UI ----------------
  openInventory() {
    this.craftSize = 2;
    this.craftGrid = new Array(4).fill(null);
    this.setScreen("inventory");
    document.exitPointerLock();
  }
  openCrafting() {
    this.craftSize = 3;
    this.craftGrid = new Array(9).fill(null);
    this.setScreen("crafting");
    document.exitPointerLock();
  }
  closeUI() {
    const inv = this.player.inventory;
    for (let i = 0; i < this.craftGrid.length; i++) {
      const s = this.craftGrid[i];
      if (s) { const left = inv.add(s.id, s.count); if (left > 0) this.dropAt(s.id, left); this.craftGrid[i] = null; }
    }
    if (this.cursor) { const left = inv.add(this.cursor.id, this.cursor.count); if (left > 0) this.dropAt(this.cursor.id, left); this.cursor = null; }
    inv.touch();
    this.setScreen("paused");
    this.requestLock();
  }
  private dropAt(id: number, count: number) {
    const eye = this.player.getEye(), dir = this.player.getDir();
    this.items.spawn(id, count, eye.x + dir.x, eye.y - 0.3, eye.z + dir.z, dir.clone().multiplyScalar(3), 1);
  }
  craftResult(): ItemStack | null {
    const rec = matchRecipe(this.craftGrid, this.craftSize);
    return rec ? { ...rec.result } : null;
  }
  private consumeGrid() {
    for (let i = 0; i < this.craftGrid.length; i++) {
      const s = this.craftGrid[i];
      if (s) { s.count--; if (s.count <= 0) this.craftGrid[i] = null; }
    }
  }
  slotClick(container: "inv" | "craft" | "result", index: number, button: number, shift: boolean) {
    const inv: Inventory = this.player.inventory;
    sfx.click();
    if (container === "result") {
      const rec = matchRecipe(this.craftGrid, this.craftSize);
      if (!rec) return;
      const res = rec.result;
      if (shift) {
        for (let n = 0; n < 64; n++) {
          const r2 = matchRecipe(this.craftGrid, this.craftSize);
          if (!r2 || r2 !== rec) break;
          if (inv.add(res.id, res.count) > 0) break;
          this.consumeGrid();
        }
      } else {
        if (this.cursor && (this.cursor.id !== res.id || this.cursor.count + res.count > itemMaxStack(res.id))) return;
        if (!this.cursor) this.cursor = { id: res.id, count: res.count };
        else this.cursor.count += res.count;
        this.consumeGrid();
      }
      inv.touch();
      this.notify();
      return;
    }
    const slots = container === "inv" ? inv.slots : this.craftGrid;
    const s = slots[index];
    if (shift) {
      if (!s) return;
      if (container === "craft") {
        const left = inv.add(s.id, s.count);
        slots[index] = left > 0 ? { id: s.id, count: left } : null;
      } else {
        const from = index < 9 ? [9, 36] : [0, 9];
        let count = s.count;
        const max = itemMaxStack(s.id);
        for (let i = from[0]; i < from[1] && count > 0; i++) {
          const t = inv.slots[i];
          if (t && t.id === s.id && t.count < max) { const n = Math.min(max - t.count, count); t.count += n; count -= n; }
        }
        for (let i = from[0]; i < from[1] && count > 0; i++) {
          if (!inv.slots[i]) { inv.slots[i] = { id: s.id, count }; count = 0; }
        }
        slots[index] = count > 0 ? { id: s.id, count } : null;
      }
      inv.touch();
      this.notify();
      return;
    }
    if (button === 0) {
      if (!this.cursor) { if (s) { this.cursor = s; slots[index] = null; } }
      else if (!s) { slots[index] = this.cursor; this.cursor = null; }
      else if (s.id === this.cursor.id) {
        const max = itemMaxStack(s.id);
        const n = Math.min(max - s.count, this.cursor.count);
        s.count += n; this.cursor.count -= n;
        if (this.cursor.count <= 0) this.cursor = null;
      } else { slots[index] = this.cursor; this.cursor = s; }
    } else {
      if (!this.cursor) {
        if (s) { const half = Math.ceil(s.count / 2); this.cursor = { id: s.id, count: half }; s.count -= half; if (s.count <= 0) slots[index] = null; }
      } else if (!s) { slots[index] = { id: this.cursor.id, count: 1 }; this.cursor.count--; if (this.cursor.count <= 0) this.cursor = null; }
      else if (s.id === this.cursor.id && s.count < itemMaxStack(s.id)) { s.count++; this.cursor.count--; if (this.cursor.count <= 0) this.cursor = null; }
    }
    inv.touch();
    this.notify();
  }
  dropCursor() {
    if (!this.cursor) return;
    this.dropAt(this.cursor.id, this.cursor.count);
    this.cursor = null;
    this.notify();
  }
  biomeName(): string {
    const info = this.terrain.column(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z));
    return Biome[info.biome];
  }
}
