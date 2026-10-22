import * as THREE from 'three';
import { clamp, TAU } from './util.js';
import { HALF, WORLD_SIZE } from './world.js';
import { World } from './world.js';
import { Renderer, FOV_TEX } from './renderer.js';
import { PostFX } from './postfx.js';
import { AudioMan } from './audio.js';
import { Env } from './env.js';
import { Player } from './player.js';
import { ZombieManager } from './zombie.js';
import { Interact } from './interact.js';
import { Loot } from './loot.js';
import { Crafting } from './craft.js';
import { bus } from './bus.js';
import { RNG } from './util.js';

// ================= 游戏编排 =================
export class Game {
  constructor() {
    this.cfg = defaultCfg();
    this.now = 0;
    this.dt = 0.016;
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.rng = new RNG(this.seed);
    this.texCache = {};
    this.events = bus;
    this.pendingNoise = [];
    this.state = 'menu'; // menu | playing | paused | dead | won
    this.viewMode = 0;
    this.speed = 1;
    this.saveTimer = 0;
    this.fovTimer = 0;
    this.killCount = 0;
    this.WORLD_SIZE = WORLD_SIZE;
    this.dayLengthRealHours = 0.67; // 40 分钟一天
    window.addEventListener('error', e => {
      this.lastError = e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno;
      const dbg = document.getElementById('dbg');
      if (dbg) { dbg.classList.remove('hidden'); dbg.textContent = 'ERR: ' + this.lastError; }
      try { console.error('[ZOMDUCK]', this.lastError); } catch (x) {}
    });
  }
  log(msg) { console.log('[ZOMDUCK]', msg); }
  toast(msg, cls = 'info') { this.ui && this.ui.toast(msg, cls); }
  isPlaying() { return this.state === 'playing'; }

