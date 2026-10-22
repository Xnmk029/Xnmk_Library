// ============================================================
//  player.js — 玩家控制器（融合双摇杆式操作 + 僵毁状态约束）
// ============================================================
import { BodyState, PART_IDS } from '../systems/body.js';
import { Skills } from '../systems/skills.js';
import { itemDef, mkItem } from '../data/items.js';
import { addItem, removeItem, takeItems, countOf } from '../systems/inventory.js';
import { fireGun, startReload, finishReload, meleeSwing, throwItem } from '../systems/combat.js';
import { emitNoise } from '../systems/vision.js';
import { clamp, normAng, damp } from '../core/util.js';

const BASE_SPEED = 3.5;

export class Player {
  constructor(mods) {
    this.x = 0; this.y = 0; this.facing = 0; this.vx = 0; this.vy = 0;
    this.body = new BodyState(mods);
    this.skills = new Skills();
    this.inv = [];
    this.eq = { gun: null, sidearm: null, melee: null, vest: null, helm: null, pack: null, throw1: null };
    this.curWeapon = 'gun';
    this.fireCd = 0; this.recoil = 0; this.reloadT = 0; this.reloadWpn = null;
    this.meleeCd = 0; this.throwCd = 0; this.rollCd = 0;
    this.rolling = false; this.rollT = 0; this.rollDir = { x: 0, y: 1 };
    this.sneaking = false; this.sprinting = false;
    this.light = false; this.thermal = false;
    this.onGround = false; this.exposure = 0;
    this.isPlayer = true; this.isEnemy = false; this.size = 0.42;
    this.aimAng = 0; this.moving = false;
  }

  activeWeapon() {
    if (this.curWeapon === 'melee') return this.eq.melee;
    if (this.curWeapon === 'sidearm') return this.eq.sidearm;
    return this.eq.gun;
  }

