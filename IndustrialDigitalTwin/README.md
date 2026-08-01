# 工业数字孪生设备监控 Benchmark



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: 3D Graphics, Physics & Shaders
- **Difficulty Level (难度等级)**: `L3 (Advanced)`
- **Primary Tech Stack (核心技术栈)**: Vue 3 / Three.js / Vite / Interactive Raycasting
- **Core Evaluation Focus (核心考核点)**: Industrial CAD model rendering, interactive raycasting, real-time telemetry UI

## 任务定位

测试模型整合 Vue 3、Three.js、交互拾取、实时模拟数据和工业监控 UI 的能力。

## 标准化提示词

使用 Vue 3 Composition API、`<script setup>`、Three.js 和 Vite 创建一个工业数字孪生设备监控页面，主要实现集中在 `App.vue`。

### 3D 场景

- 深色背景、雾效和网格地面。
- 程序化生成 6 台设备：空压机、冷却泵、配电柜、储气罐、注塑机和液压站。
- 每台设备由组合几何体形成可辨识轮廓。
- 设备上方显示状态灯：运行绿、待机黄、告警红且闪烁。
- OrbitControls 启用阻尼，并限制俯仰和缩放范围。
- 提供注释清晰的 GLTFLoader 替换入口。

### 交互

- 点击设备时高亮，相机平滑聚焦并打开右侧详情。
- 点击空白关闭详情并取消高亮。
- 使用 pointerdown/pointerup 位移阈值避免拖拽误触。
- 坐标换算必须使用画布的 `getBoundingClientRect()`。
- 射线命中子对象后向上查找关联的设备数据。

### 数据与面板

- 详情显示名称、编号、状态、位置、功率、温度、振动、压力、电流和累计运行时间。
- 温度超过 85°C 时显示告警色。
- 显示近 30 秒温度趋势。
- 左侧总览显示设备总数、运行、待机、告警、总功率、平均温度和总电流。
- 设备列表可直接聚焦对应设备。
- 每 2 秒更新模拟数据，并同步刷新总览和详情。
- 顶栏显示 LIVE 状态。

### 生命周期与样式

- `onMounted` 初始化场景、渲染循环和数据流。
- `onUnmounted` 取消动画帧、定时器、监听器并释放渲染资源。
- 使用深色半透明面板、Consolas 数字字体和明确状态色。

## 自动化验收建议

- 验证 6 台设备和状态数据存在。
- 点击每台设备，核对面板 ID 与命中设备一致。
- 验证数据至少更新两轮，告警阈值样例正确变色。
- 卸载组件后检查定时器、监听器和 WebGL 资源清理。