  newGame(def) {
    this.seed = this.cfg.seed || Math.floor(Math.random() * 2 ** 31);
    this.rng = new RNG(this.seed);
    this.charDef = def;
    this.state = 'playing';
    this.startGrace = this.now + 60;
    this.killCount = 0;
    this.pendingNoise = [];
    this.wireEvents();
    // 世界
    this.world = new World(this);
    this.world.generate();
    // 渲染
    if (!this.renderer) {
      this.renderer = new Renderer(this);
      this.renderer.init();
      this.postfx = new PostFX(this);
    } else {
      // 重建场景（复用 renderer 上下文）
      this.renderer.rebuildWorld();
    }
    // 音频
    if (!this.audio) this.audio = new AudioMan(this);
    this.audio.init();
    this.audio.startAmbient();
    // 环境
    this.env = new Env(this);
    // 玩家
    const sp = this.world.spawnPoint || { x: HALF + 2, z: HALF + 2 };
    this.player = new Player(this, def);
    this.player.x = sp.x; this.player.z = sp.z;
    this.player.face = Math.PI / 4;
    this.player.aimAngle = Math.PI / 4;
    // 初始装备（职业）
    for (const it of def.startItems || []) this.player.giveItem(it, 1, { silent: true });
    this.player.equip = {};
    // 渲染玩家
    this.renderer.resetExplored();
    this.renderer.buildPlayerMesh(this.player);
    // 交互/战利品/制作
    this.interact = new Interact(this);
    this.loot = new Loot(this);
    this.crafting = new Crafting(this);
    // 丧尸
    this.zombies = new ZombieManager(this);
    this.zombies.init();
    // 任务
    this.quests = this.quests || new QuestManager(this);
    this.quests.init();
    // UI
    this.ui.onGameStart();
    this.ui.updateHand();
    // 开场白
    this.ui.showIntro(def);
    this.lastAutosave = this.now;
    this.running = true;
    if (!this.loopStarted) { this.loopStarted = true; this.loop(performance.now()); }
  }
  // 由 UI 调用：继续（读取存档）
  continueSave(data) {
    this.seed = data.seed;
    this.cfg = { ...this.cfg, ...data.cfg };
    this.charDef = data.charDef;
    this.state = 'playing';
    this.world = new World(this);
    this.world.generate();
    if (!this.renderer) { this.renderer = new Renderer(this); this.renderer.init(); this.postfx = new PostFX(this); }
    else this.renderer.rebuildWorld();
    if (!this.audio) this.audio = new AudioMan(this);
    this.audio.init(); this.audio.startAmbient();
    this.env = new Env(this);
    this.env.day = data.env.day; this.env.hour = data.env.hour;
    this.env.weather = data.env.weather; this.env.powerOn = data.env.powerOn; this.env.waterOn = data.env.waterOn;
    this.player = new Player(this, this.charDef);
    Object.assign(this.player, data.playerPos);
    this.player.stats.deserialize(data.stats);
    this.player.inv = data.inv;
    this.player.equip = data.equip;
    this.player.hotbar = data.hotbar;
    this.player.held = null;
    this.renderer.buildPlayerMesh(this.player);
    this.renderer.updatePlayerGear(this.player);
    this.interact = new Interact(this);
    this.loot = new Loot(this);
    this.crafting = new Crafting(this);
    this.zombies = new ZombieManager(this);
    for (const z of data.zombies) this.zombies.spawn(z.x, z.z, z.kind);
    this.quests = this.quests || new QuestManager(this);
    this.quests.init();
    this.quests.state = data.questState || this.quests.state;
    // 世界状态恢复
    for (const wd of data.walls || []) {
      const w = this.world.wallAt(wd.x, wd.z, wd.bit);
      if (w) Object.assign(w, wd);
    }
    for (const c of this.world.containers) {
      const sc = (data.containers || {})[c.id];
      if (sc) { c.items = sc.items; c.searched = sc.searched; c.rolled = true; }
    }
    this.world.farmPlots = new Map(Object.entries(data.plots || {}));
    for (const [k, f] of Object.entries(data.fires || {})) this.world.addFire(f);
    this.world.car.parts = data.carParts || this.world.car.parts;
    this.ui.onGameStart();
    this.ui.updateHand();
    this.running = true;
    this.loop(performance.now());
  }
  save() {
    if (!this.player) return;
    const data = {
      v: 1, seed: this.seed, cfg: this.cfg, charDef: this.charDef,
      now: this.now,
      env: { day: this.env.day, hour: this.env.hour, weather: this.env.weather, powerOn: this.env.powerOn, waterOn: this.env.waterOn },
      playerPos: { x: this.player.x, z: this.player.z, face: this.player.face },
      stats: this.player.stats.serialize(),
      inv: this.player.inv, equip: this.player.equip, hotbar: this.player.hotbar,
      zombies: this.zombies.list.filter(z => !z.dead).map(z => ({ x: z.x, z: z.z, kind: z.kind })),
      walls: [...this.world.wallObjs.values()].filter(w => w.type === 'door' || w.type === 'window' || w.barricade > 0 || w.smashed).map(w => ({ x: w.x, z: w.z, bit: w.dir, type: w.type, open: w.open, locked: w.locked, hp: w.hp, barricade: w.barricade, curtain: w.curtain, smashed: w.smashed })),
      containers: Object.fromEntries(this.world.containers.filter(c => c.searched || c.items.length).map(c => [c.id, { items: c.items, searched: c.searched }])),
      plots: Object.fromEntries(this.world.farmPlots),
      fires: Object.fromEntries(this.world.fires),
      carParts: this.world.car.parts,
      questState: this.quests.state,
    };
    try { localStorage.setItem('zomduck_save', JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }
  hasSave() { try { return !!localStorage.getItem('zomduck_save'); } catch (e) { return false; } }
  loadSaveData() { try { return JSON.parse(localStorage.getItem('zomduck_save')); } catch (e) { return null; } }

  // ---------- 主循环 ----------
  loop = (tms) => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    if (this.lastTms === undefined) this.lastTms = tms;
    const dtRaw = clamp((tms - this.lastTms) / 1000, 0, 0.05);
    this.lastTms = tms;
    this.dt = dtRaw;
    const dt = dtRaw * this.speed * (this.state === 'playing' ? this.player ? this.player.timeScale : 1 : 0);
    this.now += dt;
    if (this.state === 'playing' && this.player && !this.player.dead) {
      this.input.computeAim();
      this.player.update(dt);
      this.interact.update(dt);
      this.zombies.update(dt);
      this.env.tick(dt);
      this.quests.update(dt);
      this.updateFov();
      this.updateCamera(dt);
      this.consumeNoise();
      // 元事件
      this.metaT = (this.metaT || 0) - dt;
      this.saveTimer += dt;
      if (this.saveTimer > 120) { this.saveTimer = 0; this.save(); }
      this.ui.updateHud(dt);
      // 尸变/死亡
      if (this.player.stats.bodyHealth <= 0) this.events.emit('death', '你的鸭子咽下了最后一口气。');
    }
    if (this.state === 'playing' && this.player) {
      this.env.applyToRenderer(this.renderer);
      this.renderer.render(dt);
      this.updateZombieVisuals();
    }
    this.input.endFrame();
  };
  updateZombieVisuals() {
    for (const z of this.zombies.list) {
      const d = Math.hypot(z.x - this.player.x, z.z - this.player.z);
      if (z.dead) { this.renderer.removeZombieVisual(z); continue; }
      if (d < 60) this.renderer.updateZombieVisual(z, this.dt, this.now);
      else this.renderer.removeZombieVisual(z);
    }
  }
  updateCamera(dt) {
    const p = this.player;
    // 平移
    this.camX = lerp(this.camX ?? p.x, p.x, 1 - Math.pow(0.001, dt));
    this.camZ = lerp(this.camZ ?? p.z, p.z, 1 - Math.pow(0.001, dt));
    // 旋转 Q/V
    this.camYaw = this.camYaw ?? Math.PI / 4;
    const cw = this.input.pressed('camcw'), ccw = this.input.pressed('camccw');
    if (cw) this.camYaw -= 0.05;
    if (ccw) this.camYaw += 0.05;
    // 缩放
    this.camZoom = clamp((this.camZoom ?? 30) + this.input.wheel * 0.02, 16, 48);
    this.renderer.setCameraFollow(this.camX - HALF, this.camZ - HALF, this.camYaw, 1.16, this.camZoom);
  }
  // ---------- FOV ----------
  updateFov() {
    const p = this.player;
    const w = this.world;
    const N = FOV_TEX;
    const d = this.renderer.visData;
    const ex = this.renderer.explData;
    const R = 22 * p.stats.visionMult * (1 - this.env.fog * 0.35);
    const px = p.x, pz = p.z;
    const step = TAU / 460;
    for (let i = 0; i < N * N; i++) { d[i * 4] = 0; d[i * 4 + 3] = 255; }
    const light = 255;
    const marked = new Uint8Array(N * N);
    const pcx = Math.floor(px), pcz = Math.floor(pz);
    const mark = (x, z) => {
      if (!w.inBounds(x, z)) return;
      const idx = (z * N + x) * 4;
      if (d[idx]) return;
      d[idx] = light; d[idx + 1] = light; d[idx + 2] = light;
      marked[z * N + x] = 1;
      if (!ex[idx]) {
        ex[idx] = 130; ex[idx + 1] = 140; ex[idx + 2] = 150; ex[idx + 3] = 255;
      }
    };
    mark(pcx, pcz);
    for (let a = 0; a < 460; a++) {
      const ang = a * step;
      const dx = Math.sin(ang), dz = Math.cos(ang);
      let t = 0;
      let prevX = pcx, prevZ = pcz;
      while (t < R) {
        t += 0.22;
        const wx = px + dx * t, wz = pz + dz * t;
        const cx = Math.floor(wx), cz = Math.floor(wz);
        if (!w.inBounds(cx, cz)) break;
        if (cx !== prevX || cz !== prevZ) {
          // 穿过的边是否有墙
          const cdx = Math.sign(cx - prevX), cdz = Math.sign(cz - prevZ);
          let blocked = false;
          if (cdx !== 0) {
            const wl = w.neighborWall(prevX, prevZ, { dx: cdx, dz: 0, bit: cdx > 0 ? 2 : 8 });
            if (wl && wl.blocksLos()) blocked = true;
          }
          if (cdz !== 0 && !blocked) {
            const wl = w.neighborWall(prevX, prevZ, { dx: 0, dz: cdz, bit: cdz > 0 ? 4 : 1 });
            if (wl && wl.blocksLos()) blocked = true;
          }
          if (blocked) break;
          prevX = cx; prevZ = cz;
        }
        mark(cx, cz);
      }
    }
    // 补洞：可见邻居填充
    for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
      const i = z * N + x;
      if (marked[i]) continue;
      const nb = marked[i - 1] + marked[i + 1] + marked[i - N] + marked[i + N];
      if (nb >= 3) { d[i * 4] = light; d[i * 4 + 1] = light; d[i * 4 + 2] = light; }
    }
    this.renderer.visTex.needsUpdate = true;
    this.renderer.explTex.needsUpdate = true;
  }
  wireEvents() {
    if (this._wired) return;
    this._wired = true;
    this.events.on('noise', ev => { this.pendingNoise.push(ev); });
    this.events.on('metaEvent', () => {
      if (!this.player || !this.zombies) return;
      const type = Math.random() < 0.6 ? 'gunshot' : 'helicopter';
      const a = Math.random() * TAU;
      const d = 40 + Math.random() * 30;
      const x = clamp(this.player.x + Math.cos(a) * d, 10, WORLD_SIZE - 10);
      const z = clamp(this.player.z + Math.sin(a) * d, 10, WORLD_SIZE - 10);
      const moved = this.zombies.metaEventHorde(x, z);
      if (type === 'helicopter') this.toast('🚁 远处传来直升机轰鸣……尸群被吸引了过去', 'warn');
      else this.toast('🔫 远处响起枪声（' + moved + ' 只丧尸循声而去）', 'warn');
    });
    this.events.on('thunder', () => { this.thunderFlash = 0.7; });
  }
  consumeNoise() {
    this.pendingNoise = [];
  }
  emitNoise(x, z, r, type) {
    this.pendingNoise.push({ x, z, r, type });
  }
}

