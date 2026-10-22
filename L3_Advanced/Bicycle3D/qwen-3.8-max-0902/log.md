# 工作日志 · 交互式 3D 自行车工作室与装配模拟器

> 受测模型独立完成记录。交付物：`answer.html`（单文件应用）、`result.json`（结构化自述）、`log.md`（本文件）。

## 0. 约束遵守声明（R1–R6）
- **R1 身份**：全程仅以“受测模型”身份作答，未扮演组织者/评审，未询问或猜测评分标准、批次、其他题目。
- **R2 信息来源**：唯一输入为工作区内 `PROJECT_PROMPT.md` + 本 prompt。**未**读取/搜索/列举 `F:\benchmark` 下工作区以外的任何内容。
- **R3 历史纪律**：未执行任何 git 命令。
- **R4 禁止委托**：未创建任何子代理/workflow/后台任务/嵌套代理，未调用任何外部模型 API，未把题面发给外部服务。
- **R5 网络管控**：未检索本题资料/教程/参考实现/CDN 文档。仅有的联网行为：
  1. 用 HTTP HEAD 请求确认交付物所引用的 three.js CDN 路径可达（`three@0.160.0` 的 `three.module.js` 与 `OrbitControls.js`，jsDelivr/unpkg 均返回 200）——这是校验自身交付物依赖，非题目检索；
  2. **例外条款**：为本地无头自测，在工作区内临时目录 `_selftest/` 安装运行时库 `puppeteer-core@23`（npm 全局缓存位于系统默认路径）。**复用系统已存在的 Chrome**（`C:\Program Files\Google\Chrome\Application\chrome.exe`）驱动，未下载浏览器。**测试结束后已整目录删除**（见第 6 节）。
- **R6 工作区纪律**：所有写入均在工作区内；未修改 `PROJECT_PROMPT.md`；最终仅保留 `answer.html`、`result.json`、`log.md`；`_selftest/`（含 `node_modules`、脚本、截图、报告）已全部删除，无中间物残留。

## 1. 需求拆解
把题面归纳为 7 个必须“真实联动、不得漂浮/穿插”的子系统：程序化建模、参数化车架几何、传动与适配、分解动画、NPR 视觉与环境、UI 与规格、工程化交付（单文件/CDN/无报错/性能）。

## 2. 关键设计决策
- **单位与坐标系**：以米为单位，五通 BB 置于局部原点；X=前进、Y=上、Z=横向，传动侧 = +Z。整车组 `bikeGroup` 再整体抬升/居中，使两轮落在世界 Y=0 地面。
- **CDN 策略**：`importmap` 指向 jsDelivr 的 `three@0.160.0`（HEAD 校验 200）。仅引入 `three` + `OrbitControls`；**不引入 EffectComposer**，自写两趟后处理（见第 4 节），减少 CDN 依赖面、提升稳定性。
- **NPR 方案**：`MeshToonMaterial` + `DataTexture` 梯度图做色阶分离；墨线用**深度+亮度的屏幕空间边缘检测**（而非逐网格反向壳），因此辐条/螺栓等细小件也能得到干净、等屏宽的轮廓，且不受非均匀缩放影响。
- **性能**：几何按尺寸键缓存复用（`geoCache`≈100 项）；材质按配色分组共享、就地更新；辐条与链条用 `InstancedMesh`（共 3 个）。参数拖动时以“脏标记 + 每帧至多一次重建”节流。

