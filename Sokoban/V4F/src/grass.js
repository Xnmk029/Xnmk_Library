// ---------------------------------------------------------------
// 草地：THREE.InstancedMesh + 自定义 ShaderMaterial（Dylearn 方案）
// 花朵：同架构的轻量版本，实例色着色
// ---------------------------------------------------------------
import * as THREE from 'three';
import { mulberry32, makeValueNoise2D } from './noise.js';
import { terrainHeight, distToRoad, POND } from './world.js';
import { GRASS_VERT, GRASS_FRAG, FLOWER_VERT, FLOWER_FRAG } from './shaders.js';

const MAX_CHARACTERS = 64;

// ---------------- 草地 ----------------
export function createGrassMesh({ grassTex, windNoiseTex, cloudTex }) {
  // 单片草：底部在 y=0，法线强制朝上 → 统一柔和卡通受光
  const geometry = new THREE.PlaneGeometry(0.42, 1.0, 1, 1);
  geometry.translate(0, 0.5, 0);
  const normals = geometry.attributes.normal.array;
  for (let i = 0; i < normals.length; i += 3) {
    normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0;
  }
  geometry.attributes.normal.needsUpdate = true;

  const uniforms = {
    uTime: { value: 0 },
    uFps: { value: 12 },
    uWindStrength: { value: 1 },
    uWindNoiseTex: { value: windNoiseTex },
    uWindDirection: { value: new THREE.Vector3(1, 0, 0.4).normalize() },
    uCharacters: { value: Array.from({ length: MAX_CHARACTERS }, () => new THREE.Vector4()) },
    uCharacterCount: { value: 0 },
    uGrassTex: { value: grassTex },
    uBaseColor: { value: new THREE.Color('#3a7a2c') },
    uTipColor: { value: new THREE.Color('#9be256') },
    uCameraForward: { value: new THREE.Vector3(0, 0, -1) },
    uPerspectiveIntensity: { value: 0.3 },
    uLightDir: { value: new THREE.Vector3(0.6, 0.8, 0.2).normalize() },
    uCloudTex: { value: cloudTex },
    uCloudSpeed: { value: 0.0035 },
    uCloudEnabled: { value: 1 },
    // ShaderMaterial 启用 fog:true 时必须声明这三个雾 uniform（渲染器每帧写入）
    fogColor: { value: new THREE.Color() },
    fogNear: { value: 0 },
    fogFar: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: GRASS_VERT,
    fragmentShader: GRASS_FRAG,
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    fog: true,
  });

  const MAX_BLADES = 45000;
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_BLADES);
  mesh.name = 'grass';
  mesh.frustumCulled = false;

  scatterBlades(mesh);
  return mesh;
}

function scatterBlades(mesh) {
  const rng = mulberry32(4242);
  const density = makeValueNoise2D(909).fbm;
  const dummy = new THREE.Object3D();
  const maxCount = mesh.count;
  let placed = 0, tries = 0;
  const maxTries = maxCount * 25;

  while (placed < maxCount && tries < maxTries) {
    tries++;
    const x = (rng() * 2 - 1) * 196;
    const z = (rng() * 2 - 1) * 196;
    const h = terrainHeight(x, z);

    // 坡度限制（陡坡不长草）
    const e = 0.8;
    const slope = Math.hypot(terrainHeight(x + e, z) - h, terrainHeight(x, z + e) - h) / e;
    if (slope > 0.5) continue;

    // 道路与池塘区域排除
    if (distToRoad(x, z) < 2.6) continue;
    const dp = Math.hypot(x - POND.x, z - POND.z);
    if (dp < POND.r * 1.45) continue;

    // 草地斑块密度（草甸感）
    const d = density(x * 0.028 + 5.2, z * 0.028 + 9.1, 3);
    if (d < 0.45) continue;
    // 池塘周围更茂密
    const densBoost = dp < POND.r * 3.2 ? 0.12 : 0;

    // 离路越近越密（人工草甸审美）
    const nearRoad = 0.1 * Math.max(0, 1 - distToRoad(x, z) / 40);
    if (d + densBoost + nearRoad < 0.62 && rng() < 0.5) continue;

    const sx = 0.8 + rng() * 0.6;
    const sy = 1.7 + rng() * 1.4;
    dummy.position.set(x, h, z);
    dummy.scale.set(sx, sy, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  mesh.count = placed;
  console.log(`[grass] 已散布 ${placed} 根草叶`);
}

// ---------------- 花朵 ----------------
export function createFlowerMesh({ flowerTex, windNoiseTex, cloudTex }) {
  // 花：四边形底部着地，贴图中带花茎
  const geometry = new THREE.PlaneGeometry(0.5, 0.55, 1, 1);
  geometry.translate(0, 0.42, 0);
  const normals = geometry.attributes.normal.array;
  for (let i = 0; i < normals.length; i += 3) {
    normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0;
  }
  geometry.attributes.normal.needsUpdate = true;

  const uniforms = {
    uTime: { value: 0 },
    uFps: { value: 12 },
    uWindStrength: { value: 1 },
    uWindNoiseTex: { value: windNoiseTex },
    uWindDirection: { value: new THREE.Vector3(1, 0, 0.4).normalize() },
    uFlowerTex: { value: flowerTex },
    uLightDir: { value: new THREE.Vector3(0.6, 0.8, 0.2).normalize() },
    uCloudTex: { value: cloudTex },
    uCloudSpeed: { value: 0.0035 },
    uCloudEnabled: { value: 1 },
    fogColor: { value: new THREE.Color() },
    fogNear: { value: 0 },
    fogFar: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: FLOWER_VERT,
    fragmentShader: FLOWER_FRAG,
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    fog: true,
  });

  const MAX_FLOWERS = 420;
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_FLOWERS);
  mesh.name = 'flowers';
  mesh.frustumCulled = false;

  scatterFlowers(mesh);
  return mesh;
}

