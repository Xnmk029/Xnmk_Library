# VOXY CRAFT — 技术文档（SPEC-技术）

> 版本 v1.0 · 2026-07-20 · 状态：待评审
> 配套：`SPEC-设计.md`（做什么）、`SPEC-任务.md`（分几步做）
> 本文为**架构与实现的唯一事实来源**。所有"怎么实现"的争议以本文为准。

---

## 1. 总体架构

三层分离，单向数据流：

```
[Worker 线程池]  生成体素 + 网格化  ──transfer ArrayBuffer──▶  [主线程]  仅渲染 + 交互
        ▲                                                            │
        └────────────  优先级任务队列（前方>周围>远景）  ◀──────────┘
```

- **主线程零生成**：任何 chunk 生成 / 网格化 / LOD 降采样都不得在主线程同步执行超过 1 帧（≈16ms）。主线程只做：上传 GPU 缓冲、渲染、玩家输入、UI。
- **Worker 线程**：体素生成 + 贪婪网格化 + LOD 降采样全部在 Worker 完成，结果以 `Transferable`（`ArrayBuffer`）零拷贝回传。
- **确定性**：所有生成由 `(seed, chunkCoord)` 纯函数推导；玩家改动以稀疏覆盖层叠加。

### 1.1 目录结构

```
我的世界VOxy/
├─ index.html            # 入口（文件夹版，importmap + ES 模块）
├─ 启动.bat / 启动.sh     # 一键本地静态服务器 + 打开浏览器（离线即玩）
├─ vendor/three.module.js# 本地 three.js（ESM，随包分发，无 CDN）
├─ src/
│  ├─ main.js            # 启动、主循环、场景装配、系统调度
│  ├─ config.js          # 常量与默认设置
│  ├─ math/{rng.js, noise.js}
│  ├─ data/{registry.js, textures.js}
│  ├─ world/{chunk.js, world.js, generator.js, lod.js}
│  ├─ mesh/{mesher.js, vertexFormat.js}
│  ├─ workers/gen.worker.js
│  ├─ render/{materials.js, sky.js, water.js, shadows.js, postprocess.js, fog.js}
│  ├─ player/{controls.js, physics.js, raycast.js}
│  ├─ ui/{hud.js, inventory.js, settings.js, debug.js}
│  └─ util/{priorityQueue.js, pool.js}
├─ build/bundle.mjs      # esbuild 打包 → 单文件 dist
├─ dist/index.html       # 单文件离线版（可 file:// 双击）
└─ test/{smoke.cjs, perf.cjs}
```

---

## 2. 离线加载方案（importmap + 本地服务器 + 单文件打包）

**现实约束**：浏览器对 `file://` 下的 `<script type="module" src>` 与 Worker 脚本施加 CORS 拦截，ES 模块无法直接双击运行。两套方案并存：

### 2.1 文件夹版（开发/主交付）
- `index.html` 使用 **importmap** 将裸导入 `three` 映射到本地 `vendor/three.module.js`：
  ```html
  <script type="importmap">
  { "imports": { "three": "./vendor/three.module.js" } }
  </script>
  <script type="module" src="./src/main.js"></script>
  ```
- `启动.bat`：零配置拉起本地静态服务器并打开默认浏览器。优先 `python -m http.server`（环境已具备 Python 3.14），回退到内置 node 单文件 http server。绑定 `127.0.0.1:随机端口`，`start http://127.0.0.1:PORT/`。
- 此版代码模块化、Worker 为独立文件、可调试，是主交付形态。

### 2.2 单文件 dist 版（可 `file://` 双击）
- `build/bundle.mjs` 用 **esbuild** `--bundle --format=iife` 把 `src/main.js` + `vendor/three.module.js` 全部内联进一个 `index.html` 的 `<script>`。
- Worker 代码以字符串内联，运行时 `new Worker(URL.createObjectURL(new Blob([src], {type:'text/javascript'})))`——Blob URL 绕过 file:// 的脚本 CORS。
- 内联后无外部 `import`/`fetch`，故 `file://` 双击即玩。
- esbuild 为**构建期**依赖（`npm i -D esbuild`），非运行期依赖，不破坏离线运行。

