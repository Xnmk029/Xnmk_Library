import * as THREE from 'three';
import { SimplexNoise } from './noise.js';
import { getTerrainHeight, isOnPath, TERRAIN_SIZE } from './terrain.js';

const noise = new SimplexNoise(123);

// ============================================
// 像素风草丛 Sprite 贴图生成 (带 Alpha 通道)
// ============================================
function createGrassSpriteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;  // 低分辨率像素风
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  // 完全透明背景
  ctx.clearRect(0, 0, 32, 32);
  
  // 绘制像素风草叶形状 - 多片草叶组成的草丛
  ctx.imageSmoothingEnabled = false;
  
  // 草叶颜色 (白色，实际颜色由shader控制)
  ctx.fillStyle = '#ffffff';
  
  // 左侧草叶
  drawPixelBlade(ctx, 8, 28, -2, 18);
  drawPixelBlade(ctx, 11, 29, -1, 20);
  
  // 中间草叶 (最高)
  drawPixelBlade(ctx, 14, 30, 0, 24);
  drawPixelBlade(ctx, 16, 30, 1, 22);
  
  // 右侧草叶
  drawPixelBlade(ctx, 19, 29, 2, 19);
  drawPixelBlade(ctx, 22, 28, 3, 16);
  
  // 额外的细草叶
  drawPixelBlade(ctx, 6, 27, -3, 12);
  drawPixelBlade(ctx, 25, 27, 4, 11);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;  // 像素风关键：最近邻采样
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 绘制单片像素草叶
function drawPixelBlade(ctx, baseX, baseY, lean, height) {
  for (let i = 0; i < height; i++) {
    const y = baseY - i;
    const xOffset = Math.floor((lean * i) / height);
    const x = baseX + xOffset;
    
    // 草叶宽度随高度递减 (底部宽，顶部尖)
    const width = i < height * 0.3 ? 2 : 1;
    
    for (let w = 0; w < width; w++) {
      ctx.fillRect(x + w, y, 1, 1);
    }
  }
}

// ============================================
// 风力噪波贴图生成
// ============================================
function createWindNoiseTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const simplex = new SimplexNoise(456);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size * 6;
      const ny = y / size * 6;
      
      // 多层噪波叠加
      let val = simplex.fbm(nx, ny, 4, 2.0, 0.5);
      val = (val + 1) * 0.5;
      val = Math.pow(val, 1.5); // 增加对比度
      val = Math.floor(val * 255);
      
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// ============================================
// 颜色斑块噪波贴图
// ============================================
function createColorPatchTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const simplex = new SimplexNoise(789);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size * 3;
      const ny = y / size * 3;
      
      // 大尺度颜色变化
      let val = simplex.fbm(nx, ny, 3, 2.0, 0.6);
      val = (val + 1) * 0.5 * 255;
      
      data[i] = val;     // R: 颜色变化
      data[i + 1] = val; // G
      data[i + 2] = val; // B
      data[i + 3] = 255;
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

