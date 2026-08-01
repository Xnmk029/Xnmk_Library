// Phase 5 — Seamless zoom camera: orbit/chase/map with continuous
// perspective<->orthographic projection blending.
'use strict';

const CameraControl = (() => {
  class Camera {
    constructor() {
      this.pos = [0, -9, 4.5];
      this.target = [0, 0, 0.6];
      this.yaw = 0;
      this.pitch = -0.42;
      this.dist = 9;
      this.mode = 'chase'; // chase | orbit | map
      this.zoom = 0; // 0 = close perspective, 1 = full ortho map
      this.aspect = 16 / 9;
    }

    update(dt, vehicle) {
      if (vehicle) {
        const vp = vehicle.rigid.pos;
        const q = vehicle.rigid.quat;
        const yawCar = Math.atan2(2 * (q[3] * q[2] + q[0] * q[1]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));
        if (this.mode === 'chase') {
          this.yaw = yawCar;
          this.pitch = -0.38 + Math.min(0.12, vehicle.speed() * 0.002);
          this.target = [vp[0], vp[1], vp[2] + 0.3];
          const back = [Math.sin(this.yaw) * Math.cos(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch)];
          const want = [this.target[0] - back[0] * this.dist, this.target[1] - back[1] * this.dist, this.target[2] - back[2] * this.dist];
          const k = Math.min(1, 5 * dt);
          this.pos = M.v3lerp(this.pos, want, k);
        } else if (this.mode === 'map') {
          this.target = [vp[0], vp[1], 0];
          this.yaw = 0;
          this.pitch = -Math.PI / 2 + 0.02;
          const k = Math.min(1, 6 * dt);
          const want = [vp[0], vp[1], 220];
          this.pos = M.v3lerp(this.pos, want, k);
        }
      }
      if (this.mode === 'orbit') {
        const eye = [
          this.target[0] + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist,
          this.target[1] - Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist,
          this.target[2] + Math.sin(this.pitch) * this.dist
        ];
        const k = Math.min(1, 8 * dt);
        this.pos = M.v3lerp(this.pos, eye, k);
      }
    }

    orbit(dx, dy) {
      this.yaw -= dx * 0.008;
      this.pitch = Math.max(-1.45, Math.min(-0.05, this.pitch + dy * 0.005));
    }

    pan(dx, dy) {
      const f = this.zoom > 0.5 ? 2.2 : 0.02 * this.dist;
      this.target[0] += dx * f * 0.02;
      this.target[1] += dy * f * 0.02;
    }

    zoomBy(w) {
      this.zoom = Math.max(0, Math.min(1, this.zoom + w));
      this.dist = Math.max(4, Math.min(60, this.dist - w * 18));
    }

    setMode(m) {
      this.mode = m;
      if (m === 'map') this.zoom = Math.max(this.zoom, 0.7);
    }

    frame() {
      const up = [0, 0, 1];
      const view = M.m4lookAt(this.pos, this.target, up, M.m4());
      const near = 0.1, far = 1400;
      const persp = M.m4perspective(0.85, this.aspect, near, far, M.m4());
      const halfH = 34 + this.dist * 3.2;
      const ortho = M.m4ortho(-halfH * this.aspect, halfH * this.aspect, -halfH, halfH, near, far, M.m4());
      const proj = M.m4();
      const t = this.zoom;
      for (let i = 0; i < 16; i++) proj[i] = persp[i] * (1 - t) + ortho[i] * t;
      const viewProj = M.m4mul(proj, view, M.m4());
      return { viewProj, view, camPos: this.pos, zoom: this.zoom, proj, viewM: view };
    }
  }

  return { Camera };
})();

if (typeof globalThis !== 'undefined') globalThis.CameraControl = CameraControl;
if (typeof module !== 'undefined' && module.exports) module.exports = CameraControl;
