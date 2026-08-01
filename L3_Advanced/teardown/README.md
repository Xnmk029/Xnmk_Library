# Teardown / 硬表面机械与微体素场景 Benchmark



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: 3D Graphics, Physics & Shaders
- **Difficulty Level (难度等级)**: `L3 (Advanced)`
- **Primary Tech Stack (核心技术栈)**: Three.js InstancedMesh / SSAO / Low-poly PBR
- **Core Evaluation Focus (核心考核点)**: Instanced Voxel grid, SSAO post-processing, gun disassembly animation

## 任务定位

测试模型在单文件 Web 项目中完成程序化硬表面建模、机械结构动画、微体素场景生成和 PBR 渲染的综合能力。

## 标准化提示词

你是一名精通 WebGL、Three.js 与技术美术的高级图形开发者。请使用 HTML、CSS 和 JavaScript，交付一个可直接运行的单文件交互式 3D Demo。

### 场景 A：USP Match 复古低多边形机械演示

- 建模对象为 USP Match 竞技版手枪。
- 采用 Half-Life / PS1 风格的低多边形几何与 90 年代 FPS 质感。
- 支持分解与组装循环动画：弹匣进入握把、套筒沿银色枪管复位、前部 Match 配重/补偿器保持可见。
- 明确区分套筒、枪管、聚合物下机匣、前部配重和弹匣。
- 准星使用高反差光纤配色：前准星绿色、后准星红色。
- 提供中性灰背景、正交或近正交展示视角和清晰机械轮廓。

### 场景 B：Teardown 风格微体素沙盘

- 场景中的主要对象由统一尺寸的 BoxGeometry 体素组成。
- 大量体素必须使用 `THREE.InstancedMesh`，不得为每个体素单独创建 Mesh。
- 不使用纹理贴图区分体素；使用实例颜色和物理材质参数。
- 金属、玻璃、木材和砖块应具有明确不同的 metalness、roughness、transmission、ior 等属性。
- 场景至少包含混凝土地基、半毁红砖墙、金属管道、玻璃或发光体。
- 使用物理正确光照、方向光、环境光/半球光、软阴影。
- 使用 EffectComposer，并实现 SSAO；景深可作为可关闭的展示效果。
- 开启 OrbitControls，初始相机为约 45 度俯视的等轴测沙盘视角。

### 场景 C：城市局部沙盘扩展

- 在微体素视觉体系上扩展一座有明确边界的城市局部沙盘。
- 自行选择合理尺度并加入道路、建筑和城市设施。
- 必须包含体素风格河流。
- 沙盘应放置在可见的实心台座上。
- 使用明显的移轴/微缩摄影效果表达尺度。

### 可选高阶机械演示：AR-15

- 展示上下机匣围绕前枢轴打开、后分解销退出、BCG 后移和枪机头旋转解锁。
- 可视化拉机柄、复进簧/缓冲管、击锤、扳机、阻铁、弹匣释放、保险和导气结构。
- 动画必须保持机械关联，不得采用随机放射式爆炸分解。

## 输出要求

- 交付完整、闭合、可直接运行的单 HTML。
- 不得包含 TODO、占位实现或要求用户补齐核心算法的说明。
- 完成后用中文简要解释场景图、实例化策略、材质与后处理管线。

## 自动化验收建议

- 页面无未处理异常，WebGL 上下文创建成功。
- 体素场景存在 InstancedMesh，记录实例数量、draw calls、三角形和帧时间。
- 自动触发分解/组装，比较开始、中间、结束状态。
- 操作 OrbitControls 后相机矩阵发生变化。
- 固定视角采集全景与机械细节截图。

## 来源整理说明

原文中的 USP、Teardown、城市扩展和 AR-15 描述已按任务层级重新排列；参考图片、作者署名和案例分数不作为硬性验收条件。