> three.js 版本：选用支持 importmap 的现代 ESM 版（r160+）。`vendor/three.module.js` 从 npm 一次性下载后随包固化，运行期不联网。

---

## 3. 数据架构（性能根基）

### 3.1 区块存储
- 区块为 **16×16×16 立方体**，体素存于 `Uint8Array(4096)`（方块 ID，<256 种足够；若含状态超 255 则升 `Uint16Array`，接口不变）。
- 索引：`i = x + z*16 + y*256`（Y 为慢变维，利于按层扫描）。
- `Chunk` 对象：`{ cx, cy, cz, data: Uint8Array, dirty: bool, mesh: ref, overrides: Map|null }`。
- **禁止**每方块一个 `Object3D`/`Mesh`。一个 chunk → 至多一个合并 Mesh（含 6 个方向分组）。

### 3.2 世界管理（`world.js`）
- `Map<key, Chunk>`，`key = cx+","+cy+","+cz`。
- `getBlock(x,y,z)` / `setBlock(x,y,z,id)`：定位 chunk → 读写 data；跨 chunk 边界 setBlock 标记相邻 chunk dirty。
- **稀疏覆盖层**：玩家改动存 `Map<worldKey, blockId>`，叠加在确定性生成之上；生成 chunk 时先跑生成器再应用覆盖层。保证种子世界可复现。
- 流式加载：以玩家所在 chunk 为中心，按视距计算需驻留的 chunk 集合；进出集合触发加载/卸载（卸载时回收 GPU 几何体防泄漏）。

### 3.3 方块注册表（`registry.js`）
- 数组式注册：`BLOCKS[id] = { id, name, solid, opaque, tile:{top,side,bottom}, transparent, liquid, lightEmit, hardness }`。
- `id=0` 恒为空气。`solid` 决定面剔除；`opaque` 决定 AO/背面；`transparent`（玻璃/树叶/花）走 alpha-test 通道。
- 物品注册表同构：`ITEMS[id] = { id, name, category, blockId?, icon(tile) }`，供物品栏。

---

## 4. 世界生成（确定性）

### 4.1 随机与噪声（`math/`）
- `rng.js`：`mulberry32(seed)` 种子 PRNG；所有随机决策由此派生，禁用 `Math.random`。
- `noise.js`：种子化 Perlin（置换表由 seed 洗牌）；提供 `noise2(x,z)`、`noise3(x,y,z)`、`fbm(x,z,octaves,lacunarity,gain)`。

### 4.2 高度场（指数塑形）
```
base   = fbm(x*1/512, z*1/512, 6)        ∈[-1,1]   大势
detail = fbm(x*1/64,  z*1/64,  4)*0.15              细节
n      = (base + detail)                            合成
height = H0 + sign(n) * (2^(|n|*k) - 1) * SCALE     指数拔升
```
- 低 `|n|` → `2^x≈1+x` 趋平 → 草甸/盆地；高 `|n|` → 指数陡增 → 山脉/高原。
- **台地量化**：对 height 做 `floor(height / STEP)*STEP`（仅当 height 超阈值且坡度低），顶部平坦、边缘陡崖 → 高原台地。
- **河流**：独立 `riverNoise = |fbm(...)|` 低值带作为河道中心线，沿中心线对 height 做高斯下切（河床低于两侧），河道贯穿多个群系（由大尺度噪声走向保证 >3 群系）。

### 4.3 群系划分（高度 + 温度 + 湿度）
```
temp = fbm(x*1/1024 + 1000, z*1/1024)      温度场
hum  = fbm(x*1/1024 - 1000, z*1/1024 + 500) 湿度场
```
判定（优先级自上而下）：
1. `height < waterLevel` → **湖泊**
2. `height < waterLevel + 2 && hum高` → **盆地**（洼地聚水/湿地）
3. `height > plateauH && temp低` → **雪山**
4. `height > plateauH` → **高原**
5. `temp高 && hum低` → **沙漠**
6. `hum高 && temp中` → **森林**
7. 其余 → **平原**

### 4.4 地表填充与矿物
- 列式填充：基岩(y=0) → 深板岩 → 石头 → 表层 3–5 格（按群系：草/沙/雪）→ 空气。
- 雪线：`temp < snowTemp && height > snowLine` → 表层换雪块，随海拔加雪层。
- 矿物：按深度概率用 `rng(hash(x,y,z))` 散布（煤浅、铁中、钻石/翡翠深）。

