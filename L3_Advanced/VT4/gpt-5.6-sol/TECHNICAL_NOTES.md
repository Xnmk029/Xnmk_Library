# 技术实现说明

## 渲染架构

应用采用原生 WebGPU API，不依赖 WebGL 回退层或第三方场景引擎。

### 主要 Render / Compute Pass

1. **Particle Compute Pass**：更新 4096 个尘埃粒子的位置、速度和寿命。
2. **Shadow Pass**：将可投影实例写入 1536² 深度阴影贴图。
3. **Scene Pass**：MRT 输出 HDR 色彩和法线/线性深度 G-buffer。
4. **Accumulation Pass**：对静止帧执行增量均值累积，避免无限增长的加法误差。
5. **Post Pass**：AO 近似、景深、曝光、色调映射、暗角和轻微胶片颗粒。
6. **Export Readback Pass**：最终分块写入与交换链同格式的 Capture Texture，再复制到 MAP_READ Buffer。

## WGSL 与资源布局

- `Globals`：视图、投影、逆矩阵、阴影矩阵、相机、太阳、环境与三盏局部灯。
- `InstanceData`：模型矩阵、法线矩阵、色调与选择/透明/差异高亮标记。
- `MaterialData`：基础色、发光、金属度、粗糙度、AO 与材质类别。
- 几何实例按“几何体 + 材质 + 透明/阴影属性”批处理。
- 阴影 Pass 使用独立的最小全局 Bind Group，避免同一同步域内把阴影纹理同时作为写附件和采样纹理。

## 程序化几何

基础网格只有 Box、Wedge、Cylinder、Cone、Sphere、Torus、Quad 和起伏 Ground。车辆由场景层级和实例变换组合：

- 车体、炮塔与炮管均使用父子节点，支持炮塔旋转和火炮俯仰。
- 履带由逐节链接与几何复用构成；负重轮、托带轮和裙板按左右侧实例化。
- 内部装置按驾驶舱、战斗舱、动力舱设置分层、爆炸方向和选择球体。
- 乘员使用头、躯干、四肢、头盔和耳机等基础骨架比例部件构建，不使用蒙皮模型文件。

## X-Ray 与剖切

- X-Ray：将 shell 批次切换到透明 Pipeline，并降低材质 Alpha；内部机械保持不透明。
- 左舷剖开：按部件 side 标签隐藏左侧外壳、裙板与部分履带遮挡件。
- 差异高亮：当前改型独有部件通过实例 flags 写入青色/琥珀色发光项。

## 相机

- 物理近似采用 24 mm 传感器高度和焦距换算垂直 FOV。
- 累积渲染使用 Halton(2,3) 亚像素抖动。
- 4K/8K 导出使用完整画幅视锥的离轴分块投影，避免把每块错误地当作独立相机。

## 导出可靠性

WebGPU 交换链的呈现纹理不保证在 `createImageBitmap(canvas)` 时仍可读，因此本项目没有使用该方法。导出路径使用专用 Capture Texture + `copyTextureToBuffer`，并处理：

- 每行 256 字节对齐；
- BGRA → RGBA 通道交换；
- 分块坐标拼接；
- 无损 PNG 编码。

## 自检入口

开发或排障时可访问：

```text
http://127.0.0.1:8765/?smoke=1
```

该模式会构建完整车辆、渲染一帧、等待 GPU 队列完成，并将状态写入：

```javascript
document.documentElement.dataset.vt4Status
```

成功值为 `ready`；失败时 `vt4Error` 保存首个验证错误。正常用户无需使用此参数。
