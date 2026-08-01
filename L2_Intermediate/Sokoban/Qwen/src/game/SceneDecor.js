import * as THREE from 'three';
import { SimplexNoise } from '../noise.js';

const noise = new SimplexNoise(999);

// ============================================
// 游戏关卡外圈草地 (沿矩形关卡边缘自然生长)
// ============================================
export function createGameGrass(scene, levelWidth, levelHeight) {
  const group = new THREE.Group();
  group.name = 'gameGrass';
  
  const grassCount = 8000;
  const geometry = new THREE.PlaneGeometry(0.25, 1.1, 1, 2);
  
  const grassTex = createGrassSprite();
  const windTex = createWindNoise();
  
  const material = new THREE.ShaderMaterial({
    vertexShader: GRASS_VERT,
    fragmentShader: GRASS_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uGrassTex: { value: grassTex },
      uWindTex: { value: windTex },
      uWindDir: { value: new THREE.Vector3(1, 0, 0.3).normalize() },
      uBaseColor: { value: new THREE.Color('#2a7a2a') },
      uMidColor: { value: new THREE.Color('#4ab84a') },
      uTipColor: { value: new THREE.Color('#8ae060') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    },
    side: THREE.DoubleSide,
    transparent: false,
  });
  
  const mesh = new THREE.InstancedMesh(geometry, material, grassCount);
  mesh.frustumCulled = false;
  
  const dummy = new THREE.Object3D();
  const halfW = levelWidth / 2;
  const halfH = levelHeight / 2;
  // 草地沿矩形关卡边缘向外延伸1.5~3格
  const bandInner = 0.8;
  const bandOuter = 2.5;
  
  const clusterNoise = new SimplexNoise(777);
  
  let idx = 0;
  for (let i = 0; i < grassCount * 3 && idx < grassCount; i++) {
    // 沿矩形周边随机选点: 先选边，再沿边随机位置
    const side = Math.floor(Math.random() * 4);
    let bx, bz;
    if (side === 0) { // 上边
      bx = (Math.random() - 0.5) * (levelWidth + bandOuter * 2);
      bz = -halfH - bandInner - Math.random() * (bandOuter - bandInner);
    } else if (side === 1) { // 下边
      bx = (Math.random() - 0.5) * (levelWidth + bandOuter * 2);
      bz = halfH + bandInner + Math.random() * (bandOuter - bandInner);
    } else if (side === 2) { // 左边
      bx = -halfW - bandInner - Math.random() * (bandOuter - bandInner);
      bz = (Math.random() - 0.5) * (levelHeight + bandOuter * 2);
    } else { // 右边
      bx = halfW + bandInner + Math.random() * (bandOuter - bandInner);
      bz = (Math.random() - 0.5) * (levelHeight + bandOuter * 2);
    }
    
    // 角落区域也补充一些草
    if (Math.random() < 0.2) {
      const cornerX = (Math.random() < 0.5 ? -1 : 1) * (halfW + bandInner + Math.random() * bandOuter);
      const cornerZ = (Math.random() < 0.5 ? -1 : 1) * (halfH + bandInner + Math.random() * bandOuter);
      bx = cornerX;
      bz = cornerZ;
    }
    
    // 丛生噪声控制密度
    const cluster = clusterNoise.noise2D(bx * 0.2, bz * 0.2);
    if (cluster < -0.3 && Math.random() > 0.2) continue;
    
    dummy.position.set(bx, 0, bz);
    
    // 自然倾斜
    const lean = 0.1 + Math.random() * 0.3;
    const leanDir = Math.random() * Math.PI * 2;
    dummy.rotation.set(
      Math.cos(leanDir) * lean,
      Math.random() * Math.PI * 2,
      Math.sin(leanDir) * lean
    );
    
    // 高度: 靠近关卡矮，远离关卡高
    const distFromEdge = Math.max(0, Math.max(Math.abs(bx) - halfW, Math.abs(bz) - halfH));
    const heightFactor = Math.min(1, distFromEdge / bandOuter);
    const scale = (0.4 + Math.random() * 0.5) * (0.5 + heightFactor * 0.7);
    dummy.scale.set(scale * 0.7, scale, scale * 0.7);
    
    dummy.updateMatrix();
    mesh.setMatrixAt(idx, dummy.matrix);
    idx++;
  }
  
  mesh.count = idx;
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  
  const update = (time) => {
    material.uniforms.uTime.value = time;
  };
  
  return { group, update, material };
}