### 4.5 树木（`generator.js` 地物阶段）
- 由 `rng(hash(cx,cz, treeSalt))` 决定每 chunk 的树位置与种类，**确定性**。
- **锥形针叶杉**：直干 + 自下而上每层半径递减的环形叶层，顶收尖（尖塔）。
- **弯干伞冠棕榈**：分段贝塞尔/正弦偏移的弯干 + 顶端放射下垂叶。
- **圆冠樱花树**：粗短干 + 球形粉色花叶（球面体素化）。
- **巨型高树**：2×2 干、≥20 高、顶部大冠；森林深处低概率生成，作为远景地标。
- 树写入 chunk 体素；跨 chunk 的树冠在相邻 chunk 生成时由同一 hash 推导，保证无缝。

---

## 5. Mesh 优化（三级剔除 + 贪婪合并）

### 5.1 面剔除（occlusion culling）
- 遍历体素，对每个实心方块的 6 个面：仅当**相邻格非实心**（空气/透明）时生成该面。被遮挡面零顶点。
- 透明方块（玻璃/树叶）之间：同类型相邻不剔面（避免透视穿帮），异类型/空气则生成。

### 5.2 贪婪网格化（Greedy Meshing，近景必须）
- 标准 Mikola Lysenko 算法：对每个轴/方向，把同材质相邻面合并为最大矩形。
- **合并键** = `(tileId, aoPattern, light)`——AO/光照不同的面**不合并**，保证烘焙 AO 不糊（这是贪婪 + AO 共存的关键）。
- 10×10 同色平面：200 三角形 → 2 三角形。
- 输出：每矩形 4 顶点 + 6 索引（2 三角形）。

### 5.3 六向子网格 + 背面剔除
- 顶点按面法线方向（+X,-X,+Y,-Y,+Z,-Z）分入 6 个 `geometry.group`。
- 渲染时按相机方向计算可见的 ≤3 个朝向，仅绘制朝向相机的分组（`material.visible` 或动态 draw range），跳过整批背向面。
- GPU 侧同时 `side = FrontSide` 做逐三角背面剔除兜底。
- 权衡说明：六向分组增加少量 draw call，但对大 Mesh（近景满精度 chunk / 远景超级 Mesh）能省约一半片元；近景 chunk 数量有限，draw call 可控。提供开关，远景超级 Mesh 默认启用。

### 5.4 顶点压缩（自定义属性，消除冗余）
整数坐标无需 float32。自定义 `ShaderMaterial` 解码，属性布局：

| 属性 | 类型 | 说明 |
|---|---|---|
| `aPos` | `Uint8 × 3` | chunk 内局部坐标 0..16（整数） |
| `aDir` | `Uint8 × 1` | 面朝向 0..5（解码为法线，省去 normal 属性） |
| `aAO` | `Uint8 × 1` | 顶点烘焙 AO 0..3 |
| `aTile` | `Uint16 × 1` | 图集 tile 索引（shader 内算 UV，省 uv 属性） |
| `aUV` | `Uint8 × 2` | 矩形内角点 0/1（0..1 量化） |

- chunk 世界偏移以 `uniform vec3 uChunkOffset` 传入（近景每 chunk 一 Mesh）；远景超级 Mesh 则把世界坐标烘焙进 `Int16` 位置属性后合批。
- 相比默认 `position(float32×3)+normal(float32×3)+uv(float32×2)=32B/顶点`，压缩后 ≈ `8B/顶点`，显存与带宽降 4×。

### 5.5 AO 烘焙
- 网格化时对每个顶点采样其切向 2 邻 + 角 1 邻（共 3 个实心邻居）：`AO = 3 - occluders`（0..3）。
- 四顶点 AO 写入 `aAO`，片元双线性插值 → 边缘/缝隙柔和阴影。
- 如 §5.2，AO pattern 进入合并键，避免贪婪合并抹平 AO 边界。

---

## 6. 远景 LOD 系统（核心卖点）

**原则：减少远处需要生成的方块数量，而非加速生成。**

