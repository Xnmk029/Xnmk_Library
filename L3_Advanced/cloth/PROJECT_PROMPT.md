你是一位顶级的 WebGL 与物理引擎开发专家。请为我编写一个单文件（Single-file）HTML 项目，使用 Three.js 实现一个基于“质点-弹簧系统（Mass-Spring System）”或“质点位置动力学（Verlet Integration）”的 3D 软体布料物理仿真模型。

### 1. 技术栈要求
- 单文件 `index.html`，直接包含 HTML, CSS, JavaScript。
- 必须通过 CDN 引入依赖：
  1. Three.js (最新稳定版 r128 或以上)
  2. OrbitControls (用于 3D 视角拖拽旋转/缩放)
  3. lil-gui 或 dat.gui (用于 UI 参数调控)

### 2. 核心功能与物理模拟要求

#### A. 网格数量可调（Dynamic Grid Resolution）
- 允许用户在 UI 中调整布料的网格细分数量（例如 10x10 到 40x40）。
- 当更改网格数量时，能够平滑销毁旧的质点网格并按新分辨率重建布料。

#### B. 三大核心动作/环境模拟
1. 【风吹模拟（Wind Force）】：
   - 实现动态三维风力矢量。
   - 风力需要带有随时间变化的随机扰动/噪波效果（例如正弦波或简单 Perlin 噪波），使布料呈自然飘动。
   - UI 可调：风力开关、风速大小、风向角度。

2. 【台阶碰撞（Stair Collision）】：
   - 在场景中央下方生成 2~3 层由 BoxGeometry 构成的台阶（带有纹理或清晰材质）。
   - 实现质点与台阶（AABB 盒碰撞/表面碰撞）的物理碰撞检测与响应（含简单的反弹与摩擦力）。
   - 布料初始处于台阶上方，释放后能自然下落并“折褶”覆盖在台阶上。

3. 【布料折叠（Cloth Folding）】：
   - 物理模型中需包含**弯曲弹簧（Bending Springs）**约束，使布料保持形态并能产生自然的折痕。
   - **交互折叠**：支持鼠标射线（Raycaster）点击并拖拽布料的任意节点进行拉扯折叠。
   - **预设动作**：在 UI 中提供一个“对折/折叠（Fold Cloth）”按钮，点击后通过向特定角落应用对向作用力，演示布料自动对折的效果。

### 3. UI 控制面板（lil-gui / dat.gui）设计
请在右上角创建一个清晰的 UI 控制面板，包含以下分组：
- **布料配置**：网格分辨率 (Grid Resolution)、重力大小 (Gravity)、结构刚度 (Stiffness)、重置布料 (Reset Button)。
- **风力控制**：风力开关 (Wind On/Off)、风速大小 (Wind Force)、风向 (Wind Direction)。
- **交互与预设**：一键释放下落 (Drop onto Steps)、一键对折 (Fold Action)。

### 4. 视觉与场景细节
- 包含柔和的平行光（带阴影显示）与环境光，使用 `MeshStandardMaterial`（双面渲染 `Side: DoubleSide`）。
- 场景底面提供地板，配合台阶呈现良好的立体感和阴影投射。
- 代码必须干净整洁，物理循环与渲染循环分离，物理步长（dt）要稳定以防“模型爆炸”。

请直接给出完整的、可直接运行的 HTML 代码，不要省略任何关键算法实现。