export function defaultCfg() {
  return {
    dayLenHours: 0.67,
    zombiePop: 1.0,
    powerShutoff: 3,
    waterShutoff: 4,
    metaEvents: 1,
    corpseHours: 240,
    volume: 0.8,
    seed: 0,
  };
}
function lerp(a, b, t) { return a + (b - a) * t; }

// ================= 任务系统 =================
export class QuestManager {
  constructor(game) {
    this.game = game;
    this.state = { survive3: false, repairBattery: false, repairFuel: false, repairEngine: false, escaped: false };
  }
  init() {
    const g = this.game;
    this.defs = [
      { id: 'survive3', name: '活过三天', desc: '在末日的前三天活下来。这个世界不会怜悯任何一只鸭子。', objs: [() => ({ text: '存活 ' + g.env.day + ' / 3 天', ok: g.env.day >= 3 })], done: () => g.env.day >= 3 },
      { id: 'repair', name: '修好撤离车辆', desc: '东部公路检查站旁停着一辆还能用的车。找到蓄电池、汽油与引擎零件，修好它。', objs: [
        () => ({ text: '蓄电池：' + (g.world.car.parts.battery ? '✔' : '未找到'), ok: g.world.car.parts.battery }),
        () => ({ text: '汽油：' + (g.world.car.parts.fuel ? '✔' : '未找到'), ok: g.world.car.parts.fuel }),
        () => ({ text: '引擎零件：' + (g.world.car.parts.engine ? '✔' : '未找到'), ok: g.world.car.parts.engine }),
      ], done: () => g.world.car.parts.battery && g.world.car.parts.fuel && g.world.car.parts.engine },
      { id: 'escape', name: '逃离鸭科夫', desc: '发动车辆，穿过检查站，把这个世界抛在身后。', objs: [() => ({ text: '抵达东部撤离点并发动车辆', ok: this.state.escaped })], done: () => this.state.escaped },
    ];
  }
  update(dt) {
    const g = this.game;
    if (!this.state.survive3 && g.env.day >= 3) {
      this.state.survive3 = true;
      g.toast('🏆 目标达成：活过三天', 'good');
      g.player.stats.daysSurvived = g.env.day;
    }
  }
  list() { return this.defs || []; }
  objective() {
    const g = this.game;
    if (!this.state.survive3) return '活过三天（第 ' + g.env.day + ' 天）';
    const c = g.world.car.parts;
    const missing = [];
    if (!c.battery) missing.push('蓄电池');
    if (!c.fuel) missing.push('汽油');
    if (!c.engine) missing.push('引擎零件');
    if (missing.length) return '修车还需：' + missing.join('、');
    return '车辆已修好！前往东部撤离点发动车辆';
  }
}