### 6.1 分级降采样
| 层级 | 单元 | 代表方块策略 | 覆盖环 |
|---|---|---|---|
| LOD0 | 满精度 16³ chunk | 真实体素 + 贪婪 Mesh | `[0, R0]` 近景 |
| LOD1 | 2³→1 | 每 8 体素取 1 代表 | `(R0, R1]` |
| LOD2 | 4³→1 | 每 64 体素取 1 | `(R1, R2]` |
| LOD3 | 8³→1 | … | `(R2, R3]` |
| LODn | … 至单代表块 | 最远每 chunk → 1 块 | `(Rn-1, 8192]` |

- 半径按 2 的幂递增（如 R0=128, R1=256, R2=512, R3=1024, R4=2048, R5=4096, R6=8192），可由视距滑条缩放。
- 每升一级，单元边长 ×2，需生成方块数 ÷8 → 工作量指数下降。

### 6.2 代表方块 ≠ 高度图（立体感关键）
每个降采样单元存储一个**特征记录**而非单一颜色：
```
{ topHeight, topColor, sideColor,
  canopy: 0..1 (树冠凸起强度), canopyColor,
  snow: 0..1, water: 0..1, cliff: bool (台地崖壁) }
```
低 LOD Mesh 生成规则：
- 以 `topHeight` 挤出**立体柱**（2.5D 高度场柱体，非平板）；
- `canopy>阈值` → 柱顶叠加**树冠凸起**（森林绒感），染 `canopyColor`；
- `snow>阈值` → 顶部染白（雪山白帽），保留高度起伏；
- `cliff` → 保留**阶梯崖壁**（台地）；
- `water>阈值` → 该单元纳入**水面 Mesh**，染水色走向；
- **巨树地标**：生成阶段把巨树位置写入特征记录，超远景以加高柱 + 树冠球剪影呈现，保证可辨认。

### 6.3 环形管理与合批
- 每个 LOD 级维护以玩家为中心的环形区块集合；玩家移动时生成外环、回收内环/越界环。
- 同一 LOD 级的所有低细节 chunk **合并为少量超级 Mesh**（按材质/朝向分组），目标每级 **个位数 draw call**。
- 超级 Mesh 用烘焙世界坐标（Int16 位置）+ 单次 draw。

### 6.4 无缝衔接
- 相邻 LOD 级半径重叠 1 单元，边界处几何对齐到降采样网格，避免裂缝。
- **指数雾**在 LOD 边界带加浓，掩盖残余切换痕迹；雾色随天空/昼夜联动。
- LOD 切换采用"新层就绪后再卸旧层"，杜绝闪烁/空洞。

---

## 7. 异步生成（Worker 池）

### 7.1 Worker 职责（`workers/gen.worker.js`）
- 输入任务：`{ type:'chunk'|'lod', coord, lodLevel, seed }`。
- 执行：生成体素（或降采样特征）→ 贪婪网格化 → 产出压缩顶点/索引 `ArrayBuffer`。
- 回传：`postMessage({ coord, buffers }, [transferList])` 零拷贝。

### 7.2 线程池与优先级（`util/pool.js`, `priorityQueue.js`）
- 池大小 = `min(navigator.hardwareConcurrency, 8)`。
- 任务优先级：`score = 玩家前方权重*距离投影 + 距离`，**前方 > 周围 > 远景**；同距离近 LOD 优先远 LOD。
- 主线程每帧向空闲 Worker 派发队列头部任务；Worker 拉取执行。
- 取消机制：玩家快速移动时，已排队但过远的任务标记 stale，Worker 完成后主线程丢弃。

### 7.3 主线程约束
- 主线程每帧仅：消费回传结果 → `BufferGeometry` 上传 → 场景增删 → 渲染 → 输入/UI。
- 任何单帧同步生成/网格化 > 1ms 即视为违规，须移入 Worker。

---

## 8. 渲染管线与画面效果

### 8.1 渲染器
- `WebGLRenderer({ antialias:false, powerPreference:'high-performance' })`——AA 交给 TAA。
- `outputColorSpace = SRGB`，像素比 `min(devicePixelRatio, 2)`（TAA 下可降采样省带宽）。

