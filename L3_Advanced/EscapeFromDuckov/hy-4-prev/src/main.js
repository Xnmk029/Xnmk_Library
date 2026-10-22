// 启动入口：装配世界 → 接线系统 → 主循环。
// M0 目标：双击 dist/index.html 就能在正交 3D 场景里操控一只战术萌鸭。
import * as THREE from 'three';
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { bus, noise } from './core/events.js';
import { CameraRig } from './render/camera.js';
import { Renderer } from './render/renderer.js';
import { Lights } from './render/lights.js';
import { SceneView } from './render/scene.js';
import { PlayerView } from './render/entities.js';
import { FogOfWar } from './render/fow.js';
import { EnemyView } from './render/enemies.js';
import { Flashlight } from './render/flashlight.js';
import { Tracers } from './render/tracers.js';
import { World } from './systems/world.js';
import { Vision, sightRange, castRay } from './systems/vision.js';
import { Pathfinder } from './systems/pathfind.js';
import { Combat, makeWeapon } from './systems/combat.js';
import { Weather, updateBodyTemp } from './systems/weather.js';
import { Director } from './systems/director.js';
import { Hideout } from './systems/hideout.js';
import { Health } from './systems/health.js';
import { save as saveGame, load as loadSave, snapshot, restore, SAVE_VERSION } from './core/save.js';
import { Inventory, searchContainer, useItem } from './systems/inventory.js';
import { Hud } from './ui/hud.js';
import { Panels } from './ui/panels.js';
import { showHelp, toast } from './ui/screens.js';
import { wireEvents, onExtracted } from './game/actions.js';
import { bootGame } from './game/boot.js';
import { armorMitigation, resolveHit } from './systems/pure/ballistics.js';
import { weaponStats } from './systems/pure/statPipeline.js';
import { Player } from './entities/player.js';
import { spawnEnemies, Corpse } from './entities/enemy.js';
import { Rng } from './core/rng.js';
import { MAP_BY_ID, MAPS } from './data/maps.js';
import { warmTextures } from './gfx/textures/proc.js';
import { installHooks } from './debug/hooks.js';
import { TIME, daylightT } from './data/balance.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

class Game {
  constructor() {
    this.host = $('app');
    this.time = 0;                 // 真实累计秒（着色器用）
    this.minutes = TIME.dayStartHour * 60;   // 游戏内分钟
    this.day = 1;
    this.aimPoint = new THREE.Vector3();
    this.aim = { x: 0, z: 1 };
    this.clock = this;             // hooks 兼容
    this.torchOn = false;
    this.thermalOn = false;
    this.weatherMul = 1;
    this.sight = 22;
    this.noise = noise;             // 暴露给调试与自动化测试
    this.saveVersion = SAVE_VERSION;
    // 纯函数的测试缝：数值公式必须能被独立断言，不能只靠"看着差不多"
    this.pure = { armorMitigation, resolveHit, weaponStats };
  }

  async boot() {
    bootGame(this, params);
    this.loop = new Loop({
      step: (dt, gdt) => this.step(dt, gdt),
      render: (alpha) => this.renderOnce(alpha),
      onSecond: (fps) => this.onSecond(fps),
    });
    this.bindWindow();
    this.buildMenu();
    installHooks(this);
    // 首帧：先离屏渲染一次，避免菜单背景是黑的
    this.renderOnce(1);
    setTimeout(() => $('loading')?.classList.add('off'), 120);
    if (params.get('autostart') === '1') this.startRun();
  }

  buildWorld(id) {
    const def = MAP_BY_ID[id] || MAPS[0];
    this.world = new World(def);
    this.mapDef = def;
  }

  // ---------------- 物品与交互 ----------------
  /**
   * 取得武器实例（含改装与弹药）。实例挂在物品对象上，
   * 这样物品在背包格 ↔ 装备槽之间来回移动时，改装与余弹不会丢。
   */
  weaponInstance(itemOrUid) {
    const it = typeof itemOrUid === 'object' ? itemOrUid : this.findItem(itemOrUid);
    if (!it) return null;
    if (!it._weapon) {
      it._weapon = makeWeapon(it.id, { ammo: 0 });
      it._weapon.mag = 0;
    }
    return it._weapon;
  }

