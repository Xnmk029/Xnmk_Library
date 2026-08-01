/**
 * ui/CameraRig.js — seamless zoom camera
 *  - smooth pan / pitch-yaw rotation / continuous zoom
 *  - seamless interpolation between perspective and orthographic projection
 *  - chase / orbit / hood / free modes
 */
import * as THREE from 'three';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.target = new THREE.Vector3(0, 1.2, 16);
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.distance = 9;
    this.minDist = 2.2;
    this.maxDist = 1500;
    this.mode = 'chase';          // chase | orbit | hood | free
    this.orthoBlend = 0;          // 0 = perspective, 1 = ortho
    this.fov = 52;
    this.freePos = new THREE.Vector3(0, 400, 600);
    this.freeYaw = 0.8;
    this.freePitch = -0.55;
    this.freeDist = 800;
    this._drag = null;
    this._keys = new Set();
    this.shake = 0;
    this._bind();
    this.updateProjection();
  }

  _bind() {
    const d = this.dom;
    d.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this._drag = { x: e.clientX, y: e.clientY, button: 0 };
      if (e.button === 2) this._drag = { x: e.clientX, y: e.clientY, button: 2 };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x;
      const dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX;
      this._drag.y = e.clientY;
      if (this._drag.button === 2) {
        // pan (ground plane)
        const s = this.distance * 0.0016;
        this.target.x -= Math.cos(this.yaw) * dx * s - Math.sin(this.yaw) * dy * s * -1;
        this.target.z += Math.sin(this.yaw) * dx * s + Math.cos(this.yaw) * dy * s * -1;
        this.freePos.x = this.target.x;
        this.freePos.z = this.target.z;
      } else {
        this.yaw -= dx * 0.0055;
        this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + dy * 0.005));
      }
    });
    window.addEventListener('pointerup', () => { this._drag = null; });
    d.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.0011);
      this.distance = Math.max(this.minDist, Math.min(this.maxDist, this.distance * factor));
      this.freeDist = this.distance;
    }, { passive: false });
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      this._keys.add(e.code);
      if (e.code === 'KeyC') this.cycleMode();
      if (e.code === 'KeyF') {
        if (this.mode !== 'free') {
          this.freePos.copy(this.camera.position);
          this.mode = 'free';
        } else this.mode = 'chase';
      }
    });
    window.addEventListener('keyup', (e) => this._keys.delete(e.code));
  }

  cycleMode() {
    const order = ['chase', 'orbit', 'hood', 'chase'];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
    return this.mode;
  }

  setMode(m) { this.mode = m; }

  focus(x, z, dist = 10) {
    this.target.set(x, 1.2, z);
    this.distance = dist;
  }

  /** continuous zoom: blend perspective <-> ortho by distance */
  updateProjection() {
    const cam = this.camera;
    const t = THREE.MathUtils.clamp((this.distance - 30) / 320, 0, 1);
    this.orthoBlend = t;
    const aspect = cam.aspect;
    const near = 0.5, far = 4200;
    const halfH = Math.tan(this.fov * Math.PI / 360) * near;
    const persp = new THREE.Matrix4().makePerspective(
      -halfH * aspect, halfH * aspect, halfH, -halfH, near, far);
    const halfH2 = this.distance * Math.tan(this.fov * Math.PI / 360);
    const ortho = new THREE.Matrix4().makeOrthographic(
      -halfH2 * aspect, halfH2 * aspect, -halfH2, halfH2, 0.5, 4200);
    // element-wise blend of projection matrices (seamless perspective <-> ortho)
    const pe = persp.elements, oe = ortho.elements, ce = cam.projectionMatrix.elements;
    const tt = t * t;
    for (let i = 0; i < 16; i++) ce[i] = pe[i] + (oe[i] - pe[i]) * tt;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  /** keyboard pan for free mode */
  updateFree(dt, input) {
    const s = this.distance * 0.9;
    const f = _p.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.freeYaw);
    const r = _p.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const k = this._keys;
    let mx = 0, mz = 0;
    if (k.has('KeyA')) mx -= 1;
    if (k.has('KeyD')) mx += 1;
    if (k.has('KeyW')) mz -= 1;
    if (k.has('KeyS')) mz += 1;
    this.freePos.addScaledVector(f, -mz * s * dt);
    this.freePos.addScaledVector(r, mx * s * dt);
    if (k.has('KeyR')) this.freePos.y += s * 0.5 * dt;
    if (k.has('KeyT')) this.freePos.y -= s * 0.5 * dt;
    this.freePos.y = Math.max(1, this.freePos.y);
    this.target.set(this.freePos.x, 0, this.freePos.z);
  }

  /** shake impulse */
  addShake(v) { this.shake = Math.min(1.2, this.shake + v); }

  update(dt, vehicle, input) {
    const cam = this.camera;
    const t = this.target;

    if (this.mode === 'free') {
      this.updateFree(dt, input);
      const f = _p.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.freeYaw);
      const r = f.clone().cross(new THREE.Vector3(0, 1, 0));
      const up = r.clone().cross(f);
      cam.position.copy(this.freePos);
      cam.lookAt(this.freePos.clone().add(f.clone().multiplyScalar(100)));
      cam.up.copy(up).normalize();
    } else {
      const body = vehicle.body;
      if (this.mode === 'chase') {
        const fwd = _p.set(0, 0, 1).applyQuaternion(body.quat);
        t.lerp(body.pos.clone().addScaledVector(fwd, -2.2).setY(body.pos.y + 1.15), 1 - Math.pow(0.002, dt));
        const targetYaw = Math.atan2(fwd.x, fwd.z);
        let dy = targetYaw - this.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.yaw += dy * Math.min(1, dt * 5);
        this.pitch = THREE.MathUtils.lerp(this.pitch, 0.24, Math.min(1, dt * 3));
        this.distance = THREE.MathUtils.lerp(this.distance, 8.5 + vehicle.speed * 0.06, Math.min(1, dt * 2));
      } else if (this.mode === 'orbit') {
        const fwd = _p.set(0, 0, 1).applyQuaternion(body.quat);
        t.lerp(body.pos.clone().addScaledVector(fwd, -1).setY(body.pos.y + 1.0), 1 - Math.pow(0.005, dt));
      } else if (this.mode === 'hood') {
        const fwd = _p.set(0, 0, 1).applyQuaternion(body.quat);
        t.lerp(body.pos.clone().setY(body.pos.y + 1.25), 1 - Math.pow(0.01, dt));
        this.distance = Math.min(this.distance, 3.0);
        this.yaw = Math.atan2(fwd.x, fwd.z);
        this.pitch = -0.02;
      }
      // smooth distance change by wheel for orbit
      if (this.mode === 'orbit') {
        this.distance *= Math.exp(-input.steer * 0.0);
      }
      this.distance = THREE.MathUtils.clamp(this.distance, this.minDist, this.maxDist);

      const cp = _p.set(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      ).multiplyScalar(this.distance);
      cam.position.copy(t).add(cp);

      // shake
      if (this.shake > 0.003) {
        cam.position.x += (Math.random() - 0.5) * this.shake * 0.35;
        cam.position.y += (Math.random() - 0.5) * this.shake * 0.35;
        this.shake *= Math.pow(0.001, dt);
      }
      cam.lookAt(t);
    }

    this.updateProjection();
  }
}
