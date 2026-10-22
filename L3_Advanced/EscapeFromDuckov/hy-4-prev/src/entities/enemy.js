// 丧鸭（敌人实体 + 行为状态机）。逻辑层不 import three，渲染交给 render/enemies.js。
import { ENEMIES, FACTION, isHostile } from '../data/enemies.js';
import { hasLineOfSight } from '../systems/movement.js';
import { moveWithCollision } from '../systems/movement.js';
import { noise as noiseField, bus } from '../core/events.js';
import { NOISE, COMBAT } from '../data/balance.js';
import { clamp, dist, angleDiff, approachAngle, TAU } from '../core/math2d.js';

export const STATE = {
  IDLE: 'idle', WANDER: 'wander', INVESTIGATE: 'investigate',
  CHASE: 'chase', ATTACK: 'attack', RANGED: 'ranged', SEARCH: 'search', DEAD: 'dead',
};

let _uid = 1;

export class Enemy {
  constructor(typeId, x, z) {
    const def = ENEMIES[typeId];
    this.id = _uid++;
    this.type = typeId;
    this.def = def;
    this.x = x; this.z = z;
    this.px = x; this.pz = z;
    this.r = def.boss ? 0.52 : 0.33;
    this.scale = def.scale ?? 1;
    this.facing = 0;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.armorLevel = def.armor ?? 0;
    this.faction = def.faction;
    this.state = STATE.IDLE;
    this.stateT = 0;
    this.alive = true;
    this.speed = 0;
    this.attackCd = 0;
    this.rangedCd = 0;
    this.burstLeft = 0;
    this.burstT = 0;
    this.chargeCd = 0;
    this.telegraph = 0;             // 冲锋前摇计时（狂暴搜刮者的红光）
    this.charging = 0;              // 冲锋位移阶段
    this.telegraphJustEnded = false;
    this.path = null;
    this.pathIdx = 0;
    this.repathT = 0;
    this.target = null;
    this.lastSeenX = 0; this.lastSeenZ = 0;
    this.memory = 0;
    this.bob = Math.random() * TAU;
    this.flash = 0;                 // 受击白闪（渲染层读）
    this.corpse = false;
    this.stuck = 0;
  }

  get moving() { return this.speed > 0.05; }
  get isBoss() { return !!this.def.boss; }

  hurt(amount, part) {
    if (!this.alive) return 0;
    this.hp -= amount;
    this.flash = 1;
    if (this.hp <= 0) { this.hp = 0; this.die(); }
    return amount;
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.state = STATE.DEAD;
    this.deadT = 0;
    bus.emit('enemy:died', this);
  }

  // ---------------- 感知 ----------------
  /** 能否看见目标：距离 → 视锥 → 视线遮挡 */
  canSee(world, tx, tz) {
    const d = dist(this.x, this.z, tx, tz);
    const range = this.def.sight;
    if (d > range) return false;
    if (d > 1.2) {
      const a = Math.atan2(tx - this.x, tz - this.z);
      if (Math.abs(angleDiff(a, this.facing)) > (this.def.fovDeg * Math.PI) / 360) {
        // 极近距离即使不在视锥内也能察觉（背后贴脸）
        if (d > 2.2) return false;
      }
    }
    return hasLineOfSight(world, this.x, this.z, tx, tz);
  }

  /** 听见噪音：返回强度 0..1 */
  hear(field) {
    const h = field.hear(this.x, this.z, this.def.hearing);
    return h.strength;
  }

  // ---------------- 主更新 ----------------
  update(dt, ctx) {
    this.px = this.x; this.pz = this.z;
    this.bob += dt * (1.4 + this.speed);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4.5);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.rangedCd = Math.max(0, this.rangedCd - dt);
    this.chargeCd = Math.max(0, this.chargeCd - dt);
    this.repathT -= dt;
    if (!this.alive) { this.deadT = (this.deadT || 0) + dt; return; }

    const { world, player, field, pathfinder } = ctx;
    const def = this.def;

    // ---- 目标选择：优先玩家，其次敌对阵营（阵营内讧）----
    let tgt = null;
    if (player.alive && this.canSee(world, player.x, player.z)) tgt = player;
    else if (isHostile(this.faction, FACTION.PLAYER)) {
      // 玩家在记忆期内：继续追最后已知位置
      if (this.memory > 0) tgt = { x: this.lastSeenX, z: this.lastSeenZ, ghost: true };
    }
    if (tgt && !tgt.ghost) { this.lastSeenX = tgt.x; this.lastSeenZ = tgt.z; this.memory = def.memory; }
    else this.memory = Math.max(0, this.memory - dt);