## 3. 场景图（Scene Graph）
```
scene
├── 灯光：HemisphereLight + 3×DirectionalLight(key/fill/rim) + AmbientLight
├── envGroup（工作室，静态构建一次，可整体显隐）
│   ├── 地面/漆线/工作地垫、后墙+侧墙+踢脚线、天花板灯箱
│   ├── 工作台(台虎钳/工具箱/罐/扳手)、墙面工具板+挂墙工具、挂墙车轮×2
│   ├── 货架(立柱/层板/箱子/轮胎)、维修停车架、轮胎堆、水桶
│   └── 接触阴影(径向渐变透明面片, depthWrite=false)
└── bikeGroup（position = 居中偏移 + 抬升；所有部件为程序化子组）
    ├── gFrame   车架：头/上/下/座管、五通壳、后下叉、后上叉(传统/下沉)、勾爪、尾钩、点缀环
    ├── gFork    前叉：舵管/叉冠/叉腿(带前弓)/前勾爪        —— 沿转向轴分解
    ├── gHead    碗组：上下杯/垫圈/顶盖                     —— 沿头管分解
    ├── gCockpit 座舱：把立/弯把(TubeGeometry)/把带/手变刹把/线管 —— 沿舵管上移
    ├── gSeat    座管柱/座管夹/坐垫(垫体+底板+导轨)          —— 沿座管轴上移
    ├── gDrive   传动：中轴/曲柄(spin)/牙盘(1-3)/脚踏/前拨/后拨(knuckle+cage+2导轮)/链条(实例化)
    ├── gBrake   刹车：碟刹夹器 或 圈刹夹器；水壶架凸台
    └── gWheels  前轮/后轮(lathe轮圈+torus轮胎+花鼓+实例化辐条+气嘴+镂空碟片) + 飞轮(锥形塔基+齿轮齿片)
```

## 4. 依赖更新架构（参数变化→部件重新对齐）
核心是“**先解算锚点，后消费锚点**”的单向数据流：
1. `computeSkeleton(P)` 由当前参数**解析求解**全部安装锚点：`BB / HT_top / HT_bot / rearAxle / frontAxle / seatCluster / saddlePos / steererTop / barCenter` 及方向单位向量 `uUp/uDown/uSeat/perpF`。
   - Stack/Reach 定位头管上口；头管角决定转向轴；头管长度受“紧凑度”联动。
   - 后轴由后下叉长与五通落差解算（轴线高于 BB）。
   - **前轴高度被约束为与后轴同高**（解出前叉 axle-to-crown 长度），保证双轮同时着地、车身水平。
   - 紧凑度缩短座管→座簇下移→上管自然下斜、座管延伸变长（组合变化，非整体缩放）。
2. `buildBike()` 清空 `bikeGroup`（**只 dispose 非缓存几何**，缓存几何与共享材质保留），按锚点重建各子组，登记分解件（`exploders`）与旋转件（`spinners`），再 `applyMaterials()`→`applyExplode()`→刷新标签锚点与规格。
3. 参数分发 `onParam(k)` 按影响面分流：几何类→置脏标记下一帧重建；配色/表面/色阶→仅 `applyMaterials()`（零重建）；轮廓/海报化/像素化/背景/道具→`applyRenderStyle()`；分解→`applyExplode()`；旋转/环绕/标签→标志位。
4. 分解为每个子组登记**真实安装轴 + 距离**（轮组沿车轴 Z、前叉沿转向轴、碗组/座舱沿头管、座管沿座管轴、曲柄沿中轴、飞轮脱离塔基…），`applyExplode(t)` 用 easeInOutQuad 平滑且**可逆**，绝非随机放射。

> 因所有部件都只读取同一份锚点，任一参数改变都会让相关部件**重定位/重缩放/重旋转/显隐/重建**，不会漂浮或脱开安装点。

## 5. 渲染管线（NPR 赛璐璐）
```
[pass 1] scene ──► sceneRT (HalfFloat 线性色 + DepthTexture)   // MeshToonMaterial 梯度图做色阶分离
[pass 2] 全屏四边形 ShaderMaterial：
         · 线性化深度 → Roberts-cross 深度不连续 = 轮廓/遮挡边（等屏宽，随 outlineWidth 调节）
         · 亮度梯度 = 赛璐璐明暗分区边
         · edge 混合墨色 → 可选 posterize 量化 → #include <colorspace_fragment> 转 sRGB
         ──► 屏幕
```
- 像素化：把 `sceneRT` 尺寸按 1/2/3 缩小并改用 `NearestFilter`，颜色与墨线一致地“克制像素化”。
- 明亮可读基线：多灯 + 浅色工作室背景；深度阈值/亮度阈值经过调参，避免阴影吞噬结构与轮廓过曝。
- 颜色空间一致性：场景渲染到**线性** RT，墨色 uniform 亦为线性，最后一趟统一 `colorspace_fragment` 转 sRGB，单次转换、无双转。

