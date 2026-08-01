import * as THREE from 'three';

/*
 * Minimal orbit controls: LMB rotate, RMB/middle pan, wheel dolly,
 * touch one-finger rotate / two-finger pinch+pan. No dependencies.
 */
export class OrbitControls {
  constructor(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.target = opts.target || new THREE.Vector3(0.6, 0.32, 0.3);
    this.minDistance = 0.4;
    this.maxDistance = 8;
    this.minPolar = 0.06;
    this.maxPolar = Math.PI / 2 + 0.05;
    this.rotateSpeed = 0.0055;
    this.panSpeed = 0.0014;
    this.dollySpeed = 0.9;

    this._spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(this.target)
    );
    this._pointers = new Map();
    this._pinch = null;
    this._enabled = true;
    this._needsUpdate = true;

    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('pointermove', this._onMove);
    dom.addEventListener('pointerup', this._onUp);
    dom.addEventListener('pointercancel', this._onUp);
    dom.addEventListener('wheel', this._onWheel, { passive: false });
    dom.addEventListener('contextmenu', this._onCtx);
  }

  _onCtx = (e) => e.preventDefault();

  _onDown = (e) => {
    if (!this._enabled) return;
    this.dom.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size === 2) {
      const pts = [...this._pointers.values()];
      this._pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2
      };
    }
  };

  _onMove = (e) => {
    if (!this._enabled || !this._pointers.has(e.pointerId)) return;
    const prev = this._pointers.get(e.pointerId);
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;

    if (this._pointers.size === 1) {
      const btn = e.buttons;
      if (btn === 2 || btn === 4 || e.button === 2) {
        this._pan(dx, dy);
      } else {
        this._rotate(dx, dy);
      }
    } else if (this._pointers.size === 2 && this._pinch) {
      const pts = [...this._pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const dm = dist / Math.max(this._pinch.dist, 1);
      this._dolly(Math.pow(dm, 1.4));
      this._pan((midX - this._pinch.midX) * 1.2, (midY - this._pinch.midY) * 1.2);
      this._pinch.dist = dist;
      this._pinch.midX = midX;
      this._pinch.midY = midY;
    }
  };

  _onUp = (e) => {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) this._pinch = null;
  };

  _onWheel = (e) => {
    if (!this._enabled) return;
    e.preventDefault();
    this._dolly(Math.exp(-e.deltaY * 0.0012));
  };

  _rotate(dx, dy) {
    this._spherical.theta -= dx * this.rotateSpeed;
    this._spherical.phi -= dy * this.rotateSpeed;
    this._spherical.phi = Math.max(
      this.minPolar,
      Math.min(this.maxPolar, this._spherical.phi)
    );
    this._needsUpdate = true;
  }

  _pan(dx, dy) {
    const f = this._spherical.radius * this.panSpeed;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
    const up = new THREE.Vector3().copy(this.camera.up).normalize();
    this.target.addScaledVector(right, -dx * f);
    this.target.addScaledVector(up, dy * f);
    this._needsUpdate = true;
  }

  _dolly(factor) {
    this._spherical.radius = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this._spherical.radius * factor)
    );
    this._needsUpdate = true;
  }

  update() {
    if (this._needsUpdate) {
      this.camera.position.setFromSpherical(this._spherical).add(this.target);
      this.camera.lookAt(this.target);
      this._needsUpdate = false;
    }
  }

  reset(pos, target) {
    if (pos) this.camera.position.copy(pos);
    if (target) this.target.copy(target);
    this._spherical.setFromVector3(this.camera.position.clone().sub(this.target));
    this.update();
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this._onDown);
    this.dom.removeEventListener('pointermove', this._onMove);
    this.dom.removeEventListener('pointerup', this._onUp);
    this.dom.removeEventListener('pointercancel', this._onUp);
    this.dom.removeEventListener('wheel', this._onWheel);
    this.dom.removeEventListener('contextmenu', this._onCtx);
  }
}
