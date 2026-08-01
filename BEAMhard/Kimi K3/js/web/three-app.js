// ============================================================================
// web/three-app.js — WebGL renderer + HDR lighting environment + post stack.
// ============================================================================

import * as THREE from 'three';
import { makeSkyDome } from './npr.js';
import { PostPipeline } from './post.js';

export class ThreeApp {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.NoToneMapping; // ACES lives in post
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fb2d9);

    // --- camera ---
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000);
    this.camera.position.set(6, 3, 8);

    // --- HDR-ish sun + hemisphere environment ---
    this.sunDir = new THREE.Vector3(0.55, 0.62, -0.42).normalize();
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
    this.sun.position.copy(this.sunDir).multiplyScalar(220);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 600;
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -60;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbdd4f0, 0x4a4438, 0.85);
    this.scene.add(this.hemi);

    // --- skybox (gradient dome w/ HDR sun for bloom) ---
    this.sky = makeSkyDome(this.sunDir);
    this.scene.add(this.sky);

    // --- post pipeline (ACES + bloom + vignette) ---
    this.post = new PostPipeline(this.renderer, window.innerWidth, window.innerHeight);

    // camera modes handled by main (chase cam / map cam)
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
  }

  // keep the shadow frustum glued to the vehicle
  followShadow(target) {
    this.sun.position.set(target.x + this.sunDir.x * 220, target.y + this.sunDir.y * 220, target.z + this.sunDir.z * 220);
    this.sun.target.position.set(target.x, target.y, target.z);
  }

  render() {
    this.post.render(this.scene, this.activeCamera || this.camera);
  }
}
