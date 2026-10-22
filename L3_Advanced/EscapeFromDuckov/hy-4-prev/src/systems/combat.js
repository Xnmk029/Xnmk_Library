// 战斗编排：开火 / 装填 / 近战 / 命中结算 / 噪音。
// 数值计算全部走 systems/pure，这里只负责"什么时候扣什么、发什么事件"。
import { WEAPONS, ATTACHMENTS } from '../data/weapons.js';
import { ammoStats, CALIBER } from '../data/ammo.js';
import { resolveHit, pickBodyPart, spreadDeg } from './pure/ballistics.js';
import { weaponStats } from './pure/statPipeline.js';
import { castRay } from './vision.js';
import { noise, bus } from '../core/events.js';
import { COMBAT } from '../data/balance.js';
import { clamp, clamp01 } from '../core/math2d.js';

/** 一次开火的完整弹药描述 */
export function makeWeapon(id, { mods = {}, caliber, tier = 1, ammo = 90 } = {}) {
  const def = WEAPONS[id];
  if (!def) return null;
  const cal = caliber || def.caliber || '9mm';
  return {
    id, mods, caliber: cal, tier,
    mag: 0, magSize: def.magSize + (mods.mag === 'magExt' ? (ATTACHMENTS.magExt.add.magSize || 0) : 0),
    reserve: ammo,
    durability: 100,
    ammo: def.caliber ? ammoStats(cal, tier) : null,
  };
}