  /** 按 uid 找物品：装备槽与背包都要找（装备后的物品已不在网格里） */
  findItem(uid) {
    if (this.inventory.grid.items.has(uid)) return this.inventory.grid.items.get(uid);
    for (const s of ['primary', 'secondary', 'melee', 'head', 'body', 'backpack']) {
      const it = this.inventory.loadout.get(s);
      if (it && it.uid === uid) return it;
    }
    return null;
  }

  useItemById(uid) { return useItem(uid, this); }

  /** 同步"当前手持"：装备栏变化后把 combat 指向正确的武器实例 */
  syncEquipped() {
    const inv = this.inventory;
    const pri = inv.loadout.get('primary') || inv.loadout.get('secondary') || inv.loadout.get('melee');
    if (!pri) { this.equipped = null; return; }
    const w = this.weaponInstance(pri);
    if (w) this.equipped = w;
  }

  /** X 键：主/副/近战轮换 */
  swapWeapon() {
    const inv = this.inventory;
    const pool = ['primary', 'secondary', 'melee'].map((s) => inv.loadout.get(s)).filter(Boolean);
    if (pool.length < 2) { toast('没有可切换的武器'); return; }
    const idx = pool.findIndex((p) => this.weaponInstance(p) === this.equipped);
    const next = pool[(idx + 1) % pool.length];
    this.equipped = this.weaponInstance(next);
    toast(`切换到 ${next.id.toUpperCase()}`);
  }

