# 任务背景

你是一个顶级的 WebGL / Three.js 图形学开发专家与技术美术（TA）。请使用 HTML、CSS 和 JavaScript（基于 Three.js），编写一个单文件的可交互 3D Demo。该 Demo 的目标是完美复刻游戏《Teardown》（拆迁）的视觉美学，即："极简的微体素（Micro-Voxel）几何体"与"极度写实的 PBR 光影渲染"所产生的强烈物理反差感。

# 需求范围

## 技术约束

- 仅限一个完整的、可直接在浏览器双击运行的 HTML 文件（包含内联 CSS 和 JS）。
- 使用 CDN 引入最新版 Three.js 及其必要附加组件（OrbitControls、EffectComposer、SSAO、BokehPass 等），CDN 链接须有效（建议 esm.sh 或 unpkg 的 ES Modules 引入方式）。
- 场景体素数量较多时，必须使用 `THREE.InstancedMesh` 渲染方块，而不是单独创建无数个 Mesh。

## 核心视觉要求

1. **微体素几何（Micro-Voxel Art）**：场景中所有物体由统一大小的小方块（BoxGeometry）拼装而成；**绝对不使用任何纹理贴图**，完全依靠纯色（Instance Colors）区分物体。
2. **写实 PBR 材质**：使用 `THREE.MeshPhysicalMaterial`，体素材质必须有明显物理区分：
   - 金属方块：高 metalness、低 roughness。
   - 玻璃方块：transmission + ior，实现真实折射与透明感。
   - 木头/砖块：全漫反射、高 roughness。
3. **影棚级光照**：物理正确光照模式；强 DirectionalLight（PCFSoftShadowMap + 较高阴影分辨率）产生锐利但边缘微柔的阴影；AmbientLight / HemisphereLight 模拟天光。
4. **电影级后处理**：必须引入 `EffectComposer` 并添加 **SSAO**（屏幕空间环境光遮蔽）——小方块夹角处的浓重真实阴影是消除"塑料感"的关键；必须添加 **DOF 景深（BokehPass）**聚焦场景中心，营造"微缩沙盘模型（Diorama）"的玩具感。

## 场景内容（微缩沙盘，约 20×20×10 体素规模）

1. 底部灰白色混凝土地基。
2. 地基上一面被破坏了一半的红砖墙。
3. 旁边散落几个金属光泽的管道（银色/生锈色）。
4. 场景中央放置半透明玻璃体素组成的窗户或发光体。

用代码逻辑（循环和条件判断）自动生成这些体素阵列，赋予不同颜色和物理材质属性。

## 交互

- 开启 OrbitControls，允许旋转、缩放、平移。
- 初始相机为 45 度俯视的等轴测（Isometric）视角。

## 城市局部沙盘扩展

在微体素视觉体系上拓展一座**有明确边界的城市局部沙盘**：

1. 自行构思城市应有元素（道路、建筑、城市设施），选择合适的沙盘大小。
2. 可搜集网络素材获取像素风格天空盒 HDRI。
3. **城市中必须有体素风格河流**。
4. 沙盘应有明显界限，表现为放置在**实心台座**上。
5. 正确表示尺度：将现有景深效果强化为更具"移轴"感的镜头。

# 交付与限制要求

- 交付完整、闭合、可直接运行的单 HTML。
- 不得包含 TODO、占位实现或要求用户补齐核心算法的说明。
- 项目输出完成后，摘取其中代码，用中文解释渲染管线的设置逻辑（SSAO/DOF 管线、InstancedMesh 策略、材质体系）。
