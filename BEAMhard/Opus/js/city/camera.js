/**
 * camera.js — Task 5.3: seamless-zoom map camera.
 *
 * Pan (left drag / touch), orbit (right or middle drag: yaw+pitch), wheel
 * zoom-to-cursor, pinch zoom. The projection continuously morphs between
 * perspective (near ground) and orthographic (high altitude) by lerping the
 * two projection matrices, matched at the focal plane so the transition is
 * imperceptible — the classic "dollhouse → map" move.
 */
import * as THREE from 'three';

export class MapCamera {
  constructor(canvas) {
    this.canvas = canvas;
    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 9000);
    this.target = new THREE.Vector3(180, 0, -240);   // downtown
    this.yaw = -0.6;
    this.pitch = 0.72;                                // rad from horizon
    this.dist = 320;                                  // opens at building LOD
    this.minDist = 28;
    this.maxDist = 4200;
    this.enabled = false;
    this.orthoBlend = 0;

    this._drag = null;
    this._pinch = null;
    this._tmpM1 = new THREE.Matrix4();
    this._tmpM2 = new THREE.Matrix4();

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    this.touches = new Map();
  }

  /** ground intersection of a screen ray (uses current matrices) */
  groundPoint(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const t = -ray.ray.origin.y / (ray.ray.direction.y || -1e-6);
    if (t < 0) return null;
    return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
  }

  onDown(e) {
    if (!this.enabled) return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      this._pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.dist };
      this._drag = null;
      return;
    }
    const mode = (e.button === 2 || e.button === 1) ? 'orbit' : 'pan';
    this._drag = {
      mode, x: e.clientX, y: e.clientY,
      ground: this.groundPoint(e.clientX, e.clientY),
      target: this.target.clone(), yaw: this.yaw, pitch: this.pitch,
    };
    this.canvas.setPointerCapture?.(e.pointerId);
  }

  onMove(e) {
    if (!this.enabled) return;
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pinch && this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.dist = THREE.MathUtils.clamp(this._pinch.dist * (this._pinch.d / Math.max(20, d)), this.minDist, this.maxDist);
      return;
    }
    if (!this._drag) return;
    const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
    if (this._drag.mode === 'orbit') {
      this.yaw = this._drag.yaw - dx * 0.005;
      this.pitch = THREE.MathUtils.clamp(this._drag.pitch + dy * 0.004, 0.18, 1.5);
    } else {
      // ground-anchored pan: keep the grabbed point under the cursor
      const now = this.groundPoint(e.clientX, e.clientY);
      if (now && this._drag.ground) {
        this.target.copy(this._drag.target).add(this._drag.ground.clone().sub(now));
        const lim = 2600;
        this.target.x = THREE.MathUtils.clamp(this.target.x, -lim, lim);
        this.target.z = THREE.MathUtils.clamp(this.target.z, -lim, lim);
      }
    }
  }

  onUp(e) {
    this.touches.delete(e.pointerId);
    if (this.touches.size < 2) this._pinch = null;
    if (this.touches.size === 0) this._drag = null;
  }

  onWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const before = this.groundPoint(e.clientX, e.clientY);
    const f = Math.exp((e.deltaY > 0 ? 1 : -1) * 0.16);
    this.dist = THREE.MathUtils.clamp(this.dist * f, this.minDist, this.maxDist);
    this.updateMatrices();
    const after = this.groundPoint(e.clientX, e.clientY);
    if (before && after) this.target.add(before.sub(after)); // zoom-to-cursor
  }

  height() { return Math.sin(this.pitch) * this.dist; }

  updateMatrices() {
    const cam = this.camera;
    const eye = new THREE.Vector3(
      this.target.x + Math.cos(this.pitch) * Math.sin(this.yaw) * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.pitch) * Math.cos(this.yaw) * this.dist,
    );
    cam.position.copy(eye);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.target);
    cam.near = Math.max(0.5, this.dist * 0.02);
    cam.far = this.dist * 12 + 4000;
    cam.updateMatrixWorld();

    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    cam.aspect = aspect;

    // perspective matrix
    const fovRad = (cam.fov * Math.PI) / 180;
    this._tmpM1.makePerspective(
      -cam.near * Math.tan(fovRad / 2) * aspect, cam.near * Math.tan(fovRad / 2) * aspect,
      cam.near * Math.tan(fovRad / 2), -cam.near * Math.tan(fovRad / 2),
      cam.near, cam.far,
    );
    // matched orthographic at the focal plane
    const halfH = Math.tan(fovRad / 2) * this.dist;
    const halfW = halfH * aspect;
    this._tmpM2.makeOrthographic(-halfW, halfW, halfH, -halfH, cam.near, cam.far);

    // blend factor: perspective below 500 m, ortho above 1500 m
    const b = THREE.MathUtils.smoothstep(this.dist, 520, 1700);
    this.orthoBlend = b;
    const e1 = this._tmpM1.elements, e2 = this._tmpM2.elements;
    const out = cam.projectionMatrix.elements;
    for (let i = 0; i < 16; i++) out[i] = e1[i] * (1 - b) + e2[i] * b;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  update() { this.updateMatrices(); }
}

export default MapCamera;
