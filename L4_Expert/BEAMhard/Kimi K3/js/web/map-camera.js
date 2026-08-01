// ============================================================================
// web/map-camera.js — Phase 5.3: seamless zoom camera controller.
// One continuous zoom parameter drives a smooth Orthographic <-> Perspective
// transition: we lerp the two projection matrices element-wise inside the
// transition band, so zooming from city-wide top-down map to street level is
// perfectly seamless (no camera swap pop).
// Controls: LMB/RMB drag = pan, wheel = continuous zoom, Q/E = yaw, R/F = pitch.
// ============================================================================

import * as THREE from 'three';
import { clamp, clamp01, smoothstep, lerp } from '../core/math.js';

export class HybridMapCamera {
  constructor(domElement, cityHalf) {
    this.dom = domElement;
    this.cityHalf = cityHalf;

    this.target = new THREE.Vector3(0, 0, 0);   // ground focus
    this.zoom = 0.15;                            // 0 far .. 1 street
    this.yaw = 0.0;
    this.pitch = 72 * Math.PI / 180;             // from horizontal

    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 8000);
    this._persp = new THREE.Matrix4();
    this._ortho = new THREE.Matrix4();
    this._mixed = new THREE.Matrix4();

    this._drag = null;
    domElement.addEventListener('pointerdown', (e) => {
      if (e.target !== domElement) return;
      this._drag = { x: e.clientX, y: e.clientY, btn: e.button };
      domElement.setPointerCapture(e.pointerId);
    });
    domElement.addEventListener('pointerup', () => { this._drag = null; });
    domElement.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX; this._drag.y = e.clientY;
      const dist = this._distance();
      const scale = dist * 0.0016;
      // pan in camera ground plane
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const rx = fz, rz = -fx;
      this.target.x -= (rx * dx - fx * dy) * scale;
      this.target.z -= (rz * dx - fz * dy) * scale;
      this.target.x = clamp(this.target.x, -cityHalf, cityHalf);
      this.target.z = clamp(this.target.z, -cityHalf, cityHalf);
    });
    domElement.addEventListener('wheel', (e) => {
      if (e.target !== domElement) return;
      this.zoom = clamp01(this.zoom - Math.sign(e.deltaY) * 0.055);
    }, { passive: true });
    this.keys = new Set();
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  _distance() {
    // exponential dolly: 30 m .. 2400 m
    return lerp(2400, 26, Math.pow(this.zoom, 1.35));
  }

  update(dt) {
    if (this.keys.has('KeyQ')) this.yaw += dt * 1.4;
    if (this.keys.has('KeyE')) this.yaw -= dt * 1.4;
    if (this.keys.has('KeyR')) this.pitch = clamp(this.pitch + dt * 0.9, 0.32, 1.52);
    if (this.keys.has('KeyF')) this.pitch = clamp(this.pitch - dt * 0.9, 0.32, 1.52);
    if (this.keys.has('Equal') || this.keys.has('NumpadAdd')) this.zoom = clamp01(this.zoom + dt * 0.5);
    if (this.keys.has('Minus') || this.keys.has('NumpadSubtract')) this.zoom = clamp01(this.zoom - dt * 0.5);

    const dist = this._distance();
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const ox = Math.sin(this.yaw) * cp * dist;
    const oz = Math.cos(this.yaw) * cp * dist;
    this.camera.position.set(this.target.x + ox, this.target.y + sp * dist, this.target.z + oz);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();

    // --- seamless ortho<->persp projection blend -----------------------------
    const aspect = innerWidth / innerHeight;
    const near = 0.5, far = 8000;
    // perspective: fov narrows slightly as we zoom out (telephoto map feel)
    const fov = lerp(34, 56, this.zoom);
    this._persp.makePerspective(
      -near * Math.tan(fov * Math.PI / 360) * aspect, near * Math.tan(fov * Math.PI / 360) * aspect,
      near * Math.tan(fov * Math.PI / 360), -near * Math.tan(fov * Math.PI / 360), near, far);
    // orthographic frustum matched to the view height at the focus distance
    const halfH = dist * Math.tan(fov * Math.PI / 360);
    this._ortho.makeOrthographic(-halfH * aspect, halfH * aspect, halfH, -halfH, -far * 0.5, far);
    // blend factor: 0 = full ortho (far), 1 = full perspective (street)
    const t = smoothstep(0.28, 0.72, this.zoom);
    const pe = this._persp.elements, oe = this._ortho.elements, me = this._mixed.elements;
    for (let i = 0; i < 16; i++) me[i] = lerp(oe[i], pe[i], t);
    this.camera.projectionMatrix.copy(this._mixed);
    this.camera.projectionMatrixInverse.copy(this._mixed).invert();

    return this.camera;
  }

  zoom01() { return this.zoom; }
}
