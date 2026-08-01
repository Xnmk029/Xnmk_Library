# stage1

尝试使用以下方式，实现一个three.js下的草地shaders效果，场景需要有以下元素
1、同时为其配备相同渲染风格的hdri贴图资源（hdri可搜索）
2、生成一些类似渲染风格的树（以极高的园林景观审美进行简单摆放，以构成一个场景）
3、一条相似渲染风格的土路
4、场景周围使用迷雾美化渲染距离
5、场景需要有一定的自然的地形起伏

以下为草地shaders方式：
在视频《How I made grass better than 99% of games | Stylized grass 3D pixel art》中，作者 Dylearn 介绍了一套非常高级、极具游戏质感（Juicy）的**像素风/写实风混合草地渲染方案**。他在 Godot 4.3 中实现的这套系统，核心在于**将世界空间物理旋转、低帧率动画（Stop-motion）、非透视相机下的伪透视（Fake Perspective）以及多角色交互位移**融合在一起。

要把这套方案完整地移植到 **Three.js** 中，你需要使用 `THREE.InstancedMesh`（实例化网格）并编写自定义的着色器（`THREE.ShaderMaterial` 或通过 `onBeforeCompile` 修改材质）。

下面我将为你深度拆解，并提供在 Three.js 中实现这套 Shader 方法的完整技术方案与核心代码。

---

---

## 1. 架构设计：实例化渲染 (InstancedMesh)

由于草地数量极大，你必须使用 **InstancedMesh** 降低 Draw Call。

在 Three.js 中，我们使用一个垂直的 `THREE.PlaneGeometry` 作为单张草叶。为了让法线在地面光照下显得平滑，我们通常会将草叶的法线强制指向天空 $(0, 1, 0)$，以此获得统一柔和的着色。

```javascript
// 创建单片草的几何体
const geometry = new THREE.PlaneGeometry(0.5, 1.0, 1, 1); // 1个分段即可，位移全靠 Shader
// 强制将法线指向上方以获得卡通、平整的受光
const normals = geometry.attributes.normal.array;
for (let i = 0; i < normals.length; i += 3) {
    normals[i] = 0;
    normals[i+1] = 1; // 朝上
    normals[i+2] = 0;
}
geometry.attributes.normal.needsUpdate = true;

// 实例化的草地
const count = 10000;
const instancedGrass = new THREE.InstancedMesh(geometry, grassMaterial, count);

```

---

## 2. 顶点着色器 (Vertex Shader) 实现

这是整个草地渲染的灵魂所在。我们需要在顶点着色器中按顺序完成：

1. **解析实例的世界坐标**；

2. **计算带相位偏移的低帧率风力时间**；

3. **采样噪波计算风力，并进行世界空间旋转**；

4. **计算多角色交互位移**；

5. **执行面向相机的看板（Billboarding）计算**。

### 核心顶点着色器逻辑 (GLSL)

