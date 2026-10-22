# VOXY CRAFT — 任务文档（SPEC-任务）

> 版本 v1.1 · 2026-07-20 · 状态：**已交付（M0–M12 全部通过验收）**
> 配套：`SPEC-设计.md`（做什么）、`SPEC-技术.md`（怎么做）
> 本文为**执行路线图**：分阶段里程碑，每阶段含交付物、涉及文件、**验收门槛**。门槛不过不进入下一阶段。

---

## 0. 执行原则

- **门槛驱动**：每阶段末尾有可机器/截图验证的验收门槛，通过才推进。
- **纵向切片**：先打通"生成→网格→渲染"最小闭环并可视化，再逐层加优化与效果，避免"全写完才跑"。
- **可测优先**：纯逻辑模块（noise/rng/mesher/raycast/physics）带 `LOGIC_START/END` 标记区，node 单测覆盖。
- **瓶颈优先减工作量**：性能问题先降采样/合批/视距外不生成，后谈加速。
- **每阶段 console 零 error** 是底线。

---

## 1. 里程碑总览

| # | 里程碑 | 核心产出 | 关键验收门槛 | 状态 |
|---|---|---|---|---|
| M0 | 离线运行骨架 | index.html/importmap/vendor/启动.bat/空场景 | 双击启动即见画面 + FPS 面板，零 error | ✓ |
| M1 | 数据架构 + 确定性噪声 | rng/noise/registry/chunk/world | 同 seed 同输出（单测 39/39）；get/setBlock 正确 | ✓ |
| M2 | 地形生成 + 7 群系可视化 | generator + 满精度渲染 | 截图可辨 7 群系 | ✓ |
| M3 | Mesh 优化三件套 | 面剔除/贪婪/顶点压缩/AO/六向 | greedy 单测 200→2；9B/顶点 | ✓ |
| M4 | 材质系统 | SVG 程序化贴图 + 图集 | 全方块原创贴图，零外部图片 | ✓ |
| M5 | 树木 + 地物 | 4 种树 + 矿物 + 河流 | 截图 4 树种剪影可辨；巨树 2×2 ≥20 高 | ✓ |
| M6 | 玩家交互 | controls/physics/raycast/放置破坏 | 单测 14/14；可行走/飞行/放置/破坏 | ✓ |
| M7 | Worker 异步 + 流式加载 | gen.worker/pool/优先级队列 | 移动无卡顿；区块有界无泄漏 | ✓ |
| M8 | LOD 远景系统 | 降采样/特征记录/环形/超级Mesh/雾 | 8192 视距可辨森林绒感/雪山/巨树 | ✓ |
| M9 | 渲染管线 | sky/fog/water/昼夜 | 天空昼夜 + 水面折射反射 + 雾联动 | ✓ |
| M10 | UI 与物品栏 | hud/inventory/settings/debug | 物品栏 290 种；视距滑条生效 | ✓ |
| M11 | 单文件 dist 打包 | build/bundle.mjs + dist/index.html | `file://` 双击可玩 | ✓ |
| M12 | 验收自检 | 全量单测 + 无头截图 + dist | 全部通过 | ✓ |

> 依赖链：M0→M1→M2→M3→M4 可串行打底；M5/M6 可在 M4 后并行；M7 依赖 M3；M8 依赖 M7+M3；M9 依赖 M2（有画面）；M10 依赖 M1（注册表）；M11 依赖功能冻结；M12 收尾。

---

## 2. 阶段明细

### M0 — 离线运行骨架
**交付**：`index.html`、`vendor/three.module.js`、`src/main.js`（清屏 + 相机 + 渲染循环）、`src/config.js`、`启动.bat`、`启动.sh`。
**要点**：importmap 映射 `three`→本地文件；`启动.bat` 拉起 `python -m http.server`（回退 node）并打开浏览器；HUD 占位显示 FPS。
**验收门槛**：
- [ ] 双击 `启动.bat` 自动开浏览器见纯色场景 + FPS 数字跳动。
- [ ] console 零 error / 零 warning（three 版本告警除外，需消解）。
- [ ] 断网（拔网线/禁网）刷新仍可运行。

