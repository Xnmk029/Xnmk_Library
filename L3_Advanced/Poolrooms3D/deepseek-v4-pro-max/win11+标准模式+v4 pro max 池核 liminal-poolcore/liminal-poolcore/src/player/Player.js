/**
 * player/Player.js — 第一人称控制（PointerLockControls）+ 解析式碰撞 + 涉水/游泳
 * ===========================================================================
 * ▍不需要碰撞网格
 *   世界是纯函数场（Field），所以碰撞直接**解析查询**：
 *   isSolid(x,y,z) / floorYAt(x,z) / waterDepthAt(x,z)。
 *   这意味着无论玩家跑到多远、chunk 有没有加载完，碰撞永远正确且零内存开销。
 *
 * ▍三种运动状态
 *   · 步行（onGround）：可自动抬腿越过 ≤ stepUp 的池阶/台阶
 *   · 涉水（wading）：脚踝到腰深，速度衰减，每隔一段路程在水面留下涟漪
 *   · 游泳（swimming）：3D 自由移动 + 浮力回到水面；相机低于水面即触发水下渲染
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { PLAYER, WORLD } from '../config.js';

const SAMPLE_DIRS = 6;

export class Player {
  /**
   * @param {object} opts
   * @param {THREE.PerspectiveCamera} opts.camera
   * @param {HTMLElement} opts.domElement
   * @param {import('../gen/Field.js').Field} opts.field
   * @param {import('../render/Water.js').WaterSystem} opts.water
   */
  constructor({ camera, domElement, field, water }) {
    this.camera = camera;
    this.field = field;
    this.water = water;
    this.controls = new PointerLockControls(camera, domElement);

    /** 脚底位置（相机 = 脚底 + eyeHeight + 平滑量） */
    this.position = new THREE.Vector3(0, WORLD.deckY, 0);
    this.velocity = new THREE.Vector3();
    this.keys = Object.create(null);

    this.onGround = false;
    this.swimming = false;
    this.wading = false;
    this.depth = 0;
    this.underwater = false;
    this.speed = 0;

    this._eyeSmooth = 0;         // 抬腿/落地的视觉平滑
    this._bob = 0;               // 走动微晃
    this._wadeAccum = 0;         // 涉水涟漪节流
    this._wasInWater = false;
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();

    this._onKey = (e, down) => {
      const k = e.code;
      this.keys[k] = down;
      if (down && (k === 'Space' || k.startsWith('Arrow'))) e.preventDefault();
    };
    this._kd = (e) => this._onKey(e, true);
    this._ku = (e) => this._onKey(e, false);
    window.addEventListener('keydown', this._kd, { passive: false });
    window.addEventListener('keyup', this._ku);
  }

  /** 放置到出生点（Field.findSpawn 的结果） */
  spawn(p) {
    this.position.set(p.x, p.y + 0.02, p.z);
    this.velocity.set(0, 0, 0);
    this.camera.position.set(p.x, p.y + PLAYER.eyeHeight, p.z);
  }

  /** 某点是否与玩家圆柱体碰撞（多方向 × 两个高度采样） */
  _blocked(x, z, feetY) {
    const r = PLAYER.radius;
    const f = this.field;
    for (let hi = 0; hi < 2; hi++) {
      const h = feetY + (hi === 0 ? 0.45 : 1.45);
      if (f.isSolid(x, h, z)) return true;
      for (let i = 0; i < SAMPLE_DIRS; i++) {
        const a = (i / SAMPLE_DIRS) * Math.PI * 2;
        if (f.isSolid(x + Math.cos(a) * r, h, z + Math.sin(a) * r)) return true;
      }
    }
    return false;
  }

  /** 单轴推进 + 自动抬腿 */
  _moveAxis(dx, dz) {
    const p = this.position;
    const nx = p.x + dx, nz = p.z + dz;
    if (!this._blocked(nx, nz, p.y + 0.05)) { p.x = nx; p.z = nz; return; }
    // 抬腿：目标点地面不高于 stepUp，且抬起后不再被挡
    const targetFloor = this.field.floorYAt(nx, nz);
    const rise = targetFloor - p.y;
    if (rise > 0.001 && rise <= PLAYER.stepUp && !this._blocked(nx, nz, targetFloor + 0.05)) {
      this._eyeSmooth -= rise;         // 视觉上平滑抬起，不要瞬移
      p.set(nx, targetFloor, nz);
    }
  }

  update(dt, time) {
    const p = this.position;
    const v = this.velocity;
    const f = this.field;

    // ── 采样当前所处环境 ─────────────────────────────────────────
    this.depth = f.waterDepthAt(p.x, p.z);
    const groundY = f.floorYAt(p.x, p.z);
    const eyeY = p.y + PLAYER.eyeHeight + this._eyeSmooth;
    this.swimming = this.depth > PLAYER.swimSubmergeDepth && (p.y + 0.9) < WORLD.waterY;
    this.wading = !this.swimming && this.depth > 0.04;
    this.underwater = eyeY < WORLD.waterY - 0.02;

    // ── 输入 → 期望方向（相机朝向的水平投影）─────────────────────
    const k = this.keys;
    const fwdInput = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const sideInput = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const sprint = !!(k.ShiftLeft || k.ShiftRight);

    this.camera.getWorldDirection(this._forward);
    this._right.set(this._forward.z, 0, -this._forward.x).normalize();

    const wish = this._wish.set(0, 0, 0);
    if (this.swimming) {
      // 游泳：沿视线 3D 前进
      wish.addScaledVector(this._forward, fwdInput);
      wish.addScaledVector(this._right, -sideInput);
      if (k.Space) wish.y += 1;
      if (k.KeyC || k.ControlLeft) wish.y -= 1;
    } else {
      const flat = _v.set(this._forward.x, 0, this._forward.z).normalize();
      wish.addScaledVector(flat, fwdInput);
      wish.addScaledVector(this._right, -sideInput);
    }
    if (wish.lengthSq() > 1e-6) wish.normalize();

    // ── 速度积分 ────────────────────────────────────────────────
    if (this.swimming) {
      const target = PLAYER.swimSpeed * (sprint ? 1.5 : 1.0);
      v.x += (wish.x * target - v.x) * Math.min(1, dt * PLAYER.waterDrag);
      v.z += (wish.z * target - v.z) * Math.min(1, dt * PLAYER.waterDrag);
      v.y += (wish.y * target - v.y) * Math.min(1, dt * PLAYER.waterDrag);
      // 浮力：越深越强，把玩家推回水面（悬浮在水面附近）
      const submerge = WORLD.waterY - (p.y + PLAYER.eyeHeight * 0.85);
      if (submerge > 0) v.y += Math.min(submerge, 1.6) * PLAYER.buoyancy * dt * 0.35;
      v.y -= PLAYER.gravity * 0.12 * dt;
    } else {
      const wadeFactor = this.wading ? THREE.MathUtils.lerp(1.0, 0.45, Math.min(1, this.depth / 1.1)) : 1.0;
      const target = (sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * wadeFactor;
      const accel = this.onGround ? PLAYER.airDrag : PLAYER.airDrag * 0.35;
      v.x += (wish.x * target - v.x) * Math.min(1, dt * accel);
      v.z += (wish.z * target - v.z) * Math.min(1, dt * accel);
      v.y -= PLAYER.gravity * dt;
      if (k.Space && this.onGround) {
        v.y = PLAYER.jumpSpeed;
        this.onGround = false;
      }
    }

    // ── 水平推进（分轴 + 抬腿）───────────────────────────────────
    this._moveAxis(v.x * dt, 0);
    this._moveAxis(0, v.z * dt);

    // ── 垂直 ────────────────────────────────────────────────────
    p.y += v.y * dt;
    const floorNow = f.floorYAt(p.x, p.z);
    if (p.y <= floorNow) {
      if (!this.onGround && v.y < -6.5 && this.depth <= 0.04) this._eyeSmooth -= 0.09; // 落地屈膝
      p.y = floorNow;
      if (v.y < 0) v.y = 0;
      this.onGround = true;
    } else if (p.y > floorNow + 0.02) {
      this.onGround = false;
    }
    // 天花板
    const headRoom = WORLD.ceilingY - 0.12;
    if (p.y + PLAYER.eyeHeight > headRoom) {
      p.y = headRoom - PLAYER.eyeHeight;
      if (v.y > 0) v.y = 0;
    }

    // ── 水面涟漪（入水 / 涉水 / 游泳）────────────────────────────
    const inWater = this.depth > 0.04;
    const horizSpeed = Math.hypot(v.x, v.z);
    this.speed = horizSpeed;
    if (inWater && !this._wasInWater) {
      this.water?.addRipple(p.x, p.z, PLAYER.splashRippleStrength * (this.swimming ? 1.4 : 1.0), time);
    }
    if (inWater) {
      this._wadeAccum += horizSpeed * dt;
      const stride = this.swimming ? 1.6 : 0.85;
      if (this._wadeAccum > stride) {
        this._wadeAccum = 0;
        this.water?.addRipple(p.x, p.z, this.swimming ? 0.5 : 0.85, time);
      }
    }
    this._wasInWater = inWater;

    // ── 相机（眼高 + 平滑 + 微晃）────────────────────────────────
    this._eyeSmooth += (0 - this._eyeSmooth) * Math.min(1, dt * 9);
    if (this.onGround && horizSpeed > 0.6) {
      this._bob += dt * horizSpeed * 2.2;
    } else {
      this._bob += dt * 0.6;
    }
    const bob = this.onGround ? Math.sin(this._bob * 2.0) * 0.018 * Math.min(1, horizSpeed / 4) : 0;
    const swimBob = this.swimming ? Math.sin(time * 1.1) * 0.05 : 0;
    this.camera.position.set(
      p.x,
      p.y + PLAYER.eyeHeight + this._eyeSmooth + bob + swimBob,
      p.z,
    );
  }

  /** 朝视线方向在水面打一个涟漪（鼠标点击）*/
  splashAhead(time) {
    const dir = this.camera.getWorldDirection(_v).clone();
    const camY = this.camera.position.y;
    // 与水面求交
    if (Math.abs(dir.y) < 1e-3) return;
    const t = (WORLD.waterY - camY) / dir.y;
    if (t < 0 || t > 40) return;
    const x = this.camera.position.x + dir.x * t;
    const z = this.camera.position.z + dir.z * t;
    if (this.field.waterDepthAt(x, z) > 0.02) this.water?.addRipple(x, z, 1.2, time);
  }

  dispose() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    this.controls.disconnect?.();
  }
}

const _v = new THREE.Vector3();
export default Player;
