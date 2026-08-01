# BEAMGL — WebGL 车辆物理管线 · 引擎声学模拟 · NPR 风格化渲染系统

**HTML5 / Three.js / WebGL / Web Audio API** 单页应用：将 BeamNG 车辆模组包（`thw_ccf2(ccf2重置版)`）
完整解析为浏览器内可驾驶的刚体底盘 + 软轮胎车辆，附带自动化试验场、程序化城市、
QuadTree 矢量瓦片流式渲染、卡通 (NPR) 渲染管线与 FR-Legends 风格 HUD。

---

## 1. 快速开始

```bash
# 依赖（仅构建/测试工具需要，运行时零依赖）
npm install            # three / puppeteer / sharp
pip install pillow      # DDS -> PNG 纹理转换

# 首次运行：解压资产包 + 转换纹理 + 生成 vehicles_web/
node tools/extract.ps1        # PowerShell: 解压 5 个 zip 到 vehicles/
node tools/prepare_assets.js  # 转换 108 张 DDS(BC7/BC5/BC4) -> PNG，修补 DAE 纹理引用

# 启动
node server.js          # http://localhost:8080
```

> 若 `vehicles_web/` 缺失，`server.js` 会在启动时自动执行资产准备（需 Python + Pillow）。

## 2. 操作说明

| 按键 | 功能 | 按键 | 功能 |
|---|---|---|---|
| W / S | 油门 / 刹车 | A / D | 转向 |
| SPACE | 手刹 | Q / E | 降档 / 升档 |
| C | 视角循环 (追尾/环绕/引擎盖) | F | 自由相机 (WASD 平移, R/T 升降) |
| R | 复位到起点 | 1–6 | 传送至各试验场地 |
| M | 打开/关闭城市大地图 (点击传送) | K | 导出遥测 CSV |
| L | 大灯 | V | 生成校验矩阵 (VALIDATION MATRIX) |
| G | 后期特效开关 | B | 深度边缘描边 |
| N | NPR 卡通渲染开关 | T | 诊断控制台 |
| M | 导出遥测 CSV | ESC | 暂停 |

支持手柄：左摇杆转向、RT/LT 油门刹车、A 手刹、LB/RB 换挡（需先拨动任一控制激活）。

## 3. 系统架构（Phase 1–5 对应实现）

```
vehicles_web/                 资产根目录（jbeam + dae + png + manifest.json）
js/
├── config.js                 全局配置：场地布局 / 车辆参数 / 部件装配清单
├── utils/jbeam.js            容错 JBeam 解析器（注释/尾逗号/缺逗号容忍）
├── assets/
│   ├── AssetManager.js       manifest、部件加载、DAE 场景、网格索引、纹理回退
│   └── VehicleVisual.js      JBeam 部件 -> 3D 网格绑定、轮组动画、NPR 转换、描边
├── physics/
│   ├── Vehicle.js            自定义 Web 物理求解器
│   │                          RigidBody + CollisionShape(盒子复合)
│   │                          四轮射线悬挂 + 渐进限位块 + 防倾杆
│   │                          轮胎 stick/slip 摩擦模型（μ≥1.2, rough）
│   │                          引擎扭矩曲线 + 离合/变速箱/LSD/ABS/刹车
│   │                          浮力/水阻、气动阻力、滚动阻力
│   └── Ground.js             程序化高度场（比利时石/非对称起伏/高速弯/涉水池）
├── audio/EngineAudio.js      Web Audio 引擎声学合成器（4缸点火频率、排气/进气、
│                              齿轮啸叫、风噪、胎响、水花、回火） + Panner 3D 声场
├── world/
│   ├── ProvingGround.js      试验场构建（石阵、减速带、绕桩桶、银行弯、水池）
│   ├── City.js               程序化城市（网格图 + L-system 大道、街区、建筑、POI）
│   └── Tiles.js              QuadTree 矢量瓦片：切片/流式加载/屏幕空间定宽线着色器
├── render/
│   ├── Toon.js               卡通着色 GLSL（分级漫反射、轮廓倒置壳、水、天空）
│   └── PostFX.js             HDR 场景 RT + Bloom + 深度边缘检测 + ACES 色调映射
├── ui/                       HUD（FR-Legends 风格）、POI 标签、遥测、相机、输入
└── lib/                      three.module.js + ColladaLoader（本地离线）
```

