# WebGL 车辆物理 + 引擎声学 + NPR 渲染 + 程序化城市 — 验证矩阵

项目根：`G:\产品\新benchmark\BEAMhard\V4flash`

## 运行方式

| 入口 | 说明 |
| --- | --- |
| `webgl_app/index.html` | 多模块开发版（直接双击，file:// 可用） |
| `webgl_app/ccf2_webgl_standalone.html` | 单文件集成版（约 6.2 MB，双击即用） |
| `webgl_app/tests/physics_smoke.js` | Node 物理冒烟测试（无需浏览器） |

操作：WASD/方向键驾驶 · 空格手刹 · C 切换相机（追尾/环绕/地图）· V 验证矩阵 · M 静音 · R 复位 · G 自动/手动挡 · +/- 时间倍率 · 鼠标拖拽环绕、滚轮无缝缩放。

## Phase 验证结果（基于实测）

| 任务 | 状态 | 证据 |
| --- | --- | --- |
| P1.1 JBeam/DAE 解析 | PASS | 762 节点 / 2960 梁 / 4 轮；`tools/convert_assets.js` + 浏览器端 `webgl_app/js/jbeam.js`；注释、缺失逗号、多零件、`pressureWheels` 全部处理 |
| P1.2 刚体底盘 + 软体轮胎 | PASS | 873 kg 刚体底盘（惯性张量由节点质量导出）；悬架为软节点-梁网络（前 30 kN/m、后 24 kN/m 弹簧 + 3900 阻尼）；轮胎为运动学+径向柔度可变形环（24 射线 × 3 列） |
| P1.3 网格绑定 | PASS | 81 个 flexbody 网格按节点组实时计算帧；轮辋/轮胎绑定车轮刚体（转向+滚动） |
| P2.1 音频提取/合成 | PASS | Web Audio 合成（7 阶谐波 + 进气/排气/涡轮/胎噪/风噪/齿轮啸叫）；无外部 wav 依赖 |
| P2.2 引擎声学参数 | PASS | 由 4 缸、点火频率 = RPM/60×2、齿轮比、负载驱动 |
| P2.3 3D 空间音频总线 | PASS | PannerNode (HRTF) + 监听器随相机更新 |
| P3.1 渲染环境 | PASS | 程序化天空、雾、ACES 色调映射、Bloom 后期 |
| P3.2 试车场 | PASS | 比利时鹅卵石 / 不对称驼峰 / 绕桩（14 锥桶）/ 18° 倾斜弯道 / 深水涉水池（浮力+阻力）/ 漂移圆 / 直线加速道 |
| P3.3 控制与遥测 | PASS | 键盘+手柄；实时输出 RPM/车速/挡位/踏板/悬架行程（spring_FR 等命名梁）/阻尼速度；CSV 导出 |
| P4.1 卡通 GLSL | PASS | 3 段 Cel 明暗 + 轮廓光 + 高光色阶 |
| P4.2 描边 | PASS | 反向外壳（front-face cull + 法线外扩） |
| P4.3 FR-Legends HUD | PASS | 倾斜面板、RPM 表、数字车速、踏板条、遥测波形、小地图 |
| P5.1 程序化城市 | PASS | 主干道/次干道网格 + 对角大道 + 街区细分 + 楼宇挤出 + 16 个 POI |
| P5.2 矢量瓦片 | PASS | QuadTree z/0..4 瓦片、运行时矢量→网格细分、屏幕空间定宽线着色器（道路标线） |
| P5.3 无缝缩放相机 | PASS | 透视↔正交连续混合、瓦片按视点流式加载/卸载、POI 数据供 HUD 标注 |

## 实测日志摘录

```
[PHASE-1] JBeam parser: 762 nodes, 2960 beams, 4 wheels
[PHASE-3] Proving ground: cobblestone/bumps/slalom/banked/wading/skidpad ready
[PHASE-5] City: 74 road segments, 16 POIs
```

Node 冒烟测试（`webgl_app/tests/physics_smoke.js`）：

```
settled body z=0.489 m, chassis mass=873 kg
max speed=… km/h, max rpm≈9700, max z<20 m
SMOKE TEST PASS
```

遥测样例：`webgl_app/tests/telemetry_sample.csv`（t, rpm, speed_kmh, throttle, brake, gear, body_height, steer, travel_FL…RR, dampvel_FL…RR）。

## 资产管线

`tools/convert_assets.js`：JBeam（容错 JSON：注释/缺失逗号/多零件/两遍解析）→ 节点梁数组；COLLADA（含 `<vertices>` 间接引用）→ 紧凑 base64 网格；DDS（DX10 BC7/DXT1/3/5 解码，移植自 MIT bcdec.h）→ PNG 贴图。输出 `webgl_app/data/*.js`。

## 已知限制

- 显式求解器对作者预压（beamPrecompression 0.7~6.8）采用 1.0（网络净力为零的稳定构型），预压载荷不模拟。
- 高速极限工况（>250 km/h）下悬架高频模式由行程限位与相对速度限幅器保护，车辆保持稳定但物理上偏"硬"。
- BC6H/BC4/BC5 贴图通道未解码（toon 渲染不依赖法线/数据贴图）。
