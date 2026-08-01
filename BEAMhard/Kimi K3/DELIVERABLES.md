# THW_CCF2 WebGL Vehicle Pipeline — Deliverables

BeamNG `thw_ccf2(ccf2重置版)` 资产包 → 纯 Web 技术栈 (HTML5 / CSS3 / ES6 / WebGL Three.js / Web Audio API) 车辆物理 + 引擎声学 + NPR 动漫渲染 + 程序化城市矢量瓦片系统。**无任何桌面引擎代码，全部逻辑在浏览器端独立运行。**

## 运行方式

```bash
py serve.py            # 或任意静态服务器 (python -m http.server)
# 打开 http://localhost:8000
```

Three.js 已本地化到 `vendor/`（离线可运行）。资产位于 `vehicles/ccf2/`（5 个分包已合并解压），`vehicles/manifest.json` 为 115 个 JBeam 文件的加载清单。

**操作**: W/S 油门刹车 · A/D 转向 · Space 手刹 · X/C 手动换挡 · R 重置 · 1/2/3 切换 试车场/城市/地图 · M 全屏矢量地图 · T 导出遥测 CSV · 地图模式 拖拽平移/滚轮缩放/Q,E 旋转/R,F 俯仰。

## 1. HTML/JS 架构与基础设施 (Phase 1–3)

| 文件 | 职责 |
|---|---|
| `index.html` | 页面结构、importmap(`three`→vendor)、HUD DOM、加载屏 |
| `css/main.css` | FR-Legends 风格高对比斜切几何 HUD 样式 |
| `js/main.js` | 启动编排：清单→解析→物理→渲染→音频→模式切换主循环 |
| `js/core/jbeam-parser.js` | BeamNG 方言容错解析器（注释/尾逗号/**缺逗号**/`$=`表达式求值/`case()`），节点/梁/pressureWheel/flexbody 结构化 |
| `js/core/vehicle-builder.js` | JBeam→VehicleSpec：节点云求质量/质心/惯量张量，悬架槽位偏移解算轮位， coilover 弹簧率/刹车/变速箱/主减速比提取 |
| `js/core/vehicle-physics.js` | 自研 Web 物理求解器（240Hz 子步）：刚体底盘+碰撞复合体、串联弹簧悬架-轮胎解、Pacejka-lite 接触斑、防倾杆、浮力/流体阻力、锥桶碰撞 |
| `js/core/engine-sim.js` | 发动机（真实扭矩曲线/软限速/惯量）+6 速自动箱（含离合器滑摩-锁止模型） |
| `js/core/track-zones.js` | 试车场解析地面模型（物理/视觉共用同一函数） |

## 2. 核心物理与 Web Audio 代码

- **刚体转换 (1.2)**: 底盘 = `RigidBody`(质量 1049kg 来自节点云、惯量 (1546,1648,396) kg·m²) + 角点/底盘中探针 `CollisionShape` 复合体。
- **轮胎解耦 (1.2)**: 四轮独立软体组件，胎体刚度来自胎面 beamSpring (101k N/m×2)，载荷敏感摩擦 `μ≥1.2` 强制钳制 (task 指令), `rough=true`。
- **绑定对齐 (1.3)**: Collada 网格加载后按节点云包围盒自动缩放/对中，对齐残差输出到诊断日志。
- **声学 (Phase 2)**: `js/web/engine-audio.js` — AudioWorklet 点火脉冲列（缸数 4、点火顺序 1-3-2-4、歧管长度 0.85m 四分之一波长共振）→ BiquadFilter 带通/低通链 → WaveShaper 负载驱动 → HRTF PannerNode 排气/进气双声道 3D 总线 + 风噪/胎响/涉水闷音 + 限速器断火爆裂声。OscillatorNode 后备路径。

## 3. GLSL NPR 着色器 (Phase 4)

`js/web/npr.js`:
- `TOON_VERT/TOON_FRAG` — Cel-Shading 阶梯漫反射 ramp（可调步数）+ 阶梯高光 + 边缘光 + 顶点色/贴图反照率。
- `OUTLINE_VERT/FRAG` — Inverted-Hull 描边，**clip 空间按 w 补偿的恒定屏幕像素宽度**。
- `SKY_VERT/FRAG` — 渐变天穹 + HDR 太阳盘（供 bloom 提取）。
`js/web/post.js` — 自研 HDR 管线：HalfFloat MSAA RT → 亮度提取 → 两级分离高斯 → ACES ToneMapping + Bloom 合成 + 暗角。
`js/web/city-renderer.js` `LINE_VERT/FRAG` — **屏幕空间恒定线宽**矢量线着色器（NDC 扩张，随分辨率/w 补偿，支持虚线丢弃）。

## 4. 程序化城市与 3D 矢量瓦片引擎 (Phase 5)