### 8.2 管线（自定义 pass，非 examples 依赖，保证离线可控）
```
1. 阴影 pass：CSM 渲染级联深度图
2. 主场景 pass → sceneColor + sceneDepth（含体素/树/水）
3. 天空 pass：大气散射背景（深度=远平面）
4. God Rays pass：遮挡深度 → 径向模糊 → 加色合成
5. 水面 pass：折射(浅)/反射(深) 合成到 sceneColor
6. TAA pass：抖动投影 + 历史混合 → 输出
7. 雾：在主场景 shader 内按距离指数混合天空色
```
用 `WebGLRenderTarget` + 全屏三角 + 自定义 `ShaderMaterial` 手工组合，不依赖网络 addon。

### 8.3 天空（大气散射 + 昼夜）
- 大球/盒 `ShaderMaterial`，Preetham/Hosek-Wilkie 近似：`sunDirection`、`turbidity`、`rayleighCoeff` 等 **uniform 由外部 `timeOfDay` 驱动**。
- 昼夜循环：`timeOfDay∈[0,1)` → 太阳方位/颜色、环境光、雾色、天空参数全部联动。设置面板可手动定格或自动循环。

### 8.4 雾
- 体素 shader 内 `fogFactor = 1 - exp(-density * dist)`，颜色 = 当前地平线天空色；浓度随视距/LOD 边界自适应，掩盖 LOD 切换。

### 8.5 阴影（CSM 级联）
- 方向光（太阳）+ 2–3 级级联：近级小范围高分辨率（2048²）、远级大范围低分辨率（1024²）。
- 每级独立 `WebGLRenderTarget` 深度，主 shader 按片元深度选级采样 PCF 软阴影。
- 级联范围随太阳方向/视距更新；提供开关（低画质关闭）。

### 8.6 水面（浅折射 / 深反射）
- 单独水 Mesh（水体顶面），`ShaderMaterial`：
  - 采样场景色做**屏幕空间折射**（按法线扰动 UV），浅水为主；
  - **反射**：渲染一份天空+远景到反射 RT（或采环境立方），深水为主；
  - `depth = 水深` → `mix(refraction, reflection, smoothstep(depth))`；
  - 时间驱动法线扰动（程序化正弦/噪声），菲涅尔边缘增强反射。

### 8.7 God Rays（低成本近似）
- 从相机渲染**遮挡深度图**：太阳方向被几何遮挡处为暗、可见天空处为亮（太阳屏幕位置为光源）。
- 对该图做**径向模糊**（朝太阳屏幕坐标采样 N 次衰减叠加）。
- 加色（additive）合成回主画面。**非**步进式体积射线追踪，开销为 1 个低分辨率 pass + 径向模糊。

### 8.8 TAA（时间抗锯齿）
- 每帧用 Halton(2,3) 序列**抖动投影矩阵**（亚像素偏移）。
- 渲染到 `currentRT`，与 `historyRT` 按运动向量重投影混合（`mix ≈ 0.1 当前 + 0.9 历史`）。
- 运动向量：静态世界 + 相机运动 → 用相机 view/proj 差分重投影近似（动态方块极少，忽略其运动）。
- 邻域颜色裁剪（neighborhood clamp）防鬼影。输出替代 MSAA。

---

## 9. 材质系统（SVG 程序化 + 图集）

### 9.1 贴图生成（`textures.js`）
- 每 tile 由一段 **SVG 字符串**或 Canvas 指令定义（16×16 像素风：底色 + 噪点 + 图案，全部原创配色）。
- 光栅化：`new Image()` 加载 `data:image/svg+xml` 或 Canvas 绘制 → 绘入图集 Canvas 的固定格子。
- **图集**：所有 tile 排进 `N×N` 图集（如 16×16 tile → 256×256 图集），`CanvasTexture`，`magFilter=NearestFilter`，`minFilter=NearestMipmapNearest`（远景防闪烁，雾再兜底）。
- `aTile` → shader 内换算 UV 偏移：`uv = (tileXY + aUV) / tilesPerRow`。

### 9.2 多面材质
- 草方块等：`tile.top / tile.side / tile.bottom` 不同 tile，网格化按面朝向选 tile。

### 9.3 透明通道
- alpha-test 材质（`alphaTest=0.5`）处理玻璃/树叶/花/梯/门；关闭背面剔除（`side=DoubleSide`）但保留面剔除。

---

## 10. 玩家 / 交互

