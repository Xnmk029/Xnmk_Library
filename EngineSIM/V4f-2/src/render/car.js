// src/render/car.js — 车辆渲染：GLB 肌肉车模型 + 车轮 pivot + 姿态/刹车灯
//
// - Kenney Car Kit（CC0）race.glb：body + 4 个轮子网格；
//   车身缩放 1.8421 → 轴距 2.80m；移除原车轮，用 wheel-racing.glb 重建
//   （Ø0.66m），前轮挂转向+滚动 pivot，后轮挂滚动 pivot；
// - 姿态：加速翘头（pitch 负）、刹车点头（pitch 正）、转向向外侧倾（roll）；
// - 车轮旋转：正 omega（前进）→ spin.rotation.x += omega·dt；
// - 尾灯随刹车发光；加载失败回退程序化车身。

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BODY_SCALE = 1.8421;             // 轴距 1.52 → 2.80 m
const WHEEL_SCALE = 1.10;              // Ø0.60 → 0.66 m
const TRACK_HALF = 0.79;               // 轮距 1.58
const WHEELBASE_HALF = 1.40;

export class Car {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.scale.setScalar(BODY_SCALE);
    this.root.add(this.bodyGroup);

    // 车轮 rig
    this.wheelPivots = [];   // 转向+滚动（前）
    this.wheelSpins = [];    // 滚动（前后）
    this.wheelMeshes = [];
    this.brakeLights = [];
    this.ready = false;

    this._loadModel();
  }

  _loadModel() {
    const loader = new GLTFLoader();
    const base = document.baseURI;
    loader.load(new URL('./assets/models/muscle-car.glb', base).href, (gltf) => {
      const body = gltf.scene;
      // 移除自带的 4 个轮子网格（重新挂 rig）
      body.traverse((o) => {
        if (o.isMesh && /wheel/i.test(o.name || '')) {
          o.parent?.remove(o);
        }
      });
      // 升级材质（漆面/玻璃/大灯/尾灯）
      body.traverse((o) => {
        if (o.isMesh) {
          const m = o.material;
          if (m && m.isMeshStandardMaterial) {
            m.roughness = 0.35;
            m.metalness = 0.25;
          }
        }
      });
      this.bodyGroup.add(body);
      // 尾灯标记（名称含 light/taillight 的红色发光件）
      body.traverse((o) => {
        if (o.isMesh && /(tail|light|rear)/i.test(o.name || '')) {
          this.brakeLights.push(o);
        }
      });
      this._buildWheels();
      this.ready = true;
    }, undefined, () => {
      // 回退：程序化低多边形车身
      this._buildFallbackBody();
      this._buildWheels();
      this.ready = true;
    });
  }

  _buildWheels() {
    const loader = new GLTFLoader();
    loader.load(new URL('./assets/models/wheel-racing.glb', document.baseURI).href, (gltf) => {
      this._wheelProto = gltf.scene;
      this._spawnWheels();
    }, undefined, () => {
      // 回退：程序化轮胎
      const proto = new THREE.Mesh(
        new THREE.CylinderGeometry(0.33, 0.33, 0.32, 20),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 })
      );
      proto.rotation.x = Math.PI / 2;
      this._wheelProto = proto;
      this._spawnWheels();
    });
  }

  _spawnWheels() {
    if (!this._wheelProto) return;
    const positions = [
      [TRACK_HALF, WHEELBASE_HALF], [-TRACK_HALF, WHEELBASE_HALF],
      [TRACK_HALF, -WHEELBASE_HALF], [-TRACK_HALF, -WHEELBASE_HALF],
    ];
    positions.forEach(([x, z], i) => {
      const front = i < 2;
      const pivot = new THREE.Group();       // 转向 pivot（前轮）
      pivot.position.set(x, 0.33, z);
      const spin = new THREE.Group();        // 滚动 pivot
      spin.position.x = 0;
      pivot.add(spin);
      const wheel = this._wheelProto.clone();
      wheel.scale.setScalar(WHEEL_SCALE);
      wheel.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      spin.add(wheel);
      this.root.add(pivot);
      this.wheelPivots.push(front ? pivot : null);
      this.wheelSpins.push(spin);
      this.wheelMeshes.push(wheel);
    });
  }

  _buildFallbackBody() {
    // 低多边形肌肉车（程序化）：车身 + 座舱 + 灯
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb0231a, roughness: 0.32, metalness: 0.45 });
    const body = new THREE.Group();
    const main = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.6), bodyMat);
    main.position.y = 0.55;
    body.add(main);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.22, 1.5), bodyMat);
    hood.position.set(0, 0.92, 1.3);
    body.add(hood);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.7), new THREE.MeshStandardMaterial({ color: 0x222a35, roughness: 0.1, metalness: 0.6 }));
    cabin.position.set(0, 1.02, -0.3);
    body.add(cabin);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.5, 1.66), new THREE.MeshStandardMaterial({ color: 0x9fc4e8, roughness: 0.08, metalness: 0.5 }));
    glass.position.set(0, 1.02, -0.3);
    body.add(glass);
    const rearWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.45), bodyMat);
    rearWing.position.set(0, 1.18, -1.9);
    body.add(rearWing);
    // 尾灯
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x661111, emissive: 0x220000, roughness: 0.3 });
    for (const sx of [-0.8, 0.8]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.08), tailMat);
      tl.position.set(sx, 0.62, -2.29);
      body.add(tl);
      this.brakeLights.push(tl);
    }
    // 前灯
    const headMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0x333322, roughness: 0.2 });
    for (const sx of [-0.78, 0.78]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.08), headMat);
      hl.position.set(sx, 0.68, 2.29);
      body.add(hl);
    }
    // 保险杠细节
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.24), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 }));
    bumper.position.set(0, 0.36, 2.26);
    body.add(bumper);
    this.bodyGroup.add(body);
  }

  // 每帧同步车辆状态
  update(v, dt) {
    // 位置/朝向
    this.root.position.set(v.x, 0, v.y);
    this.root.rotation.y = v.yaw;
    // 模型尚未加载完成时只跟随位置
    if (this.wheelSpins.length < 4) return;
    // 姿态：加速翘头（pitch 负）、刹车点头（pitch 正）、转向向外侧倾（roll）
    const pitch = v.pitchTarget;
    const roll = v.rollTarget;
    this.bodyGroup.rotation.x = pitch;
    this.bodyGroup.rotation.z = roll;
    // 车轮
    const steerAngles = [v.steerAngle, v.steerAngle, 0, 0];
    for (let i = 0; i < 4; i++) {
      if (this.wheelPivots[i]) this.wheelPivots[i].rotation.y = steerAngles[i];
      // 正 omega（前进）→ spin.rotation.x += omega·dt（视觉正确方向）
      this.wheelSpins[i].rotation.x += v.wheelOmega[i] * dt;
    }
    // 尾灯
    const brake = v.brakeIn > 0.05 || v.handbrakeIn > 0.05;
    const em = brake ? 0x661111 : 0x220000;
    for (const l of this.brakeLights) {
      if (l.material) l.material.emissive.setHex(em);
    }
  }
}