// ============================================
// 顶点着色器 - 核心：Billboard + 风力 + 低帧率动画
// ============================================
const grassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uWindNoiseTex;
  uniform vec3 uWindDirection;
  uniform vec4 uCharacters[64];
  uniform int uCharacterCount;
  uniform float uWindStrength;
  
  varying vec2 vUv;
  varying float vWindIntensity;
  varying float vPlayerDisplacement;
  varying vec3 vWorldPosition;
  varying float vHeightFactor;
  
  // 旋转矩阵生成
  mat4 rotationAxisAngle(vec3 axis, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat4(
      oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
      oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
      oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
      0.0,                                0.0,                                0.0,                                1.0
    );
  }
  
  void main() {
    vUv = uv;
    
    // 1. 获取实例世界坐标
    vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 worldPos = (modelMatrix * instancePos).xyz;
    vWorldPosition = worldPos;
    
    // 2. Stop-motion 低帧率时间 (12fps 定格动画感)
    // 每个草实例有独立的相位偏移，避免全局同步卡顿
    float phaseOffset = fract(sin(dot(worldPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float fps = 12.0;
    float steppedTime = floor((uTime + phaseOffset * 0.8) * fps) / fps;
    
    // 3. 多层风力噪波采样 (使用无理数避免规律重复)
    vec2 noiseUV1 = worldPos.xz * 0.04 + uWindDirection.xz * steppedTime * 0.15;
    vec2 noiseUV2 = worldPos.xz * 0.017 + uWindDirection.xz * (steppedTime * 1.314159) * 0.08;
    vec2 noiseUV3 = worldPos.xz * 0.09 + vec2(steppedTime * 0.05, steppedTime * 0.03);
    
    float noise1 = texture2D(uWindNoiseTex, noiseUV1).r;
    float noise2 = texture2D(uWindNoiseTex, noiseUV2).r;
    float noise3 = texture2D(uWindNoiseTex, noiseUV3).r;
    
    // 混合多层噪波
    float windNoise = clamp(noise1 * 0.5 + noise2 * 0.35 + noise3 * 0.15, 0.0, 1.0);
    windNoise = pow(windNoise, 1.2);
    vWindIntensity = windNoise;
    
    // 4. 计算旋转轴 (正交于风向)
    vec3 rotAxis = normalize(vec3(-uWindDirection.z, 0.0, uWindDirection.x));
    float maxRotAngle = uWindStrength;
    
    // 只有草的上部 (uv.y 接近 1.0) 会弯曲
    float bendFactor = uv.y * uv.y; // 二次曲线，底部固定
    float finalRotAngle = maxRotAngle * windNoise * bendFactor;
    
    // 5. 多角色交互位移
    vec3 totalDisplacementVec = vec3(0.0);
    float totalDisplacementFactor = 0.0;
    
    for (int i = 0; i < 64; i++) {
      if (i >= uCharacterCount) break;
      vec3 charPos = uCharacters[i].xyz;
      float radius = uCharacters[i].w;
      
      float dist = distance(worldPos.xz, charPos.xz);
      if (dist < radius) {
        float force = 1.0 - (dist / radius);
        force = force * force; // 平方衰减
        
        vec3 dirToGrass = normalize(vec3(worldPos.x - charPos.x, 0.0, worldPos.z - charPos.z));
        totalDisplacementVec += dirToGrass * force;
        totalDisplacementFactor = max(totalDisplacementFactor, force);
      }
    }
    vPlayerDisplacement = totalDisplacementFactor;
    
    // 6. 应用几何形变
    vec4 localPosition = vec4(position, 1.0);
    
    // 风力旋转
    mat4 windRotMatrix = rotationAxisAngle(rotAxis, finalRotAngle);
    localPosition = windRotMatrix * localPosition;
    
    // 角色推开 (只影响上部)
    localPosition.xyz += totalDisplacementVec * bendFactor * 1.2;
    
    // 记录高度因子用于片元着色
    vHeightFactor = uv.y;
    
    // 7. Y轴 Billboard 计算
    // 草始终面向相机，但保持垂直
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    
    // 提取缩放
    float scaleX = length(vec3(modelMatrix[0].xyz));
    float scaleY = length(vec3(modelMatrix[1].xyz));
    
    // 在视图空间中偏移，实现Billboard
    mvPosition.xy += localPosition.xy * vec2(scaleX, scaleY);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ============================================
// 片元着色器 - 核心：Hybrid Toon Shading + 伪透视 + 颜色斑块
// ============================================
const grassFragmentShader = /* glsl */ `
  uniform sampler2D uGrassTex;
  uniform sampler2D uColorPatchTex;
  uniform sampler2D uCloudNoiseTex;
  uniform vec3 uBaseColor;
  uniform vec3 uMidColor;
  uniform vec3 uTipColor;
  uniform vec3 uAccentColor;
  uniform vec3 uWindDirection;
  uniform vec3 uCameraForward;
  uniform float uPerspectiveIntensity;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform vec3 uAmbientColor;
  uniform float uTime;
  uniform float uToonBands;
  uniform float uToonSmoothness;
  
  varying vec2 vUv;
  varying float vWindIntensity;
  varying float vPlayerDisplacement;
  varying vec3 vWorldPosition;
  varying float vHeightFactor;
  
  // ============================================
  // 混合卡通着色 (Hybrid Toon Shading)
  // 色阶分块 + 边界平滑过渡
  // ============================================
  float getHybridToonShadow(float NdotL, float bands, float smoothness) {
    float bandWidth = 1.0 / bands;
    float rawValue = NdotL * 0.5 + 0.5;
    
    // 计算当前所在的色阶
    float stepped = floor(rawValue * bands) / bands;
    
    // 计算到色阶边界的距离
    float dist = rawValue - stepped;
    float edge = bandWidth * smoothness;
    
    // 在边界处做极小范围的平滑过渡
    return stepped + smoothstep(0.0, edge, dist) * bandWidth;
  }
  
  void main() {
    // 1. 伪透视 UV 拉伸补偿 (Fake Perspective)
    // 在正交相机下，草前后摇摆时会变扁，需要拉伸补偿
    float dotAlign = abs(dot(normalize(uWindDirection.xz), normalize(uCameraForward.xz)));
    float perspectiveFactor = (vWindIntensity * 0.4 + vPlayerDisplacement * 0.6);
    float scaleFactor = 1.0 + perspectiveFactor * (1.0 - vUv.y) * dotAlign * uPerspectiveIntensity;
    
    vec2 correctedUv = vUv;
    correctedUv.x = (correctedUv.x - 0.5) / scaleFactor + 0.5;
    
    // 2. 采样草丛贴图 + Alpha 剪裁
    vec4 texColor = texture2D(uGrassTex, correctedUv);
    if (texColor.a < 0.5) discard; // 关键：剔除透明部分
    
    // 3. 世界坐标颜色斑块采样 (Color Patches)
    vec2 patchUV = vWorldPosition.xz * 0.02;
    float colorPatch = texture2D(uColorPatchTex, patchUV).r;
    
    // 4. 高度渐变 + 颜色斑块混合
    // 底部 -> 中部 -> 顶部 的三段渐变
    vec3 heightColor;
    if (vUv.y < 0.5) {
      heightColor = mix(uBaseColor, uMidColor, vUv.y * 2.0);
    } else {
      heightColor = mix(uMidColor, uTipColor, (vUv.y - 0.5) * 2.0);
    }
    
    // 混入强调色 (Accent Grass) 基于噪波
    float accentMask = smoothstep(0.6, 0.8, colorPatch);
    heightColor = mix(heightColor, uAccentColor, accentMask * 0.4);
    
    // 添加随机色彩变化
    float colorVar = fract(sin(dot(vWorldPosition.xz, vec2(12.9898, 78.233))) * 43758.5453);
    heightColor = mix(heightColor, heightColor * 1.15, colorVar * 0.15);
    
    vec3 finalColor = heightColor;
    
    // 5. Hybrid Toon Shading 光照
    // 关键：法线强制朝上 (0, 1, 0)，消除单片草内部阴影
    vec3 normal = vec3(0.0, 1.0, 0.0);
    float NdotL = dot(normal, normalize(uSunDirection));
    
    // 应用混合卡通着色 (3阶色块，边界平滑度0.2)
    float toonLight = getHybridToonShadow(NdotL, uToonBands, uToonSmoothness);
    
    // 组合光照：环境光 + 主光源
    vec3 lighting = uAmbientColor + uSunColor * toonLight;
    finalColor *= lighting;
    
    // 6. 云层阴影
    vec2 cloudUV = vWorldPosition.xz * 0.006 + uTime * 0.008;
    float cloudShadow = texture2D(uCloudNoiseTex, cloudUV).r;
    cloudShadow = smoothstep(0.3, 0.7, cloudShadow);
    finalColor *= mix(0.65, 1.0, cloudShadow);
    
    // 7. 底部轻微AO (不是黑色，是深色)
    float ao = mix(0.75, 1.0, smoothstep(0.0, 0.3, vUv.y));
    finalColor *= ao;
    
    // 8. 风力高亮 (风吹过时草尖微微发亮)
    finalColor += uSunColor * vWindIntensity * vUv.y * 0.08;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================
// 草地创建主函数
// ============================================
export function createGrass(camera) {
  const grassCount = 60000;
  
  // 使用简单的矩形平面 (Quad) 作为草叶
  // 关键：这是2D平面，不是3D几何体
  const geometry = new THREE.PlaneGeometry(0.6, 1.0, 1, 1);
  
  // 生成贴图
  const grassTex = createGrassSpriteTexture();
  const windNoiseTex = createWindNoiseTexture(128);
  const colorPatchTex = createColorPatchTexture(128);
  const cloudNoiseTex = createWindNoiseTexture(64);
  
  // 角色数据
  const maxCharacters = 64;
  const characterData = [];
  for (let i = 0; i < maxCharacters; i++) {
    characterData.push(new THREE.Vector4(0, 0, 0, 0));
  }
  
  const material = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uWindNoiseTex: { value: windNoiseTex },
      uColorPatchTex: { value: colorPatchTex },
      uCloudNoiseTex: { value: cloudNoiseTex },
      uWindDirection: { value: new THREE.Vector3(1, 0, 0.4).normalize() },
      uWindStrength: { value: 0.45 },
      uCameraForward: { value: new THREE.Vector3() },
      uCharacters: { value: characterData },
      uCharacterCount: { value: 0 },
      uPerspectiveIntensity: { value: 0.35 },
      uGrassTex: { value: grassTex },
      // 颜色配置：底部深绿 -> 中部翠绿 -> 顶部黄绿
      uBaseColor: { value: new THREE.Color('#1a4a1a') },
      uMidColor: { value: new THREE.Color('#3d8b37') },
      uTipColor: { value: new THREE.Color('#7ec850') },
      uAccentColor: { value: new THREE.Color('#a8d84a') }, // 黄绿强调色
      uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color('#fff8e0') },
      uAmbientColor: { value: new THREE.Color('#5a7a5a') },
      uToonBands: { value: 3.0 },
      uToonSmoothness: { value: 0.2 },
    },
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
  
  const instancedGrass = new THREE.InstancedMesh(geometry, material, grassCount);
  instancedGrass.frustumCulled = false;
  
  const dummy = new THREE.Object3D();
  let index = 0;
  
  const halfSize = TERRAIN_SIZE * 0.46;
  
  // 分布草地，避开路径
  for (let i = 0; i < grassCount * 3 && index < grassCount; i++) {
    const x = (Math.random() - 0.5) * 2 * halfSize;
    const z = (Math.random() - 0.5) * 2 * halfSize;
    
    // 避开路径
    if (isOnPath(x, z)) continue;
    
    // 使用噪波控制密度，形成自然斑块
    const density = noise.noise2D(x * 0.03, z * 0.03);
    if (density < -0.4 && Math.random() > 0.2) continue;
    
    const y = getTerrainHeight(x, z);
    
    dummy.position.set(x, y, z);
    
    // 随机Y轴旋转 (Billboard会处理面向相机)
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    
    // 随机缩放变化 (高度错落)
    const heightScale = 0.5 + Math.random() * 0.9;
    const widthScale = 0.7 + Math.random() * 0.5;
    dummy.scale.set(widthScale, heightScale, 1);
    
    dummy.updateMatrix();
    instancedGrass.setMatrixAt(index, dummy.matrix);
    index++;
  }
  
  instancedGrass.count = index;
  instancedGrass.instanceMatrix.needsUpdate = true;
  
  console.log(`🌱 Grass instances: ${index}`);
  
  // 更新函数
  const update = (time, players = []) => {
    material.uniforms.uTime.value = time;
    
    if (camera) {
      camera.getWorldDirection(material.uniforms.uCameraForward.value);
    }
    
    const activeCount = Math.min(players.length, maxCharacters);
    material.uniforms.uCharacterCount.value = activeCount;
    
    for (let i = 0; i < activeCount; i++) {
      const player = players[i];
      characterData[i].set(
        player.position.x,
        player.position.y,
        player.position.z,
        player.radius || 2.5
      );
    }
  };
  
  return { mesh: instancedGrass, update, material };
}
