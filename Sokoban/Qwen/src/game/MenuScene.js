import * as THREE from 'three';
import { createRollingBox } from './Box.js';
import { getTerrainHeight, TERRAIN_SIZE } from '../terrain.js';

// ============================================
// 主菜单场景 - 箱子在道路上滚动
// ============================================
export class MenuScene {
  constructor(scene) {
    this.scene = scene;
    this.rollingBoxes = [];
    this.pathCurve = null;
    this.time = 0;
    
    this.createPathCurve();
    this.createRollingBoxes();
  }
  
  // 创建紧凑环形路径 (靠近原点，确保在菜单相机视野内可见)
  createPathCurve() {
    const points = [];
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * 8 + Math.sin(angle * 2) * 2;
      const z = Math.sin(angle) * 6;
      const y = getTerrainHeight(x, z) + 0.5;
      points.push(new THREE.Vector3(x, y, z));
    }
    this.pathCurve = new THREE.CatmullRomCurve3(points, true); // 闭合环路
  }
  
  // 创建滚动的箱子 (放大以在像素化后仍可见)
  createRollingBoxes() {
    const boxCount = 3;
    
    for (let i = 0; i < boxCount; i++) {
      const box = createRollingBox();
      box.scale.setScalar(2.8); // 原1.2太小，像素化后不可见
      box.userData.offset = i / boxCount; // 错开位置
      box.userData.speed = 0.03 + Math.random() * 0.015;
      this.scene.add(box);
      this.rollingBoxes.push(box);
    }
  }
  
  // 更新动画
  update(deltaTime) {
    this.time += deltaTime;
    
    this.rollingBoxes.forEach(box => {
      // 计算在曲线上的位置
      let t = (this.time * box.userData.speed + box.userData.offset) % 1;
      
      const point = this.pathCurve.getPoint(t);
      const tangent = this.pathCurve.getTangent(t);
      
      box.position.copy(point);
      box.position.y += 0.6;
      
      // 朝向运动方向
      const lookAt = point.clone().add(tangent);
      box.lookAt(lookAt);
      
      // 滚动旋转 (加大速度使像素化后仍可感知运动)
      box.rotation.x += deltaTime * 4;
      box.rotation.z = Math.sin(this.time * 2.5 + box.userData.offset * 10) * 0.15;
      
      // 上下弹跳 (加大幅度)
      box.position.y += Math.abs(Math.sin(this.time * 3 + box.userData.offset * 5)) * 0.4;
    });
  }
  
  // 清理
  dispose() {
    this.rollingBoxes.forEach(box => {
      this.scene.remove(box);
      box.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    this.rollingBoxes = [];
  }
}
