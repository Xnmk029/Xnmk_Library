# 场景图、依赖更新架构与渲染管线说明

## 1. 场景图（Scene Graph）

```
Scene
├─ bikeRoot（scale=0.001，整车内部全部以毫米建模）
│  ├─ cockpitG  ── barG（handlebar：弯把中心线管/把带/手变/刹把/末端锁环、把立体/夹环螺栓）
│  ├─ seatPostG ── saddleG（座管/夹环/弓轨/坐垫体与鼻锥，座面水平补偿 + 前后偏移）
│  ├─ crankG（右曲柄臂/轴心盖）── ringG（1/2/3 片牙盘：环形盘身+蜘蛛臂+盘片螺栓+实例化齿）
│  ├─ crankLG · axleG(中轴轴心) · cupLG · cupRG（五通杯）
│  ├─ pedalRG · pedalLG（脚踏平台+轴+绑带）
│  ├─ frameG（座管/上管/下管/头管/链支/座支/五通壳/后勾爪/节点衬块/水壶架+水瓶）
│  ├─ forkG（舵管/叉冠/双叉管/前勾爪/叉肩碗）── 前叉随转向轴整体分离
│  ├─ headsetTopG · headsetSpacersG · headsetBottomG（上杯+轴承/垫圈+顶盖+螺栓/底杯+轴承）
│  ├─ frontWheelG · rearWheelG（圈/内圈/花鼓/辐条实例化/胎/气嘴/快拆/后花鼓锥形塔基）
│  ├─ frontRotorG · rearRotorG（镂空碟片：外环+6 臂间隙+内毂+6 螺栓）
│  ├─ frontCaliperG · rearCaliperG（双板+桥+刹车皮+螺栓+安装架）
│  ├─ cassetteG（7–12 速飞轮：多片盘+锥形隔套+锁环+实例化齿，大齿在内、小齿在外）
│  ├─ fdG（前拨：夹环+连杆+外/内拨片；1× 时整组不可见）· rdG（后拨：主体+臂+双导轮+实例化轮齿）
│  ├─ chainG（链条：InstancedMesh 链节，沿"盘→飞盘→导轮→闭合"多边形按 12.7mm 节距布局）
│  └─ cablesG（四条程式化线管：手变→夹器/前拨/后拨，CatmullRom 管）
└─ envRoot（米制工作室：地板/双墙/墙裙/装饰条/洞洞板+挂墙工具/工作台+台钳+抽屉/货架+收纳箱/收纳堆/轮胎堆/备用轮/挂画/吊灯/硬边动漫投影）
```

关键从属关系：`barG ⊂ cockpitG`、`saddleG ⊂ seatPostG`、`ringG ⊂ crankG`——保证爆炸与平移时把横随把立、坐垫随座管、牙盘随曲柄自动联动；`frontCaliperG` 与 `forkG` 使用同一爆炸矢量，夹器随前叉分离。所有部件均为 three 基元程序化生成（圆柱/圆环/球/挤出剪影/管状样条），零外部 3D 资产。

## 2. 依赖更新架构（Geometry → 联动）

单一 `state`（geo/drv/fit/ast/col/fin 六组）驱动，`setState(patch)` 做深度合并后按**脏标记**调度重建，而非整体重建：

- **geo 变化** → `solveGeo()` 重算全部关键点（BB/座管顶/头管上下端/上管交汇点 J/座撑交汇 attJ/叉冠/前轴/立柱顶），随后重建 frameG、forkG、headset、cockpit 锚点、seatPost、前/后拨、曲柄锚点、脚踏、线管、链条，并重设爆炸基位与爆炸目标。轴距=后轴距(0)−前轴 z，由 Reach/头管角/紧凑度组合导出——**轴距随参数自动联动**。
- **drv 变化** → `rebuildCrank()`（盘片数/齿数/盘位置/前拨可见性）+（速数变化时）`rebuildWheelsWithCassette()`（锥形塔基长度/飞轮片数/齿分布）+ `rebuildChain()`（盘径/飞轮大齿径变化 → 链包围图与外切切线重算、链节数重排）。
- **fit 变化** → 座管+坐垫（postH/saddleF）或 弯把+手变+把带+线管（barWidth/barRise/barFlare 参与弯把中心线参数化生成，外撇由肩部支点旋转实现）。
- **col 变化** → 按角色材质 base 色更新（材质本身复用、不重建）；**fin 变化** → 轮廓可见性/色调分离级数/表面预设（spec、rim、weave、色深权重）/背景雾色/环境开关。
- **ast 变化 / tick** → 解释器循环：`pos = base + offset × smoothstep(explode)`，爆炸为纯沿安装轴的线性插值（轮/碟沿车轴 X、前叉/碗组沿转向轴 d、座管沿座管轴、曲柄/杯/轴心沿中轴 X、飞轮脱离塔基、脚踏外移、后拨后移），方向全局恒定、可平滑双向动画（0.85/单位秒）。
- 每次 `setState` 尾部重算 `computeWeight()`（车架=各管长和×材质系数、飞轮∝速数、牙盘∝齿数和、链条∝链节数、座舱∝把宽与座管高……均为**随配置变化的函数**）并刷新规格面板；相机与 OrbitControls 目标从不参与重建路径。

几何件全部注册进 `disposables` 队列并在重建批次间释放（旧 geometry.dispose），材质按角色全局复用，防止拖动滑块时内存漂移。

## 3. 渲染管线

- **NPR 赛璐璐着色**：所有角色共享一个自定义 `ShaderMaterial`（顶点：世界法线/视向量；片元：方向光 `ndl × 2~4 步` 量化成色调分离明暗带 + 半球环境光基底（保证暗面明亮可读）+ 朗伯白色高光 `pow(ndh,55)` + fresnel 边缘光），支持 `uSteps` 级数、`uSpec/uRim` 表面预设权重与 `uWeave` 碳纤维程序化细纹（沿世界 Y/Z 的 0.5 阈值条纹，无需贴图）；输出后再做一次 `quant` 级颜色量化增强"海报化/色调分离"感，并以 `pow(1/2.2)` 完成线性→sRGB。
- **墨线轮廓**：`BackSide + scale 1.022` 反向外壳法（仅主要实体部件；辐条/链节/齿等细件豁免），由 `outlineRegister()` 统一收集、可开关；无 bloom、无过度像素化，背景为纯色+线性雾的距离混合，保持整体亮度基线。
- **光照与阴影**：单一暖色方向光 + 天空/地面半球近似（着色器内计算，无真实光照对象）；地面用径向衰减 ShaderMaterial 硬边"动漫投影"贴合场景，避免阴影吞噬结构。
- **性能**：辐条（24/32）、链节（≈131）、牙盘齿（42–119）、飞轮齿（237）、导轮齿（20）全部走 InstancedMesh 单次绘制；材质按角色缓存复用；`pixelRatio ≤ 2`；几何更新采用脏标记局部重建，OrbitControls 阻尼更新与相机预设渐变在渲染循环中独立执行（几何更新绝不重置相机）。
