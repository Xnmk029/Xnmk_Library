import * as THREE from 'three';
import { getTerrainHeight, isOnPath, TERRAIN_SIZE } from './terrain.js';
import { SimplexNoise } from './noise.js';

const noise = new SimplexNoise(789);

// ============================================
// 风格化低多边形树木 (卡通渲染风格)
// ============================================
function createStylizedTree(type = 0) {
  const group = new THREE.Group();
  
  // 树干
  const trunkHeight = 1.2 + Math.random() * 0.8;
  const trunkRadius = 0.12 + Math.random() * 0.08;
  const trunkGeometry = new THREE.CylinderGeometry(
    trunkRadius * 0.7, trunkRadius, trunkHeight, 5
  );
  const trunkMaterial = new THREE.MeshToonMaterial({
    color: new THREE.Color('#6b4423'),
  });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  group.add(trunk);
  
  // 树叶颜色配置
  const foliageColors = ['#2d6b2e', '#3a8a3a', '#4a9a4a', '#357a35'];
  const foliageColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
  
  if (type === 0) {
    // 锥形树 (松树风格) - 分层锥体
    const layers = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < layers; i++) {
      const layerHeight = 1.0 - i * 0.12;
      const layerRadius = 1.0 - i * 0.2;
      const coneGeometry = new THREE.ConeGeometry(layerRadius, layerHeight, 6);
      const coneMaterial = new THREE.MeshToonMaterial({
        color: new THREE.Color(foliageColor).offsetHSL(0, 0, i * 0.04),
      });
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      cone.position.y = trunkHeight + i * 0.55 + 0.4;
      cone.rotation.y = Math.random() * Math.PI;
      cone.castShadow = true;
      group.add(cone);
    }
  } else if (type === 1) {
    // 圆形树 (阔叶树) - 低多边形球体
    const foliageGeometry = new THREE.IcosahedronGeometry(1.0 + Math.random() * 0.4, 1);
    
    // 随机化顶点创建有机感
    const positions = foliageGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const offset = 0.12;
      positions[i] += (Math.random() - 0.5) * offset;
      positions[i + 1] += (Math.random() - 0.5) * offset;
      positions[i + 2] += (Math.random() - 0.5) * offset;
    }
    foliageGeometry.computeVertexNormals();
    
    const foliageMaterial = new THREE.MeshToonMaterial({
      color: foliageColor,
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = trunkHeight + 0.7;
    foliage.scale.y = 0.85;
    foliage.castShadow = true;
    group.add(foliage);
    
    // 次要叶团
    const foliage2Geometry = new THREE.IcosahedronGeometry(0.55, 1);
    const foliage2 = new THREE.Mesh(foliage2Geometry, foliageMaterial.clone());
    foliage2.material.color.offsetHSL(0.02, 0, 0.05);
    foliage2.position.set(0.4, trunkHeight + 1.0, 0.25);
    foliage2.castShadow = true;
    group.add(foliage2);
  } else {
    // 灌木树 - 多个小球体
    const bushCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < bushCount; i++) {
      const radius = 0.4 + Math.random() * 0.35;
      const bushGeometry = new THREE.IcosahedronGeometry(radius, 1);
      const bushMaterial = new THREE.MeshToonMaterial({
        color: new THREE.Color(foliageColor).offsetHSL(
          (Math.random() - 0.5) * 0.04,
          0,
          (Math.random() - 0.5) * 0.08
        ),
      });
      const bush = new THREE.Mesh(bushGeometry, bushMaterial);
      const angle = (i / bushCount) * Math.PI * 2;
      const dist = 0.25 + Math.random() * 0.3;
      bush.position.set(
        Math.cos(angle) * dist,
        trunkHeight + 0.4 + Math.random() * 0.4,
        Math.sin(angle) * dist
      );
      bush.castShadow = true;
      group.add(bush);
    }
  }
  
  return group;
}

// 装饰性岩石
function createRock() {
  const geometry = new THREE.DodecahedronGeometry(0.25 + Math.random() * 0.3, 0);
  
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] *= 0.8 + Math.random() * 0.4;
    positions[i + 1] *= 0.5 + Math.random() * 0.3;
    positions[i + 2] *= 0.8 + Math.random() * 0.4;
  }
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshToonMaterial({
    color: new THREE.Color('#7a7a7a').offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
  });
  
  const rock = new THREE.Mesh(geometry, material);
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

