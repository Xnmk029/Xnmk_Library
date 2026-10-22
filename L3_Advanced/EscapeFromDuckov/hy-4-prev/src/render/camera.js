// 相机装置：正交俯视（文档 §7.1：Orthographic / Size 6-8）+ 死区跟随 + 屏幕震动。
// 两台相机同姿态：camWorld 只渲染世界层，camChar 只渲染角色层
// —— 角色因此在调色/暗角之后再绘制，天然保持高饱和固有色（§5.1）。
import * as THREE from 'three';
import { RENDER } from '../data/balance.js';
import { clamp, damp, lerp } from '../core/math2d.js';

export const LAYER_WORLD = 0;
export const LAYER_CHAR = 1;
export const LAYER_HEAT = 2;

export class CameraRig {
  constructor(w, h) {
    const size = RENDER.orthoSize;
    const aspect = w / h;
    this.size = size;
    this.zoom = 1;
    this.camWorld = new THREE.OrthographicCamera(-aspect * size, aspect * size, size, -size, 0.1, 220);
    this.camChar = this.camWorld.clone();
    this.camHeat = this.camWorld.clone();
    this.camWorld.layers.set(LAYER_WORLD);
    this.camChar.layers.set(LAYER_CHAR);
    this.camHeat.layers.set(LAYER_HEAT);   // 只有热成像模式会启用这一层
    this.cameras = [this.camWorld, this.camChar, this.camHeat];
    this.perspCam = null;                 // 透视模式（V 键）
    this.perspective = false;

    this.target = new THREE.Vector3();
    this.focus = new THREE.Vector3();     // 平滑后的实际注视点
    this.aimBias = new THREE.Vector2();
    this.shake = 0;
    this.shakeSeed = Math.random() * 100;
    this.dist = 60;
    this.resize(w, h);
    this._apply();
  }

  resize(w, h) {
    const aspect = w / h;
    const s = this.size * this.zoom;
    for (const c of this.cameras) {
      if (c.isOrthographicCamera) {
        c.left = -aspect * s; c.right = aspect * s; c.top = s; c.bottom = -s;
      } else {
        c.aspect = aspect;
      }
      c.updateProjectionMatrix();
    }
    if (this.perspCam) { this.perspCam.aspect = aspect; this.perspCam.updateProjectionMatrix(); }
  }

  setZoom(z) { this.zoom = clamp(z, 0.55, 1.9); this.resize(window.innerWidth, window.innerHeight); }

  /** 后坐力/爆炸/受击的屏幕震动 */
  addShake(v) { this.shake = Math.min(1.2, this.shake + v); }

  follow(px, pz, dt, aimX = 0, aimZ = 0) {
    // 死区：小幅移动不推动相机，避免像素级抖动
    const dx = px - this.target.x, dz = pz - this.target.z;
    const d = Math.hypot(dx, dz);
    const dead = 0.55;
    if (d > dead) {
      const k = (d - dead) / d;
      this.target.x += dx * k; this.target.z += dz * k;
    }
    this.aimBias.x = damp(this.aimBias.x, aimX * 2.4, 3.2, dt);
    this.aimBias.y = damp(this.aimBias.y, aimZ * 2.4, 3.2, dt);
    this.focus.x = damp(this.focus.x, this.target.x + this.aimBias.x, 9, dt);
    this.focus.z = damp(this.focus.z, this.target.z + this.aimBias.y, 9, dt);
    this.focus.y = damp(this.focus.y, 0.4, 6, dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.6);
  }

  snapTo(px, pz) {
    this.target.set(px, 0, pz);
    this.focus.set(px, 0.4, pz);
    this.aimBias.set(0, 0);
    this._apply();
  }

  _apply() {
    const pitch = (RENDER.pitchDeg * Math.PI) / 180;
    const yaw = (RENDER.yawDeg * Math.PI) / 180;
    let sx = 0, sz = 0, sy = 0;
    if (this.shake > 0.001) {
      const t = performance.now() * 0.001 + this.shakeSeed;
      const a = this.shake * this.shake * 0.42;
      sx = (Math.sin(t * 47.3) + Math.sin(t * 31.1) * 0.6) * a;
      sy = (Math.sin(t * 53.7) + Math.sin(t * 27.9) * 0.6) * a;
      sz = (Math.cos(t * 41.9) + Math.cos(t * 37.3) * 0.6) * a;
    }
    const fx = this.focus.x + sx, fy = this.focus.y + sy, fz = this.focus.z + sz;
    const dirY = Math.sin(pitch), dirH = Math.cos(pitch);
    const ox = Math.sin(yaw) * dirH, oz = Math.cos(yaw) * dirH;
    for (const c of this.cameras) {
      const d = this.dist;
      c.position.set(fx + ox * d, fy + dirY * d, fz + oz * d);
      c.lookAt(fx, fy, fz);
      c.updateMatrixWorld();
    }
  }

  update(dt) { this._apply(); }

  /** 屏幕坐标 → 地面 (y=0) 世界坐标 */
  screenToGround(nx, ny, out = new THREE.Vector3()) {
    const c = this.camWorld;
    const v = new THREE.Vector3(nx, ny, -1).unproject(c);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion).normalize();
    if (Math.abs(dir.y) < 1e-5) return out.set(v.x, 0, v.z);
    const t = -v.y / dir.y;
    return out.set(v.x + dir.x * t, 0, v.z + dir.z * t);
  }

  /** 世界坐标 → 屏幕像素（HUD 飘字、锁定标记用） */
  worldToScreen(x, y, z, w, h, out = { x: 0, y: 0, vis: true }) {
    const c = this.camWorld;
    const v = new THREE.Vector3(x, y, z).project(c);
    out.x = (v.x * 0.5 + 0.5) * w;
    out.y = (-v.y * 0.5 + 0.5) * h;
    out.vis = v.z < 1;
    return out;
  }
}
