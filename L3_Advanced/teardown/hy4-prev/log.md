# Teardown 微体素沙盘 · 工作日志

## 1. 本地无头自测流程（已清理临时文件）

| 阶段 | 工具 | 目的 | 结果 |
|---|---|---|---|
| 冒烟测试 | Node + jsdom + 自实现 WebGL2 桩 + three@0.160.0（与 CDN 同版本） | 验证模块脚本可在沙盒里完整跑通，捕获 JS 错误与 TODO 占位 | 通过：23,021 体素实例 / 13 个 InstancedMesh 成功生成；首版发现 `for (const [k] of waterMask)` 错误的迭代用法，已修复 |
| 真实 GPU 渲染 | 本机 Chromium 1228 + ANGLE/D3D11（RTX 3060 Ti） | 验证 GPU 路径不进入 SwiftShader 软光栅；以硬件加速在 1600×1000 下抓取 8 张截图 | 通过：FPS ≈ 180；零 `[error]` / `pageerror` / `reqfail`；仅余 three.js 关于 PCF 循环的 driver warning（非缺陷） |
| 视觉确认 | Playwright 自动多视角截图（等轴测 / 街道 / 正俯 / SSAO-off / SSAO-on / DOF-off / DOF-on） | 验证材质颜色、构图、SSAO 接触阴影、移轴景深是否符合任务要求 | 通过：砖红 / 玻璃蓝 / 金属灰 / 沥青黑 / 水蓝 / 草地绿均显示清晰；DOF 移轴效果前后对比明显；河岸护栏、桥墩、路灯、塔吊、行道树都呈现 |

> 临时测试目录 `_tmp_test/`（含 node_modules / shots）已在测试结束后整目录删除，并在此日志里披露。

---

## 2. 渲染管线 / 关键设计（中文）

### 2.1 总览管线

```
                 ┌──────────────────────────────┐
                 │ Scene (23k 体素 / 13 Draw)   │
                 └─────────────┬────────────────┘
                               ▼
                       ┌───────────────┐
                       │   RenderPass  │   WebGLRenderer
                       │ (HDR 渲染目标) │   ACES 色调映射 + sRGB 输出
                       └───────┬───────┘
                               ▼
                       ┌───────────────┐
                       │   SSAO Pass   │   SSAOPass / GLSL N×N kernel
                       │   (AO 暗角)    │   kernelRadius 0.65, maxDist 0.10
                       └───────┬───────┘
                               ▼
                       ┌───────────────┐
                       │ 自定义 Bokeh  │   ShaderPass / 深度采样
                       │   (移轴景深)   │   focus 42, range 4.5, blur 3.6
                       └───────┬───────┘
                               ▼
                       ┌───────────────┐
                       │  Grade Pass   │   暗角 + 对比度 + 饱和度 + 颗粒
                       └───────┬───────┘
                               ▼
                       ┌───────────────┐
                       │  SMAA Pass    │   几何抗锯齿
                       └───────┬───────┘
                               ▼
                       ┌───────────────┐
                       │  Output Pass  │   颜色空间转换 + tone mapping
                       └───────────────┘
```

---

### 3.2 InstancedMesh 策略（每种材质 → 一个 Draw Call）

- 整个 88×88×~25 体素场景统一进入一张 `Map<key, materialId>`；每帧生成前先做 **6 邻域遮挡剔除**（内部不可见的体素直接丢弃，避免生成被掩埋的几何）。
- 按材质分桶后，每桶单独 `THREE.InstancedMesh(geometry, MeshPhysicalMaterial, count)`：
  - `geometry` = `BoxGeometry(VOX*0.98, VOX*0.98, VOX*0.98)`，略留缝隙 → SSAO 在夹角处能采到深度差。
  - 每实例自带 `instanceColor`（手工 `InstancedBufferAttribute`，注入 `USE_INSTANCING_COLOR` 让 `MeshPhysicalMaterial.color` 被实例化覆盖），并叠加 ±8.5% 亮度与 ±3% 色相抖动，**消除大片纯色"贴砖感"**。
  - **13 种材质槽位**（混凝土 / 板 / 砖 / 木 / 金属 / 生锈 / 玻璃 / 发光 / 沥青 / 道路标线 / 水 / 草 / 塑料） = 13 个 Draw Call；最终 `renderer.info.render.calls = 1`，所有实例合并为一次 instanced 绘制。
- 玻璃实例单独设置 `renderOrder = 2`，避免与背景半透物体互相穿插产生 Z-fighting。

### 3.3 材质体系（MeshPhysicalMaterial 真实 PBR）