```glsl
uniform float uTime;
uniform sampler2D uWindNoiseTex;
uniform vec3 uWindDirection; // 归一化的风向向量，例如 (1.0, 0.0, 0.0)
uniform vec4 uCharacters[64]; // vec4(x, y, z, radius) 角色位置与影响半径
uniform int uCharacterCount;

varying vec2 vUv;
varying float vWindIntensity; // 传递给片元着色器用于伪透视
varying float vPlayerDisplacement; // 传递给片元用于形变

// 2D 旋转矩阵生成函数
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

    // 1. 获取当前草实例的世界原点位置
    vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 worldPos = instancePos.xyz;

    // 2. 定格低帧率 (Stop-motion) 计算
    // 利用实例位置哈希一个随机偏移值，让各片草的刷新帧率错开，防止全局卡顿感
    float phaseOffset = fract(sin(dot(worldPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float fps = 12.0; // 目标 12 帧动画
    float steppedTime = floor((uTime + phaseOffset) * fps) / fps;

    // 3. 风力噪波计算（多层正弦波/噪波交融，采用无理数避免规律重复）
    vec2 noiseUV1 = worldPos.xz * 0.05 + uWindDirection.xz * steppedTime * 0.2;
    vec2 noiseUV2 = worldPos.xz * 0.02 + uWindDirection.xz * (steppedTime * 1.314) * 0.1; // 乘以 pi 左右的无理数
    
    float noise1 = texture2D(uWindNoiseTex, noiseUV1).r;
    float noise2 = texture2D(uWindNoiseTex, noiseUV2).r;
    float windNoise = clamp(noise1 * noise2 * 1.5, 0.0, 1.0);
    vWindIntensity = windNoise;

    // 4. 旋转轴计算（正交于风向的向量）
    vec3 rotAxis = normalize(vec3(-uWindDirection.z, 0.0, uWindDirection.x));
    float maxRotAngle = 0.5; // 最大偏转弧度
    float finalRotAngle = maxRotAngle * windNoise * uv.y; // 只有草的顶部 (uv.y 接近 1.0) 会旋转

    // 5. 角色位移影响 (多角色支持)
    vec3 totalDisplacementVec = vec3(0.0);
    float totalDisplacementFactor = 0.0;

    for (int i = 0; i < 64; i++) {
        if (i >= uCharacterCount) break;
        vec3 charPos = uCharacters[i].xyz;
        float radius = uCharacters[i].w;

        float dist = distance(worldPos, charPos);
        if (dist < radius) {
            // 倒数渐变，离角色越近位移越强
            float force = 1.0 - (dist / radius);
            force = pow(force, 2.0); // 陡峭度控制

            vec3 dirToGrass = normalize(worldPos - charPos);
            dirToGrass.y = 0.0; // 保持在水平面推开

            totalDisplacementVec += dirToGrass * force;
            totalDisplacementFactor = max(totalDisplacementFactor, force);
        }
    }
    vPlayerDisplacement = totalDisplacementFactor;

    // 6. 执行几何体定点形变
    // 将局部顶点位置转到世界空间
    vec4 localPosition = vec4(position, 1.0);

    // 风偏转
    mat4 windRotMatrix = rotationAxisAngle(rotAxis, finalRotAngle);
    localPosition = windRotMatrix * localPosition;

    // 玩家物理推开
    localPosition.xyz += totalDisplacementVec * uv.y * 0.8; // 依然是只有草顶受力

    // 7. Y 轴看板 (Billboard) 计算
    // 保证草始终在 Y 轴上对齐并面向相机
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    
    // 手动重构视图空间中的 X 和 Y 轴
    mvPosition.xy += localPosition.xy * vec2(
        length(vec3(modelMatrix[0].xyz)), 
        length(vec3(modelMatrix[1].xyz))
    );

    gl_Position = projectionMatrix * mvPosition;
}

```

---

## 3. 片元着色器 (Fragment Shader) 实现

片元着色器中，我们需要解决两个棘手问题：

1. **伪透视 (Fake Perspective) 补偿**：当正交相机（Orthographic Camera）下草向前后晃动时，它会变扁从而暴露 2D 面片的本质。因此需要拉伸 UV.x。

2. **混合卡通渲染 (Hybrid Toon Shading)**：防止草叶跨越光影边界时产生刺眼的闪烁和像素块突变。

### 核心片元着色器逻辑 (GLSL)

```glsl
uniform sampler2D uGrassTex;
uniform vec3 uBaseColor;
uniform vec3 uTipColor;
uniform vec3 uWindDirection;
uniform vec3 uCameraForward; // 摄像机前向向量
uniform float uPerspectiveIntensity; // 伪透视拉伸强度

varying vec2 vUv;
varying float vWindIntensity;
varying float vPlayerDisplacement;

// 混合卡通着色计算 (视频核心方法)
float getHybridToonShadow(float NdotL, float bands, float smoothness) {
    float bandWidth = 1.0 / bands;
    // 计算当前光强最接近哪个分阶
    float rawValue = NdotL * 0.5 + 0.5; // 映射到 0.0 - 1.0
    float stepped = floor(rawValue * bands) / bands;
    
    // 构建过渡带
    float dist = rawValue - stepped;
    float edge = bandWidth * smoothness;
    
    // 在边界处进行柔和的 smoothstep 过渡
    return stepped + smoothstep(0.0, edge, dist) * bandWidth;
}

void main() {
    // 1. 计算伪透视 UV 拉伸 (Fake Perspective)
    // 只有在风向与相机前向高度平行时，拉伸才明显（利用 Dot Product 点积）
    float dotAlign = abs(dot(normalize(uWindDirection), normalize(uCameraForward)));
    
    // 只有上半部分拉伸 (1.0 - vUv.y)
    float scaleFactor = 1.0 + (vWindIntensity * 0.3 + vPlayerDisplacement * 0.5) * (1.0 - vUv.y) * dotAlign * uPerspectiveIntensity;
    
    // 围绕 0.5（中心点）进行 X 轴拉伸
    vec2 correctedUv = vUv;
    correctedUv.x = (correctedUv.x - 0.5) / scaleFactor + 0.5;

    // 2. 纹理采样 & Alpha 剪裁 (Alpha Scissor)
    vec4 texColor = texture2D(uGrassTex, correctedUv);
    if (texColor.a < 0.5) discard; // 剔除透明部分

    // 3. 颜色混合
    vec3 finalColor = mix(uBaseColor, uTipColor, vUv.y);
    
    // 4. 混合卡通着色 (Hybrid Toon Shading) 应用
    // 模拟一个简单的主光源方向
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    vec3 normal = vec3(0.0, 1.0, 0.0); // 顶部的天空法线
    float NdotL = dot(normal, lightDir);
    
    float toonLight = getHybridToonShadow(NdotL, 3.0, 0.25); // 3阶卡通，过渡平滑度0.25
    finalColor *= (0.4 + toonLight * 0.6); // 乘以环境光基础

    gl_FragColor = vec4(finalColor * texColor.rgb, 1.0);
}

```

