/* 玩家：物理、碰撞、飞行、游泳、相机 */
(function () {
  'use strict';
  const { B, SOLID } = window.Blocks;
  const HW = 0.3, HH = 1.8, EYE = 1.62;
  const GRAV = 32, JUMP = 8.4, WALK = 4.32, SPRINT = 5.61, SNEAK = 1.31;
  const FLY = 10.9, FLY_FAST = 21.8;

  class Player {
    constructor(world, camera) {
      this.world = world;
      this.camera = camera;
      this.pos = new THREE.Vector3(8.5, 62, 8.5);
      this.vel = new THREE.Vector3();
      this.yaw = Math.PI * 0.25;
      this.pitch = -0.1;
      this.onGround = false;
      this.fly = false;
      this.inWater = false;
      this.bob = 0;
      this.fov = 75;
      this.step = 0;
    }

    isSolid(x, y, z) { return SOLID(this.world.getBlock(x, y, z)); }

    collides(x, y, z) {
      const x0 = Math.floor(x - HW), x1 = Math.floor(x + HW);
      const y0 = Math.floor(y), y1 = Math.floor(y + HH - 0.001);
      const z0 = Math.floor(z - HW), z1 = Math.floor(z + HW);
      for (let by = y0; by <= y1; by++) {
        for (let bx = x0; bx <= x1; bx++) {
          for (let bz = z0; bz <= z1; bz++) {
            if (this.isSolid(bx, by, bz)) return true;
          }
        }
      }
      return false;
    }

    inWaterAt(x, y, z) {
      return this.world.getBlock(Math.floor(x), Math.floor(y + 0.4), Math.floor(z)) === B.WATER;
    }

    update(dt, input) {
      this.inWater = this.inWaterAt(this.pos.x, this.pos.y, this.pos.z) ||
                     this.inWaterAt(this.pos.x, this.pos.y + 1.0, this.pos.z);

      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      let fx = 0, fz = 0;
      if (input.forward) { fx -= sin; fz -= cos; }
      if (input.back) { fx += sin; fz += cos; }
      if (input.left) { fx -= cos; fz += sin; }
      if (input.right) { fx += cos; fz -= sin; }
      const fl = Math.hypot(fx, fz);
      if (fl > 0) { fx /= fl; fz /= fl; }

      let speed;
      if (this.fly) speed = input.sprint ? FLY_FAST : FLY;
      else if (this.inWater) speed = 2.3;
      else if (input.sneak) speed = SNEAK;
      else if (input.sprint) speed = SPRINT;
      else speed = WALK;

      const k = 1 - Math.exp(-(this.onGround ? 14 : 5) * dt);
      this.vel.x += (fx * speed - this.vel.x) * k;
      this.vel.z += (fz * speed - this.vel.z) * k;

      if (this.fly) {
        const tv = (input.up ? 1 : 0) - (input.down ? 1 : 0);
        this.vel.y += (tv * (input.sprint ? FLY_FAST : FLY) - this.vel.y) * (1 - Math.exp(-12 * dt));
      } else if (this.inWater) {
        this.vel.y -= GRAV * 0.22 * dt;
        if (this.vel.y < -4) this.vel.y = -4;
        if (input.up) this.vel.y = 3.4;
      } else {
        this.vel.y -= GRAV * dt;
        if (this.vel.y < -55) this.vel.y = -55;
        if (input.up && this.onGround) { this.vel.y = JUMP; this.onGround = false; }
      }

      const p = this.pos, EPS = 0.001;
      let hitX = false, hitZ = false;
      p.x += this.vel.x * dt;
      if (this.collides(p.x, p.y, p.z)) {
        if (this.vel.x > 0) p.x = Math.floor(p.x + HW) - HW - EPS;
        else p.x = Math.floor(p.x - HW) + 1 + HW + EPS;
        this.vel.x = 0; hitX = true;
      }
      p.z += this.vel.z * dt;
      if (this.collides(p.x, p.y, p.z)) {
        if (this.vel.z > 0) p.z = Math.floor(p.z + HW) - HW - EPS;
        else p.z = Math.floor(p.z - HW) + 1 + HW + EPS;
        this.vel.z = 0; hitZ = true;
      }
      this.onGround = false;
      p.y += this.vel.y * dt;
      if (this.collides(p.x, p.y, p.z)) {
        if (this.vel.y <= 0) { p.y = Math.floor(p.y) + 1 + EPS; this.onGround = true; }
        else p.y = Math.floor(p.y + HH) - HH - EPS;
        this.vel.y = 0;
      }
      // 自动上台阶（0.6 格，MC 特性）
      if ((hitX || hitZ) && this.onGround && this.vel.y <= 0 && !this.collides(p.x, p.y + 0.6, p.z)) {
        p.y += 0.6;
      }
      this.step = p.y;

      // 相机 + 视差晃动
      const moving = input.forward || input.back || input.left || input.right;
      const bobAmt = (this.onGround && moving && !this.fly && !this.inWater) ? 1 : 0;
      if (bobAmt) this.bob += dt * (input.sprint ? 11 : 8);
      else this.bob *= Math.exp(-10 * dt);
      const bobY = Math.sin(this.bob) * 0.045 * bobAmt;
      this.camera.position.set(p.x, p.y + EYE + bobY, p.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.pitch, this.yaw, 0);

      const targetFov = 75 + (input.sprint && !this.fly && !this.inWater ? 7 : 0) + (this.fly ? 3 : 0);
      this.fov += (targetFov - this.fov) * (1 - Math.exp(-6 * dt));
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  window.Player = Player;
})();
