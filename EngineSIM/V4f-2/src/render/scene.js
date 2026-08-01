// src/render/scene.js — 渲染场景组装：渲染器、天空、赛道、车辆、特效、相机

import * as THREE from 'three';
import { Track } from './track.js';
import { Sky } from './sky.js';
import { Car } from './car.js';
import { Effects } from './effects.js';
import { CameraController } from './camera-controller.mjs';

export class GameScene {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.1, 3000);

    this.sky = new Sky(this.scene, this.renderer);
    this.track = new Track(this.scene);
    this.car = new Car(this.scene);
    this.effects = new Effects(this.scene);
    this.cam = new CameraController(this.camera);

    window.addEventListener('resize', () => this._resize());
    this._resize();
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // 每帧：v = 车辆快照，dt = 秒
  render(v, dt) {
    this.car.update(v, dt);
    // 轮子世界位置（供特效）
    const wheelPos = [];
    if (this.car.wheelSpins.length === 4) {
      for (let i = 0; i < 4; i++) {
        const wp = new THREE.Vector3();
        this.car.wheelSpins[i].getWorldPosition(wp);
        wheelPos.push(wp);
      }
    }
    this.effects.update(v, dt, wheelPos);
    this.cam.update(v, dt);
    this.renderer.render(this.scene, this.camera);
  }
}