---

## 4. CPU 侧的数据配合 (JavaScript)

视频中提到的“多角色支持不确定数组大小”问题，在 Three.js 中同样可以通过预分配一个固定长度的 uniform 数组来解决：

```javascript
// 初始化 64 个角色的数据
const maxCharacters = 64;
const characterData = new Float32Array(maxCharacters * 4); // [x, y, z, radius, ...]

const grassMaterial = new THREE.ShaderMaterial({
    vertexShader: myVertexShader,
    fragmentShader: myFragmentShader,
    uniforms: {
        uTime: { value: 0 },
        uWindNoiseTex: { value: windNoiseTexture },
        uWindDirection: { value: new THREE.Vector3(1, 0, 0) },
        uCameraForward: { value: new THREE.Vector3() },
        uCharacters: { value: characterData },
        uCharacterCount: { value: 0 },
        uPerspectiveIntensity: { value: 0.25 },
        uGrassTex: { value: grassTexture },
        uBaseColor: { value: new THREE.Color('#104010') },
        uTipColor: { value: new THREE.Color('#50c050') }
    }
});

// 每一帧更新逻辑
function update(time, players) {
    grassMaterial.uniforms.uTime.value = time;

    // 更新相机朝向以便计算伪透视
    camera.getWorldDirection(grassMaterial.uniforms.uCameraForward.value);

    // 填充玩家位置及碰撞半径
    let activeCount = Math.min(players.length, maxCharacters);
    grassMaterial.uniforms.uCharacterCount.value = activeCount;

    for (let i = 0; i < activeCount; i++) {
        const player = players[i];
        const index = i * 4;
        characterData[index]     = player.position.x;
        characterData[index + 1] = player.position.y;
        characterData[index + 2] = player.position.z;
        characterData[index + 3] = player.radius; // 影响半径
    }
    
    // 通知 Three.js uniform 数据已改变
    grassMaterial.uniforms.uCharacters.value = characterData;
}

```

---

## 5. 云影贴图系统 (Cloud Shadows)

要实现视频最后的“云层阴影”，可以使用平面投影思路。

```glsl
// 在片元着色器中，假设云层高度为 uCloudHeight 
// 我们利用世界空间位置 worldPosition 和光源方向 uLightDir 计算与云层的交点
vec3 rayDir = -uLightDir;
float t = (uCloudHeight - vWorldPosition.y) / rayDir.y;
vec3 cloudIntersect = vWorldPosition + rayDir * t;

// 用该交点的 XZ 坐标采样云层噪波
vec2 cloudUV = cloudIntersect.xz * 0.01 + uTime * uCloudSpeed;
float cloudShadow = texture2D(uCloudNoiseTex, cloudUV).r;

// 将阴影乘入最终的草地颜色
finalColor *= mix(0.5, 1.0, cloudShadow);

```

---

## 总结要点：如何让移植更出彩？

1. **噪波贴图 (Noise Texture) 的选择**：准备一张高对比度、无缝的 Perlin/Simplex 噪波图作为风力贴图。

2. **像素画质感 (Pixelation Art)**：如果希望像视频中那样拥有纯正的复古 3D 像素风，请将 `renderer.setPixelRatio(1)` 甚至使用更低分辨率的 WebGL 离屏渲染，再通过带有邻近采样（`THREE.NearestFilter`）的着色器贴图缩放输出。

# stage2:


提炼出此shader风格，制作一个精良的3D推箱子游戏：
1、首先将当前的场景作为主菜单页面，做一个箱子自己在场景中的道路中滚动的动画，循环的进行滚动。
2、搜集经典推箱子关卡来借鉴关卡设计，将草坪作为限制框设计关卡。
3、关卡中，箱子被一个Low-poly风格的小鲸鱼推动，箱子也要保持Low-poly风格，模型资产可以去网络搜索，也可以你自行搭建
4、UI风格也要符合shaders的风格，整体画面必须有精致的独立游戏感觉，不得出现emoji、蓝紫渐变、毛玻璃等廉价元素

## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: Web Games & Interactive Logic
- **Difficulty Level (难度等级)**: `L2 (Intermediate)`
- **Primary Tech Stack (核心技术栈)**: Three.js / Custom Grass Shader / HDRI Environment
- **Core Evaluation Focus (核心考核点)**: Instanced grass shader, HDRI lighting, grid undo/redo Sokoban logic