## 6. 自测与修复（本地无头 Chromium + SwiftShader）
在 `_selftest/` 用 `puppeteer-core` 驱动系统 Chrome，经本地 HTTP 加载页面，采集控制台/页面错误、遍历场景、注入参数场景并截图、解码 PNG 做像素统计。

**发现并修复的缺陷：**
1. **构建器签名不匹配（致命）**：`buildDrivetrain/buildBrakes` 定义为 `(S)` 并返回自建组，却被 `buildBike` 以 `(gDrive,S)` 调用，导致 `S` 实为 Group、`S.BB` undefined 抛错、整车无法装配。→ 改为接收返回值 `const gDrive = buildDrivetrain(S)`。
2. **前叉长度求解符号错误**：`t=(Ay-bbDrop-rake·cosH)/sinH` 使前轴比后轴高约 26mm（前轮悬空）。→ 修正为 `+rake·cosH`，实测 `frontAxleY == rearAxleY == 0.070`，车身水平、轴距 0.979m（符合真实公路车）。
3. **前拨夹环四元数**：一段绕圈的 `cross` 计算恒等于单位阵，夹环未对齐座管。→ 简化为 `setFromUnitVectors(ẑ, uSeat)`。
4. **链条飞轮包角方向**：采样经过 0°（前侧）会与上边重叠。→ 改为经 180°（后侧）包角。
5. **程序化 `setParam('explode',v)` 被动画环回退**：未同步 `explodeTarget`。→ 在 `onParam('explode')` 内同步目标值。
6. **控制台 favicon 404**：→ 加内联 `<link rel="icon" href="data:,">`，控制台错误归零。
7. `applyMaterials` 原实现每次基于**已被修改的**颜色再叠加 sat/sheen，会累积漂移。→ 改为每次从基准色重置再套用表面预设。

**自测结果（最终）：**
- `ready=true`、WebGL 正常、canvas 存在；场景 220 mesh + 3 InstancedMesh，**NaN 位置 0**，`exploders=10 / spinners=4`，后处理 `postOK=true`。
- UI：8 个分组、89 个控件。
- 5 组配置场景（1×12 砾石 / 3×9 经典圈刹 / 2×11 气动 / 极端大几何 / 极端小几何）：全部 `ok=true, nan=0`；估算重量随配置变化 **7.88–8.32kg**；轴距随几何变化 **976–1017mm**。
- NPR 像素校验：开轮廓 vs 关轮廓，极暗（墨线）像素占比 **5.2% → 9.0%**（墨线净增 ≈3.8%），平均亮度 ~118/255（明亮可读）。
- **控制台错误 0、页面错误 0。**

**临时目录删除记录（R5/R6）：** 自测完成后删除整个 `_selftest/`（含 `node_modules/`、`package.json`、`test.js`、`dbg.js`、`viz.js`、`extract.js`、`report.json` 及全部 `*.png`）。工作区最终仅存 `PROJECT_PROMPT.md`（未改）、`answer.html`、`result.json`、`log.md`。

## 7. 使用方式
用现代浏览器打开 `answer.html`（需可访问 jsDelivr CDN 以加载 three.js）。左侧 3D 视口用 OrbitControls 交互（左键旋转/右键平移/滚轮缩放）；右侧“参数控制台”按分组实时调参；顶栏可切换分解视图、轮组转动、组件标签、隐藏面板；“重置”恢复默认。几何更新不会重置相机。