    // ---- 噪音：没看见就去查看声源 ----
    if (!tgt) {
      const h = this.hear(field);
      if (h > 0.05) {
        const ev = field.hear(this.x, this.z, def.hearing).ev;
        if (ev) {
          this.lastSeenX = ev.x; this.lastSeenZ = ev.z;
          this.memory = Math.max(this.memory, def.memory * 0.7);
          tgt = { x: ev.x, z: ev.z, ghost: true };
          if (this.state === STATE.IDLE || this.state === STATE.WANDER) {
            this.setState(STATE.INVESTIGATE);
            this.repathT = 0;
          }
        }
      }
    }

    const has = !!tgt;
    const d = has ? dist(this.x, this.z, tgt.x, tgt.z) : Infinity;
    const inAttackRange = has && !tgt.ghost && d <= (def.reach + (this.r + (player.r || 0.34)));

    // ---- 状态迁移 ----
    if (has && !tgt.ghost && inAttackRange) {
      this.setState(STATE.ATTACK);
    } else if (has && !tgt.ghost && def.ranged && d < def.ranged.range * 0.9 && this.rangedCd <= 0) {
      this.setState(STATE.RANGED);
    } else if (has && !tgt.ghost) {
      this.setState(STATE.CHASE);
    } else if (has && tgt.ghost) {
      this.setState(this.state === STATE.CHASE ? STATE.SEARCH : STATE.INVESTIGATE);
    } else if (this.state !== STATE.WANDER && this.state !== STATE.INVESTIGATE) {
      this.setState(STATE.IDLE);
    }

    this.stateT += dt;

    switch (this.state) {
      case STATE.IDLE:
        this.speed = 0;
        if (this.stateT > 1.2 + Math.random() * 2.5) {
          this.setState(STATE.WANDER);
          this.wanderX = this.x + (Math.random() - 0.5) * 12;
          this.wanderZ = this.z + (Math.random() - 0.5) * 12;
          this.repathT = 0;
        }
        break;
      case STATE.WANDER:
        this.follow(dt, world, pathfinder, this.wanderX, this.wanderZ, def.speed * 0.45);
        if (this.stateT > 6 || dist(this.x, this.z, this.wanderX, this.wanderZ) < 1.2) this.setState(STATE.IDLE);
        break;
      case STATE.INVESTIGATE:
      case STATE.SEARCH:
        this.follow(dt, world, pathfinder, tgt.x, tgt.z, def.speed * 0.75);
        if (dist(this.x, this.z, tgt.x, tgt.z) < 1.6) { this.setState(STATE.IDLE); }
        break;
      case STATE.CHASE:
        this.follow(dt, world, pathfinder, tgt.x, tgt.z, def.sprint, true);
        break;
      case STATE.ATTACK: this.actMelee(dt, ctx, tgt); break;
      case STATE.RANGED: this.actRanged(dt, ctx, tgt); break;
      default: break;
    }

