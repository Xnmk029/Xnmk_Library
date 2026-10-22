// ============================================================
//  enemy.js — 感染鸭 / 拾荒鸭 / 精英 / Boss 的感知-调查-追击 AI
//  融合：僵毁的噪声/视线感知 + 鸭科夫的怪物行为
// ============================================================
import { enemyDef } from '../data/enemies.js';
import { rollEnemyLoot } from '../data/loot.js';
import { findPath, hasLOS } from '../world/pathfind.js';
import { meleeSwing, fireGun } from '../systems/combat.js';
import { emitNoise, heard } from '../systems/vision.js';
import { mkItem } from '../data/items.js';
import { rng, clamp, normAng, uid, dist } from '../core/util.js';

const SPEED_MUL = 2.6;

let _eid = 1;

export class Enemy {
  constructor(id, x, y, tier) {
    const d = enemyDef(id);
    this.eid = _eid++;
    this.defId = id; this.def = d; this.faction = d.faction; this.name = d.name;
    this.x = x; this.y = y; this.facing = rng.next() * 6.28;
    this.hp = d.hp; this.maxhp = d.hp; this.armor = d.armor; this.size = d.size || 1;
    this.sight = d.sight; this.fov = (d.fov || 140) * Math.PI / 180; this.hearing = d.hearing;
    this.atkCd = 0; this.state = 'idle'; this.path = null; this.pathIdx = 0;
    this.lastSeen = null; this.alert = 0; this.seenT = -999;
    this.gun = d.gun ? { ...d.gun, cls: 'gun' } : null;
    this.gunItem = this.gun ? { id: '_egun', def: this.gun, ammoTier: this.gun.ammoTier || 1, extra: { mag: this.gun.mag } } : null;
    this.mag = this.gun ? this.gun.mag : 0;
    this.reloadT = 0; this.specialCd = 4 + rng.next() * 4;
    this.chargeT = 0; this.charging = false; this.slamT = 0; this.tellT = 0;
    this.burstLeft = 0; this.repathT = 0;
    this.bleed = 0; this.burning = 0; this.dead = false; this.deathT = 0; this.lootDropped = false;
    this.invisible = !!d.invisible; this.immune = !!d.immune;
    this.isEnemy = true; this.isPlayer = false;
    this.vx = 0; this.vy = 0; this.tier = tier || d.tier;
    this.wanderT = rng.next() * 3; this.wanderGoal = null;
    this.stun = 0;
  }