// 草叶Sprite贴图
function createGrassSprite() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 16, 32);
  ctx.fillStyle = '#ffffff';
  
  // 多片草叶
  for (let b = 0; b < 4; b++) {
    const bx = 3 + b * 3;
    const lean = (b - 1.5) * 1.5;
    for (let y = 0; y < 22 + b * 3; y++) {
      const px = Math.round(bx + (lean * y) / 25);
      ctx.fillRect(px, 31 - y, 1, 1);
    }
  }
  
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function createWindNoise() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const s = new SimplexNoise(321);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let v = s.fbm(x / size * 4, y / size * 4, 3, 2, 0.5);
      v = (v + 1) * 0.5 * 255;
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// 草地顶点着色器
const GRASS_VERT = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uWindTex;
  uniform vec3 uWindDir;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  
  void main() {
    vUv = uv;
    vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 wPos = (modelMatrix * instPos).xyz;
    vWorldPos = wPos;
    
    // Stop-motion 12fps
    float phase = fract(sin(dot(wPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float t = floor((uTime + phase * 0.7) * 12.0) / 12.0;
    
    // 风力
    vec2 nUV = wPos.xz * 0.06 + uWindDir.xz * t * 0.2;
    float wind = texture2D(uWindTex, nUV).r;
    
    // 弯曲 (仅上部)
    float bend = uv.y * uv.y * wind * 0.4;
    vec3 pos = position;
    pos.x += bend * uWindDir.x;
    pos.z += bend * uWindDir.z;
    
    // Billboard
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float sx = length(vec3(modelMatrix[0].xyz));
    float sy = length(vec3(modelMatrix[1].xyz));
    mv.xy += pos.xy * vec2(sx, sy);
    
    gl_Position = projectionMatrix * mv;
  }
`;

// 草地片元着色器 (Hybrid Toon)
const GRASS_FRAG = /* glsl */ `
  uniform sampler2D uGrassTex;
  uniform vec3 uBaseColor;
  uniform vec3 uMidColor;
  uniform vec3 uTipColor;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  
  void main() {
    vec4 tex = texture2D(uGrassTex, vUv);
    if (tex.a < 0.5) discard;
    
    // 三段高度渐变
    vec3 col;
    if (vUv.y < 0.5) col = mix(uBaseColor, uMidColor, vUv.y * 2.0);
    else col = mix(uMidColor, uTipColor, (vUv.y - 0.5) * 2.0);
    
    // 位置色彩变化
    float patchVar = fract(sin(dot(vWorldPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
    col = mix(col, col * 1.2, patchVar * 0.2);
    
    // Toon光照 (法线强制朝上)
    float NdL = dot(vec3(0.0, 1.0, 0.0), normalize(uSunDir));
    float toon = floor((NdL * 0.5 + 0.5) * 3.0) / 3.0;
    col *= (0.5 + toon * 0.5);
    
    // 底部AO
    col *= mix(0.7, 1.0, smoothstep(0.0, 0.25, vUv.y));
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ============================================
// Low-poly 岩石造景
// ============================================
export function createRocksRing(levelWidth, levelHeight) {
  const group = new THREE.Group();
  group.name = 'rocksRing';
  
  const halfW = levelWidth / 2 + 1;
  const halfH = levelHeight / 2 + 1;
  const ringRadius = Math.max(halfW, halfH) + 1.5;
  
  const rockCount = 18;
  // 提亮岩石色板，避免像素量化后变为黑色
  const rockColors = ['#b8b0a0', '#c8c0b0', '#a8a090', '#d0c8b8'];
  
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const dist = ringRadius + (Math.random() - 0.5) * 3;
    const x = Math.cos(angle) * dist * (levelWidth / levelHeight);
    const z = Math.sin(angle) * dist;
    
    const rock = createLowPolyRock(rockColors[i % rockColors.length]);
    rock.position.set(x, -0.1, z);
    rock.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.8 + Math.random() * 1.4;
    rock.scale.set(s, s * (0.6 + Math.random() * 0.4), s);
    group.add(rock);
  }
  
  return group;
}

function createLowPolyRock(color) {
  const group = new THREE.Group();
  
  const geo = new THREE.IcosahedronGeometry(0.5, 0);
  const pos = geo.attributes.position.array;
  
  // 基于位置的确定性变形 (避免随机导致面片缝隙)
  // 相同位置的顶点获得相同位移，保持网格闭合
  const seed = Math.random() * 100;
  for (let i = 0; i < pos.length; i += 3) {
    const px = pos[i], py = pos[i+1], pz = pos[i+2];
    // 用位置哈希代替随机数，确保共享顶点一致
    const hx = Math.sin(px * 12.9898 + py * 78.233 + seed) * 43758.5453;
    const hy = Math.sin(py * 12.9898 + pz * 78.233 + seed) * 43758.5453;
    const hz = Math.sin(pz * 12.9898 + px * 78.233 + seed) * 43758.5453;
    pos[i]   *= 0.85 + (hx - Math.floor(hx)) * 0.3;
    pos[i+1] *= 0.55 + (hy - Math.floor(hy)) * 0.25;
    pos[i+2] *= 0.85 + (hz - Math.floor(hz)) * 0.3;
  }
  geo.computeVertexNormals();
  
  // 顶点颜色: 顶部亮、底部暗的渐变，模拟自然光照
  const colors = [];
  const baseColor = new THREE.Color(color);
  for (let i = 0; i < pos.length; i += 3) {
    const heightFactor = (pos[i+1] + 0.5); // 0=底部, ~1=顶部
    const brightness = 0.9 + heightFactor * 0.4;
    const variation = 0.95 + Math.random() * 0.1; // 极小变化，避免量化后出现黑点
    colors.push(
      baseColor.r * brightness * variation,
      baseColor.g * brightness * variation,
      baseColor.b * brightness * variation
    );
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  // 使用 MeshLambertMaterial 替代 MeshToonMaterial，避免色带断裂变黑
  const mat = new THREE.MeshLambertMaterial({ 
    color: 0xffffff,
    vertexColors: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  
  return group;
}

// ============================================
// Low-poly 水面造景
// ============================================
export function createWaterRing(levelWidth, levelHeight) {
  const group = new THREE.Group();
  group.name = 'waterRing';
  
  const halfW = levelWidth / 2 + 1;
  const halfH = levelHeight / 2 + 1;
  const innerR = Math.max(halfW, halfH) + 2.5; // 内径: 留出岛屿陆地
  const outerR = innerR + 40; // 外径: 适度延伸，超出部分由scene.background接管
  
  // RingGeometry: 内径留出岛屿，外径由背景色无缝衔接
  const waterGeo = new THREE.RingGeometry(innerR, outerR, 64, 4);
  waterGeo.rotateX(-Math.PI / 2);
  
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#4ab8e8') },
      uColor2: { value: new THREE.Color('#80d8f8') },
      uDeepColor: { value: new THREE.Color('#2a7ab0') }, // 与scene.background一致
      uFoamColor: { value: new THREE.Color('#e8f8ff') },
      uInnerR: { value: innerR },
      uOuterR: { value: outerR },
    },
    transparent: false,
    side: THREE.DoubleSide,
  });
  
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = -0.3;
  water.frustumCulled = false;
  group.add(water);
  
  // 散落的小石块在水边
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = innerR + Math.random() * 2;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    
    const pebble = createLowPolyRock('#8a9a9a');
    pebble.position.set(x, -0.15, z);
    pebble.scale.setScalar(0.3 + Math.random() * 0.4);
    group.add(pebble);
  }
  
  const update = (time) => {
    waterMat.uniforms.uTime.value = time;
  };
  
  return { group, update };
}

const WATER_VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPos;
  
  void main() {
    vUv = uv;
    vec3 pos = position;
    // 简单波浪
    pos.y += sin(pos.x * 0.5 + uTime * 1.5) * 0.08;
    pos.y += cos(pos.z * 0.4 + uTime * 1.2) * 0.06;
    vPos = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uDeepColor;
  uniform vec3 uFoamColor;
  uniform float uInnerR;
  uniform float uOuterR;
  varying vec2 vUv;
  varying vec3 vPos;
  
  void main() {
    float dist = length(vPos.xz);
    float normalizedDist = clamp((dist - uInnerR) / (uOuterR - uInnerR), 0.0, 1.0);
    
    // 5级色阶波浪 (原3级太生硬)
    float wave = sin(vPos.x * 1.5 + uTime * 1.5) * 0.5 + 0.5;
    wave += sin(vPos.z * 1.2 + uTime * 1.0) * 0.3;
    wave = clamp(wave, 0.0, 1.0);
    wave = floor(wave * 5.0) / 5.0;
    
    // 基础水色 + 深度渐变
    vec3 col = mix(uColor1, uColor2, wave);
    col = mix(col, uDeepColor, normalizedDist * 0.4);
    
    // 沿岸泡沫: 更宽的平滑带
    float shoreFoam = 1.0 - smoothstep(0.0, 0.08, normalizedDist);
    float foamPulse = sin(dist * 2.0 - uTime * 3.0) * 0.5 + 0.5;
    foamPulse = floor(foamPulse * 3.0) / 3.0;
    shoreFoam *= (0.7 + foamPulse * 0.3);
    
    // 宽阔波峰泡沫线 (替代随机噪点)
    float waveFoam = sin(vPos.x * 3.0 + vPos.z * 2.0 + uTime * 2.5);
    waveFoam = smoothstep(0.92, 1.0, waveFoam) * 0.4;
    
    float totalFoam = max(shoreFoam, waveFoam);
    col = mix(col, uFoamColor, totalFoam);
    
    gl_FragColor = vec4(col, 1.0);
  }
`;