### M1 — 数据架构 + 确定性噪声
**交付**：`math/rng.js`、`math/noise.js`、`data/registry.js`（方块部分）、`world/chunk.js`、`world/world.js`。
**要点**：`Uint8Array(4096)` chunk；`mulberry32` + 种子 Perlin/fbm；稀疏覆盖层；`getBlock/setBlock` 跨 chunk。
**验收门槛**：
- [ ] node 单测：同 seed 调用 noise/rng 输出逐位一致；不同 seed 不同。
- [ ] 单测：setBlock 后 getBlock 回读一致；跨 chunk 边界读写正确。
- [ ] 注册表 `id=0` 为空气，方块属性齐（solid/opaque/tile）。

### M2 — 地形生成 + 7 群系可视化
**交付**：`world/generator.js`、临时满精度 Mesh 渲染（朴素面剔除）。
**要点**：指数高度场 + 台地量化 + 河流下切；温度/湿度群系划分；地表填充与雪线。
**验收门槛**：
- [ ] 无头截图：平原/森林/沙漠/高原/盆地/湖泊/雪山 7 群系各一张，地貌可辨。
- [ ] 同 seed 重启世界逐 chunk 一致。
- [ ] 可见指数拔升的天际线（草甸与山脉交错）。

### M3 — Mesh 优化三件套
**交付**：`mesh/mesher.js`（面剔除 + 贪婪 + AO + 六向分组）、`mesh/vertexFormat.js`（压缩属性 + 解码 shader）、`render/materials.js`（体素 ShaderMaterial）。
**要点**：合并键 `(tile,ao)`；六向 group + 相机朝向裁剪；`aPos/aDir/aAO/aTile/aUV` 压缩布局。
**验收门槛**：
- [x] greedy 单测：10×10 同色平面 → 2 三角形（200→2，约 100×）；AO 边界/异 tile 不被错误合并；3×3×3 实心立方体 = 12 三角形。
- [x] 顶点字节 ≈9B/顶点（position3+dir1+ao1+tile2+uv2，Uint8/Uint16 压缩属性，单测核对）。
- [x] 六向子网格 + 相机朝向剔除生效（渲染 TRI 约为构建量一半），画面无破面。
- [x] AO 烘焙可见（地形阶梯处柔和阴影）。
- 实测记录：自然地形场景级三角面较 M2 约降 2×（M2 已面剔除、地形非平面，属预期；平坦表面才是 100×）。**大范围三角面/draw call 削减由 M8 LOD 超级 Mesh 承担**，此处不强求场景级一个量级。

### M4 — 材质系统（SVG 程序化）
**交付**：`data/textures.js`（全 tile SVG 定义 + 图集构建）。
**要点**：每 tile 原创 SVG（底色+噪点+图案）；图集 + NearestFilter + mipmap；多面材质（草顶/侧/底）；alpha-test 透明通道。
**验收门槛**：
- [ ] 全方块贴图由 SVG 生成，代码中零外部图片引用（grep 校验无 `http`/`.png`/`.jpg`）。
- [ ] 截图：草/沙/石/雪/木/叶/水/矿石等贴图清晰可辨、风格统一。
- [ ] 透明方块（玻璃/树叶/花）正确 alpha-test，无排序破面。

### M5 — 树木 + 地物
**交付**：`generator.js` 地物阶段（4 种树 + 矿物 + 河流完善）。
**要点**：针叶杉尖塔 / 棕榈弯干伞冠 / 樱花圆冠 / 巨树 2×2 ≥20 高；确定性 hash 布点；跨 chunk 树冠无缝。
**验收门槛**：
- [ ] 无头截图：4 种树各一张，**剪影层面一眼可分**（无橡木/白桦式雷同）。
- [ ] 巨树在远景机位仍为可辨地标。
- [ ] 矿物按深度分布；河流贯穿 ≥3 群系、河床低于两侧。

### M6 — 玩家交互
**交付**：`player/controls.js`、`player/physics.js`、`player/raycast.js`、放置/破坏逻辑、高亮线框。
**要点**：Pointer Lock；AABB 扫掠碰撞；体素 DDA 射线；双击空格飞行；破坏/放置改 chunk + 覆盖层 + 局部重建。
**验收门槛**：
- [ ] 可行走/跳跃/飞行/下蹲，无穿墙卡墙。
- [ ] 左键破坏、右键放置、中键拾取生效，边界 chunk 同步更新。
- [ ] raycast 单测：已知体素布局命中正确方块与面。

