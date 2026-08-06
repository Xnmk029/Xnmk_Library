/* 破坏方块粒子（Points 池） */
(function () {
  'use strict';
  const MAX = 600;

  class Particles {
    constructor(scene) {
      const pos = new Float32Array(MAX * 3);
      const col = new Float32Array(MAX * 3);
      this.vel = new Float32Array(MAX * 3);
      this.life = new Float32Array(MAX);
      this.alive = new Uint8Array(MAX);
      this.cursor = 0;
      this.geo = new THREE.BufferGeometry();
      this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({
        size: 0.09, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false
      }));
      this.points.frustumCulled = false;
      this.points.renderOrder = 3;
      scene.add(this.points);
    }

    burst(x, y, z, colorHex, n) {
      const pos = this.geo.attributes.position.array;
      const col = this.geo.attributes.color.array;
      const c = new THREE.Color(colorHex);
      for (let i = 0; i < n; i++) {
        const idx = this.cursor;
        this.cursor = (this.cursor + 1) % MAX;
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * Math.PI - Math.PI / 2;
        const s = 0.8 + Math.random() * 3;
        this.vel[idx * 3] = Math.cos(e) * Math.cos(a) * s;
        this.vel[idx * 3 + 1] = Math.sin(e) * s + 1.2;
        this.vel[idx * 3 + 2] = Math.cos(e) * Math.sin(a) * s;
        pos[idx * 3] = x + (Math.random() - 0.5) * 0.3;
        pos[idx * 3 + 1] = y + (Math.random() - 0.5) * 0.3;
        pos[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
        const v = 0.5 + Math.random() * 0.5;
        col[idx * 3] = c.r * v;
        col[idx * 3 + 1] = c.g * v;
        col[idx * 3 + 2] = c.b * v;
        this.life[idx] = 0.4 + Math.random() * 0.4;
        this.alive[idx] = 1;
      }
    }

    update(dt) {
      const pos = this.geo.attributes.position.array;
      let any = false;
      for (let i = 0; i < MAX; i++) {
        if (!this.alive[i]) continue;
        this.life[i] -= dt;
        if (this.life[i] <= 0) { this.alive[i] = 0; continue; }
        any = true;
        this.vel[i * 3 + 1] -= 18 * dt;
        pos[i * 3] += this.vel[i * 3] * dt;
        pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.points.visible = any;
    }
  }

  window.Particles = Particles;
})();
