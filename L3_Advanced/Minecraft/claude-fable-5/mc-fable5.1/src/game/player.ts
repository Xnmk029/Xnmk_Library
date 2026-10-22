import * as THREE from "three";
import { Inventory } from "./inventory";
import { moveEntity, type MoveResult } from "./physics";
import { World } from "./world";

export const GRAVITY = 32;

export class Player {
  pos = new THREE.Vector3(0, 80, 0);
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  halfW = 0.3;
  height = 1.8;
  eye = 1.62;
  onGround = false;
  inWater = false;
  headInWater = false;
  inLava = false;
  flying = false;
  sprinting = false;
  sneaking = false;
  health = 20;
  maxHealth = 20;
  hurtTime = 0;
  regenTimer = 0;
  fallDist = 0;
  lastSpaceTap = -1;
  inventory = new Inventory();
  spawn = new THREE.Vector3();
  bob = 0;
  res: MoveResult = { onGround: false, hitWall: false, inWater: false, inLava: false, headInWater: false };
  fovTarget = 70;
  onHurt?: (amount: number) => void;
  onDeath?: () => void;

  getEye(out = new THREE.Vector3()) {
    const eye = this.sneaking && !this.flying ? this.eye - 0.3 : this.eye;
    return out.set(this.pos.x, this.pos.y + eye, this.pos.z);
  }
  getDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  toggleFly() {
    this.flying = !this.flying;
    if (this.flying) this.vel.y = 0;
  }

  update(dt: number, world: World, keys: Set<string>) {
    const fwd = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const jump = keys.has("Space");
    this.sneaking = keys.has("ShiftLeft") || keys.has("ShiftRight");
    if (keys.has("ControlRight") && fwd > 0) this.sprinting = true;
    if (fwd <= 0 || this.sneaking) this.sprinting = false;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // world-space move dir
    let mx = -sin * fwd + cos * strafe;
    let mz = -cos * fwd - sin * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    if (this.flying) {
      const speed = this.sprinting ? 21 : 10.9;
      this.vel.x = mx * speed;
      this.vel.z = mz * speed;
      let vy = 0;
      if (jump) vy += speed * 0.8;
      if (this.sneaking) vy -= speed * 0.8;
      this.vel.y = vy;
      this.fallDist = 0;
    } else if (this.inWater) {
      const speed = 2.2;
      this.vel.x += (mx * speed - this.vel.x) * Math.min(1, dt * 6);
      this.vel.z += (mz * speed - this.vel.z) * Math.min(1, dt * 6);
      if (jump) this.vel.y += (3.2 - this.vel.y) * Math.min(1, dt * 5);
      else if (this.sneaking) this.vel.y -= 8 * dt;
      else this.vel.y += (-1.6 - this.vel.y) * Math.min(1, dt * 2.5);
      this.fallDist = 0;
    } else {
      const speed = this.sneaking ? 1.31 : this.sprinting ? 5.612 : 4.317;
      const accel = this.onGround ? 14 : 3;
      this.vel.x += (mx * speed - this.vel.x) * Math.min(1, dt * accel);
      this.vel.z += (mz * speed - this.vel.z) * Math.min(1, dt * accel);
      if (jump && this.onGround) {
        this.vel.y = 8.6;
        this.onGround = false;
        if (this.sprinting) { this.vel.x += mx * 1.5; this.vel.z += mz * 1.5; }
      }
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -78) this.vel.y = -78;
    }

    const prevY = this.pos.y;
    const prevVy = this.vel.y;
    moveEntity(world, this.pos, this.halfW, this.height, this.vel, dt, this.res);
    this.onGround = this.res.onGround;
    this.inWater = this.res.inWater;
    this.headInWater = this.res.headInWater;
    this.inLava = this.res.inLava;
    // climb out of water onto ledges (like Minecraft's swim-up boost)
    if (this.inWater && this.res.hitWall && (jump || fwd > 0) && !this.flying) this.vel.y = Math.max(this.vel.y, 5.5);
    if (this.inLava) this.damage(4 * dt + 0.01, true);

    // fall damage
    if (!this.flying && !this.inWater) {
      if (this.pos.y < prevY) this.fallDist += prevY - this.pos.y;
      if (this.onGround) {
        if (this.fallDist > 3.2 && prevVy < -4) {
          const dmg = Math.floor(this.fallDist - 3);
          if (dmg > 0) this.damage(dmg);
        }
        this.fallDist = 0;
      }
    } else this.fallDist = 0;

    // regen
    if (this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer > 4) { this.regenTimer = 0; this.health = Math.min(this.maxHealth, this.health + 1); }
    }
    if (this.hurtTime > 0) this.hurtTime -= dt;
    // view bobbing
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hspeed > 0.5) this.bob += dt * hspeed * 1.8;
    this.fovTarget = this.sprinting && hspeed > 4.5 ? 80 : 70;
    if (this.pos.y < -10) this.damage(100);
  }

  damage(amount: number, continuous = false) {
    if (amount <= 0) return;
    if (!continuous && this.hurtTime > 0) return;
    this.health -= amount;
    this.hurtTime = continuous ? 0.05 : 0.5;
    this.regenTimer = -6;
    this.onHurt?.(amount);
    if (this.health <= 0) {
      this.health = 0;
      this.onDeath?.();
    }
  }

  respawn() {
    this.pos.copy(this.spawn);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.fallDist = 0;
    this.flying = false;
  }

  /** knockback from a source position */
  knockback(fromX: number, fromZ: number, power = 6) {
    let dx = this.pos.x - fromX, dz = this.pos.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    this.vel.x += dx * power;
    this.vel.z += dz * power;
    this.vel.y = Math.max(this.vel.y, 5);
  }
}