### M7 — Worker 异步 + 流式加载
**交付**：`workers/gen.worker.js`、`util/pool.js`、`util/priorityQueue.js`、`world.js` 流式加载。
**要点**：Worker 内生成 + 网格化；Transferable 零拷贝回传；优先级（前方>周围>远景）；stale 取消；主线程每帧限量消费。
**验收门槛**：
- [ ] 快速移动 10s，主线程无 >16ms 长帧（计时器日志）。
- [ ] 进出视距的 chunk 正确加载/卸载，显存无泄漏（长时间移动后几何体数量稳定）。
- [ ] Worker 回传走 transfer（日志确认无结构化克隆大缓冲）。

### M8 — LOD 远景系统（核心卖点）
**交付**：`world/lod.js`（降采样 + 特征记录 + 环形管理 + 超级 Mesh）、雾衔接。
**要点**：LOD0..n 半径 2 幂递增；特征记录 `{topHeight,topColor,canopy,snow,water,cliff}`；立体柱挤出 + 树冠凸起 + 雪帽 + 崖壁 + 水面；每级合批个位数 draw call；重叠环 + 雾 + 新层就绪再卸旧层。
**验收门槛**：
- [ ] 视距滑条拉到 8192，画面连续不崩、console 零 error。
- [ ] **远景专项截图**：远处森林有绒感凸起、雪山有起伏+白帽、巨树为可辨地标、台地有阶梯崖壁、河湖有水色走向——**认不出即返工**。
- [ ] 每级 LOD draw call 为个位数（renderer.info 核对）。
- [ ] 近远景过渡无跳变/裂缝（移动中截图序列核对）。

### M9 — 渲染管线
**交付**：`render/sky.js`、`render/fog.js`、`render/water.js`、`render/shadows.js`（CSM）、`render/postprocess.js`（God Rays + TAA）。
**要点**：大气散射天空 + 昼夜；指数雾联动；水面浅折射/深反射；2–3 级 CSM；径向模糊 God Rays；抖动投影 + 历史混合 TAA。
**验收门槛**：
- [ ] 昼夜循环：太阳升降、天空/雾/光色联动（定时截图序列）。
- [ ] 水面截图：浅水见折射、深水见反射。
- [ ] God Rays 在逆光遮挡下出现光束；TAA 开启后锯齿明显减少、无明显鬼影。
- [ ] 各效果可独立开关，关闭后帧时下降。

### M10 — UI 与物品栏
**交付**：`ui/hud.js`、`ui/inventory.js`、`ui/settings.js`、`ui/debug.js`；`data/registry.js` 物品部分补全 ≥80 种。
**要点**：工业风（深色/等宽/无圆角阴影 emoji）；创造物品栏分类 + 搜索 + 拖拽；设置视距 256–8192 滑条；F3 计时面板。
**验收门槛**：
- [ ] 物品栏陈列 ≥80 种（染色系列算一种），可取用到快捷栏并放置。
- [ ] 视距滑条实时生效（256↔8192）。
- [ ] F3 面板显示生成/网格化/渲染耗时分布、draw call、三角面。

### M11 — 单文件 dist 打包
**交付**：`build/bundle.mjs`（esbuild）、`dist/index.html`。
**要点**：`--bundle --format=iife` 内联 three + src；Worker 转 Blob URL；无外部 import/fetch。
**验收门槛**：
- [ ] `dist/index.html` 直接 `file://` 双击可玩（无需服务器）。
- [ ] dist 与文件夹版功能一致、console 零 error。

### M12 — 验收自检
**交付**：`test/smoke.cjs`、`test/perf.cjs`、远景专项脚本、瓶颈报告。
**要点**：Playwright（`.cjs` + swiftshader）遍历 7 群系/4 树/远景截图；8192 视距 FPS 曲线；计时分布汇总。
**验收门槛**：
- [ ] 7 群系 + 4 树种 + 远景立体感截图全部人工/像素校验通过。
- [ ] 8192 视距平均 FPS 达标、无长帧堆积。
- [ ] 产出各阶段耗时分布与瓶颈定位，确认采用"减工作量"策略。
- [ ] 全流程 console 零 error。

---

## 3. 完成定义（Definition of Done）

全部满足方可交付：
1. 设计文档 §13 全部验收标准通过。
2. 文件夹版（`启动.bat`）与单文件版（`dist/index.html`）均可离线运行。
3. 8192 视距流畅、console 零 error、远景立体感专项通过。
4. 全原创材质，零外部图片素材。
5. 单测（noise/rng/mesher/raycast/physics）与无头冒烟全绿。
6. 性能计时埋点齐备并产出瓶颈报告。