### Phase 1 — 模组解析与物理转换
- `JBeamParser`：容错解析节点/梁/柔性体/pressureWheels/引擎/变速箱等 115 个部件文件；
- **刚体底盘**：节点加权质心 + 包围盒 `CollisionShape` + 盒体惯量（1219 kg 实测）；
- **轮胎解耦**：`pressureWheels` 半径/宽度/摩擦系数驱动独立轮体，软胎形变（压缩/拉长）；
- 坐标系严格映射：JBeam `(x左, y后, z上)` → three `(-x, z+抬升量, -y)`，网格镜像校正法线。

### Phase 2 — Web Audio 引擎声学
- 4 缸点火频率 = RPM/60×2，谐波振荡器组 + 波形整形失真 + 排气/进气共振滤波；
- 齿轮啸叫/风噪/胎响/涉水水花/回火爆音，PannerNode 三维声场随车辆移动，监听器跟随相机。

### Phase 3 — 自动化试验场
1. **悬挂测试**：比利时石块阵（0.28m 网格随机高度）+ 非对称起伏带（左 15.5cm / 右 6cm）；
2. **转向测试**：绕桩赛道（15 锥桶可撞倒，起点/终点门）+ 17° 高速银行弯（环形）；
3. **涉水测试**：2.1m 深水池，车轮浮力/水阻/飞溅粒子，底盘浸没阻力；
- 遥测：四轮行程/阻尼速度/弹簧力/载荷、转速、G 值、水深，30Hz 采样 + CSV 导出。

### Phase 4 — NPR 卡通渲染 + FR-Legends UI
- 卡通着色：分级漫反射光带、高光色块、边缘光、梯度天空球；
- 描边：倒置壳（背面挤出）+ 可选深度 Sobel 边缘后期；
- HUD：270° RPM 转速表（红区换挡灯）、斜切数字时速、档位、油门/刹车/手刹/转向条、
  悬挂行程遥测条、小地图、场地计时器、校验矩阵面板。

### Phase 5 — 程序化城市与 3D 矢量瓦片
- 道路网络：主干道/次干道网格图 + L-system 蛇形大道，街区细分生成 295 栋建筑；
- QuadTree 切片：特征按层级归属（道路 L1/L2、建筑 L3、路灯/信号灯 L4），
  视锥可见瓦片动态加载/卸载（流式 LOD）；
- 屏幕空间定宽线着色器：车道中心虚线/边界线在任何缩放下保持恒定像素宽度；
- 无缝变焦相机：透视↔正交投影矩阵连续插值；POI 标签随 LOD 淡入淡出。

## 4. 测试与验证

```bash
node tools/phys_test.js     # 物理单元测试（驻车/起步/制动/转向/颠簸/涉水）
node tools/smoke_test.js    # 无头浏览器集成测试（截图 + 遥测 + 校验矩阵）
```

- `tools/shot1.png … shot3.png`：无头浏览器实机截图；
- 按 `V` 生成校验矩阵，按 `K` 导出 CSV，按 `M` 打开大地图，按 `T` 打开诊断控制台。

## 5. 目录说明

| 路径 | 说明 |
|---|---|
| `vehicles/` | 解压后的原始模组资产（5 个分卷 zip 还原） |
| `vehicles_web/` | 浏览器资产（PNG 纹理 ≤2048、修补后的 DAE、manifest.json） |
| `tools/` | 提取/转换/测试脚本 |
| `js/lib/` | 本地 three.js r160 + ColladaLoader（离线可用） |

## 6. 已知限制
- 软体轮胎以"形变视觉 + 刚度模型"近似，非逐节点有限元（浏览器实时约束）；
- DDS 中缺失的纹理（如轮毂贴图）使用程序化生成材质回退；
- 无头 SwiftShader 软渲染下帧率低，真实 GPU 浏览器 60 FPS。
