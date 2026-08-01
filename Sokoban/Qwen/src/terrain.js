import * as THREE from 'three';
import { SimplexNoise } from './noise.js';

// 地形配置
export const TERRAIN_SIZE = 100;
export const TERRAIN_SEGMENTS = 100;
export const TERRAIN_HEIGHT_SCALE = 5;

const noise = new SimplexNoise(42);

// 获取任意世界坐标的地形高度
export function getTerrainHeight(x, z) {
  const nx = x / TERRAIN_SIZE;
  const nz = z / TERRAIN_SIZE;
  
  // 多层噪波叠加
  let height = noise.fbm(nx * 2.5, nz * 2.5, 4, 2.0, 0.5);
  height += noise.fbm(nx * 1.2 + 100, nz * 1.2 + 100, 3, 2.0, 0.5) * 0.4;
  
  // 中心区域略微平坦 (用于路径)
  const distFromCenter = Math.sqrt(x * x + z * z) / (TERRAIN_SIZE * 0.5);
  const flattenFactor = Math.max(0, 1 - distFromCenter * 2.5);
  height *= (1 - flattenFactor * 0.4);
  
  return height * TERRAIN_HEIGHT_SCALE;
}

// 判断是否在路径上
export function isOnPath(x, z) {
  const pathWidth = 3.0;
  const pathCenterX = Math.sin(z * 0.06) * 10 + Math.sin(z * 0.025) * 6;
  const dist = Math.abs(x - pathCenterX);
  return dist < pathWidth;
}

// 获取到路径的距离 (0=中心, 1=边缘)
export function getPathDistance(x, z) {
  const pathWidth = 3.0;
  const pathCenterX = Math.sin(z * 0.06) * 10 + Math.sin(z * 0.025) * 6;
  const dist = Math.abs(x - pathCenterX);
  return Math.min(1, dist / pathWidth);
}

export function createTerrain() {
  const geometry = new THREE.PlaneGeometry(
    TERRAIN_SIZE, TERRAIN_SIZE,
    TERRAIN_SEGMENTS, TERRAIN_SEGMENTS
  );
  
  geometry.rotateX(-Math.PI / 2);
  
  const positions = geometry.attributes.position.array;
  const colors = new Float32Array(positions.length);
  
  // 卡通风格颜色配置
  const grassDark = new THREE.Color('#2d5a27');
  const grassMid = new THREE.Color('#4a8c3f');
  const grassLight = new THREE.Color('#6ab04c');
  const dirtColor = new THREE.Color('#c4a35a');
  const dirtDark = new THREE.Color('#a08040');
  const dirtLight = new THREE.Color('#d4b86a');
  
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    
    const height = getTerrainHeight(x, z);
    positions[i + 1] = height;
    
    const pathDist = getPathDistance(x, z);
    const noiseVal = noise.noise2D(x * 0.08, z * 0.08) * 0.5 + 0.5;
    const detailNoise = noise.noise2D(x * 0.3, z * 0.3) * 0.5 + 0.5;
    
    let color;
    
    if (pathDist < 0.6) {
      // 路径区域 - 泥土色
      color = dirtDark.clone().lerp(dirtLight, noiseVal);
      // 添加小石子变化
      if (detailNoise > 0.7) {
        color.lerp(new THREE.Color('#8a7a5a'), 0.3);
      }
    } else if (pathDist < 1.0) {
      // 过渡区域
      const t = (pathDist - 0.6) / 0.4;
      const dirt = dirtDark.clone().lerp(dirtColor, noiseVal);
      const grass = grassDark.clone().lerp(grassMid, noiseVal);
      color = dirt.lerp(grass, t * t); // 平滑过渡
    } else {
      // 草地区域 - 使用噪波创建色块
      const patchNoise = noise.fbm(x * 0.04, z * 0.04, 3, 2.0, 0.5) * 0.5 + 0.5;
      
      if (patchNoise < 0.35) {
        color = grassDark.clone().lerp(grassMid, detailNoise);
      } else if (patchNoise < 0.65) {
        color = grassMid.clone().lerp(grassLight, detailNoise);
      } else {
        color = grassLight.clone();
        // 偶尔的黄绿斑块
        if (detailNoise > 0.6) {
          color.lerp(new THREE.Color('#8bc34a'), 0.3);
        }
      }
      
      // 高度影响颜色
      const heightFactor = (height / TERRAIN_HEIGHT_SCALE + 1) * 0.5;
      color.lerp(grassLight, heightFactor * 0.2);
    }
    
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }
  
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  
  // 使用 MeshToonMaterial 实现卡通着色
  const material = new THREE.MeshToonMaterial({
    vertexColors: true,
  });
  
  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  
  return terrain;
}
