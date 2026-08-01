import * as THREE from 'three';

// ============================================
// Low-poly 小鲸鱼模型 (程序化生成)
// ============================================
export function createWhale() {
  const whale = new THREE.Group();
  whale.name = 'whale';
  
  // 卡通色系: 明亮饱和，像素化后仍醒目
  const bodyColor = new THREE.Color('#5ec8f2');  // 明亮天蓝
  const bellyColor = new THREE.Color('#eafaff');  // 近白肚皮
  const finColor = new THREE.Color('#38b0e8');   // 活泼中蓝
  
  // 身体主体 - 拉长的椭球
  const bodyGeometry = new THREE.SphereGeometry(0.5, 8, 6);
  bodyGeometry.scale(1.4, 0.8, 0.9);
  
  // 随机化顶点创建 low-poly 感
  randomizeVertices(bodyGeometry, 0.03);
  
  const bodyMaterial = new THREE.MeshToonMaterial({
    color: bodyColor,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  whale.add(body);
  
  // 肚皮 - 底部浅色区域
  const bellyGeometry = new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  bellyGeometry.scale(1.3, 0.6, 0.85);
  const bellyMaterial = new THREE.MeshToonMaterial({
    color: bellyColor,
  });
  const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
  belly.position.y = -0.1;
  whale.add(belly);
  
  // 头部 - 略微凸起
  const headGeometry = new THREE.SphereGeometry(0.35, 7, 5);
  headGeometry.scale(1.0, 0.85, 0.9);
  randomizeVertices(headGeometry, 0.02);
  const head = new THREE.Mesh(headGeometry, bodyMaterial.clone());
  head.position.set(0.55, 0.05, 0);
  head.castShadow = true;
  whale.add(head);
  
  // 嘴巴 - 微笑曲线
  const mouthCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0.75, -0.05, -0.15),
    new THREE.Vector3(0.85, -0.12, 0),
    new THREE.Vector3(0.75, -0.05, 0.15)
  );
  const mouthGeometry = new THREE.TubeGeometry(mouthCurve, 8, 0.02, 4);
  const mouthMaterial = new THREE.MeshToonMaterial({ color: '#3a5a6f' });
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  whale.add(mouth);
  
  // 眼睛
  const eyeGeometry = new THREE.SphereGeometry(0.06, 6, 4);
  const eyeMaterial = new THREE.MeshToonMaterial({ color: '#1a2a3a' });
  const eyeWhiteGeometry = new THREE.SphereGeometry(0.08, 6, 4);
  const eyeWhiteMaterial = new THREE.MeshToonMaterial({ color: '#ffffff' });
  
  [-1, 1].forEach(side => {
    const eyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
    eyeWhite.position.set(0.65, 0.12, side * 0.22);
    whale.add(eyeWhite);
    
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(0.68, 0.12, side * 0.24);
    whale.add(eye);
    
    // 眼睛高光
    const highlightGeometry = new THREE.SphereGeometry(0.025, 4, 3);
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlight.position.set(0.70, 0.15, side * 0.25);
    whale.add(highlight);
  });
  
  // 尾鳍
  const tailGeometry = new THREE.ConeGeometry(0.25, 0.4, 4);
  tailGeometry.rotateZ(Math.PI / 2);
  tailGeometry.scale(1, 0.3, 1.5);
  randomizeVertices(tailGeometry, 0.02);
  const tailMaterial = new THREE.MeshToonMaterial({ color: finColor });
  const tail = new THREE.Mesh(tailGeometry, tailMaterial);
  tail.position.set(-0.75, 0.05, 0);
  tail.castShadow = true;
  whale.add(tail);
  
  // 尾鳍分叉
  [-1, 1].forEach(side => {
    const flukeGeometry = new THREE.ConeGeometry(0.15, 0.3, 3);
    flukeGeometry.rotateZ(Math.PI / 2 + side * 0.4);
    flukeGeometry.scale(1, 0.25, 1);
    const fluke = new THREE.Mesh(flukeGeometry, tailMaterial.clone());
    fluke.position.set(-0.9, 0.08, side * 0.15);
    fluke.castShadow = true;
    whale.add(fluke);
  });
  
  // 胸鳍
  [-1, 1].forEach(side => {
    const finGeometry = new THREE.ConeGeometry(0.12, 0.35, 4);
    finGeometry.rotateX(side * 0.8);
    finGeometry.rotateZ(-0.3);
    finGeometry.scale(1, 0.2, 1);
    randomizeVertices(finGeometry, 0.015);
    const fin = new THREE.Mesh(finGeometry, finColor.clone());
    fin.position.set(0.2, -0.2, side * 0.35);
    fin.castShadow = true;
    whale.add(fin);
  });
  
  // 背鳍
  const dorsalGeometry = new THREE.ConeGeometry(0.1, 0.25, 4);
  dorsalGeometry.scale(1, 1, 0.3);
  randomizeVertices(dorsalGeometry, 0.01);
  const dorsal = new THREE.Mesh(dorsalGeometry, finColor.clone());
  dorsal.position.set(-0.1, 0.35, 0);
  dorsal.castShadow = true;
  whale.add(dorsal);
  
  // 喷水孔 (小凸起)
  const spoutGeometry = new THREE.CylinderGeometry(0.03, 0.05, 0.08, 5);
  const spoutMaterial = new THREE.MeshToonMaterial({ color: '#4a7a9f' });
  const spout = new THREE.Mesh(spoutGeometry, spoutMaterial);
  spout.position.set(0.3, 0.38, 0);
  whale.add(spout);
  
  // 优化: 添加玩家指示环，提升辨识度 (加大尺寸以在像素化后可见)
  const ringGeometry = new THREE.RingGeometry(0.75, 0.95, 16);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffcc00,  // 饱和金色
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.35;
  ring.name = 'playerRing';
  whale.add(ring);
  
  // 整体缩放 (从0.8提升到1.0，确保像素化后可辨识)
  whale.scale.setScalar(1.0);
  
  return whale;
}

// 随机化顶点创建 low-poly 效果
function randomizeVertices(geometry, amount) {
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += (Math.random() - 0.5) * amount;
    positions[i + 1] += (Math.random() - 0.5) * amount;
    positions[i + 2] += (Math.random() - 0.5) * amount;
  }
  geometry.computeVertexNormals();
}

// 创建鲸鱼移动动画
export function animateWhale(whale, time, isMoving) {
  // 上下浮动
  whale.position.y += Math.sin(time * 2) * 0.002;
  
  // 轻微摇摆
  whale.rotation.z = Math.sin(time * 1.5) * 0.05;
  
  // 移动时身体前倾
  if (isMoving) {
    whale.rotation.x = Math.sin(time * 8) * 0.03;
  }
}