function scatterFlowers(mesh) {
  const rng = mulberry32(1717);
  const density = makeValueNoise2D(616).fbm;
  const dummy = new THREE.Object3D();
  const palette = ['#ffffff', '#ffd23f', '#ff9fc0', '#c77dff', '#ffa54f', '#fff3b0'].map(c => new THREE.Color(c));
  const count = mesh.count;
  const maxTries = count * 60;
  let placed = 0, tries = 0;

  while (placed < count && tries < maxTries) {
    tries++;
    // 40% 路边花带 / 25% 池塘岸 / 35% 草甸点缀
    const mode = rng();
    let x, z;
    if (mode < 0.4) {
      // 路边
      const t = rng();
      const p = roadSample(t);
      const ang = rng() * Math.PI * 2;
      const off = 3.2 + rng() * 4.5;
      x = p.x + Math.cos(ang) * off;
      z = p.z + Math.sin(ang) * off;
    } else if (mode < 0.65) {
      // 池塘岸
      const ang = rng() * Math.PI * 2;
      const off = POND.r + 0.8 + rng() * 6;
      x = POND.x + Math.cos(ang) * off;
      z = POND.z + Math.sin(ang) * off;
    } else {
      x = (rng() * 2 - 1) * 170;
      z = (rng() * 2 - 1) * 170;
      if (density(x * 0.03 + 1.7, z * 0.03 + 8.8, 3) < 0.6) continue;
    }
    if (Math.abs(x) > 194 || Math.abs(z) > 194) continue;
    if (distToRoad(x, z) < 2.7) continue;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r * 1.1) continue;
    const slope = 0.5;
    const h = terrainHeight(x, z);
    if (Math.hypot(terrainHeight(x + 0.8, z) - h, terrainHeight(x, z + 0.8) - h) / 0.8 > slope) continue;

    const sx = 0.85 + rng() * 0.75;
    const sy = 0.85 + rng() * 0.75;
    dummy.position.set(x, h, z);
    dummy.scale.set(sx, sy, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    mesh.setColorAt(placed, palette[(rng() * palette.length) | 0]);
    placed++;
  }
  mesh.count = placed;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  console.log(`[flowers] 已散布 ${placed} 朵花`);
}

// 道路采样（复用 world.js 逻辑的轻量版本）
import { ROAD_CURVE } from './world.js';
function roadSample(t) {
  return ROAD_CURVE.getPoint(t);
}

// ---------------- 每帧更新 ----------------
export function makeGrassUpdater(grassMesh, flowerMesh, sharedUniforms) {
  const charArr = grassMesh.material.uniforms.uCharacters.value;
  return function updateGrass({ time, windDir, lightDir, camera, actors, fps, windStrength, persp, clouds }) {
    const gu = grassMesh.material.uniforms;
    const fu = flowerMesh.material.uniforms;

    gu.uTime.value = fu.uTime.value = time;
    gu.uFps.value = fu.uFps.value = fps;
    gu.uWindStrength.value = fu.uWindStrength.value = windStrength;
    gu.uWindDirection.value.copy(windDir);
    fu.uWindDirection.value.copy(windDir);
    gu.uLightDir.value.copy(lightDir);
    fu.uLightDir.value.copy(lightDir);
    gu.uPerspectiveIntensity.value = persp;
    gu.uCloudEnabled.value = fu.uCloudEnabled.value = clouds ? 1 : 0;

    camera.getWorldDirection(gu.uCameraForward.value);

    const n = Math.min(actors.length, MAX_CHARACTERS);
    gu.uCharacterCount.value = n;
    for (let i = 0; i < n; i++) {
      const v = charArr[i];
      v.set(actors[i].pos.x, actors[i].pos.y, actors[i].pos.z, actors[i].radius);
    }

    // 云影风速（受风力强度轻微调制）
    gu.uCloudSpeed.value = fu.uCloudSpeed.value = 0.0028 + windStrength * 0.0012;

    if (sharedUniforms) {
      sharedUniforms.uTime.value = time;
      sharedUniforms.uLightDir.value.copy(lightDir);
      sharedUniforms.uCloudEnabled.value = clouds ? 1 : 0;
      sharedUniforms.uCloudSpeed.value = gu.uCloudSpeed.value;
    }
  };
}
