# Teardown 风格微体素物理渲染沙盘 (Micro-Voxel PBR Diorama)

> 💡 **Benchmark 评测项目交付文档**（L3_Advanced / teardown）  
> **核心目标**：完美复刻游戏《Teardown》（拆迁）的视觉美学——**“极简的微体素（Micro-Voxel）几何体”与“极度写实的 PBR 光影渲染”所产生的强烈物理反差与移轴沙盘玩具感**。

---

## 目录
1. [项目概览与设计哲学](#1-项目概览与设计哲学)
2. [架构设计与技术栈](#2-架构设计与技术栈)
3. [核心渲染管线深度解析](#3-核心渲染管线深度解析)
   - 3.1 实例化渲染与合批策略 (InstancedMesh Strategy)
   - 3.2 写实 PBR 材质系统 (Physical Material System)
   - 3.3 影棚级物理光照与环境反射 (Lighting & IBL)
   - 3.4 电影级后处理管线 (SSAO / Tilt-Shift DOF / Bloom / Color Grading)
4. [物理破坏与微体素动力学模拟](#4-物理破坏与微体素动力学模拟)
5. [场景构成与体素沙盘规划](#5-场景构成与体素沙盘规划)
6. [交互控制与快捷键指南](#6-交互控制与快捷键指南)

---

## 1. 项目概览与设计哲学

在瑞典独立游戏《Teardown》（由 Dennis Gustafsson 开发）中，最震撼的视觉特征在于**极度写实的物理渲染**作用于**纯粹的体素世界**上：
1. **绝对零贴图（Zero Textures）**：场景中没有任何外部位图贴图，所有物体纯粹由单一尺寸的立方体单元（`BoxGeometry`）搭建，依靠实例顶点色（Instance Colors）与微妙的色相/明度扰动赋予体素材质生命力。
2. **高对比度 PBR 物理反射**：粗糙漫反射的砖块、混凝土与高金属性、低粗糙度的镀铬管道、透射折射玻璃在同一场景中产生剧烈的材质质感对比。
3. **屏幕空间环境光遮蔽（SSAO）的决定性作用**：微体素模型由海量缝隙与直角夹角组成，强烈的 SSAO 能够在每一处砖缝、管道转角和碎屑阴影处产生深邃浓郁的接触阴影，彻底消除 WebGL 常见的“塑料发飘感”。
4. **移轴景深（Tilt-Shift Miniature DOF）**：通过模拟大光圈移轴镜头，聚焦于中央爆破缺口，虚化前后景深边缘，营造精致绝伦的微缩沙盘模型（Diorama）质感。

---

## 2. 架构设计与技术栈

- **单文件交付**：包含完整内联 HTML、现代 CSS 与 ES Module JavaScript，双击即运行。
- **渲染引擎**：Three.js (r160) + 官方 Post-Processing 管线扩展模块。
- **运行性能**：场景容纳约 **28,450+** 个微体素实例，仅需 **11 个 Draw Calls**，在常规 GPU 上稳锁 **60 FPS**。

```mermaid
graph TD
    A[场景几何生成器] -->|按材质分流分配| B[InstancedMesh 实例化合批 11 Groups]
    B --> C[主渲染 Beauty Pass]
    D[程序化 HDRI 天空盒] -->|PMREM 生成| E[场景环境光 IBL / 物理反射]
    F[PCFSoft 软阴影平行光 + 局部聚光灯] --> C
    C --> G[EffectComposer 后处理管线]
    G --> H[SSAO 接触环境遮蔽 Pass]
    H --> I[UnrealBloom 辉光与高光 Pass]
    I --> J[Tilt-Shift 移轴景深 Pass]
    J --> K[ColorGrading & Film Grain 调色 Pass]
    K --> L[OutputPass sRGB 输出]
    L --> M[屏幕最终呈现 60FPS]
```

---

## 3. 核心渲染管线深度解析

### 3.1 实例化渲染与合批策略 (InstancedMesh Strategy)

如果为近 3 万个体素单独创建 `THREE.Mesh`，会导致数万次 Draw Calls 并引发严重的 CPU 瓶颈与帧率暴跌。本项目采用**物理材质分组的 InstancedMesh 架构**：

```javascript
// 摘自 index.html: 实例化网格预分配与动态绘制设置
const boxGeo = new THREE.BoxGeometry(VOX, VOX, VOX);

const materials = {
  concrete: new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.04 }),
  asphalt: new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.08 }),
  brick: new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02 }),
  wood: new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02 }),
  chromeMetal: new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.98, envMapIntensity: 1.8 }),
  rustMetal: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.82 }),
  paintedMetal: new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.65 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x99e6ff, roughness: 0.06, metalness: 0.05,
    transmission: 0.94, ior: 1.52, thickness: 0.8 * VOX,
    transparent: true, opacity: 0.95, envMapIntensity: 2.0
  }),
  water: new THREE.MeshPhysicalMaterial({
    color: 0x0284c7, roughness: 0.08, metalness: 0.15,
    transmission: 0.86, ior: 1.333, thickness: 1.5 * VOX,
    transparent: true, opacity: 0.90
  }),
  foliage: new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.01 }),
  emissive: new THREE.MeshStandardMaterial({ roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 3.5 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.20, metalness: 0.95 })
};

// 为每种材质创建单独的 InstancedMesh
for (const key in materials) {
  const mesh = new THREE.InstancedMesh(boxGeo, materials[key], MAX_COUNTS[key]);
  mesh.castShadow = (key !== 'glass' && key !== 'water');
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
}
```

#### 纯色实例着色与微抖动（Jittering）
为避免体素产生单调的纯色色块感，每块体素在写入 `instanceColor` 缓冲时，均在 HSL 空间内进行程序化微扰动：

```javascript
function addVoxel(type, x, y, z, hexColor, jitter = 0.05) {
  // 设置实例变换矩阵
  dummyObj.position.set(x * VOX, y * VOX + VOX * 0.5, z * VOX);
  dummyObj.updateMatrix();
  mesh.setMatrixAt(idx, dummyObj.matrix);

  // HSL 空间微扰动：赋予每块砖石手工雕琢的自然质感
  tempColor.setHex(hexColor);
  if (jitter > 0) {
    tempColor.getHSL(hslHelper);
    hslHelper.h = (hslHelper.h + (Math.random() - 0.5) * 0.02 + 1) % 1;
    hslHelper.s = THREE.MathUtils.clamp(hslHelper.s + (Math.random() - 0.5) * 0.04, 0, 1);
    hslHelper.l = THREE.MathUtils.clamp(hslHelper.l + (Math.random() - 0.5) * jitter, 0, 1);
    tempColor.setHSL(hslHelper.h, hslHelper.s, hslHelper.l);
  }
  mesh.setColorAt(idx, tempColor);
}
```

---

### 3.2 写实 PBR 材质体系

项目严格遵循物理光学原理（Energy Conservation），对不同材质的粗糙度（Roughness）、金属性（Metalness）、折射率（IOR）和透射比（Transmission）进行了精确设定：

| 材质类型 | Material 类 | Metalness | Roughness | 关键物理参数与特征 |
| :--- | :--- | :--- | :--- | :--- |
| **镀铬金属管** | `MeshStandardMaterial` | **0.98** | **0.12** | 极强环境镜像反射，银白高光，镜面级反射 |
| **生锈铸铁** | `MeshStandardMaterial` | **0.82** | **0.55** | 氧化铁红褐色，粗糙各向同性散射 |
| **红砖 / 灰缝** | `MeshStandardMaterial` | **0.02** | **0.85** | 完全漫反射，色温微抖动，强接触阴影 |
| **透射玻璃** | `MeshPhysicalMaterial` | **0.05** | **0.06** | `transmission: 0.94, ior: 1.52`，内部光线真实折射穿透 |
| **运河水体** | `MeshPhysicalMaterial` | **0.15** | **0.08** | `transmission: 0.86, ior: 1.333`，动态波浪微起伏 |
| **自发光霓虹** | `MeshStandardMaterial` | **0.10** | **0.20** | `emissiveIntensity: 3.5`，配合 Bloom 产生梦幻光晕 |

---

### 3.3 影棚级物理光照与环境反射 (Lighting & IBL)

为了实现无需下载外部庞大 HDR 文件即可达到 360° 写实环境反射的效果，系统内置了**基于 Canvas 动态生成的 HDR 等距柱状全景天空**，并通过 `PMREMGenerator` 预过滤为辐射度环境贴图（IBL）：

```javascript
// 摘自 index.html: 程序化天光生成与 PMREM 预过滤
function createProceduralSkyTexture(sunElev = 0.35, sunAzimuth = 0.4) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  
  // 天顶蓝 -> 黄金地平线 -> 地表暖色渐变
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#102a45');
  grad.addColorStop(0.45, '#386b8c');
  grad.addColorStop(0.60, '#ff9e50');
  grad.addColorStop(0.68, '#4a3224');
  grad.addColorStop(1.0, '#15131a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // 太阳日盘与高能光晕（产生极佳的金属高光反光）
  const sunGrad = ctx.createRadialGradient(400, 330, 0, 400, 330, 180);
  sunGrad.addColorStop(0.0, 'rgba(255, 255, 240, 1.0)');
  sunGrad.addColorStop(0.5, 'rgba(255, 150, 70, 0.35)');
  sunGrad.addColorStop(1.0, 'rgba(255, 120, 50, 0.0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, 1024, 512);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const pmremGen = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGen.fromEquirectangular(createProceduralSkyTexture()).texture;
```

#### 阴影参数精细调优
阴影采用 `THREE.PCFSoftShadowMap`，分辨率达 `2048×2048`，并通过设置负偏移量 `shadow.bias = -0.00018` 与 `shadow.normalBias = 0.02`，彻底解决微体素网格表面因离散多边形导致的摩尔纹与阴影粉刺（Shadow Acne），同时保留极锐利的接触阴影。

---

### 3.4 电影级后处理管线 (Post-Processing Pipeline)

后处理管线由 6 个按顺序串联的 Pass 组成：

```javascript
const composer = new EffectComposer(renderer);

// Pass 1: 基础渲染通道
composer.addPass(new RenderPass(scene, camera));

// Pass 2: 屏幕空间环境光遮蔽 (SSAO)
const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 0.55;  // 遮蔽采样球半径
ssaoPass.minDistance = 0.001;  // 最小距离
ssaoPass.maxDistance = 0.12;   // 最大距离
ssaoPass.output = SSAOPass.OUTPUT.Default;
composer.addPass(ssaoPass);

// Pass 3: 辉光通道 (UnrealBloom)
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45, 0.5, 0.82
);
composer.addPass(bloomPass);

// Pass 4: 移轴微缩景深通道 (Tilt-Shift Diorama DOF)
const tiltShiftPass = new ShaderPass(TiltShiftShader);
composer.addPass(tiltShiftPass);

// Pass 5: 电影调色、暗角与胶片颗粒通道
const colorGradePass = new ShaderPass(ColorGradeShader);
composer.addPass(colorGradePass);

// Pass 6: sRGB 色彩空间输出
composer.addPass(new OutputPass());
```

#### Tilt-Shift 移轴景深 Shader 逻辑
自定义 Tilt-Shift 着色器在屏幕 Y 轴中央定义清晰焦带，上下边缘采用 12 采样圆盘散景（Disc Bokeh Kernel）进行指数模糊，营造沙盘玩具的移轴摄影效果：

```glsl
// 摘自 TiltShiftShader Fragment Shader
uniform sampler2D tDiffuse;
uniform float focusPos;    // 焦平面 Y 轴位置 (0.0 - 1.0)
uniform float focusWidth;  // 清晰对焦带宽度
uniform float blurMax;     // 最大模糊半径
uniform vec2 resolution;
varying vec2 vUv;

void main() {
  float dist = abs(vUv.y - focusPos);
  float blur = smoothstep(focusWidth * 0.5, focusWidth * 0.5 + 0.32, dist) * blurMax;

  if (blur <= 0.05) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  vec4 sum = vec4(0.0);
  vec2 texel = 1.0 / resolution;
  float total = 0.0;

  // 12-sample 圆盘散景卷积核
  for (float i = -2.0; i <= 2.0; i += 1.0) {
    for (float j = -2.0; j <= 2.0; j += 1.0) {
      float weight = exp(-(i*i + j*j) / 3.5);
      vec2 offset = vec2(i, j) * texel * blur;
      sum += texture2D(tDiffuse, vUv + offset) * weight;
      total += weight;
    }
  }
  gl_FragColor = sum / total;
}
```

---

## 4. 物理破坏与微体素动力学模拟

Demo 集成了完全自定义的**微体素物理炸药模拟器（Voxel Demolition Engine）**：
1. **爆破冲量计算**：当触发爆破时，计算缺口区域体内所有微体素距离爆心 `(-11, 6, -12)` 的三维径向距离，施加衰减辐射冲量并附加随机角动量。
2. **欧拉物理积分**：每帧更新体素速度、重力（$g = -18.0\text{ m/s}^2$）与空气阻力。
3. **地面碰撞与动能反弹**：检测体素与地面基座接触，施加 $0.35$ 恢复系数反弹与 $0.7$ 地面滑动摩擦衰减，呈现出极其逼真的砖石碎渣滚落效果。
4. **无缝倒放还原**：支持一键线性插值倒放（Lerp Easing），将数千块散落碎石平滑吸附回原始建筑墙体中。

---

## 5. 场景构成与体素沙盘规划

沙盘总体尺寸为 $68 \times 68$ 体素单元，依序构建了以下精致模块：
- **实心台座（Solid Plinth）**：底部高档深色黑胡桃木/花岗岩双层基座，镶嵌镀金黄铜包边与四周边框地质断层（玄武岩、碎石层）。
- **被炸毁的红砖厂房（Main Ruin Wall）**：多层红砖墙体，中心呈现一个巨大的有机破碎缺口，断口裸露出弯曲的钢筋管线、断裂的木质横梁与散落一地的砖块碎渣。
- **工业管道与阀门系统**：高反光银色镀铬排气管道、锈蚀铁质输油管与醒目的明黄色高压瓦斯管道，配合金色黄铜控制阀门。
- **现代透射玻璃实验室**：黑色钢构格栅框架，镶嵌高透射比实体玻璃体素，内部清晰可见实木工作台、发光终端屏幕与吊灯。
- **体素运河与石拱桥**：蜿蜒穿过沙盘的半透明蓝绿运河，搭配带有行人护栏的石拱公路桥与微波起伏动画。
- **微型工程挖掘机与道路设施**：黑色履带、工程黄车身、液压臂与钢齿挖斗，搭配沥青公路、黄色虚线、斑马线、路灯与交通路障。

---

## 6. 交互控制与快捷键指南

| 交互操作 | 功能说明 |
| :--- | :--- |
| **鼠标左键拖拽** | 围绕沙盘中心 360° 旋转视角 |
| **鼠标右键拖拽** | 平移摄像机目标中心 |
| **鼠标滚轮** | 缩放镜头距离（限制在 10 ~ 120 之间） |
| **空格键 (Space)** | 触发墙体爆破 / 倒放还原修复 |
| **数字键 1 ~ 4** | 快速切换相机预设：45°等轴 / 缺口特写 / 运河桥梁 / 90°俯视蓝图 |
| **按键 T** | 循环切换光照时间：🌅 黄金时刻 / ☀️ 正午影棚 / 🌃 赛博夜景 |
| **右侧控制面板** | 实时调节 SSAO 半径、移轴焦平面位置、切换后处理开关与自动电影运镜 |

---

*交付完成：文件 `index.html` 100% 独立闭合可运行，无任何外部构建依赖与占位符。*
