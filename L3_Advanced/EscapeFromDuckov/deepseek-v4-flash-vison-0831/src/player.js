import { clamp, lerp, TAU, dist2 } from './util.js';
import { HALF, DIRS } from './world.js';
import { ITEMS } from './items.js';
import { Stats } from './status.js';

// ================= 玩家：移动 / 战斗 / 背包 =================
export class Player {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.stats = new Stats(game, this, def);
    this.inv = [];
    this.equip = {};
    this.hotbar = new Array(8).fill(null);
    this.held = null; // { item, slot: 'inv'|'hotbar', idx }
    this.x = 0; this.z = 0; this.face = Math.PI / 4;
    this.aimAngle = Math.PI / 4;
    this.moving = false; this.running = false; this.crouching = false;
    this.sneaking = false;
    this.attackT = 0; this.fireT = 0; this.reloadT = 0; this.aimT = 0;
    this.rollT = 0; this.rollCd = 0; this.rollDir = { x: 0, z: 0 };
    this.flashOn = false;
    this.lastStepNoise = 0;
    this.interacting = false;
    this.vaultT = 0; this.vaultFrom = null; this.vaultTo = null;
    this.dead = false;
    this.timeScale = 1;
    this.inventoryOpen = false;
    this.viewMode = 0;
    this.reloadTarget = null;
    this.attachments = {}; // slot -> item
  }
  // ---------- 背包 ----------
  weight() { return this.inv.reduce((s, i) => s + i.item.weight * i.n, 0); }
  bagCapacity() {
    const bag = this.equip.back;
    const base = bag ? bag.item.cap : 8;
    return base * this.stats.bagCapMult;
  }
  totalWeight() { return this.weight() + this.weightEquipped(); }
  weightEquipped() { return Object.values(this.equip).reduce((s, e) => s + (e ? e.item.weight : 0), 0); }
  isOverweight() { return this.totalWeight() > this.stats.maxCarry; }
  findItem(id) { return this.inv.find(i => i.item.id === id); }
  countItem(id) { return this.inv.reduce((s, i) => i.item.id === id ? s + i.n : s, 0); }
  giveItem(id, n = 1, opts = {}) {
    const def = ITEMS[id];
    if (!def) return false;
    if (def.stack || opts.stack) {
      const ex = this.inv.find(i => i.item.id === id && (i.item.maxStack === undefined || i.n < i.item.maxStack));
      if (ex) { const add = Math.min(n, 99); ex.n += add; n -= add; }
      while (n > 0) {
        const add = Math.min(n, def.maxStack || 99);
        this.inv.push({ item: { ...def, id }, n: add, uid: Math.random().toString(36).slice(2) });
        n -= add;
      }
    } else {
      for (let i = 0; i < n; i++) {
        const stack = { item: mkInstance(def), n: 1, uid: Math.random().toString(36).slice(2) };
        this.inv.push(stack);
      }
    }
    if (!opts.silent) this.game.toast('+ ' + def.icon + ' ' + def.name + (n > 1 ? ' ×' + n : ''), 'good');
    if (this.game.ui) this.game.ui.invDirty = true;
    return true;
  }
  takeItem(stack, n = 1) {
    if (stack.n <= n) { this.inv.splice(this.inv.indexOf(stack), 1); }
    else stack.n -= n;
    if (this.held && this.held.slot === 'inv' && !this.inv.includes(this.held.stack)) { this.held = null; }
    this.game.ui && (this.game.ui.invDirty = true);
  }
  hasTool(tool) {
    if (tool === 'nails' || tool === 'plank' || tool === 'rsheet') return this.countItemByIdTool(tool) > 0;
    const t = ITEMS[tool];
    if (this.inv.find(i => i.item.tool === tool)) return true;
    if (this.equip && Object.values(this.equip).some(e => e && e.item.tool === tool)) return true;
    if (this.held && this.held.item.tool === tool) return true;
    return false;
  }
  countItemByIdTool(tool) { return this.inv.reduce((s, i) => i.item.tool === tool ? s + i.n : s, 0); }
  consumeToolItem(tool, n = 1) {
    const st = this.inv.find(i => i.item.tool === tool && i.n >= n);
    if (!st) return false;
    st.n -= n; if (st.n <= 0) this.inv.splice(this.inv.indexOf(st), 1);
    this.game.ui && (this.game.ui.invDirty = true);
    return true;
  }
  // ---------- 主手 ----------
  setHeld(stack, slot = 'inv', idx = -1) {
    if (this.held && this.held.slot === 'inv') { /* 原持有物留在背包 */ }
    this.held = stack ? { stack, item: stack.item, slot, idx } : null;
    this.reloadT = 0; this.aimT = 0;
    this.game.ui && this.game.ui.updateHand();
    this.game.renderer && this.game.renderer.updatePlayerWeapon(this);
  }
  // ---------- 更新 ----------
  update(dt) {
    if (this.dead) return;
    const g = this.game, st = this.stats;
    const input = g.input;
    // 翻滚
    if (this.rollT > 0) {
      this.rollT -= dt;
      const sp = 7.5 * st.rollMult;
      const r = g.world.moveCircle(this.x, this.z, 0.3, this.rollDir.x * sp * dt, this.rollDir.z * sp * dt);
      this.x = r.x; this.z = r.z;
      if (this.rollT <= 0) { g.events.emit('rollend'); }
      return;
    }
    this.rollCd = Math.max(0, this.rollCd - dt);
    // 交互阻断移动
    const busy = this.interacting || this.reloadT > 0 || this.attackT > 0;
    let dx = 0, dz = 0;
    if (!busy) {
      dx = (input.down('d') ? 1 : 0) - (input.down('a') ? 1 : 0);
      dz = (input.down('s') ? 1 : 0) - (input.down('w') ? 1 : 0);
    }
    this.moving = (dx !== 0 || dz !== 0) && !busy;
    this.running = this.moving && input.down('shift') && st.stamina > 5;
    this.crouching = input.down('c');
    this.sneaking = this.crouching || input.down('alt');
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; this.face = Math.atan2(dx, dz); }
    let speed = this.running ? 5.1 : this.sneaking ? 1.9 : 3.4;
    if (st.stamina < 20) speed *= 0.72;
    speed *= st.moveSpeedMult;
    const invW = this.isOverweight();
    if (invW) speed *= clamp(1 - (this.totalWeight() - st.maxCarry) * 0.07, 0.45, 1);
    if (this.moving) {
      const r = g.world.moveCircle(this.x, this.z, 0.28, dx * speed * dt, dz * speed * dt);
      this.x = r.x; this.z = r.z;
      // 脚步噪音
      const noiseBase = this.running ? 14 : this.sneaking ? 3.4 : 8;
      const noise = noiseBase * st.noiseMult * st.sneakNoiseMult * (this.equip.shoes && this.equip.shoes.item.stepNoise ? this.equip.shoes.item.stepNoise : 1);
      if (g.now - this.lastStepNoise > (this.running ? 0.34 : this.sneaking ? 0.8 : 0.5)) {
        this.lastStepNoise = g.now;
        g.events.emit('noise', { x: this.x, z: this.z, r: noise, type: 'footstep' });
        g.audio.footstep(this.sneaking);
      }
    }
    // 瞄准角度：鼠标
    this.aimAngle = input.aimAngle !== null ? input.aimAngle : this.face;
    // 翻滚触发
    if (input.pressed('roll') && this.rollCd <= 0 && st.stamina > 12 && !busy) {
      this.rollT = 0.26;
      this.rollCd = 1.1;
      const dir = this.moving ? { x: dx, z: dz } : { x: Math.sin(this.face), z: Math.cos(this.face) };
      const l = Math.hypot(dir.x, dir.z) || 1;
      this.rollDir = { x: dir.x / l, z: dir.z / l };
      st.stamina = clamp(st.stamina - 14 * st.rollStamMult, 0, 100);
      g.audio.roll();
      g.events.emit('roll');
    }
    // 攻击
    this.attackT = Math.max(0, this.attackT - dt);
    this.fireT = Math.max(0, this.fireT - dt);
    const attacking = input.down('attack') || input.down('attack2');
    if (attacking) {
      const w = this.held && this.held.item;
      if (w && w.type === 'gun') this.tryFire(dt);
      else if (this.attackT <= 0) this.meleeSwing();
    }
    if (input.down('aim')) { this.aimT += dt; } else this.aimT = Math.max(0, this.aimT - dt * 2);
    // 换弹
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    // 手电
    if (input.pressed('flashlight')) this.flashOn = !this.flashOn;
    // 负重惩罚提示
    this.stats.tick(dt);
    // 丧尸攻击格挡
    if (this.moving && this.stats.panic > 70) this.stats.stress = clamp(this.stats.stress + dt * 0.2, 0, 100);
  }
  // ---------- 近战 ----------
  meleeSwing() {
    const g = this.game, st = this.stats;
    const w = this.held ? this.held.item : ITEMS.fist;
    const m = w.melee || ITEMS.fist.melee;
    this.attackT = m.swing * (1 - st.skills.axe.lvl * 0.015) * (1 - st.skills.blunt.lvl * 0.012);
    st.stamina = clamp(st.stamina - m.stam * 100 * (1 - st.skills.fitness.lvl * 0.05), 0, 100);
    g.audio.meleeWhoosh();
    const range = m.range * (1 + st.strength * 0.01);
    const arc = m.arc;
    const sk = w.id === 'fire_axe' || w.id === 'garden_hoe' ? 'axe' : (w.melee && w.melee.stab || w.id === 'kitchen_knife' || w.id === 'machete' ? 'blade' : 'blunt');
    const skLvl = st.skills[sk].lvl;
    let hitAny = false;
    for (const z of g.zombies.list) {
      if (z.dead) continue;
      const d = dist2(this.x, this.z, z.x, z.z);
      if (d > range + 0.4 || d < 0.25) continue;
      const ang = Math.atan2(z.x - this.x, z.z - this.z);
      let da = Math.abs(ang - this.aimAngle) % TAU;
      if (da > Math.PI) da = TAU - da;
      if (da > arc / 2) continue;
      if (g.world.losBlocked(this.x, this.z, z.x, z.z)) continue;
      const dmg = m.dmg * (1 + st.strength * 0.03 + skLvl * 0.06) * st.combatMult * (1 + (Math.random() - 0.5) * 0.2);
      const crit = Math.random() < m.crit + skLvl * 0.015;
      const headshot = crit && Math.random() < 0.5 + st.skills.aiming.lvl * 0.02;
      const kb = m.kb * st.kbMult * (0.8 + st.strength * 0.05);
      z.takeMelee(dmg * (crit ? 1.8 : 1), kb, crit || headshot, this);
      hitAny = true;
      st.addXp(sk, 2.2);
      st.addXp('maintenance', 0.4);
      if (w.maxCond) {
        w.cond = (w.cond || w.maxCond) - (w.condLoss || 0.2) * (1 - st.skills.maintenance.lvl * 0.05);
        if (w.cond <= 0) {
          g.toast('💥 ' + w.name + ' 损坏了！', 'warn');
          this.breakHeld();
        }
      }
      if (z.dead) st.kills++;
      break;
    }
    // 破窗/破门
    if (!hitAny) {
      const near = g.world.findWallInteract(this.x, this.z, 1.4);
      if (near && (near.type === 'window' || near.type === 'door')) {
        const d = dist2(this.x, this.z, near.x + 0.5, near.z + 0.5);
        if (d < 1.6) {
          if (near.type === 'window' && !near.smashed) { near.smashed = true; g.audio.windowSmash(); g.renderer.updateWindowVisual(near); g.events.emit('noise', { x: near.x, z: near.z, r: 12, type: 'smash' }); g.toast('🔨 打碎了窗户'); }
          else if (near.type === 'door') { near.hp -= 12 + st.strength; g.events.emit('noise', { x: near.x, z: near.z, r: 8, type: 'bash' }); if (near.hp <= 0) { near.type = 'hole'; near.smashed = true; g.toast('🚪 门被砸开了', 'good'); } }
        }
      }
    }
    this.game.ui.updateHand();
  }
  breakHeld() {
    const h = this.held;
    if (!h) return;
    if (h.slot === 'inv') this.takeItem(h.stack);
    else if (h.slot === 'hotbar') this.hotbar[h.idx] = null;
    this.setHeld(null);
  }
  // ---------- 枪械 ----------
  magAmmo() { return this.held ? (this.held.item.mag || 0) : 0; }
  reserveAmmo() {
    const cal = this.held ? this.held.item.ammo : null;
    return this.inv.reduce((s, i) => i.item.type === 'ammo' && i.item.cal === cal ? s + i.n : s, 0);
  }
  tryFire(dt) {
    const g = this.game, st = this.stats;
    const w = this.held.item;
    if (this.fireT > 0 || this.reloadT > 0) return;
    if ((w.mag || 0) <= 0) {
      this.startReload();
      return;
    }
    const spread = this.aimSpread();
    const dmgBase = w.damage;
    const pellets = w.pellets || 1;
    const range = (w.range || 16) * (this.attach('sight') && this.attach('sight').item.rangeMult ? this.attach('sight').item.rangeMult : 1);
    const origin = { x: this.x, z: this.z };
    const mx = Math.sin(this.aimAngle), mz = Math.cos(this.aimAngle);
    let hitWall = null;
    let firstZ = null, firstT = range;
    for (let i = 0; i < pellets; i++) {
      const off = (Math.random() - 0.5) * 2 * (w.spread || 0.02) * spread;
      const ax = Math.sin(this.aimAngle + off), az = Math.cos(this.aimAngle + off);
      // 墙体命中
      let wallT = range;
      for (const wall of g.world.wallObjs.values()) {
        if (!wall.blocksLos()) continue;
        // 粗检测：距离
        const d = dist2(this.x, this.z, wall.x + 0.5, wall.z + 0.5);
        if (d > range + 2) continue;
        const hit = rayWall(this.x, this.z, ax, az, wall, wallT);
        if (hit) { wallT = hit; hitWall = wall; }
      }
      // 丧尸命中
      for (const z of g.zombies.list) {
        if (z.dead) continue;
        const d = dist2(this.x, this.z, z.x, z.z);
        if (d > wallT) continue;
        const dx = z.x - this.x, dz = z.z - this.z;
        const t = (dx * ax + dz * az);
        if (t < 0.2) continue;
        const px = this.x + ax * t, pz = this.z + az * t;
        if (dist2(px, pz, z.x, z.z) > 0.45) continue;
        if (g.world.losBlocked(this.x, this.z, z.x, z.z)) continue;
        if (!firstZ || t < firstT) { firstZ = z; firstT = t; }
      }
      // 曳光
      g.renderer.addTracer(this.x - HALF, this.z - HALF, 0.8, this.x + ax * wallT - HALF, this.z + az * wallT - HALF, 0.5, 0xffc860);
    }
    // 枪口火光
    const gunX = this.x + mx * 0.7, gunZ = this.z + mz * 0.7;
    g.renderer.addMuzzleFlash(gunX - HALF, 0.75, gunZ - HALF);
    g.renderer.addShell(gunX - HALF, 0.7, gunZ - HALF, { x: -mz, z: mx });
    // 弹药
    w.mag--;
    const condLoss = w.condLoss || 0.1;
    w.cond = (w.cond || w.maxCond) - condLoss;
    if (w.cond <= 0) { g.toast('💥 ' + w.name + ' 卡壳报废！', 'warn'); this.breakHeld(); }
    // 噪音
    const noiseR = (w.noise || 60) * (this.attach('muzzle') && this.attach('muzzle').item.noiseMult ? this.attach('muzzle').item.noiseMult : 1);
    g.events.emit('noise', { x: this.x, z: this.z, r: noiseR, type: 'gunshot' });
    g.audio.gunshot(0.5, noiseR < w.noise * 0.6);
    this.fireT = w.rof || 0.4;
    st.addXp('aiming', 0.8);
    st.addXp('reloading', 0.15);
    // 命中效果
    if (hitWall) {
      g.renderer.addSplinters(hitWall.x + 0.5 - HALF, 1.1, hitWall.z + 0.5 - HALF, 5, hitWall.type === 'window' ? 0xbfe8f0 : 0x8a7a5c);
      if (hitWall.type === 'window' && !hitWall.smashed) { hitWall.smashed = true; g.renderer.updateWindowVisual(hitWall); }
    }
    if (firstZ) {
      const acc = 1 - spread * 0.35;
      const dmg = dmgBase * acc * (1 + st.skills.aiming.lvl * 0.045);
      const crit = Math.random() < 0.25 + st.skills.aiming.lvl * 0.03;
      firstZ.takeMelee(dmg * (crit ? 2.2 : 1), 1.2, crit, this);
      if (firstZ.dead) st.kills++;
      g.renderer.addFeathers(firstZ.x - HALF, 0.7, firstZ.z - HALF, 10, 0x9aa278);
    }
    g.ui.updateHand();
    if (w.mag <= 0) this.startReload();
  }
  aimSpread() {
    const st = this.stats;
    const w = this.held.item;
    let s = 1.9 - w.acc * 0.9;
    if (this.moving) s *= this.running ? 2.6 : 1.9;
    s *= 1 - st.skills.aiming.lvl * 0.07;
    s *= 1 - this.aimT * 0.22;
    s *= 1 + st.panic / 100 * 0.8;
    s *= 1 + st.totalPain / 100 * 0.5;
    if (this.attach('sight')) s *= 1 / (this.attach('sight').item.accMult || 1);
    if (this.attach('muzzle') && this.attach('muzzle').item.accMult) s *= 1 / this.attach('muzzle').item.accMult;
    if (this.attach('laser')) s *= 0.9;
    return clamp(s, 0.4, 6);
  }
  attach(slot) { return this.attachments[slot] || null; }
  startReload() {
    const w = this.held && this.held.item;
    if (!w || w.type !== 'gun') return;
    if ((w.mag || 0) >= w.magCap) return;
    if (this.reserveAmmo() <= 0) { this.game.toast('没有适配的弹药！', 'warn'); return; }
    this.reloadT = clamp(3.2 - this.stats.skills.reloading.lvl * 0.22, 1.0, 3.2);
    this.game.audio.reload();
    this.game.toast('🔄 装填中…');
  }
  finishReload() {
    const w = this.held && this.held.item;
    if (!w) return;
    const need = w.magCap - (w.mag || 0);
    const st = this.inv.find(i => i.item.type === 'ammo' && i.item.cal === w.ammo);
    if (!st) { this.game.toast('弹药不够！', 'warn'); return; }
    const take = Math.min(need, st.n);
    st.n -= take; if (st.n <= 0) this.inv.splice(this.inv.indexOf(st), 1);
    w.mag = (w.mag || 0) + take;
    this.game.ui.updateHand();
    this.stats.addXp('reloading', 2);
  }
  rollActive() { return this.rollT > 0; }
}
function mkInstance(def) {
  const inst = { ...def, id: def.id };
  if (def.type === 'gun') { inst.mag = 0; if (def.maxCond) inst.cond = def.maxCond; }
  else if (def.maxCond) inst.cond = def.maxCond;
  return inst;
}
function rayWall(ox, oz, dx, dz, wall, maxT) {
  const x0 = wall.sx0, z0 = wall.sz0, x1 = wall.sx1, z1 = wall.sz1;
  const rx = x1 - x0, rz = z1 - z0;
  const denom = dx * rz - dz * rx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((ox - x0) * rz - (oz - z0) * rx) / denom;
  const u = ((ox - x0) * dz - (oz - z0) * dx) / denom;
  if (t > 0 && t < maxT && u >= 0 && u <= 1) return t;
  return null;
}
