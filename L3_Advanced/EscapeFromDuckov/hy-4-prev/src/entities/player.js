// 玩家实体：位置、朝向、姿态、体力/耐力、翻滚无敌帧。
// 只存状态与推进逻辑，渲染由 render/entities.js 负责（逻辑层不 import three）。
import { COMBAT, MOODLE } from '../data/balance.js';
import { moveWithCollision } from '../systems/movement.js';
import { clamp, clamp01, approachAngle, TAU } from '../core/math2d.js';

export const STANCE = { STAND: 0, CROUCH: 1, PRONE: 2 };

export class Player {
  constructor(spawn) {
    this.x = spawn.x; this.z = spawn.z;
    this.px = spawn.x; this.pz = spawn.z;       // 上一帧位置（渲染插值用）
    this.r = 0.34;
    this.facing = 0;                            // 身体朝向（弧度）
    this.aim = 0;                               // 瞄准朝向（跟随鼠标）
    this.vx = 0; this.vz = 0;
    this.speed = 0;
    this.stance = STANCE.STAND;
    this.stamina = COMBAT.stamina.max;
    this.endurance = 0;                         // 已耗耐力比例 0..1（PZ Endurance）
    this.rollT = 0;                             // 翻滚剩余时间
    this.rollDx = 0; this.rollDz = 0;
    this.iFrame = 0;
    this.sprinting = false;
    this.sneaking = false;
    this.moving = false;
    this.noiseTimer = 0;
    this.bob = 0;
    this.alive = true;
    this.downed = false;
    this.maxHp = 100;
    this.hp = 100;                  // M3 起由部位伤病系统合成，此处仅作占位
  }

  get rollSpeedMul() { return this.rollT > 0 ? COMBAT.move.rollSpeed / COMBAT.move.run : 1; }

  /** 速度受姿态、耐力、负重、腿部伤势共同影响（后两者由 statPipeline 注入） */
  update(dt, intent, aimPoint, speedMul = 1, canSprint = true) {
    this.px = this.x; this.pz = this.z;
    if (!this.alive) return;
    // 越界兜底：任何来源的非法坐标都不允许把实体丢到地图外（否则碰撞与 AI 全线失效）
    const b = this.world.bounds;
    if (b) { this.x = clamp(this.x, b.minX, b.maxX); this.z = clamp(this.z, b.minZ, b.maxZ); }

    // ---- 翻滚：0.3s 冲刺 + 0.26s 无敌帧（文档 §7.1）----
    if (this.rollT > 0) {
      this.rollT -= dt;
      this.iFrame = Math.max(0, this.iFrame - dt);
      const k = Math.max(0, this.rollT) / COMBAT.move.rollTime;
      const v = COMBAT.move.rollSpeed * (0.35 + 0.65 * k);
      moveWithCollision(this.world, this, this.rollDx * v * dt, this.rollDz * v * dt, this.r);
      this.speed = v;
      this.facing = approachAngle(this.facing, Math.atan2(this.rollDx, this.rollDz), dt * 10);
      return;
    }
    if (intent.dodge && (intent.mx || intent.mz) && this.stamina > COMBAT.stamina.dodgeCost) {
      const l = Math.hypot(intent.mx, intent.mz) || 1;
      this.rollDx = intent.mx / l; this.rollDz = intent.mz / l;
      this.rollT = COMBAT.move.rollTime;
      this.iFrame = COMBAT.move.iFrame;
      this.stamina -= COMBAT.stamina.dodgeCost;
      this.onRoll?.();
      return;
    }

    // ---- 姿态与基础速度 ----
    this.sneaking = !!intent.sneak;
    const wantSprint = !!intent.sprint && canSprint && this.endurance < 0.5 && this.stamina > 3;
    this.sprinting = wantSprint && (intent.mx !== 0 || intent.mz !== 0);
    let base = this.sneaking ? COMBAT.move.sneak
      : this.sprinting ? COMBAT.move.sprint
        : (intent.mx || intent.mz) ? COMBAT.move.run : 0;
    if (this.stance === STANCE.CROUCH) base *= COMBAT.move.crouchMul;
    base *= speedMul;

    // ---- 耐力/体力消耗（PZ：冲刺耗耐力，耗尽禁冲刺）----
    if (this.sprinting) {
      this.stamina -= COMBAT.stamina.sprintDrain * dt;
      this.endurance = clamp01(this.endurance + dt * 0.055);
    } else if (base > COMBAT.move.walk) {
      this.stamina -= COMBAT.stamina.runDrain * dt * 0.5;
      this.endurance = clamp01(this.endurance + dt * 0.012);
    } else {
      this.stamina += COMBAT.stamina.walkRegen * dt * (base > 0 ? 0.6 : 1.4);
      this.endurance = Math.max(0, this.endurance - dt * 0.030);
    }
    this.stamina = clamp(this.stamina, 0, COMBAT.stamina.max);
    this.endurance = clamp01(this.endurance);
    if (this.stamina <= 0) this.sprinting = false;

    // ---- 移动 ----
    const l = Math.hypot(intent.mx, intent.mz);
    this.moving = l > 0.01;
    if (this.moving) {
      const dx = (intent.mx / l) * base * dt;
      const dz = (intent.mz / l) * base * dt;
      const res = moveWithCollision(this.world, this, dx, dz, this.r);
      this.speed = Math.hypot(res.movedX, res.movedZ) / Math.max(dt, 1e-5);
      this.bob += dt * this.speed * 2.6;
    } else {
      this.speed = 0;
      this.bob += dt * 1.2;
    }

    // ---- 朝向：身体跟着移动方向，头部/武器永远指向鼠标 ----
    if (aimPoint) this.aim = Math.atan2(aimPoint.x - this.x, aimPoint.z - this.z);
    if (this.moving && !intent.aim) {
      this.facing = approachAngle(this.facing, Math.atan2(intent.mx, intent.mz), dt * 12);
    } else {
      this.facing = approachAngle(this.facing, this.aim, dt * 14);
    }
  }

  get invulnerable() { return this.iFrame > 0; }
}

/** 依据 Endurance 档位取效果（PZ 数值：25/50/75/90%） */
export function enduranceTier(t) {
  let out = null;
  for (const e of MOODLE.endurance) if (t >= e.at) out = e;
  return out;
}