- `js/core/city-gen.js` — 种子确定性生成：主干道波动网格 + 街区细分（Voronoi 抖动）+ 巷弄；街区多边形挤出建筑（中心衰减高度）；路灯/信号灯/车道线/POI。
- `js/core/quadtree.js` — z/x/y QuadTree 切片 (z0..6 共 5461 瓦片)，Liang–Barsky 线段裁剪 + Sutherland–Hodgman 多边形裁剪。
- `js/web/city-renderer.js` — 运行时矢量→网格 tessellation（道路条带/建筑挤出/实例化路灯信号），按相机视锥+缩放级别动态实例化/销毁瓦片 Chunk (LRU)，POI DOM 浮动标签 LOD 淡入缩放。
- `js/web/map-camera.js` — 连续缩放混合相机：透视↔正交投影矩阵逐元素插值，无缝过渡；平移/旋转/缩放。
- `js/web/hud.js` — 转速表/数字速度表/踏板条/悬架遥测 + 全屏 2D 矢量大地图（瓦片绘制+车辆标记+POI LOD）。

## 5. 集成验证矩阵 (Node 阶段验证, `test/validate.mjs`)

```
 [PASS] V1.1  115 个 .jbeam 全部解析, 0 失败 (753ms)
 [PASS] V1.2  拓扑提取: 779 部件, 3253 节点, 18306 梁, 8 pressureWheels
 [PASS] V1.3  $=表达式求值器 (brake=1900, case()=0.245)
 [PASS] V2.1  质量 1049.3 kg (节点云)
 [PASS] V2.2  惯量 I=(1546,1648,396) kg·m²
 [PASS] V2.3  轴距 2.3186m / 轮距 1.4200m == JBeam 几何
 [PASS] V2.4  轮胎摩擦材料 μ≥1.2 rough (μbase=1.40, R=0.335)
 [PASS] V2.5  扭矩曲线 19 行, 峰值 272 Nm
 [PASS] V2.6  齿比 [-3.21,0,4.01,2.72,2.1,1.7,1.3,0.97], 终传 3.07
 [PASS] V2.7  65 条 flexbody 网格绑定
 [PASS] V3.1  45s 全科目无 NaN
 [PASS] V3.2  极速 145.6 km/h (0-100 约 6.9s)
 [PASS] V3.3  绕桩横向加速度 10.5 m/s²
 [PASS] V3.4  石板路悬架行程 std 9.06mm (272 样本)
 [PASS] V3.5  涉水: 排水体积 2.54m³, 37.0→13.3 km/h 拖滞
 [PASS] V3.6  静置稳定 roll/pitch≈0°, 轮荷 [2882,2882,2258,2257]N
 [PASS] V4.1  城市: 194 路/830 楼/1778 灯/16 信号/25 POI
 [PASS] V4.2  QuadTree 5461 瓦片 (z0..6), 构建 3.3s
 [PASS] V4.3  z=3 瓦片数 = 64
 [PASS] V4.4  裁剪后要素守恒 (13973≥830×0.95)
 RESULT: 20/20
```

- 遥测样本: `validation/telemetry_sample.csv` (时间/速度/RPM/挡位/四轮行程/阻尼速度/轮荷/latG/涉水)
- 完整报告: `validation/report.txt`
- 模块图+DOM 一致性: `test/check-graph.mjs` → ALL OK (18 files)
- HTTP 资源冒烟: 27/27 URL 200（含 5.8MB DAE、vendor、全部模块）

### 试车场遥测样本节选 (validation/telemetry_sample.csv, 实采)

```csv
t,speedKmh,rpm,gear,zone,FL_travelMM,FL_damperVel,latG,inWater
0.02,0.6,1008,1,FLAT,-110.0,0.000,-2.54,0
2.03,40.7,6406,1,FLAT,49.2,0.193,0.00,0
4.03,71.5,6519,2,FLAT,45.7,0.261,0.00,0
8.03,80.1,5513,2,COBBLE,86.9,0.015,0.00,0
12.02,79.9,5491,2,ASYM_BUMP,93.9,0.021,0.02,0
18.02,79.8,6374,2,SLALOM,117.5,-0.031,20.21,0
22.02,12.1,1598,5,FLAT,110.4,-0.051,-0.69,0
```

另见专项验证：涉水 37.0→13.3 km/h、排水体积 2.54 m³（V3.5）；石板路行程 std 9.06mm/272 样本（V3.4）。

## 已知取舍

- DDS 纹理 (BC 压缩) 不在运行时解码；NPR 方案以材质基色+程序化 Canvas 纹理替代（动漫风格下视觉一致）。DAE 几何与绑定为真实资产。
- 声浪为全程序合成（资产包内无 .wav），满足 2.1 的"程序化音频生成器"路径。