  canStand(lv, x, y) {
    const r = 0.32 * this.size;
    const pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r], [x, y]];
    for (const [px, py] of pts) {
      const tx = px | 0, ty = py | 0;
      if (!lv.inB(tx, ty) || lv.solid[lv.i(tx, ty)]) return false;
    }
    return true;
  }

  update(dt, game) {
    if (this.immune) return; // 商人等中立单位不动
    if (this.dead) { this.vx *= 0.8; this.vy *= 0.8; this.x += this.vx * dt; this.y += this.vy * dt; return; }
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    this.reloadT = Math.max(0, this.reloadT - dt);
    this.repathT = Math.max(0, this.repathT - dt);
    this.stun = Math.max(0, this.stun - dt);

    // 出血 / 燃烧
    if (this.bleed > 0) { this.hp -= this.bleed * dt * 3.5; if (this.hp <= 0) return this.die(game, 'bleed'); }
    if (this.burning > 0) { this.hp -= this.burning * dt * 7; this.burning = Math.max(0, this.burning - dt); if (this.hp <= 0) return this.die(game, 'burn'); }
    for (const f of game.fires || []) if (Math.hypot(this.x - f.x, this.y - f.y) < f.r * 0.8) this.burning = Math.max(this.burning, 1);

    this.perceive(game);
    if (this.stun <= 0) this.act(dt, game);

    // 击退速度衰减
    this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.82; this.vy *= 0.82;
    if (!this.canStand(game.level, this.x, this.y)) { this.x -= this.vx * dt; this.y -= this.vy * dt; }
  }

  perceive(game) {
    const P = game.player;
    const d = dist(this.x, this.y, P.x, P.y);
    let see = false;
    if (!P.body.dead && d <= this.sight) {
      const a = Math.atan2(P.y - this.y, P.x - this.x);
      const inFov = Math.abs(normAng(a - this.facing)) < this.fov * 0.5 || d < 2.4;
      if (inFov && hasLOS(game.level, this.x, this.y, P.x, P.y)) {
        let seeChance = (P.sneaking ? 0.45 : 1) * (P.sprinting ? 1.35 : 1) * (P.light ? 1.25 : 1) * (P.rolling ? 0.6 : 1);
        if (rng.chance(seeChance)) see = true;
      }
    }
    if (see) {
      this.alert = 1; this.lastSeen = { x: P.x, y: P.y }; this.seenT = game.time; this.state = 'chase';
      for (const o of game.enemies) {
        if (o !== this && !o.dead && o.faction === this.faction && dist(o.x, o.y, this.x, this.y) < 13) {
          o.alert = 1; o.lastSeen = { x: P.x, y: P.y }; o.seenT = game.time;
          if (o.state === 'idle' || o.state === 'investigate') o.state = 'chase';
        }
      }
    } else {
      for (const n of game.noises) {
        if (heard(this.x, this.y, n.x, n.y, n.r, this.hearing)) {
          this.lastSeen = { x: n.x, y: n.y }; this.alert = Math.max(this.alert, 0.55);
          if (this.state === 'idle') this.state = 'investigate';
        }
      }
      if (this.alert > 0) {
        this.alert -= game.dt * 0.22;
        if (this.alert < 0) this.alert = 0;
        if (this.state === 'chase' && !this.lastSeen) this.state = 'investigate';
      }
    }
  }

  moveToward(tx, ty, sp, dt, lv) {
    const dx = tx - this.x, dy = ty - this.y; const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    this.facing = Math.atan2(dy, dx);
    const nx = this.x + ux * sp * dt, ny = this.y + uy * sp * dt;
    if (this.canStand(lv, nx, this.y)) this.x = nx;
    if (this.canStand(lv, this.x, ny)) this.y = ny;
    return d;
  }

  ensurePath(game, tx, ty) {
    if (this.path && this.pathIdx < this.path.length) return;
    const p = findPath(game.level, this.x | 0, this.y | 0, tx | 0, ty | 0, { smash: this.def.tier >= 3 });
    this.path = p; this.pathIdx = 0;
  }
  followPath(sp, dt, lv) {
    if (!this.path || !this.path.length) return false;
    const node = this.path[this.pathIdx];
    const d = this.moveToward(node.x, node.y, sp, dt, lv);
    if (d < 0.6) { this.pathIdx++; if (this.pathIdx >= this.path.length) this.path = null; }
    return true;
  }

  act(dt, game) {
    const P = game.player, lv = game.level;
    const sp = this.def.spd * SPEED_MUL * (this.charging ? 2.2 : 1);
    const d = dist(this.x, this.y, P.x, P.y);
    const los = !P.body.dead && hasLOS(lv, this.x, this.y, P.x, P.y);

    // 特殊能力
    if (this.special(game, dt, P, d, los, sp)) return;

    if (this.state === 'idle' || this.state === 'wander') {
      this.wanderT -= dt;
      if (!this.wanderGoal || this.wanderT <= 0) {
        this.wanderGoal = { x: this.x + (rng.next() - 0.5) * 10, y: this.y + (rng.next() - 0.5) * 10 };
        this.wanderT = 2 + rng.next() * 3;
      }
      this.moveToward(this.wanderGoal.x, this.wanderGoal.y, sp * 0.35, dt, lv);
      return;
    }

    if (this.state === 'investigate' && this.lastSeen) {
      const dd = this.moveToward(this.lastSeen.x, this.lastSeen.y, sp * 0.7, dt, lv);
      if (dd < 0.8) { this.lastSeen = null; this.state = 'idle'; }
      return;
    }

    // chase
    if (this.gun && d <= this.gun.range && los) {
      this.facing = Math.atan2(P.y - this.y, P.x - this.x);
      this.tryShoot(game);
      if (d > this.gun.range * 0.65) this.moveToward(P.x, P.y, sp * 0.7, dt, lv);
      return;
    }
    if (d <= this.def.reach + 0.7 + this.size) {
      this.facing = Math.atan2(P.y - this.y, P.x - this.x);
      if (this.atkCd <= 0) {
        const bite = this.faction === 'zed' && (this.def.infect || 0) > 0 && rng.chance(this.def.infect || 0);
        meleeSwing(game, this, this.def.dmg, this.def.reach + 0.5, this.facing, 1.0, { bite });
        this.atkCd = this.def.atkCd;
        this.lunge();
      }
      return;
    }
    if (los) this.moveToward(P.x, P.y, sp, dt, lv);
    else {
      if (this.repathT <= 0 || !this.path) { this.ensurePath(game, P.x, P.y); this.repathT = 0.5; }
      if (!this.followPath(sp, dt, lv)) this.moveToward(P.x, P.y, sp, dt, lv);
    }
  }

  lunge() { this.vx += Math.cos(this.facing) * 1.4; this.vy += Math.sin(this.facing) * 1.4; }

  tryShoot(game) {
    if (this.reloadT > 0) return;
    if (this.mag <= 0) {
      this.reloadT = this.gun.reloadT || 2.5;
      return;
    }
    if (this.burstLeft <= 0 && this.atkCd <= 0) this.burstLeft = this.gun.burst || 1;
    if (this.burstLeft > 0 && this.atkCd <= 0) {
      this.gunItem.extra.mag = this.mag;
      if (fireGun(game, this, this.gunItem, this.facing)) { this.mag = this.gunItem.extra.mag; this.burstLeft--; if (this.burstLeft <= 0) this.atkCd = 1.1; }
    }
  }

  special(game, dt, P, d, los, sp) {
    const dd = this.def;
    // 冲锋
    if (dd.charge) {
      if (this.charging) {
        this.chargeT -= dt;
        this.x += Math.cos(this.facing) * sp * dt; this.y += Math.sin(this.facing) * sp * dt;
        if (this.chargeT <= 0) {
          this.charging = false; this.specialCd = 5;
          if (d < dd.charge.dur * sp + 1.5) meleeSwing(game, this, dd.charge.dmg, 1.6, this.facing, 1.2, {});
        }
        return true;
      }
      if (this.specialCd <= 0 && d < 7 && d > 1.5 && los) {
        this.tellT = dd.charge.tell; this.charging = true; this.chargeT = dd.charge.dur;
        this.facing = Math.atan2(P.y - this.y, P.x - this.x);
        game.particles.push({ kind: 'tell', x: this.x, y: this.y, life: dd.charge.tell, max: dd.charge.tell });
        return true;
      }
    }
    // 震地
    if (dd.slam) {
      if (this.slamT > 0) {
        this.slamT -= dt;
        if (this.slamT <= 0) {
          if (d < dd.slam.radius) { meleeSwing(game, this, dd.slam.dmg, dd.slam.radius, this.facing, Math.PI, {}); game.shake = 12; }
          game.particles.push({ kind: 'shock', x: this.x, y: this.y, r: dd.slam.radius, life: 0.5, max: 0.5 });
          this.specialCd = dd.slam.cd;
        }
        return true;
      }
      if (this.specialCd <= 0 && d < dd.slam.radius + 1 && los) { this.slamT = dd.slam.tell; return true; }
    }
    // 召唤
    if (dd.summon && this.specialCd <= 0 && d < 16) {
      for (let i = 0; i < dd.summon.n; i++) {
        const ax = this.x + (rng.next() - 0.5) * 4, ay = this.y + (rng.next() - 0.5) * 4;
        game.spawnEnemy(dd.summon.type, ax, ay, this.tier);
      }
      this.specialCd = dd.summon.cd;
      return true;
    }
    // 弹幕（四骑士）
    if (dd.barrage && this.specialCd <= 0 && d < 18) {
      for (let i = 0; i < dd.barrage.n; i++) {
        const a = (i / dd.barrage.n) * Math.PI * 2;
        game.projectiles.push({ kind: 'bullet', x: this.x, y: this.y, vx: Math.cos(a) * 22, vy: Math.sin(a) * 22, dmg: dd.barrage.dmg, pen: dd.barrage.pen || 4, range: 20, life: 20, faction: 'enemy', tracer: '#b388ff', from: 'enemy', ang: a });
      }
      this.specialCd = dd.barrage.cd; game.shake = 8;
      return true;
    }
    return false;
  }

  die(game, cause) {
    if (this.dead) return;
    this.dead = true; this.deathT = game.time; this.deathCause = cause;
    if (this.def.burst === 'poison') game.fires.push({ x: this.x, y: this.y, r: 2.2, life: 5, max: 5, poison: true });
    game.onEnemyKilled(this);
  }

  dropLoot(game) {
    if (this.lootDropped) return;
    this.lootDropped = true;
    const loot = rollEnemyLoot(this.def, rng, this.tier);
    let n = 0;
    for (const it of loot) {
      const item = mkItem(it.item, it.n, it.extra);
      const ox = this.x + (rng.next() - 0.5) * 1.2, oy = this.y + (rng.next() - 0.5) * 1.2;
      game.level.dropItem(item, ox, oy);
      n++;
    }
    // 携带武器也掉落
    if (this.def.gun && rng.chance(0.5)) {
      const w = mkItem('pistol_m9', 1, { mag: 6 });
      game.level.dropItem(w, this.x + 0.4, this.y);
    }
  }
}
