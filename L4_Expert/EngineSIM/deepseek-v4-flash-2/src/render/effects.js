// src/render/effects.js — 轮胎烟、刹车痕、路缘特效

import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.smokes = [];
    this.marks = [];
    this._markGeo = null;
    this._markPositions = [];
    this._buildMarks();
  }

  _buildMarks() {
    // 刹车痕/漂移痕：动态增长的线带
    const maxSeg = 4000;
    this._markGeo = new THREE.BufferGeometry();
    this._markPositions = new Float32Array(maxSeg * 2 * 3);
    this._markGeo.setAttribute('position', new THREE.BufferAttribute(this._markPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this._markGeo.setDrawRange(0, 0);
    this._markMat = new THREE.MeshBasicMaterial({ color: 0x181818, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    this._markMesh = new THREE.Mesh(this._markGeo, this._markMat);
    this._markMesh.frustumCulled = false;
    this.scene.add(this._markMesh);
    this._markCount = 0;
    this._lastMarkPos = [null, null, null, null];
  }

  update(v, dt, wheelWorldPositions) {
    // —— 刹车痕 ——
    const braking = v.brakeIn > 0.3 || v.handbrakeIn > 0.3;
    const slipping = v.rearSlipDeg > 8 && v.speed > 5;
    if ((braking || slipping) && wheelWorldPositions) {
      for (let i = 0; i < 4; i++) {
        const p = wheelWorldPositions[i];
        if (!p) continue;
        const last = this._lastMarkPos[i];
        if (last && last.distanceTo(p) > 0.25 && this._markCount < 3998) {
          const b = this._markCount * 6;
          this._markPositions[b] = last.x;
          this._markPositions[b + 1] = 0.025;
          this._markPositions[b + 2] = last.z;
          this._markPositions[b + 3] = p.x;
          this._markPositions[b + 4] = 0.025;
          this._markPositions[b + 5] = p.z;
          this._markCount += 2;
        }
        this._lastMarkPos[i] = p.clone();
      }
      this._markGeo.setDrawRange(0, this._markCount * 3);
      this._markGeo.attributes.position.needsUpdate = true;
    } else {
      this._lastMarkPos = [null, null, null, null];
    }

    // —— 轮胎烟 ——
    const smokeWheels = [];
    const spinning = v.wheelSlipRatio[2] > 0.25;
    if (v.speed > 2 && (spinning || (v.rearSlipDeg > 15 && v.speed > 8))) {
      smokeWheels.push(2, 3);
    }
    for (const i of smokeWheels) {
      const p = wheelWorldPositions && wheelWorldPositions[i];
      if (!p) continue;
      if (this.smokes.length > 40) {
        const old = this.smokes.shift();
        this.scene.remove(old.mesh);
        old.mesh.geometry.dispose();
      }
      const geo = new THREE.SphereGeometry(0.5, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, 0.35, p.z);
      this.scene.add(mesh);
      this.smokes.push({
        mesh, life: 1.4, vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.6 + Math.random(), (Math.random() - 0.5) * 1.5),
      });
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const sm = this.smokes[i];
      sm.life -= dt;
      sm.mesh.position.add(sm.vel.clone().multiplyScalar(dt));
      sm.mesh.scale.multiplyScalar(1 + dt * 1.6);
      sm.mesh.material.opacity = Math.max(0, sm.life / 1.4 * 0.45);
      if (sm.life <= 0) {
        this.scene.remove(sm.mesh);
        sm.mesh.geometry.dispose();
        this.smokes.splice(i, 1);
      }
    }
  }
}