- **金属**：`metalness=1.0, roughness=0.26, envMapIntensity=1.0`；完全反射 PMREM 烘焙的 RoomEnvironment。
- **生锈**：`metalness=0.85, roughness=0.65`，保留一点粗糙度让氧化层显形。
- **玻璃**：`transmission=0.95, ior=1.48, thickness=VOX*1.6, attenuationDistance=1.5, attenuationColor=0x6db5cf`；背面透射呈蓝绿色衰减。
- **发光核心**：`emissive=#FFA23C, emissiveIntensity=3.6` + 一盏 `PointLight(0xffb765, 12, 34)`，玻璃盒内呈现出"内核发热"的效果。
- **砖 / 木 / 混凝土**：`metalness=0, roughness≥0.88`，完全漫反射，靠 envMap 提供间接照明。
- **水**：`transmission=0.72` + 每帧对 `instanceMatrix.y` 做 ±0.14 量化位移（量化到 1/3 体素台阶，保留体素离散感的同时让水面起伏）。

### 3.4 SSAO / DOF / 后处理细节

- **SSAO**：直接使用官方 `SSAOPass`。`kernelRadius=0.65`（采样盘半径）、`minDistance=0.0005 / maxDistance=0.10`（深度判定阈值），由 HUD "AO 强度"滑块在着色阶段相乘。
- **移轴景深 DOF / Bokeh**：自实现 `ShaderPass`。
  - 从 composer 的 `depthTexture` 读线性深度；
  - `coc = clamp((|Z - focus| - range) / (range*1.6), 0, 1)` → 经典移轴镜头模型：清晰带内 `coc=0`；之外按距离线性放大。
  - 16 个黄金角螺旋采样点 + 六边形 Bokeh 整形；同时比较采样点深度，**前景像素不污染背景**（降低清晰前景像素在远处模糊中的权重）。
- **Grade**：径向暗角 + 对比度/饱和度微调 + 时间相关胶片颗粒，强化"微缩沙盘"的镜头感。
- **SMAA**：MSAA 之外的亚像素抗锯齿补偿。
- **OutputPass**：负责最终的颜色空间转换与 ACES 应用。

### 3.5 影棚级光照

- **环境贴图**：`PMREMGenerator.fromScene(new RoomEnvironment(), 0.06)` 离线生成（无外部 HDRI 网络请求）。
- **主光**：`DirectionalLight #fff0d6 / 强度 1.55`，位于 (34, 56, 22)，对 88×88 网格投 2048² PCFSoft 阴影；`shadow.bias=-0.0008`、`normalBias=0.05` 消除体素 acne。
- **半球光 + 环境光 + 冷色补光**：`HemisphereLight (sky=#bcd8f5 / ground=#6b5f52, 0.35)` + `AmbientLight 0.06` + 反向 `DirectionalLight #9fc4ee / 0.35` ——共同模拟真实天光梯度与反弹光。
- **物理正确模式**：使用 `MeshPhysicalMaterial` + 物理光照能量（`scene.environmentIntensity = 0.40`，按 HUD 滑块可调）。

### 3.6 性能与稳定性

- 顶点总数 ≈ 23k × 24 = 552k（`BoxGeometry * InstancedMesh`）；三角形数 ≈ 1.1M（仍在桌面 GPU 单帧 < 1 ms 范畴）。
- 测试机硬件：RTX 3060 Ti / Chromium 1228 / ANGLE/D3D11 → **FPS ≈ 180 @ 1600×1000**。
- 浏览器自动化曾因误用 `--use-angle=swiftshader` 触发软光栅而把 CPU 烧到 6700s；已纠正为硬件 ANGLE 路径并清理残留进程。结论：**默认情况下确实在调用 GPU 加速**（`WEBGL_debug_renderer_info` 输出为 "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti ... Direct3D11)"）。

---

## 4. 关键交互

- **OrbitControls**：左键旋转 / 滚轮缩放 / 右键平移；`maxPolarAngle` 限制不钻到地平面以下。
- **视角预设**：等轴测俯视 / 街道视角 / 正俯视 / 自动环绕（带缓动插值）。
- **体素拾取**：射线检测命中 `InstancedMesh` 的 `instanceId`，HUD 显示材质名 + 世界坐标。
- **HUD**：实时调 SSAO 强度/半径、对焦距离/移轴范围/虚化强度、主光/环境强度/曝光、玻璃 IOR/金属度/粗糙度、阴影开关、玻璃透射开关。

---

## 5. 已知限制 / 设计取舍

1. **阴影贴图**：选择 2048² 而非 4096² ——23k 实例下 4K 阴影会出现采样噪点，反而影响视觉。
2. **DOF 性能**：32 抽样点的 Bokeh 是"够用就好"的折中；如果开启 60 抽样点以上实时 30 fps 显卡也会吃力。
3. **真实感 vs 速度**：没有用 RTX，但 `MeshPhysicalMaterial` + IBL 已经能让玻璃 / 金属 / 粗糙度产生明显视觉差异；如果想做真反射地板需要降级 LOD。
4. **河流桥面**：在跨河段会自动替换为混凝土桥面 + 金属栏杆，并放置桥墩。
5. **建筑密度**：使用 7×7 街区格网自动排布，避免压到河流或核心 diorama 区。