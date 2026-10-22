// First-person controller: 1.7 m tall walker/wader/swimmer with AABB collision against the
// streamed chunk colliders. No UI, no objectives — just movement that feels physical.

import * as THREE from 'three';

const KEYS = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'up',
  ShiftLeft: 'run', ShiftRight: 'run',
  ControlLeft: 'down', KeyC: 'down',
};

export class Player {
  constructor({ camera, streamer, domElement, cfg }) {
    this.camera = camera;
    this.streamer = streamer;
    this.dom = domElement;
    this.cfg = cfg;

    this.position = new THREE.Vector3(0, 1.2, 0); // feet position
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.swimming = false;
    this.submerged = false;
    this.waterSurface = -Infinity;
    this.waterDepth = 0;
    this.eyeHeight = cfg.eyeHeight;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.viewRoll = 0;
    this.stepDistance = 0;
    this.splashEvent = 0;
    this.footstepEvent = 0;

    this.keys = Object.create(null);
    this.locked = false;
    this._tmp = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();

    this._bind();
  }

  _bind() {
    const dom = this.dom;
    addEventListener('keydown', (e) => {
      const k = KEYS[e.code];
      if (k) {
        this.keys[k] = true;
        if (e.code === 'Space') e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => {
      const k = KEYS[e.code];
      if (k) this.keys[k] = false;
    });
    addEventListener('blur', () => {
      this.keys = Object.create(null);
    });

    dom.addEventListener('click', () => {
      if (!this.locked && dom.requestPointerLock) dom.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look(e.movementX, e.movementY);
    });
    // Touch look/move so it is usable on a tablet as well.
    let touchId = null;
    let last = [0, 0];
    dom.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      touchId = t.identifier;
      last = [t.clientX, t.clientY];
      this.keys.fwd = t.clientY < innerHeight * 0.55;
    });
    dom.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue;
        this.look((t.clientX - last[0]) * 2.2, (t.clientY - last[1]) * 2.2);
        last = [t.clientX, t.clientY];
      }
    });
    dom.addEventListener('touchend', () => {
      touchId = null;
      this.keys.fwd = false;
    });
  }

  look(dx, dy) {
    this.yaw -= dx * this.cfg.mouseSensitivity;
    this.pitch -= dy * this.cfg.mouseSensitivity;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    // Snap to a real standing surface near the requested height so scripted jumps can't embed the
    // player inside geometry.
    const g = this.streamer.groundHeight(x, z, y + 2.0);
    if (isFinite(g) && Math.abs(g - y) < 6.0) this.position.y = Math.max(y, g + 0.02);
    this._unstick(1.7);
  }

  // ---- collision -------------------------------------------------------------------------------

  /**
   * Test the player AABB at its current position against nearby colliders.
   * Returns { hit, maxTop, minBottom } where maxTop is the highest overlapped box top
   * (step-up candidate) and minBottom the lowest overlapped box bottom (ceiling candidate).
   */
  _overlap(height) {
    const p = this.position;
    const r = this.cfg.radius;
    const minX = p.x - r;
    const maxX = p.x + r;
    const minY = p.y + 0.002;
    const maxY = p.y + height;
    const minZ = p.z - r;
    const maxZ = p.z + r;

    let hit = false;
    let maxTop = -Infinity;
    let minBottom = Infinity;

    for (const c of this.streamer.near(p.x, p.z, 1)) {
      const a = c.colliders;
      for (let i = 0; i < a.length; i += 6) {
        if (maxX <= a[i] || minX >= a[i + 3]) continue;
        if (maxZ <= a[i + 2] || minZ >= a[i + 5]) continue;
        if (maxY <= a[i + 1] || minY >= a[i + 4]) continue;
        hit = true;
        if (a[i + 4] > maxTop) maxTop = a[i + 4];
        if (a[i + 1] < minBottom) minBottom = a[i + 1];
      }
    }
    return { hit, maxTop, minBottom };
  }

  /** Move on one horizontal axis; cancel the move if blocked, or step up onto low ledges. */
  _tryHorizontal(axis, delta, height) {
    if (delta === 0) return;
    const p = this.position;
    const before = p.getComponent(axis);
    const beforeY = p.y;
    p.setComponent(axis, before + delta);

    const c = this._overlap(height);
    if (!c.hit) return;

    // Stair / pool-step assist: hop up if the obstruction is a low ledge with headroom.
    if (c.maxTop > p.y + 0.02 && c.maxTop - p.y <= 0.46) {
      p.y = c.maxTop + 0.004;
      if (!this._overlap(height).hit) {
        this.onGround = true;
        return;
      }
      p.y = beforeY;
    }

    p.setComponent(axis, before);
    this.velocity.setComponent(axis, 0);
  }

  _tryVertical(dy, height) {
    if (dy === 0) return;
    const p = this.position;
    const before = p.y;
    p.y += dy;

    const c = this._overlap(height);
    if (!c.hit) return;

    if (dy < 0) {
      // Landing: settle on the highest overlapped surface.
      p.y = c.maxTop > before ? before : c.maxTop;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      p.y = Math.min(before, c.minBottom - height - 0.002);
      this.velocity.y = Math.min(0, this.velocity.y);
    }
  }

  /**
   * If we somehow ended up inside geometry (bad teleport, streaming seam), climb out onto the
   * surface we are embedded in rather than drifting upwards forever.
   */
  _unstick(height) {
    for (let i = 0; i < 8; i++) {
      const c = this._overlap(height);
      if (!c.hit) {
        if (i > 0) this.velocity.set(0, 0, 0);
        return;
      }
      // Small embedding (a step, a coping lip): rise onto the surface we are inside.
      if (isFinite(c.maxTop) && c.maxTop > this.position.y && c.maxTop - this.position.y <= 0.7) {
        this.position.y = c.maxTop + 0.01;
        continue;
      }
      // Deeply embedded (e.g. inside a column): step aside rather than climbing a wall.
      let freed = false;
      const r = this.cfg.radius + 0.05;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const ox = Math.cos(ang) * r;
        const oz = Math.sin(ang) * r;
        this.position.x += ox;
        this.position.z += oz;
        if (!this._overlap(height).hit) {
          freed = true;
          break;
        }
        this.position.x -= ox;
        this.position.z -= oz;
      }
      if (freed) continue;
      // Last resort: drop onto whatever solid surface is below.
      const g = this.streamer.groundHeight(this.position.x, this.position.z, this.position.y + 2.2);
      if (isFinite(g) && g < this.position.y - 0.02) {
        this.position.y = g + 0.01;
        continue;
      }
      break;
    }
    if (this._overlap(height).hit) {
      // Last resort: give up on this frame's motion instead of tunnelling through the world.
      this.velocity.set(0, 0, 0);
    }
  }

  // ---- update ----------------------------------------------------------------------------------

  update(dt) {
    const cfg = this.cfg;
    const height = 1.7;
    dt = Math.min(dt, 1 / 30);

    // Water state ------------------------------------------------------------------------------
    const w = this.streamer.waterColumnAt(this.position.x, this.position.z);
    const feetY = this.position.y;
    if (w && feetY < w.surface + 0.02) {
      this.inWater = true;
      this.waterSurface = w.surface;
      this.waterDepth = Math.max(0, w.surface - feetY);
      this.swimming = this.waterDepth > 1.15;
    } else {
      if (this.inWater && this.waterDepth > 0.35) this.splashEvent = 1;
      this.inWater = false;
      this.swimming = false;
      this.waterDepth = 0;
      this.waterSurface = w ? w.surface : -Infinity;
    }

    // Desired direction ------------------------------------------------------------------------
    const k = this.keys;
    let ix = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    let iz = (k.fwd ? 1 : 0) - (k.back ? 1 : 0);
    const len = Math.hypot(ix, iz);
    if (len > 0) {
      ix /= len;
      iz /= len;
    }

    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    if (this.swimming) {
      // Swimming: view-aligned thrust, buoyancy toward the surface, heavy drag.
      const pitchFwd = new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch),
      );
      const thrust = this._tmp
        .set(0, 0, 0)
        .addScaledVector(pitchFwd, iz)
        .addScaledVector(this._right, ix);
      if (k.up) thrust.y += 0.9;
      if (k.down) thrust.y -= 0.9;
      if (thrust.lengthSq() > 0) thrust.normalize();
      const speed = cfg.swimSpeed * (k.run ? 1.5 : 1.0);
      this.velocity.addScaledVector(thrust, speed * 5.0 * dt);

      // Buoyancy: bob the body just under the surface unless actively diving.
      const eyeY = this.position.y + this.eyeHeight;
      const overshoot = eyeY - (this.waterSurface - 0.12);
      const buoy = k.down ? -1.5 : THREE.MathUtils.clamp(-overshoot * 5.5, -3.0, 3.5);
      this.velocity.y += buoy * dt * 2.2;
      this.velocity.multiplyScalar(Math.pow(0.06, dt));
      this.onGround = false;
    } else {
      const wade = THREE.MathUtils.clamp(this.waterDepth / 1.2, 0, 1);
      const speed = (k.run ? cfg.runSpeed : cfg.walkSpeed) * (1.0 - wade * 0.55);
      const target = this._tmp
        .set(0, 0, 0)
        .addScaledVector(this._fwd, iz)
        .addScaledVector(this._right, ix)
        .multiplyScalar(speed);
      const accel = this.onGround ? 14.0 : 4.5;
      this.velocity.x += (target.x - this.velocity.x) * Math.min(1, accel * dt);
      this.velocity.z += (target.z - this.velocity.z) * Math.min(1, accel * dt);
      this.velocity.y -= cfg.gravity * dt;
      if (k.up && this.onGround) {
        this.velocity.y = cfg.jumpSpeed * (1.0 - wade * 0.4);
        this.onGround = false;
      }
      if (this.inWater) this.velocity.y *= Math.pow(0.35, dt); // drag in shallow water
    }

    // Integrate with sub-steps so fast motion cannot tunnel through walls.
    const move = this._tmp.copy(this.velocity).multiplyScalar(dt);
    const steps = Math.max(1, Math.min(8, Math.ceil(move.length() / 0.16)));
    this.onGround = false;
    for (let s = 0; s < steps; s++) {
      this._tryHorizontal(0, move.x / steps, height);
      this._tryHorizontal(2, move.z / steps, height);
      this._tryVertical(move.y / steps, height);
    }
    this._unstick(height);

    // Falling out of the world (shouldn't happen, but never trap the player).
    if (this.position.y < -30) {
      const g = this.streamer.groundHeight(this.position.x, this.position.z, 30);
      this.teleport(this.position.x, g + 0.2, this.position.z);
    }

    // Head bob + footsteps --------------------------------------------------------------------
    const hspeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && hspeed > 0.4) {
      this.stepDistance += hspeed * dt;
      this.bobPhase += hspeed * dt * 3.3;
      this.bobAmount += (Math.min(1, hspeed / cfg.runSpeed) - this.bobAmount) * Math.min(1, dt * 6);
      if (this.stepDistance > 1.55) {
        this.stepDistance = 0;
        this.footstepEvent = this.inWater ? 2 : 1;
      }
    } else {
      this.bobAmount += (0 - this.bobAmount) * Math.min(1, dt * 4);
    }

    // Idle breathing: a barely-there sway so standing still never feels like a frozen camera.
    this.idleTime = (this.idleTime || 0) + dt;
    const idle = 1.0 - Math.min(1, this.bobAmount * 3.0);
    const breathe = Math.sin(this.idleTime * 1.15) * 0.009 * idle;
    const sway = Math.sin(this.idleTime * 0.43 + 1.7) * 0.0016 * idle;

    const bobY = Math.sin(this.bobPhase * 2.0) * 0.032 * this.bobAmount + breathe;
    const bobX = Math.cos(this.bobPhase) * 0.026 * this.bobAmount;
    const targetRoll = -this.velocity.dot(this._right) * 0.006 + Math.cos(this.bobPhase) * 0.008 * this.bobAmount;
    this.viewRoll += (targetRoll - this.viewRoll) * Math.min(1, dt * 8);

    // Camera ------------------------------------------------------------------------------------
    const eye = this.eyeHeight + bobY + (this.swimming ? -0.16 : 0);
    this.camera.position.set(this.position.x + bobX * 0.4, this.position.y + eye, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw + sway);
    this.camera.rotateX(this.pitch + sway * 0.6);
    this.camera.rotateZ(this.viewRoll);

    const camY = this.camera.position.y;
    const wc = this.streamer.waterColumnAt(this.camera.position.x, this.camera.position.z);
    this.submerged = !!wc && camY < wc.surface - 0.02;
    if (wc) this.waterSurface = wc.surface;
  }

  consumeFootstep() {
    const v = this.footstepEvent;
    this.footstepEvent = 0;
    return v;
  }

  consumeSplash() {
    const v = this.splashEvent;
    this.splashEvent = 0;
    return v;
  }
}