export function reload(weapon, reservePool) {
  if (!weapon || !weapon.ammo) return false;
  const need = weapon.magSize - weapon.mag;
  if (need <= 0 || reservePool[weapon.ammo.id] <= 0) return false;
  const take = Math.min(need, reservePool[weapon.ammo.id]);
  reservePool[weapon.ammo.id] -= take;
  weapon.mag += take;
  return true;
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.fireCd = 0;
    this.meleeCd = 0;
    this.recoil = 0;               // 后坐力累积 → 散布变大
    this.aimProgress = 0;          // 稳定瞄准进度 0..1
    this.tracers = [];
  }

  stats() {
    const w = this.game.equipped;
    if (!w) return null;
    const g = this.game;
    return weaponStats(w, {
      skills: g.skills || {},
      moodles: g.moodleTiers || {},
      traits: g.traits || {},
      env: { dark: (g.lights.dayK ?? 1) < 0.3, thermal: g.thermalOn },
    });
  }

  update(dt, intent) {
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.meleeCd = Math.max(0, this.meleeCd - dt);
    this.recoil = Math.max(0, this.recoil - dt * 14);
    const g = this.game;
    const w = g.equipped;
    if (!w) return;

    const aiming = intent.aim;
    const s = this.stats();
    if (s) this.aimProgress = clamp01(this.aimProgress + (aiming ? dt / 0.35 : -dt / 0.2) * (s.ergonomics / 60));

    if (intent.fire && this.fireCd <= 0) {
      const def = WEAPONS[w.id];
      if (def.melee) this.melee();
      else this.fire(def, aiming);
    }
    if (intent.reload) {
      const def = WEAPONS[w.id];
      if (!def.melee && w.mag < w.magSize) {
        if (reload(w, g.reserveAmmo || {})) { this.fireCd = Math.max(this.fireCd, 1.4); bus.emit('weapon:reloaded', w); }
      }
    }
    this.updateTracers(dt);
  }

  fire(def, aiming) {
    const g = this.game;
    const w = g.equipped;
    if (w.mag <= 0) { bus.emit('weapon:dry', w); this.fireCd = 0.35; return; }
    const s = this.stats();
    const rpm = s.rpm ?? def.base.rpm;
    const auto = def.auto;

    w.mag--;
    this.fireCd = 60 / rpm;
    // 卡壳（维护技能与耐久修正）
    const jam = (s.jamChance ?? COMBAT.jamChanceBase) * (1 + (100 - (w.durability ?? 100)) / 130);
    if (Math.random() < jam) { bus.emit('weapon:jam', w); this.fireCd = 1.1; return; }
    w.durability = Math.max(0, (w.durability ?? 100) - COMBAT.durabilityLossPerShot * 0.06);

    const ammo = w.ammo;
    const p = g.player;
    const tiles = 0;
    const spread = spreadDeg(s, {
      aimMul: 1 + this.recoil * 0.02,
      panicTier: g.moodleTiers?.panicTier ?? 0,
      endurance: g.player.endurance,
      moving: g.player.moving,
      sprinting: g.player.sprinting,
      aiming,
      sneaking: g.player.sneaking,
    });
    // 后坐力累积（枪法等级已折算进 s.recoil）
    this.recoil = Math.min(100, this.recoil + (s.recoil ?? 6) * 0.55);

    const pellets = ammo?.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const a = p.aim + ((Math.random() - 0.5) * spread * Math.PI) / 180;
      this.hitscan(p.x, p.z, Math.sin(a), Math.cos(a), s, ammo, aiming);
    }
    // 噪音：这是 PZ 的灵魂 —— 一枪能把半个街区的尸群叫醒
    noise.emit(p.x, p.z, s.noise ?? 90, 'gunshot', p, 0.5);
    g.rig.addShake(0.12 + (s.recoil ?? 6) * 0.012);
    bus.emit('weapon:fired', { weapon: w, x: p.x, z: p.z, aim: p.aim, tracer: ammo?.tracer ?? 0xffb347 });
  }

  /** 2D 射线命中：先算撞墙距离，再看这段距离内有没有敌人 */
  hitscan(ox, oz, dx, dz, stats, ammo, aiming) {
    const g = this.game;
    const maxD = (stats.range ?? 20) * 1.15;
    const wallD = castRay(g.world, ox, oz, dx, dz, maxD);
    let best = null, bestD = wallD;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const ex = e.x - ox, ez = e.z - oz;
      const t = ex * dx + ez * dz;                  // 投影
      if (t < 0 || t > bestD) continue;
      const perp = Math.abs(ex * dz - ez * dx);     // 垂距
      if (perp > (e.r + 0.12)) continue;
      best = e; bestD = t;
    }
    const ex = ox + dx * bestD, ez = oz + dz * bestD;
    this.tracers.push({ x0: ox, z0: oz, x1: ex, z1: ez, life: 0.09, max: 0.09, color: ammo?.tracer ?? 0xffb347 });

    if (!best) { bus.emit('fx:impact', { x: ex, z: ez, kind: 'wall' }); return; }
    const part = pickBodyPart(Math.random, { aimed: aiming && bestD < 9 });
    const hit = resolveHit(Math.random, null, best, part, ammo, {
      angleToFacing: Math.abs(((Math.atan2(dx, dz) - best.facing) + Math.PI * 3) % (Math.PI * 2) - Math.PI),
    });
    best.hurt(hit.damage, part);
    bus.emit('fx:impact', { x: ex, z: ez, kind: 'duck', crit: hit.crit });
    bus.emit('combat:hit', { target: best, part, damage: hit.damage, crit: hit.crit, mitigated: hit.damage < (ammo?.damage ?? 1) * 0.5 });
    g.damageNumbers.push({ x: ex, z: ez, v: Math.round(hit.damage), crit: hit.crit, life: 0.9 });
  }

  melee() {
    const g = this.game;
    const w = g.equipped;
    const def = WEAPONS[w.id];
    const p = g.player;
    const s = this.stats();
    const range = s.range ?? 1.6;
    const dmg = (s.damage ?? 20) * (s.meleeMul ?? 1) * (1 - p.endurance * 0.55);
    this.meleeCd = 60 / (s.rpm ?? 95);
    p.stamina = clamp(p.stamina - (def.staminaCost ?? COMBAT.stamina.swingCost), 0, COMBAT.stamina.max);
    p.endurance = clamp01(p.endurance + 0.02);
    let hitAny = false;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > range + e.r) continue;
      const a = Math.atan2(e.x - p.x, e.z - p.z);
      if (Math.abs(((a - p.aim) + Math.PI * 3) % (Math.PI * 2) - Math.PI) > 1.1) continue;
      const part = pickBodyPart(Math.random, {});
      e.hurt(dmg, part);
      bus.emit('fx:impact', { x: e.x, z: e.z, kind: 'duck' });
      g.damageNumbers.push({ x: e.x, z: e.z, v: Math.round(dmg), life: 0.9 });
      hitAny = true;
    }
    noise.emit(p.x, p.z, hitAny ? (s.noise ?? 12) * 1.4 : (s.noise ?? 12), 'melee', p, 0.3);
    bus.emit('weapon:swung', { weapon: w, hit: hitAny });
  }

  updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) this.tracers.splice(i, 1);
    }
  }
}

export const CALIBER_LIST = Object.keys(CALIBER);