    this.updateCharge(dt, ctx, tgt, d);
  }

  /**
   * 狂暴搜刮者的冲锋：前摇（身体亮红光、原地蓄力）→ 高速直线冲 → 硬直。
   * 前摇是玩家唯一的应对窗口，必须用翻滚无敌帧穿过 —— 这正是文档 §5.2 的设计。
   */
  updateCharge(dt, ctx, tgt, d) {
    const def = this.def;
    if (!def.charge || !tgt || tgt.ghost) return;
    const { world } = ctx;

    if (this.telegraph > 0) {
      this.telegraph -= dt;
      this.speed = 0;
      this.facing = approachAngle(this.facing, Math.atan2(tgt.x - this.x, tgt.z - this.z), dt * 6);
      if (this.telegraph <= 0) {
        this.charging = def.telegraph.hold;
        this.chargeDx = (tgt.x - this.x) / (d || 1);
        this.chargeDz = (tgt.z - this.z) / (d || 1);
      }
      return;
    }
    if (this.charging > 0) {
      this.charging -= dt;
      const s = def.sprint * (def.charge.speedMul ?? 1);
      moveWithCollision(world, this, this.chargeDx * s * dt, this.chargeDz * s * dt, this.r);
      this.speed = s;
      if (this.charging <= 0) this.telegraphJustEnded = true;
      return;
    }
    if (this.state === STATE.CHASE && d < def.charge.range && this.chargeCd <= 0) {
      this.telegraph = def.telegraph.at;
      this.chargeCd = def.charge.cd;
    }
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
  }

  /** 沿路径推进；无路径或路径过期则重新规划 */
  follow(dt, world, pathfinder, tx, tz, speed, urgent = false) {
    if (this.repathT <= 0 || !this.path) {
      this.path = pathfinder.find(this.x, this.z, tx, tz);
      this.pathIdx = 0;
      this.repathT = urgent ? 0.45 : 1.1;
    }
    let wp = this.path && this.path[this.pathIdx];
    if (!wp) { this.speed = 0; return; }
    if (dist(this.x, this.z, wp.x, wp.z) < 0.55) {
      this.pathIdx++;
      wp = this.path[this.pathIdx];
      if (!wp) { this.speed = 0; return; }
    }
    const dx = (wp.x - this.x) / (dist(this.x, this.z, wp.x, wp.z) || 1);
    const dz = (wp.z - this.z) / (dist(this.x, this.z, wp.x, wp.z) || 1);
    const vx = dx * speed * dt, vz = dz * speed * dt;
    const before = this.x + this.z;
    moveWithCollision(world, this, vx, vz, this.r);
    const moved = Math.abs(this.x + this.z - before);
    this.speed = moved / Math.max(dt, 1e-5);
    if (this.speed < 0.2) { this.stuck += dt; if (this.stuck > 0.5) { this.repathT = 0; this.stuck = 0; } }
    else this.stuck = 0;
    this.facing = approachAngle(this.facing, Math.atan2(dx, dz), dt * 8);
  }

  actMelee(dt, ctx, tgt) {
    const def = this.def;
    this.speed = 0;
    this.facing = approachAngle(this.facing, Math.atan2(tgt.x - this.x, tgt.z - this.z), dt * 10);
    if (this.telegraph > 0) return;
    if (this.attackCd > 0) return;
    this.attackCd = def.attackCd;
    const mul = this.telegraphJustEnded ? (def.telegraph?.damageMul ?? 1) : 1;
    this.telegraphJustEnded = false;
    bus.emit('enemy:attack', { enemy: this, target: tgt, damage: def.damage * mul });
  }

  actRanged(dt, ctx, tgt) {
    const def = this.def;
    this.speed = 0;
    this.facing = approachAngle(this.facing, Math.atan2(tgt.x - this.x, tgt.z - this.z), dt * 7);
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burstT = 60 / def.ranged.rpm;
        this.burstLeft--;
        bus.emit('enemy:shoot', { enemy: this, target: tgt });
        noiseField.emit(this.x, this.z, def.ranged.noise, 'gunshot', this, 0.5);
        if (this.burstLeft <= 0) this.rangedCd = def.ranged.cd;
      }
    } else if (this.rangedCd <= 0) {
      this.burstLeft = def.ranged.burst;
      this.burstT = 0;
    }
  }
}

/** 尸体：腐烂 → 尸体病（PZ），可被焚烧清理 */
export class Corpse {
  constructor(x, z, source) {
    this.x = x; this.z = z;
    this.rot = 0;                    // 0..1
    this.rotHours = 0;
    this.from = source?.type ?? 'scav';
    this.loot = source?.def?.loot ?? null;
    this.searched = false;
    this.id = _uid++;
  }
  update(dt, gameHours) {
    this.rotHours += gameHours;
    this.rot = clamp(this.rotHours / 72, 0, 1);   // 3 天腐烂完成
  }
}

export function spawnEnemies(world, rng, playerSpawn, minDist = 18) {
  const def = world.def;
  const list = [];
  const counts = def.enemies || {};
  for (const type in counts) {
    if (type === 'boss') continue;
    const n = typeof counts[type] === 'number' ? counts[type] : 0;
    if (!ENEMIES[type]) continue;              // 配置里写错 id 不该让整张图起不来
    for (let i = 0; i < n; i++) {
      const p = world.randomOpenPoint(rng, playerSpawn, minDist);
      list.push(new Enemy(type, p.x, p.z));
    }
  }
  const boss = counts.boss;
  const bdef = boss ? ENEMIES[boss] : null;
  if (bdef) {
    const n = bdef.count ?? 1;
    for (let i = 0; i < n; i++) {
      const p = world.randomOpenPoint(rng, playerSpawn, 26);
      list.push(new Enemy(boss, p.x, p.z));
    }
  }
  return list;
}

export const GUN_NOISE = NOISE.gun;
export const MELEE_STAMINA = COMBAT.stamina.swingCost;
