import * as THREE from 'three';

// ============================================
// Low-poly 箱子模型
// ============================================
export function createBox(onTarget = false) {
  const box = new THREE.Group();
  box.name = 'box';
  
  // 优化: 大幅提升箱子色彩对比度
  const woodColor = onTarget ? new THREE.Color('#a0e860') : new THREE.Color('#e8b878');  // 更亮
  const woodDark = onTarget ? new THREE.Color('#80c840') : new THREE.Color('#c89858');
  const metalColor = new THREE.Color('#c0c0b0');  // 更亮的金属
  const highlightColor = new THREE.Color('#ffffff');  // 纯白高光
  
  // 主体 - 略微不规则的立方体
  const bodyGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8, 2, 2, 2);
  randomizeVertices(bodyGeometry, 0.02);
  
  const bodyMaterial = new THREE.MeshToonMaterial({
    color: woodColor,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  box.add(body);
  
  // 木板纹理 - 横向条纹
  for (let i = -1; i <= 1; i++) {
    const plankGeometry = new THREE.BoxGeometry(0.82, 0.08, 0.82);
    const plankMaterial = new THREE.MeshToonMaterial({
      color: woodDark,
    });
    const plank = new THREE.Mesh(plankGeometry, plankMaterial);
    plank.position.y = i * 0.25;
    box.add(plank);
  }
  
  // 金属包角
  const cornerPositions = [
    [-0.4, -0.4, -0.4], [-0.4, -0.4, 0.4],
    [-0.4, 0.4, -0.4], [-0.4, 0.4, 0.4],
    [0.4, -0.4, -0.4], [0.4, -0.4, 0.4],
    [0.4, 0.4, -0.4], [0.4, 0.4, 0.4],
  ];
  
  const cornerGeometry = new THREE.SphereGeometry(0.06, 4, 3);
  const cornerMaterial = new THREE.MeshToonMaterial({ color: metalColor });
  
  cornerPositions.forEach(pos => {
    const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
    corner.position.set(...pos);
    box.add(corner);
  });
  
  // 金属边框
  const edgeMaterial = new THREE.MeshToonMaterial({ color: metalColor });
  
  // 垂直边框
  const vEdgeGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 4);
  const vEdgePositions = [
    [-0.4, 0, -0.4], [-0.4, 0, 0.4],
    [0.4, 0, -0.4], [0.4, 0, 0.4],
  ];
  
  vEdgePositions.forEach(pos => {
    const edge = new THREE.Mesh(vEdgeGeometry, edgeMaterial);
    edge.position.set(...pos);
    box.add(edge);
  });
  
  // 顶部十字加固
  const crossGeometry1 = new THREE.BoxGeometry(0.7, 0.04, 0.1);
  const crossGeometry2 = new THREE.BoxGeometry(0.1, 0.04, 0.7);
  const crossMaterial = new THREE.MeshToonMaterial({ color: woodDark });
  
  const cross1 = new THREE.Mesh(crossGeometry1, crossMaterial);
  cross1.position.y = 0.41;
  box.add(cross1);
  
  const cross2 = new THREE.Mesh(crossGeometry2, crossMaterial);
  cross2.position.y = 0.41;
  box.add(cross2);
  
  // 优化: 添加高光点提升辨识度
  const highlightGeo = new THREE.PlaneGeometry(0.15, 0.15);
  const highlightMat = new THREE.MeshBasicMaterial({
    color: highlightColor,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const highlight = new THREE.Mesh(highlightGeo, highlightMat);
  highlight.position.set(-0.2, 0.42, -0.2);
  highlight.rotation.x = -Math.PI / 2;
  box.add(highlight);
  
  // 目标点标记 (在目标上时显示)
  if (onTarget) {
    const glowGeometry = new THREE.RingGeometry(0.5, 0.6, 6);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x90ee90,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.39;
    glow.name = 'targetGlow';
    box.add(glow);
  }
  
  // 优化: 添加箱子底部指示环，提升辨识度
  const boxRingGeo = new THREE.RingGeometry(0.45, 0.52, 8);
  const boxRingMat = new THREE.MeshBasicMaterial({
    color: onTarget ? 0x80ff80 : 0xffaa44,  // 绿色(在目标上) 或 橙色
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const boxRing = new THREE.Mesh(boxRingGeo, boxRingMat);
  boxRing.rotation.x = -Math.PI / 2;
  boxRing.position.y = -0.38;
  box.add(boxRing);
  
  return box;
}

// 创建目标点标记
export function createTargetMarker() {
  const group = new THREE.Group();
  group.name = 'target';
  
  // 优化: 大幅提升目标点可见度
  // 地面标记 - 六边形 (更亮的金色)
  const markerGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.05, 6);
  const markerMaterial = new THREE.MeshToonMaterial({
    color: '#ffe880',  // 亮金色
  });
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  marker.receiveShadow = true;
  group.add(marker);
  
  // 内圈
  const innerGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 6);
  const innerMaterial = new THREE.MeshToonMaterial({
    color: '#f0d060',
  });
  const inner = new THREE.Mesh(innerGeometry, innerMaterial);
  group.add(inner);
  
  // 中心点 (更亮)
  const centerGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.07, 6);
  const centerMaterial = new THREE.MeshToonMaterial({
    color: '#e0b840',
  });
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  group.add(center);
  
  // 优化: 添加发光环，使目标更醒目
  const glowRingGeo = new THREE.RingGeometry(0.4, 0.48, 6);
  const glowRingMat = new THREE.MeshBasicMaterial({
    color: 0xffdd44,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.03;
  group.add(glowRing);
  
  return group;
}

// 创建墙壁 (草坪边界)
export function createWall() {
  const group = new THREE.Group();
  group.name = 'wall';
  
  // 优化: 提升墙壁色彩对比度
  // 草丛基座
  const baseGeometry = new THREE.CylinderGeometry(0.5, 0.55, 0.6, 6);
  randomizeVertices(baseGeometry, 0.03);
  const baseMaterial = new THREE.MeshToonMaterial({
    color: '#4a8a4a',
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = 0.3;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  
  // 顶部草丛
  const topGeometry = new THREE.ConeGeometry(0.45, 0.4, 6);
  randomizeVertices(topGeometry, 0.04);
  const topMaterial = new THREE.MeshToonMaterial({
    color: '#5aaa5a',
  });
  const top = new THREE.Mesh(topGeometry, topMaterial);
  top.position.y = 0.7;
  top.castShadow = true;
  group.add(top);
  
  // 额外的小草叶
  for (let i = 0; i < 3; i++) {
    const bladeGeometry = new THREE.ConeGeometry(0.08, 0.3, 3);
    const bladeMaterial = new THREE.MeshToonMaterial({
      color: new THREE.Color('#6aba6a').offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
    blade.position.set(
      Math.cos(angle) * 0.3,
      0.65,
      Math.sin(angle) * 0.3
    );
    blade.rotation.z = (Math.random() - 0.5) * 0.3;
    group.add(blade);
  }
  
  return group;
}

// 创建地面瓷砖
export function createFloorTile(isPath = false) {
  const geometry = new THREE.BoxGeometry(0.95, 0.1, 0.95);
  
  // 优化: 提升地面色彩对比度
  const color = isPath ? '#e0d0b0' : '#a0d0a0';
  const material = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.05),
  });
  
  const tile = new THREE.Mesh(geometry, material);
  tile.receiveShadow = true;
  tile.position.y = -0.05;
  
  return tile;
}

// 随机化顶点
function randomizeVertices(geometry, amount) {
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += (Math.random() - 0.5) * amount;
    positions[i + 1] += (Math.random() - 0.5) * amount;
    positions[i + 2] += (Math.random() - 0.5) * amount;
  }
  geometry.computeVertexNormals();
}

// 箱子滚动动画 (用于主菜单)
export function createRollingBox() {
  const box = createBox(false);
  box.scale.setScalar(1.2);
  return box;
}