// 小花/草丛点缀
function createFlowerPatch() {
  const group = new THREE.Group();
  const flowerColors = ['#ffeb3b', '#ff9800', '#e91e63', '#9c27b0', '#ffffff'];
  
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const stemGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4);
    const stemMaterial = new THREE.MeshToonMaterial({ color: '#4a8c3f' });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    
    const flowerGeometry = new THREE.SphereGeometry(0.06, 6, 4);
    const flowerMaterial = new THREE.MeshToonMaterial({
      color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
    });
    const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
    flower.position.y = 0.18;
    
    const flowerUnit = new THREE.Group();
    flowerUnit.add(stem);
    flowerUnit.add(flower);
    
    flowerUnit.position.set(
      (Math.random() - 0.5) * 0.8,
      0.15,
      (Math.random() - 0.5) * 0.8
    );
    flowerUnit.rotation.y = Math.random() * Math.PI * 2;
    
    group.add(flowerUnit);
  }
  
  return group;
}

export function createTrees() {
  const treeGroup = new THREE.Group();
  treeGroup.name = 'trees';
  
  const halfSize = TERRAIN_SIZE * 0.42;
  const treePositions = [];
  
  // 树木集群配置 (园林景观布局)
  const clusterCenters = [
    { x: -22, z: -18, count: 7, radius: 10 },
    { x: 18, z: -22, count: 5, radius: 9 },
    { x: -26, z: 14, count: 6, radius: 10 },
    { x: 22, z: 18, count: 4, radius: 8 },
    { x: 0, z: -30, count: 4, radius: 7 },
    { x: -12, z: 30, count: 5, radius: 9 },
    { x: 30, z: -5, count: 3, radius: 7 },
    { x: -35, z: -5, count: 4, radius: 8 },
  ];
  
  // 集群种植
  clusterCenters.forEach(cluster => {
    for (let i = 0; i < cluster.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * cluster.radius;
      const x = cluster.x + Math.cos(angle) * dist;
      const z = cluster.z + Math.sin(angle) * dist;
      
      if (Math.abs(x) > halfSize || Math.abs(z) > halfSize) continue;
      if (isOnPath(x, z)) continue;
      
      // 检查与其他树的距离
      let tooClose = false;
      for (const pos of treePositions) {
        const dx = pos.x - x;
        const dz = pos.z - z;
        if (Math.sqrt(dx * dx + dz * dz) < 2.5) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      
      const y = getTerrainHeight(x, z);
      const treeType = Math.floor(Math.random() * 3);
      const tree = createStylizedTree(treeType);
      
      tree.position.set(x, y, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      
      const scale = 0.7 + Math.random() * 0.6;
      tree.scale.setScalar(scale);
      
      treeGroup.add(tree);
      treePositions.push({ x, z });
    }
  });
  
  // 散落的单棵树
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() - 0.5) * 2 * halfSize;
    const z = (Math.random() - 0.5) * 2 * halfSize;
    
    if (isOnPath(x, z)) continue;
    
    let tooClose = false;
    for (const pos of treePositions) {
      const dx = pos.x - x;
      const dz = pos.z - z;
      if (Math.sqrt(dx * dx + dz * dz) < 3.5) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    
    const y = getTerrainHeight(x, z);
    const treeType = Math.floor(Math.random() * 3);
    const tree = createStylizedTree(treeType);
    
    tree.position.set(x, y, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    
    const scale = 0.6 + Math.random() * 0.5;
    tree.scale.setScalar(scale);
    
    treeGroup.add(tree);
    treePositions.push({ x, z });
  }
  
  // 岩石
  for (let i = 0; i < 15; i++) {
    const x = (Math.random() - 0.5) * 2 * halfSize;
    const z = (Math.random() - 0.5) * 2 * halfSize;
    
    const y = getTerrainHeight(x, z);
    const rock = createRock();
    rock.position.set(x, y + 0.08, z);
    rock.rotation.set(
      Math.random() * 0.3,
      Math.random() * Math.PI * 2,
      Math.random() * 0.3
    );
    treeGroup.add(rock);
  }
  
  // 花丛点缀
  for (let i = 0; i < 20; i++) {
    const x = (Math.random() - 0.5) * 2 * halfSize * 0.8;
    const z = (Math.random() - 0.5) * 2 * halfSize * 0.8;
    
    if (isOnPath(x, z)) continue;
    
    const y = getTerrainHeight(x, z);
    const flowers = createFlowerPatch();
    flowers.position.set(x, y, z);
    treeGroup.add(flowers);
  }
  
  return treeGroup;
}
