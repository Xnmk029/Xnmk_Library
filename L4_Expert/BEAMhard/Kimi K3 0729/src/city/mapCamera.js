/**
 * mapCamera.js — seamless zoom / pan / rotate map camera with continuous
 * orthographic <-> perspective transition.
 *
 * State: target {x,z}, yaw, pitch (20..85 deg), zoomLevel (continuous 10.5..17).
 * All state is smoothed with a critically-damped spring (no overshoot).
 *
 * Blend: b = smoothstep(zoomLevel, 13.5, 14.5). Both cameras are configured to
 * show the SAME frustum height at the target distance, so switching between
 * them at b = 0.5 is visually continuous (matched framing).
 *   b < 0.5  → perspective camera
 *   b >= 0.5 → orthographic camera
 */

import * as THREE from '../../lib/three.module.js';

/** Critically-damped 1D spring: stable, no overshoot. */
class Spring {
  constructor(value, omega = 8) { this.x = value; this.v = 0; this.omega = omega; }
  /** Advance toward goal by dt (sub-stepped semi-implicit Euler). */
  step(goal, dt) {
    const w = this.omega;
    let remaining = Math.min(dt, 0.1);
    const h = 1 / 240;
    while (remaining > 1e-6) {
      const s = Math.min(h, remaining);
      const a = -w * w * (this.x - goal) - 2 * w * this.v;
      this.v += a * s;
      this.x += this.v * s;
      remaining -= s;
    }
    return this.x;
  }
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export class MapCameraController {
  /**
   * @param {HTMLElement} domElement canvas to attach input listeners to
   * @param {object} opts
   * @param {{minX:number,minZ:number,maxX:number,maxZ:number}} opts.bounds
   * @param {THREE.PerspectiveCamera} opts.perspectiveCamera
   * @param {THREE.OrthographicCamera} opts.orthographicCamera
   * @param {boolean} [opts.enableWASD=false] optional WASD panning (off by default)
   */
  constructor(domElement, { bounds, perspectiveCamera, orthographicCamera, enableWASD = false }) {
    this.dom = domElement;
    this.bounds = bounds;
    this.persp = perspectiveCamera;
    this.ortho = orthographicCamera;
    this.enableWASD = enableWASD;

    // goal state
    this.targetGoal = { x: 0, z: 0 };
    this.yawGoal = 0;
    this.pitchGoal = 55;                 // degrees
    this.zoomGoal = 12;                  // continuous zoom level
    this.minZoom = 10.5; this.maxZoom = 17;
    this.minPitch = 20; this.maxPitch = 85;

    // smoothed state (springs)
    this.sTX = new Spring(0, 10); this.sTZ = new Spring(0, 10);
    this.sYaw = new Spring(0, 10);
    this.sPitch = new Spring(55, 10);
    this.sZoom = new Spring(12, 8);

    // current (smoothed) values, mirrors of springs for external reads
    this.target = { x: 0, z: 0 };
    this.yaw = 0; this.pitch = 55; this.zoomLevel = 12;

    // input state
    this._drag = null; // {button, lastX, lastY, anchorNDC, anchorGround}
    this._keys = new Set();
    this._zoomAnchor = null; // {ndcX, ndcY, gx, gz, until}

    this._blend = 0;
    this._active = this.persp;

    // bind + attach
    this._onPointerDown = (e) => this._pointerDown(e);
    this._onPointerMove = (e) => this._pointerMove(e);
    this._onPointerUp = (e) => this._pointerUp(e);
    this._onWheel = (e) => this._wheel(e);
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onContextMenu = (e) => e.preventDefault();
    const d = this.dom;
    d.addEventListener('pointerdown', this._onPointerDown);
    d.addEventListener('pointermove', this._onPointerMove);
    d.addEventListener('pointerup', this._onPointerUp);
    d.addEventListener('pointercancel', this._onPointerUp);
    d.addEventListener('wheel', this._onWheel, { passive: false });
    d.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /** Current continuous zoom level. */
  get zoom() { return this.zoomLevel; }

  /** Ortho/perspective blend factor: 0 = perspective side, 1 = ortho side. */
  get blend() { return this._blend; }

  /**
   * Camera distance for a continuous zoom level (meters from target).
   * zoom 17 → ~100 m, each -1 level doubles the distance.
   */
  distanceFor(zoom) {
    return 100 * Math.pow(2, 17 - zoom);
  }

  /**
   * Advance smoothing by dt, configure both cameras with matched framing,
   * and return the active camera.
   * @param {number} dt seconds
   * @returns {THREE.Camera}
   */
  update(dt) {
    dt = clamp(dt, 0, 0.1);

    // Q/E rotate, optional WASD pan
    const rotRate = 90; // deg/s
    if (this._keys.has('KeyQ')) this.yawGoal += rotRate * dt;
    if (this._keys.has('KeyE')) this.yawGoal -= rotRate * dt;
    if (this.enableWASD) {
      const panRate = this.distanceFor(this.zoomGoal) * 0.8 * dt;
      const yawR = this.yawGoal * Math.PI / 180;
      const fx = -Math.sin(yawR), fz = -Math.cos(yawR);
      const rx = Math.cos(yawR), rz = -Math.sin(yawR);
      if (this._keys.has('KeyW')) { this.targetGoal.x += fx * panRate; this.targetGoal.z += fz * panRate; }
      if (this._keys.has('KeyS')) { this.targetGoal.x -= fx * panRate; this.targetGoal.z -= fz * panRate; }
      if (this._keys.has('KeyA')) { this.targetGoal.x -= rx * panRate; this.targetGoal.z -= rz * panRate; }
      if (this._keys.has('KeyD')) { this.targetGoal.x += rx * panRate; this.targetGoal.z += rz * panRate; }
    }
    this.pitchGoal = clamp(this.pitchGoal, this.minPitch, this.maxPitch);
    this.zoomGoal = clamp(this.zoomGoal, this.minZoom, this.maxZoom);
    const b = this.bounds;
    this.targetGoal.x = clamp(this.targetGoal.x, b.minX, b.maxX);
    this.targetGoal.z = clamp(this.targetGoal.z, b.minZ, b.maxZ);

    // critically-damped smoothing of all state
    this.target.x = this.sTX.step(this.targetGoal.x, dt);
    this.target.z = this.sTZ.step(this.targetGoal.z, dt);
    this.yaw = this.sYaw.step(this.yawGoal, dt);
    this.pitch = this.sPitch.step(this.pitchGoal, dt);
    this.zoomLevel = this.sZoom.step(this.zoomGoal, dt);

    // wheel-zoom cursor anchoring: keep the ground point under the cursor fixed
    if (this._zoomAnchor && performance.now() < this._zoomAnchor.until) {
      const g = this._groundUnderNDC(this._zoomAnchor.ndcX, this._zoomAnchor.ndcY, this.target, this.yaw, this.pitch, this.zoomLevel);
      if (g) {
        const dx = this._zoomAnchor.gx - g.x, dz = this._zoomAnchor.gz - g.z;
        this.targetGoal.x += dx; this.targetGoal.z += dz;
        this.target.x += dx; this.target.z += dz;
        this.sTX.x = this.target.x; this.sTZ.x = this.target.z;
      }
    } else {
      this._zoomAnchor = null;
    }

    // camera placement from state
    const dist = this.distanceFor(this.zoomLevel);
    const yawR = this.yaw * Math.PI / 180;
    const pitchR = this.pitch * Math.PI / 180;
    const horiz = dist * Math.cos(pitchR);
    const pos = new THREE.Vector3(
      this.target.x + Math.sin(yawR) * horiz,
      dist * Math.sin(pitchR),
      this.target.z + Math.cos(yawR) * horiz,
    );
    const look = new THREE.Vector3(this.target.x, 0, this.target.z);

    // matched framing: frustum half-height at target distance is identical
    const halfH = dist * Math.tan((this.persp.fov * Math.PI / 180) / 2);
    const w = this.dom.clientWidth || 1, h = this.dom.clientHeight || 1;
    const aspect = w / h;

    this.persp.aspect = aspect;
    this.persp.near = Math.max(0.5, dist * 0.01);
    this.persp.far = dist * 8 + 4000;
    this.persp.position.copy(pos);
    this.persp.lookAt(look);
    this.persp.updateProjectionMatrix();
    this.persp.updateMatrixWorld();

    this.ortho.top = halfH;
    this.ortho.bottom = -halfH;
    this.ortho.left = -halfH * aspect;
    this.ortho.right = halfH * aspect;
    this.ortho.near = -dist * 2;          // ortho: allow geometry behind the eye plane
    this.ortho.far = dist * 4 + 4000;
    this.ortho.position.copy(pos);
    this.ortho.lookAt(look);
    this.ortho.updateProjectionMatrix();
    this.ortho.updateMatrixWorld();

    // seamless blend: matched frustum heights make the switch at 0.5 invisible
    this._blend = smoothstep(13.5, 14.5, this.zoomLevel);
    this._active = this._blend < 0.5 ? this.persp : this.ortho;
    return this._active;
  }

  /**
   * Intersect an NDC screen point with the ground plane (y = 0).
   * @param {number} ndcX @param {number} ndcY
   * @returns {{x:number, z:number}|null}
   */
  screenToGround(ndcX, ndcY) {
    const cam = this._active;
    cam.updateMatrixWorld();
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    if (cam.isPerspectiveCamera) {
      origin.setFromMatrixPosition(cam.matrixWorld);
      dir.set(ndcX, ndcY, 0.5).unproject(cam).sub(origin).normalize();
    } else {
      origin.set(ndcX, ndcY, -1).unproject(cam);
      dir.set(0, 0, -1).transformDirection(cam.matrixWorld);
    }
    if (Math.abs(dir.y) < 1e-8) return null;
    const t = -origin.y / dir.y;
    if (t < 0) return null;
    return { x: origin.x + dir.x * t, z: origin.z + dir.z * t };
  }

  /**
   * Move the view target (and optionally zoom) to a point.
   * @param {number} x @param {number} z @param {number} [zoom]
   */
  focusOn(x, z, zoom) {
    this.targetGoal.x = clamp(x, this.bounds.minX, this.bounds.maxX);
    this.targetGoal.z = clamp(z, this.bounds.minZ, this.bounds.maxZ);
    if (zoom !== undefined) this.zoomGoal = clamp(zoom, this.minZoom, this.maxZoom);
  }

  /** Remove all input listeners. */
  dispose() {
    const d = this.dom;
    d.removeEventListener('pointerdown', this._onPointerDown);
    d.removeEventListener('pointermove', this._onPointerMove);
    d.removeEventListener('pointerup', this._onPointerUp);
    d.removeEventListener('pointercancel', this._onPointerUp);
    d.removeEventListener('wheel', this._onWheel);
    d.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  /* ------------------------------------------------------------ internal -- */

  _ndc(e) {
    const r = this.dom.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
  }

  _pointerDown(e) {
    this.dom.setPointerCapture && this.dom.setPointerCapture(e.pointerId);
    const [nx, ny] = this._ndc(e);
    this._drag = {
      button: e.button, lastX: e.clientX, lastY: e.clientY,
      anchorNDC: [nx, ny],
      anchorGround: (e.button === 0 || e.button === 1) ? this.screenToGround(nx, ny) : null,
    };
    e.preventDefault();
  }

  _pointerMove(e) {
    if (!this._drag) return;
    const dx = e.clientX - this._drag.lastX;
    const dy = e.clientY - this._drag.lastY;
    this._drag.lastX = e.clientX; this._drag.lastY = e.clientY;
    if (this._drag.button === 2) {
      // RMB: rotate yaw / pitch
      this.yawGoal -= dx * 0.35;
      this.pitchGoal = clamp(this.pitchGoal + dy * 0.25, this.minPitch, this.maxPitch);
    } else {
      // LMB / MMB: pan by tracking the ground point under the cursor
      const [nx, ny] = this._ndc(e);
      const g = this.screenToGround(nx, ny);
      if (g && this._drag.anchorGround) {
        this.targetGoal.x += this._drag.anchorGround.x - g.x;
        this.targetGoal.z += this._drag.anchorGround.z - g.z;
      }
    }
  }

  _pointerUp(e) {
    this._drag = null;
    this.dom.releasePointerCapture && this.dom.releasePointerCapture(e.pointerId);
  }

  _wheel(e) {
    e.preventDefault();
    // exp2 scaling: each wheel step shifts the continuous zoom level
    const steps = -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018);
    const nz = clamp(this.zoomGoal + steps, this.minZoom, this.maxZoom);
    if (nz === this.zoomGoal) return;
    const [nx, ny] = this._ndc(e);
    const g = this.screenToGround(nx, ny);
    this.zoomGoal = nz;
    if (g) {
      this._zoomAnchor = { ndcX: nx, ndcY: ny, gx: g.x, gz: g.z, until: performance.now() + 400 };
    }
  }

  _key(e, down) {
    if (e.repeat) return;
    if (down) this._keys.add(e.code); else this._keys.delete(e.code);
  }

  /** Ground point under NDC for an arbitrary (not yet committed) state — used by the zoom anchor. */
  _groundUnderNDC(ndcX, ndcY, target, yaw, pitch, zoomLevel) {
    const dist = this.distanceFor(zoomLevel);
    const yawR = yaw * Math.PI / 180, pitchR = pitch * Math.PI / 180;
    const horiz = dist * Math.cos(pitchR);
    const origin = new THREE.Vector3(target.x + Math.sin(yawR) * horiz, dist * Math.sin(pitchR), target.z + Math.cos(yawR) * horiz);
    // build view basis
    const fwd = new THREE.Vector3(target.x - origin.x, -origin.y, target.z - origin.z).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    const halfH = dist * Math.tan((this.persp.fov * Math.PI / 180) / 2);
    const aspect = (this.dom.clientWidth || 1) / (this.dom.clientHeight || 1);
    // perspective-style ray (good approximation for anchoring in both modes)
    const dir = fwd.clone()
      .addScaledVector(right, ndcX * halfH * aspect / dist)
      .addScaledVector(up, ndcY * halfH / dist)
      .normalize();
    if (Math.abs(dir.y) < 1e-8) return null;
    const t = -origin.y / dir.y;
    if (t < 0) return null;
    return { x: origin.x + dir.x * t, z: origin.z + dir.z * t };
  }
}
