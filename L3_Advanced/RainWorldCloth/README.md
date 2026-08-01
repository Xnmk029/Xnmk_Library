# 布料模拟：Mass-Spring / PBD Benchmark



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: 3D Graphics, Physics & Shaders
- **Difficulty Level (难度等级)**: `L3 (Advanced)`
- **Primary Tech Stack (核心技术栈)**: Three.js / PBD / Verlet Integration
- **Core Evaluation Focus (核心考核点)**: Soft body physics, obstacle collision response, dynamic mesh reconstruction

## 任务定位

测试模型实现稳定布料动力学、碰撞、动态重建和交互控制的能力。

## 标准化提示词

创建一个单文件 HTML 3D 软体布料模拟项目，使用质点弹簧系统或基于 Verlet Integration 的 Position-Based Dynamics。

### 交付格式

- 所有 HTML、CSS 和 JavaScript 位于一个 `index.html`。
- 渲染、交互和 UI 库可通过可靠公共 CDN 引入。
- 核心布料物理必须完整实现。

### 动态网格

- UI 可调整布料分辨率，例如 10×10 至 40×40。
- 调整后释放旧粒子、约束和几何资源，再平滑重建新布料。

### 物理与环境

- 实现动态三维风向量、时变扰动、风速、方向和开关。
- 场景中央下方生成 2–3 层台阶。
- 布料从台阶上方落下，与台阶和地面发生碰撞、摩擦与合理回弹。
- 包含弯曲约束，使布料能形成自然褶皱。
- 支持鼠标/触摸拾取并拖动任意节点。
- 提供自动“对折布料”动作。

### UI

- 布料：分辨率、重力、刚度、重置。
- 风：开关、速度、方向。
- 交互：释放到台阶、自动折叠。

### 渲染与结构

- 使用方向光、环境光和阴影。
- 布料双面渲染。
- 地面与台阶提供深度和阴影参照。
- 物理更新与渲染循环分离，使用稳定时间步。

## 自动化验收建议

- 在三个分辨率下检查粒子与约束数量。
- 固定时间步运行，检查 NaN、穿透深度和约束误差。
- 自动切换风、拖拽节点、落到台阶并执行对折。
- 重建前后检查旧几何和监听器是否释放。