### 10.1 控制（`controls.js`）
- Pointer Lock 鼠标环视；WASD 行走、空格跳、Shift 蹲/降；双击空格切飞行；滚轮/数字键选手持。

### 10.2 物理（`physics.js`）
- 玩家 AABB（0.6×1.8×0.6）对体素做扫掠碰撞（分轴解析）；重力 + 跳跃 + 飞行切换；地面判定。

### 10.3 射线拾取（`raycast.js`）
- 体素 DDA（Amanatides & Woo），步长 8 格；返回命中方块 + 命中面法线（放置用相邻格）。
- 高亮线框（`LineSegments` 单位立方）标示目标。

### 10.4 放置/破坏
- 破坏：setBlock(air) → 标记该 chunk + 相邻 chunk dirty → Worker 重建。
- 放置：setBlock(手持方块) → 同上。写入稀疏覆盖层。

---

## 11. UI（工业软件风格）

- 深色背景、等宽字体（`ui-monospace`）、无圆角/阴影/emoji、细边框面板。
- `hud.js`：左上 FPS/坐标/群系/LOD 统计；右下快捷栏 9 格；中央准星。
- `debug.js`（F3）：各阶段计时（生成/网格化/渲染 ms）、队列长度、draw call、三角面、显存估算。
- `settings.js`（Esc）：视距 256–8192 滑条、FOV、灵敏度、昼夜、画质预设、各效果开关。
- `inventory.js`（E）：创造物品栏，分类标签 + 搜索 + 拖拽到快捷栏。

---

## 12. 性能计时与自检

### 12.1 计时器（埋点）
- `util/timer.js`：`time(label, fn)` 包装，滚动平均（最近 60 帧）。
- 埋点：`worldgen`（Worker 内）、`meshing`（Worker 内）、`upload`（主线程几何上传）、`render`（renderer.info + 帧时）、`lodBuild`。
- F3 面板实时显示耗时分布；`console.table` 周期输出汇总。

### 12.2 优化策略优先级
- 定位瓶颈后**优先"减少工作量"**：降采样更激进、合并键更宽、视距外不生成、draw call 合批；**其次**才是"加速计算"（SIMD/缓存）。

---

## 13. 验收测试方案

### 13.1 无头冒烟（`test/smoke.cjs`，Playwright）
- 环境已具备 Playwright + chromium；headless WebGL 用 `--use-gl=angle --use-angle=swiftshader`。
- 脚本为 `.cjs`（ESM 不读 NODE_PATH，须 `require`）。
- 预设相机位姿遍历 7 群系 + 4 树种 + 远景，逐一截图。
- 断言：`console` 零 error；关键 DOM（HUD/画布）存在；截图尺寸正常。

### 13.2 远景立体感专项
- 固定机位朝森林/雪山/巨树远景截图，**人工 + 像素方差**校验：远处非纯色平板（方差超阈值）、可辨树冠凸起/雪帽/地标剪影。不通过则迭代 LOD 特征记录与 Mesh 挤出，直到可辨。

### 13.3 性能自检（`test/perf.cjs`）
- 8192 视距下采集 FPS 曲线（≥10s），断言平均 FPS 达标且无长帧（>50ms）堆积；采集 §12 计时分布，输出瓶颈报告。

### 13.4 语法/单测
- 关键纯逻辑模块（noise/rng/greedy mesher/raycast/physics）抽 `LOGIC_START/END` 标记区，node 单测覆盖确定性（同 seed 同输出）与正确性。

---

## 14. 风险与对策

| 风险 | 对策 |
|---|---|
| 8192 视距显存/帧时爆炸 | 激进降采样 + 超级 Mesh 合批 + 雾遮 + 视距外零生成 |
| 贪婪合并抹平 AO | 合并键含 aoPattern |
| file:// 无法跑 ES 模块 | 启动.bat 本地服务器 + 单文件 dist 双方案 |
| Worker 回传主线程卡顿 | Transferable 零拷贝 + 每帧限量消费 |
| LOD 切换穿帮 | 重叠环 + 雾 + 新层就绪再卸旧层 |
| TAA 鬼影 | 邻域裁剪 + 静态世界假设（动态极少） |
| three addon 需联网 | 全部自研 pass，仅依赖 three 核心本地文件 |