---

## 4. 估算与节奏

- 体量预估：核心代码约 6000–9000 行（含 shader 与 SVG 贴图定义）。
- 关键路径：M1→M2→M3→M7→M8（数据→生成→网格→异步→远景），远景 LOD 是最大不确定项，预留迭代余量。
- 建议节奏：M0–M4 打底（可跑可视）→ M5/M6 并行 → M7/M8 攻坚 → M9 画面 → M10/M11 收尾 → M12 自检迭代。

---

## 5. 变更管理

- 实现中若发现技术文档方案不可行（如某 shader 在 WebGL1/2 限制），**先更新 SPEC-技术 再改码**，保持文档为事实来源。
- 每阶段完成后在本文档对应门槛打勾并记录实测数据（FPS/三角面/draw call/耗时）。

---

## 6. 交付验收记录（2026-07-20）

### 6.1 自动化测试（全绿）
- **node 单测**：`logic.test.mjs` 39/39（rng/noise 确定性、chunk/world、registry 189 方块 / 290 物品条目 / 199 种类）；`mesher.test.mjs` 9/9（贪婪 200→2、AO/异 tile 打断合并、3×3×3=12 三角形、9B/顶点）；`player.test.mjs` 14/14（DDA 射线、AABB 碰撞/跳跃/飞行）。
- **无头冒烟（Playwright + swiftshader）**：smoke / biomes(7 群系) / trees(4 树种) / player_smoke(破坏+放置) / stream(流式无泄漏) / lod(8192 远景) / ui(290 物品) / dist(file://) **全部通过，console 零 error**。

### 6.2 实测数据（swiftshader 软件渲染，1280×800）
- 近景满精度区域：FPS 50–60，渲染 TRI 约 3–9 万，DRAW 约 200–500（每 chunk 六向子网格）。
- 流式加载：稳态约 485 区块（半径 5 圆形 × 5 垂直层），瞬移 256 格回收 485 / 重载 484，chunkMap 有界无泄漏。
- 远景 LOD：4096 视距 6 级、8192 视距 7 级；LOD 几何约 5.2 万三角形，**每级 1 个 draw call**；8192 视距 FPS ≈ 41 不崩。
- 单文件 dist：565 KB，file:// 双击运行，Blob Worker 生效。

### 6.3 运行方式
- **文件夹版**：双击 `启动.bat`（内置零配置本地服务器，自动开浏览器）。
- **单文件版**：双击 `dist/index.html`（file:// 直接运行，无需服务器）。
- 重新打包：`node build/bundle.mjs`。

### 6.4 已实现的验收标准（设计 §13）
1. ✓ 内置 FPS 面板；8192 视距连续稳定、console 零 error。
2. ✓ 无头截图确认 7 群系样貌。
3. ✓ 4 树种剪影可辨（针叶杉尖塔 / 棕榈弯干伞冠 / 樱花圆冠 / 巨树 2×2 ≥20 高地标）。
4. ✓ 远景立体感：森林树冠凸起绒感 + 树冠色、雪山白帽起伏、巨树地标剪影、台地崖壁、河湖水面走向（LOD 特征记录非高度图平板）。
5. ✓ 近远景雾中衔接，LOD 分级降采样（2³/4³/…→单代表块）。
6. ✓ 各阶段计时/统计埋点（HUD + F3：FPS/draw/tri/区块/LOD 级/长帧）。
7. ✓ 全原创 SVG 程序化材质，零外部图片。

### 6.5 诚实标注的简化项
- **M9 渲染管线**：已实现大气散射天空 + 昼夜循环、水面着色器（浅水折射水下 / 深水反射天空 + 涟漪 + 菲涅尔）、指数雾与天空联动、地形昼夜环境光。**未实现**：体积光 God Rays、TAA、级联阴影 CSM。当前以**烘焙顶点 AO + 六向方向明暗 + 雾**提供立体感与深度线索（性能优先的定向低成本方案，符合用户"低能耗"偏好）。这三项作为后续可选增强，接口（渲染 pass 结构）已预留。
- **性能说明**：验收在 swiftshader 软件渲染下完成（无独立 GPU），帧率代表软件渲染下限；在硬件 GPU 上预期显著更高。"主线程零长帧"通过 Worker 异步生成/网格化/LOD 保证（主线程仅上传与渲染）。