  /** 找最近的可交互目标（容器 / 尸体） */
  findInteractable() {
    const p = this.player;
    let best = null, bd = 2.2;
    for (const c of this.world.containers) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) { bd = d; best = { kind: 'container', ref: c }; }
    }
    for (const c of this.corpses) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) { bd = d; best = { kind: 'corpse', ref: c }; }
    }
    return best;
  }

  interact() {
    const t = this.findInteractable();
    if (!t) return;
    if (t.kind === 'container') {
      if (!t.ref.loot) {
        t.ref.loot = searchContainer(t.ref, this.world.def.lootTable, this.rng, this.traits?.lucky ?? 0);
        this.searched = (this.searched || 0) + 1;
      }
      this.panels.showContainer(t.ref);
    } else {
      if (!t.ref.loot) t.ref.loot = [];
      t.ref.searched = true;
      this.panels.showContainer({ name: '尸体', loot: t.ref.loot });
    }
  }

  bindWindow() {
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.loop.reset();
    });
    window.addEventListener('pointerdown', () => this.audio?.resume?.(), { once: true });
  }

  onResize() { this.renderer.resize(); }

  buildMenu() {
    const btns = $('menuBtns');
    const mk = (label, fn, cls = 'btn') => {
      const b = document.createElement('button');
      b.className = cls; b.textContent = label;
      b.onclick = fn; btns.appendChild(b); return b;
    };
    mk('开始游戏', () => this.startRun(), 'btn primary');
    mk('继续（读档）', () => this.startRun(true)).disabled = true;
    mk('操作说明', () => this.showHelp());
    $('menuTip').innerHTML = [
      'WASD 移动 · 鼠标瞄准 · 左键开火 · 右键稳定瞄准',
      'Shift 冲刺 · Ctrl/C 潜行 · 空格 翻滚（无敌帧）',
      'R 装填 · F 交互搜刮 · Q 手电 · T 热成像 · Tab 背包',
    ].join('<br>');
  }

  showHelp() { showHelp(); }

  startRun(loadSaved = false) {
    $('menuWrap')?.classList.add('off');
    if (loadSaved) {
      const s = loadSave();
      if (s && restore(this, s.data)) this.toast('已读取存档', 'good');
    }
    this.running = true;
    this.loop.start();
    this.saveTimer = 0;
  }

  /** 落盘：每 30 秒自动一次，关键节点（撤离/阵亡）立即写 */
  saveNow() {
    try {
      const ok = saveGame(snapshot(this));
      if (!ok) this.toast('存档写入失败（已暂存内存）', 'bad');
      return ok;
    } catch (e) {
      console.warn('[save] 失败', e);
      return false;
    }
  }

  // ---------------- 模拟 ----------------
  step(dt, gameDt) {
    this.time += dt;
    this.minutes += gameDt;
    while (this.minutes >= 1440) { this.minutes -= 1440; this.day++; }

    const p = this.player;
    const i = this.input.intent;

    // 鼠标 → 地面瞄准点
    this.rig.screenToGround(this.input.mouse.nx, this.input.mouse.ny, this.aimPoint);
    this.aim.x = this.aimPoint.x - p.x;
    this.aim.z = this.aimPoint.z - p.z;
    const l = Math.hypot(this.aim.x, this.aim.z) || 1;
    this.aim.x /= l; this.aim.z /= l;

    if (this.input.hit('flashlight')) this.torchOn = !this.torchOn;
    if (this.input.hit('thermal')) {
      this.thermalOn = !this.thermalOn;
      this.renderer.setThermal(this.thermalOn);
    }
    if (this.input.hit('inventory')) this.panels.open === 'inventory' ? this.panels.close() : this.panels.showInventory();
    if (this.input.hit('health')) this.panels.open === 'health' ? this.panels.close() : this.panels.showHealth();
    if (this.input.hit('interact')) this.interact();
    if (this.input.hit('swap')) this.swapWeapon();

    // 移动速度受腿部伤势 / 骨折 / 失血 / 体力共同影响（僵毁式耦合）
    const pen = this.health.penalties;
    p.update(dt, i, this.aimPoint, pen.moveMul, !this.health.moodles.endurance || this.health.moodles.endurance < 3);

    this.lights.setDayNight(daylightT(this.minutes), this.mapDef.ambientLight ?? 1);
    this.lights.follow(p.x, p.z);

    // 视野多边形是玩家视距、迷雾蒙版、AI 感知三者的共同输入
    this.sight = sightRange(this.lights.dayK ?? 1, this.weather.sightMul, this.torchOn, this.thermalOn);
    this.vision.cast(p.x, p.z, p.aim, this.sight);
    this.vision.update(this.tracked, p.x, p.z, p.aim, this.sight, dt);
    this.lights.setTorch(this.torchOn, p.x, p.z, this.aim.x, this.aim.z);

    // ---- 敌人 AI ----
    const ctx = { world: this.world, player: p, field: noise, pathfinder: this.pathfinder, dt };
    for (const e of this.enemies) e.update(dt, ctx);
    for (const c of this.corpses) c.update(dt, gameDt / 60);

    // ---- 玩家开火 / 近战 / 装填 ----
    this.combat.update(dt, i);

    // ---- 天气 / 体温 / 战局导演 ----
    this.weather.update(dt);
    if (gameDt >= 1 / 60) this.weather.updateHours(gameDt / 60);
    const amb = this.weather.ambientTemp(this.lights.dayK ?? 1, this.day);
    updateBodyTemp(this.health.body, amb, gameDt / 60, {
      clothing: this.inventory.loadout.armorLevel * 0.35,
      wind: this.weather.wind,
      indoors: this.playerIndoors,
    });
    this.director.update(dt, gameDt);

    // ---- 角色状态：可视敌人 → 恐慌；伤病 → 惩罚；负重 → 掉血 ----
    this.visibleZombieCount = this.enemies.reduce((n, e) => n + (e.alive && e.seen ? 1 : 0), 0);
    this.carriedWeight = this.inventory.weight;
    this.carryCapacity = this.inventory.capacity;
    const drain = this.inventory.overloadDrain(dt);
    if (drain > 0) this.health.body.blood -= drain * 60;
    this.health.update(dt, gameDt / 60);
    p.hp = this.health.totalPct * 100;
    this.updateInteractPrompt();

    this.saveTimer += dt;
    if (this.saveTimer > 30) { this.saveTimer = 0; this.saveNow(); }

    noise.update(dt);
    this.input.endFrame();
  }

  // ---------------- 渲染 ----------------
  renderOnce(alpha) {
    const p = this.player;
    this.rig.follow(p.x, p.z, 1 / 60, this.aim.x, this.aim.z);
    this.rig.update(1 / 60);
    this.playerView.update(p, alpha, 1 / 60, this.time);
    this.view.update(1 / 60, this.time);
    this.view.updateDynamic(this.vision);
    this.enemyView.update(this.enemies, this.corpses, alpha, 1 / 60, this.time, this.thermalOn);
    this.flashlight.update(1 / 60, this.time, this.torchOn, this.world, p.x, p.z, this.aim.x, this.aim.z);
    this.tracers.update(this.combat.tracers, 1 / 60, this.time);
    this.particles.update(1 / 60);
    if (this.thermalOn) this.heat.update(this.heatSources(), this.time, this.rig.camWorld.quaternion);
    this.updateWeatherFx();
    this.fow.update(p.x, p.z, this.vision.poly, this.vision.polyCount, this.sight, this.vision.hash, 1 / 60);
    this.renderer.render(1 / 60, this.time);
    this.hud.update();
    this.updateDamageNumbers();
  }

  /**
   * 热成像热源：活体（含隐身怪）与近期开火的枪口都算热源。
   * 热源层 depthTest=false，所以能穿墙 —— 这正是"热成像看穿浓烟与夜色"的落点。
   */
  heatSources() {
    const out = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - this.player.x, e.z - this.player.z);
      if (d > 46) continue;
      out.push({ x: e.x, z: e.z, y: 0.7 * (e.scale ?? 1), r: 0.95 * (e.scale ?? 1) });
    }
    for (const c of this.corpses) {
      if (c.rot >= 1) continue;                  // 完全腐烂就没有余热了
      out.push({ x: c.x, z: c.z, y: 0.28, r: 0.6 * (1 - c.rot * 0.5) });
    }
    // 玩家自己的体温也要有 —— 否则热成像下会显得自己不存在
    out.push({ x: this.player.x, z: this.player.z, y: 0.72, r: 0.8 });
    return out;
  }

  /** 把天气状态喂给雨幕 pass（关闭后期时整体跳过） */
  updateWeatherFx() {
    const p = this.renderer.passRain;
    if (!p) return;
    const w = this.weather;
    const on = this.fxOn && (w.rainAmount > 0.01 || w.flash > 0.01);
    p.enabled = on;
    if (!on) return;
    p.uniforms.uAmount.value = w.rainAmount;
    p.uniforms.uStorm.value = w.stormAmount;
    p.uniforms.uFlash.value = w.flash * 0.6;
    p.uniforms.uWind.value = w.wind;
  }

  /** 交互提示：靠近容器/尸体时显示 F 键提示 */
  updateInteractPrompt() {
    const el = $('prompt');
    if (!el) return;
    const t = this.findInteractable();
    if (!t) { el.classList.remove('on'); return; }
    const label = t.kind === 'container' ? '搜刮容器' : '搜刮尸体';
    el.innerHTML = `<kbd>F</kbd> ${label}`;
    el.classList.add('on');
  }

  /** 世界坐标伤害飘字（DOM 复用，避免每帧新建节点） */
  updateDamageNumbers() {
    const host = $('dmgNum');
    if (!host) return;
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.life -= 1 / 60;
      if (d.life <= 0) { d.el?.remove(); this.damageNumbers.splice(i, 1); continue; }
      if (!d.el) {
        d.el = document.createElement('div');
        d.el.className = 'dnum';
        if (d.crit) { d.el.style.fontSize = '17px'; d.el.style.color = '#ffd23f'; }
        if (d.v < 0) d.el.style.color = '#ff7a6a';
        d.el.textContent = (d.v > 0 ? '' : '') + Math.abs(d.v);
        host.appendChild(d.el);
      }
      const s = this.rig.worldToScreen(d.x, 1.2, d.z, w, h);
      d.el.style.left = `${s.x}px`;
      d.el.style.top = `${s.y}px`;
      d.el.style.opacity = String(Math.min(1, d.life * 1.6));
      if (!s.vis) d.el.style.display = 'none';
    }
  }

  onSecond(fps) {
    if (fps < 45 && this.loop.frames > 240) {
      // 性能保护：连续低帧时自动缩小像素比
      const pr = this.renderer.renderer.getPixelRatio();
      if (pr > 1) this.renderer.renderer.setPixelRatio(Math.max(1, pr - 0.25));
    }
  }
}

// ---------------- 引导 ----------------
const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  const f = $('fatal'), m = $('fatalMsg');
  if (f && m) { f.classList.add('on'); m.textContent = (e && (e.stack || e.message)) || String(e); }
  $('loading')?.classList.add('off');
});
window.__DUCKBOID = game;
