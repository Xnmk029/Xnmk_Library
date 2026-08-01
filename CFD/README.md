# CFD：3D SPH 流体仿真与性能基准



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: 3D Graphics, Physics & Shaders
- **Difficulty Level (难度等级)**: `L4 (Expert)`
- **Primary Tech Stack (核心技术栈)**: WebGL / SPH / WebGPU / Custom Shaders
- **Core Evaluation Focus (核心考核点)**: SPH fluid dynamics, refraction/reflection shader, real-time particle solver

## 任务定位

测试模型实现实时粒子物理、三维可视化、性能监控和可复现基准测试的能力。

## 标准化提示词

你是一名精通 WebGL、Three.js 和实时流体动力学的高级前端物理工程师。请编写一个单文件网页版 3D 流体仿真与基准测试工具。

### 物理要求

- 在透明封闭容器内生成 2500–4000 个流体粒子。
- 手写轻量级 SPH 或明确说明的近似粒子流体算法。
- 实现重力、空间近邻、压力/排斥、粘滞、位置积分和边界碰撞。
- 粒子应能表现塌陷、撞壁、回涌和速度衰减。
- 不允许依赖 Cannon.js 等现成物理引擎。
- 使用稳定时间步，避免 NaN、能量爆炸和粒子逃逸。

### 渲染要求

- 使用 Three.js 渲染粒子和透明容器。
- 粒子颜色根据瞬时速度或局部密度动态映射。
- 低速/低压与高速/高压区域应具有可辨识的色差。
- 界面采用深灰、直角边框、等宽字体的工业软件风格，不使用 emoji。

### 基准与控制

- 实时显示 FPS、活跃粒子数和单帧物理耗时。
- 提供重置、重力、粘滞度控制。
- 提供固定 workload 的基准测试入口。
- 基准测试结束后导出 JSON；建议同时导出逐帧 CSV。
- 结果至少包含环境、粒子数、采样时长、平均/中位/P95 帧时间、物理耗时和异常计数。

## 输出要求

- 所有 HTML、CSS、JS 和物理算法写入一个完整 HTML 文件。
- 仅允许通过公共 CDN 引入 Three.js。
- 不得包含 TODO 或缺失核心算法的占位符。

## 自动化验收建议

- 固定随机种子和容器尺寸，预热后重复运行三次。
- 验证粒子数、边界范围、有限数值和确定性摘要。
- 分开记录物理步耗时与渲染帧时间。
- 自动下载 JSON/CSV 并校验 schema。