  canStand(lv, x, y) {
    const r = 0.30;
    const pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r], [x, y]];
    for (const [px, py] of pts) {
      const tx = px | 0, ty = py | 0;
      if (!lv.inB(tx, ty) || lv.solid[lv.i(tx, ty)]) return false;
    }
    return true;
  }

  update(dt, game) {
    const lv = game.level, inp = game.input;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.meleeCd = Math.max(0, this.meleeCd - dt);
    this.throwCd = Math.max(0, this.throwCd - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.recoil = damp(this.recoil, 0, 6, dt);

    // 瞄准
    if (game.mouseWorld) this.aimAng = Math.atan2(game.mouseWorld.y - this.y, game.mouseWorld.x - this.x);
    this.facing = this.rolling ? this.facing : this.aimAng;

    // 输入状态
    this.sneaking = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight');
    this.sprinting = (inp.isDown('ControlLeft') || inp.isDown('AltLeft') || inp.isDown('ControlRight')) && !this.sneaking;

    // 移动
    const mv = inp.moveVec();
    let mx = mv.x, my = mv.y;
    const ml = Math.hypot(mx, my);
    if (ml > 0.01) { mx /= ml; my /= ml; this.moving = true; } else this.moving = false;

    let speed = BASE_SPEED * this.body.speedMul();
    if (this.sneaking) speed *= 0.5;
    if (this.sprinting && this.body.stamina > 1) speed *= 1.5;
    if (this.body.fallen) speed *= 0.45;
    speed *= lv.speedAt(this.x | 0, this.y | 0);

    // 翻滚
    if (this.rolling) {
      this.rollT -= dt;
      const rs = BASE_SPEED * 2.7;
      this.x += this.rollDir.x * rs * dt;
      this.y += this.rollDir.y * rs * dt;
      if (!this.canStand(lv, this.x, this.y)) { this.x -= this.rollDir.x * rs * dt; this.y -= this.rollDir.y * rs * dt; }
      if (this.rollT <= 0) { this.rolling = false; this.rollCd = 0.7; }
    } else {
      // 翻滚触发
      if (inp.pressed('Space') && this.rollCd <= 0 && this.body.stamina > 12 && !this.body.fallen) {
        const dir = ml > 0.01 ? { x: mx, y: my } : { x: Math.cos(this.aimAng), y: Math.sin(this.aimAng) };
        this.rolling = true; this.rollT = 0.42; this.rollDir = dir;
        this.body.useStamina(14);
      }
      // 普通移动
      const nx = this.x + mx * speed * dt;
      const ny = this.y + my * speed * dt;
      if (this.canStand(lv, nx, this.y)) this.x = nx;
      if (this.canStand(lv, this.x, ny)) this.y = ny;
      this.vx = mx * speed; this.vy = my * speed;
    }

    // 体力
    if (this.sprinting && ml > 0.01) this.body.useStamina(7 * dt);
    else if (this.moving) this.body.useStamina(1.4 * dt);
    else this.body.regenStamina(9 * dt);

    // 噪音（脚步）
    if (this.moving && !this.rolling) {
      const r = this.sneaking ? 3 : this.sprinting ? 16 : 8;
      emitNoise(game, this.x, this.y, r, 'step');
    }

    // 换弹
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) finishReload(game, this);
    }

    // 武器开关
    if (inp.pressed('Digit1')) this.curWeapon = 'gun';
    if (inp.pressed('Digit2')) this.curWeapon = 'sidearm';
    if (inp.pressed('Digit3')) this.curWeapon = 'melee';
    if (inp.pressed('KeyR')) { const w = this.activeWeapon(); if (w) startReload(game, this, w); }
    if (inp.pressed('KeyF')) this.light = !this.light;
    if (inp.pressed('KeyT')) this.thermal = this.canThermal() ? !this.thermal : false;
    if (inp.pressed('KeyQ')) this.doThrow(game);

    // 开火 / 近战
    const w = this.activeWeapon();
    const def = w ? itemDef(w.id) : null;
    if (!this.rolling && !this.body.fallen && this.reloadT <= 0) {
      if (def && def.t === 'gun') {
        if (inp.mouseDown) { if (!fireGun(game, this, w, this.aimAng)) { if ((w.extra?.mag ?? 0) <= 0 && inp.pressed('Mouse0')) startReload(game, this, w); } }
      } else {
        if (inp.mouseDown && this.meleeCd <= 0) this.doMelee(game);
      }
      if (inp.mousePressed(0) && def && def.t !== 'gun' && this.meleeCd <= 0) this.doMelee(game);
      if (inp.mouseDown(1) && this.meleeCd <= 0) this.doMelee(game);
    }

    // 生理 / 状态
    const ctx = {
      skills: this.skills,
      weather: lv.weather,
      indoor: lv.indoors(this.x | 0, this.y | 0),
      wet: this.body.stats.wetness > 0.4,
      temp: lv.weather === 'storm' ? -6 : 8,
      fire: false,
    };
    this.body.update(dt * 0.55, ctx);
    if (this.body.dead) { if (!game.ending) game.onPlayerDead('伤重不治'); }

    // 火堆灼烧
    for (const f of game.fires || []) {
      if (Math.hypot(this.x - f.x, this.y - f.y) < f.r * 0.8) {
        this.body.damage('torso', 6 * dt, {});
        this.body.stats.wetness = Math.max(0, this.body.stats.wetness - 10 * dt);
      }
    }
  }

  canThermal() {
    return this.inv.some(it => it.id === 'att_thermal' || it.id === 'thermal_goggles')
      || (this.eq.helm && itemDef(this.eq.helm.id).nightVision);
  }

  doMelee(game) {
    const w = this.eq.melee;
    const def = w ? itemDef(w.id) : { dmg: 9, reach: 1.1 };
    const dmg = (def.dmg || 9) * this.body.meleeMul();
    const reach = (def.reach || 1.1);
    meleeSwing(game, this, dmg, reach, this.aimAng, 0.9);
    this.meleeCd = 0.42 / (1 + this.skills.get('fitness') * 0.04);
    this.skills.add('fitness', 1);
    emitNoise(game, this.x, this.y, 5, 'melee');
  }

  doThrow(game) {
    let item = this.eq.throw1;
    if (!item) item = this.inv.find(it => itemDef(it.id).t === 'throw');
    if (!item) { game.toast('没有可投掷物', 'bad'); return; }
    if (this.throwCd > 0) return;
    throwItem(game, this, item, this.aimAng);
    this.throwCd = 0.8;
    if (this.eq.throw1 === item) { this.eq.throw1 = null; }
    else takeItems(this.inv, item.id, 1);
  }

  // -------- 物品交互 --------
  addLoot(item) { addItem(this.inv, item, 60); }

  equip(game, item) {
    const def = itemDef(item.id);
    let slot = null;
    if (def.t === 'gun') slot = 'gun';
    else if (def.t === 'melee') slot = 'melee';
    else if (def.t === 'armor') slot = 'vest';
    else if (def.t === 'helm') slot = 'helm';
    else if (def.t === 'pack') slot = 'pack';
    else if (def.t === 'throw') { this.eq.throw1 = item; removeItem(this.inv, item); game.toast('已装填投掷物：' + (def.name || item.id), 'good'); return; }
    if (!slot) { game.toast('该物品无法装备', 'bad'); return; }
    const old = this.eq[slot];
    this.eq[slot] = item; removeItem(this.inv, item);
    if (item.extra) item.loaded = item.extra.mag;
    if (slot === 'gun' || slot === 'sidearm') { if (item.extra?.mag === undefined) item.extra = { ...(item.extra || {}), mag: def.mag, atts: item.extra?.atts || [] }; }
    if (old) this.inv.push(old);
    if (slot === 'gun' || slot === 'sidearm') this.curWeapon = slot;
    game.toast('装备：' + (def.name || item.id), 'good');
  }

  unequip(game, slot) {
    const it = this.eq[slot]; if (!it) return;
    this.eq[slot] = null; this.inv.push(it);
  }

  useConsumable(game, item) {
    const def = itemDef(item.id);
    if (def.t === 'food' || def.t === 'drink') {
      const s = this.body.stats;
      if (def.cls === 'food') s.hunger = clamp(s.hunger - (def.hunger || 20), 0, 100);
      else s.thirst = clamp(s.thirst - (def.thirst || 20), 0, 100);
      s.fatigue = clamp(s.fatigue - (def.fatigue || 0), 0, 100);
      s.boredom = clamp(s.boredom - (def.boredom || 8), 0, 100);
      s.unhappy = clamp(s.unhappy - (def.unhappy || 6), 0, 100);
      if (def.rotten) { s.sickness = clamp(s.sickness + 35, 0, 100); game.toast('食物变质，生病了！', 'bad'); }
      else game.toast('进食：' + (def.name || item.id), 'good');
      if (def.cls === 'drink' && def.thirst) this.skills.add('cooking', 1);
      takeItems(this.inv, item.id, 1);
    } else if (def.t === 'book') {
      const sk = def.skill; const gain = def.xp || 60;
      const lv0 = this.skills.get(sk);
      this.skills.add(sk, gain);
      game.toast('研读《' + (def.name || item.id) + '》：' + (this.skills.get(sk) - lv0 > 0 ? '升级!' : '+经验'), 'good');
      takeItems(this.inv, item.id, 1);
    } else {
      game.toast('该物品需在对应界面使用', 'bad');
    }
  }

  applyMedToPart(game, part, medItem) {
    const def = itemDef(medItem.id);
    if (def.cls !== 'med') { game.toast('这不是医疗物品', 'bad'); return; }
    const lvl = this.skills.get('doctor');
    const res = this.body.applyMed(part, def, lvl);
    if (res.ok) {
      removeItem(this.inv, medItem);
      this.skills.add('doctor', def.xp || 10);
      game.toast('完成治疗：' + (def.name || medItem.id), 'good');
    } else game.toast(res.msg || '无效', 'bad');
  }

  dropItem(game, item) {
    removeItem(this.inv, item);
    game.level.dropItem(this.x, this.y, item);
  }
}
