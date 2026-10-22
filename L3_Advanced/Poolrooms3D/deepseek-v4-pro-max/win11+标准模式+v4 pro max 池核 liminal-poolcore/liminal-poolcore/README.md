# Infinite Liminal Poolcore — 无限边缘空间池核

> 程序化生成的无限室内泳池迷宫。Three.js r165 / WebGL2 / 纯 ESM，无构建步骤。
> 洁净、静谧、略带怪诞：全覆盖青色小方块瓷砖、天窗投下的实体光柱、水面的动态焦散与折射。

```bash
npm install          # 只装一个依赖：three@0.165.0
npm start            # → http://127.0.0.1:5177/
npm run check        # PCG 场域体检：几何连贯性规则 R1~R7 全量扫描（纯 Node，不需要浏览器）
npm run smoke        # 无头浏览器冒烟测试：启动链 + 帧推进 + chunk + draw call + Shader + 曝光回归
npm run probe        # 分段渲染探针：逐段/逐光源回读帧缓冲，定位画面偏亮偏暗出自哪一段
```

URL 参数：`?seed=1234`（世界种子）`&quality=0..3`（LOW/MEDIUM/HIGH/ULTRA）`&auto=0`（关闭自动画质治理）
自动化用：`&smoke=1`（定时器驱动帧循环 + 保留绘图缓冲）`&maxframes=N`（跑满 N 帧后停止）`&probe=1`（输出分段探针）

操作：`WASD` 移动 · `Shift` 疾行 · `Space` 跳跃/上浮 · `C` 下潜 · 左键在水面打涟漪 ·
`1/2/3/4` 画质档 · `F` 自动画质开关 · `R/O/G` 反射/AO/体积光 · `N` 换一个种子的新世界 · `Esc` 释放鼠标

---

## 一、架构总览

```
玩家移动
   ↓
Field（纯函数场：任意格坐标 → 地形/墙/道具决策）  ←── 碰撞查询也走这里（无碰撞网格）
   ↓
ChunkBuilder（纯数据：贪心矩形合并 → 实例矩阵 Float32Array，可搬进 Worker）
   ↓
ChunkManager（流式加载/卸载 · chunk LOD · 逐 mesh 包围球 + chunk 级视锥剔除）
   ↓
InstancedMesh（几何体全局共享；着色全部由世界坐标/法线推导）
   ↓
渲染管线：焦散RT → 折射RT → 反射RT → 遮挡RT → 主渲染 → GTAO → 体积光 → 水下滤镜 → Bloom → ACES → SMAA
   ↓
PerfGovernor（观察帧时间中位数，在 4 个画质档之间升降）
```

| 文件 | 职责 |
| --- | --- |
| `src/config.js` | 世界尺寸、玩家参数、4 档画质预设、渲染常量 |
| `src/core/Noise.js` | Simplex 2D/3D、fbm/ridged/billow、整数哈希、Worley（零依赖、可自检） |
| `src/gen/Field.js` | **PCG 规则引擎**：房间 Voronoi、池型/池深分层、平台楼梯、墙与门洞、柱/窗/天窗 |
| `src/gen/ChunkBuilder.js` | 分块装配：贪心矩形合并、窗洞开凿、道具放置规则、打包实例数据 |
| `src/gen/Elements.js` | 元素库几何（18 种，各 3 档 LOD，组合体已 merge 成单几何） |
| `src/core/ChunkManager.js` | chunk 生命周期、LOD 换档、剔除、GPU 资源精确释放 |
| `src/core/PerfGovernor.js` | 帧时间中位数驱动的画质升降档 |
| `src/render/Textures.js` | 全部贴图程序化生成（瓷砖 PBR/法线/粗糙/AO、泡沫、窗外风景、环境球、蓝噪声） |
| `src/render/Materials.js` | 三平面瓷砖材质 + 焦散 + 水下吸收 + 湿滑，链式包住 CSM 的 onBeforeCompile |
| `src/render/Water.js` | 水面 Shader：屏幕空间折射、平面反射、Fresnel、厚度吸收、局部涟漪、水下 Snell 窗 |
| `src/render/Caustics.js` | 可平铺动态焦散图生成器（256² RT，一次全屏 quad） |
| `src/render/GodRays.js` | 体积光：遮挡图（全黑覆盖 + 天窗层纯白）+ 径向散射 + 加性合成 |
| `src/render/PostFX.js` | EffectComposer 链、GTAO、水下滤镜、Bloom、OutputPass、SMAA |
| `src/render/Sky.js` | CSM 级联阴影（含无 addon 时的单级联降级）、IBL 环境光、雾 |
| `src/player/Player.js` | PointerLockControls + 解析碰撞 + 抬腿 + 涉水/游泳/涟漪 |
| `src/ui/Hud.js` | 性能面板、操作提示、准星、开始遮罩 |
| `src/react/PoolcoreCanvas.jsx` | React / R3F 两种集成方式（自持循环 / 挂进现有 Canvas） |
| `tools/check-field.mjs` | PCG 规则全量扫描（Node 端） |
| `tools/smoke.mjs` | 无头浏览器冒烟测试（含帧缓冲回读的曝光/对比度回归） |
| `tools/probe.mjs` | 分段渲染探针（逐段 + 逐光源分解） |
| `tools/analyze-shot.mjs` | 零依赖 PNG 解码 + 像素统计 + ASCII 亮度图 |
| `tools/serve.mjs` | 零依赖静态服务器（ESM 必须经 http 加载） |

---

## 二、PCG：为什么它能"无限"且"连贯"

### 1. 纯函数场（本项目最重要的一个决定）

世界内容是 `f(cx, cz)` 的**纯函数**，与 chunk 划分完全无关：

```js
field.cell(cx, cz, out)   // → { kind, floorY, tier, water, waterDepth, wall, wallTop, ... }
```

由此得到三个免费的好处：

1. **接缝天然吻合**：任何 chunk 在任何时刻、任何顺序生成，边界都必然一致——不需要接缝缝合、不需要邻块通信。
2. **碰撞零成本**：玩家碰撞直接查同一批函数（`isSolid / floorYAt / waterDepthAt`），不生成任何碰撞网格，也不受"chunk 还没加载完"影响。
3. **可验证**：`node tools/check-field.mjs` 能在 Node 里对 242m×242m 范围做全量规则扫描（当前 seed：水域 48.8%、墙体 13.9%、平均水深 0.93m、最深 4.5m）。

### 2. 层级生成

| 层 | 手段 |
| --- | --- |
| 房间划分 | 抖动 Voronoi（房间格 12 格 = 24m），房间中心**量化到整格**，5 种房间性格：主泳池厅 / 涉水浅池 / 柱厅 / 平台房 / 深潭 |
| 大尺度分区 | 低频 fbm 决定某片区域偏"深潭"还是偏"浅水柱厅"，避免全图匀质 |
| 池型 | `rect` / `round` / `L` / `irregular`（fbm 扰动后再量化到整格），四种都保证边界落在格线上 |
| 池深 | 由"到池边的格距离 / 每层宽度"得层级 → **多层阶梯式池壁**（tiered pool steps）自然产生 |
| 平台 | 抬升矩形 + 强制配套楼梯带（级数刚好覆盖高差） |
| 墙 | Voronoi 边界带（约 1 格厚），门洞由 3×3 格粒度的量化哈希开出（能穿透任意朝向的墙带） |
| 道具 | 柱（按房间格相位成柱廊）、窗、天窗、水下拱门、栏杆、跳板、池梯、阳台、奇异几何体 |

### 3. 规则引擎（几何连贯性）

生成器不是"随机撒东西"，而是一组硬约束，`tools/check-field.mjs` 会逐条验证：

| 规则 | 内容 | 实现方式 |
| --- | --- | --- |
| **R1** | 墙不悬空 | 先算地形再叠加墙，墙的底面 = 该格地板/池底高度 |
| **R2** | 柱子顶天立地 | 柱高 = `ceilingY - floorY`；深水与墙内不生成柱 |
| **R3** | 池边/池深严格对齐 | 池边界量化到整格，池深量化到 `tierStep` 整数倍 |
| **R4** | 平台必可上下 | 楼梯带级数覆盖高差，相邻格高差 ≤ `stairRise` |
| **R5** | 池体互相连通 | 深水（>1.6m）处的墙自动让位，改为水下拱门通道 |
| **R6** | 光柱一定落进水里 | 天窗只开在水面/池畔上方 |
| **R7** | 窗必须能看见风景 | 窗只开在"单格厚"的墙上（两侧对穿），窗洞拆成窗台/窗楣/双窗垛四块砌出 |

---

## 三、渲染：无限规模的实例化策略

### 1. 结构 = 被缩放的单位立方体 + 世界空间三平面映射

一个 20×20 格的 chunk 有 400 个地板格、上百段墙、400 格天花。逐格一个实例太浪费，
所以先做**贪心矩形合并**（greedy meshing）：把"高度 + 湿滑度相同"的相邻格并成矩形。

```
400 格地板 + 天花 + 墙  →  通常 30~80 个实例（同一个 24 顶点的立方体几何）
                        →  整块地形 1 次 draw call
```

关键点：**丢弃网格 UV，改用世界坐标三平面投影采样瓷砖贴图**。

* 瓷砖尺寸恒定 25cm，无论墙多长、池多深都不会被拉伸；
* 跨实例、跨 chunk 完全连续，看不到接缝；
* 于是所有 chunk 可以**共享同一个几何体**——几何显存约等于零；
* 法线贴图用 Whiteout blend 做三平面混合（Ben Golus 方案），勾缝凹槽在任何朝向的面上都正确。

### 2. 高度差自动成墙

每个地板矩形都是"从 `solidBase` 长到 `floorY` 的实心盒子"。相邻矩形高度不同时，
高的那个盒子侧面**天然就是瓷砖池壁**——多层阶梯池壁、平台侧面、台阶立面全部免费，
不生成任何额外几何。

### 3. 逐实例属性：一个都不用

颜色差异、湿滑、脏化、焦散、水下吸收，全部由 shader 从**世界坐标 + 世界法线**推导：

* 湿滑 = 距水线的高度函数（越靠近水面越湿、水平面比竖直面更湿）
* 房间尺度色温差异 = 20m 级低频噪声
* 脏化 = 两个不同频率噪声的乘积

代价是几次算术，收益是**几何体可以全局共享**（否则每个 chunk 都得克隆一份带属性的几何体）。

### 4. 剔除

| 层级 | 手段 |
| --- | --- |
| chunk 级 | `Frustum.intersectsBox(chunkAABB)` → 不可见整块 `group.visible = false`，连遍历都省 |
| mesh 级 | 共享几何体时给每个 `InstancedMesh` 单独写 `mesh.boundingSphere`（three r158+ 的 Frustum 优先用它）→ 引擎自带剔除在**相机与阴影两条通道**都精确生效 |
| LOD | chunk 三档：FULL（全道具）/ MID（去栏杆跳板阳台奇异体，几何降档）/ FAR（只留结构+水+柱） |
| 距离 | 视距由画质档控制（2~4 chunk = 80~160m），配合指数雾掩盖弹入 |

### 5. 流式调度

* 生成走 **生成器（`function*`）**，8 个阶段之间 `yield`；
* `ChunkManager` 每帧只花 `PERF.chunkBudgetMs = 4ms` 推进，且每帧最多完成 2 个 chunk（限制 GPU 上传尖峰）；
* 入队按"距离 + 是否在相机前方"排序，转身时优先补视线内的块；
* 卸载有 1 chunk 滞后，避免站在边界抖动；
* LOD 换档**先建后换**，不会出现空洞；
* 释放时只 `InstancedMesh.dispose()`（精确删除 instanceMatrix 的 GPU buffer），**绝不 dispose 共享几何体/材质**。

---

## 四、光影与水体

### 水面（`src/render/Water.js`）

水位是全局平面 `y = 0`，这个简化带来了一整套廉价而正确的做法：

| 效果 | 做法 |
| --- | --- |
| 折射 | 隐藏水面渲一遍场景到半分辨率 RT（含 `DepthTexture`），片元按扰动屏幕 UV 采样；采到"比水面更近"的像素时回退到未扰动 UV，杜绝漏色 |
| 厚度/吸收 | 用深度纹理反算沿视线的水体厚度 → Beer–Lambert 指数吸收 + 向深水色渐变 |
| 反射 | 镜像相机（位置/朝向/up 全部关于水面镜像）+ 斜切裁剪面只渲水上部分 → `textureMatrix` 投影采样，几何上精确 |
| Fresnel | Schlick，F0 = 0.02，与反射强度联动 |
| 波形 | **解析法线**（4 层方向性正弦），不做顶点位移 → 水面网格是最廉价的平面实例，且跨实例天然连续 |
| 局部涟漪 | 8 个环形缓冲波源（脚步/入水/点击），按距离与时间双指数衰减，只在波前附近有位移 |
| 池边白沫 | 由"水体极薄"判定 + 泡沫噪声调制 |
| 水下视角 | Snell 窗 + 全内反射：视线越贴水平越接近全反射，越垂直越透出水上房间 |

### 焦散（`src/render/Caustics.js` + `Materials.js`）

不逐表面算焦散，而是每帧把一张 **256² 可平铺** 的动态焦散图渲进 RT（一次全屏 quad），
所有水下表面按世界 XZ 投影采样它，两次不同缩放混合消除平铺感，随深度指数衰减、随法线朝上程度增强。
可平铺的关键：所有波形只用**整数频率**的 sin/cos，且缩放系数量化为整数——否则接缝必现。

### 体积光（`src/render/GodRays.js`）

1. 遮挡图（低分辨率）：Pass A 全黑材质覆盖整场景（只为写深度），Pass B 只渲天窗层纯白（depthTest 开）。
   遮挡通道用一台 `far = 110m` 的克隆相机 → 远处 chunk 自动被剔除，省掉一半开销。
2. 以**太阳方向的屏幕消失点**为中心做两次 ping-pong 径向散射（拖尾更长、成本只翻一倍），蓝噪声抖动消除环带。
3. 加性合成，按"视线与太阳贴合度"淡入淡出；水下换成偏青、更柔的光柱。

太阳是平行光，所有光柱共享同一个消失点——这正是径向模糊在物理上成立的原因。平视时消失点在屏幕外，
模糊方向自然变成自上而下，光柱依然正确。

### 级联阴影 CSM（`src/render/Sky.js`）

直接用官方 `three/addons/csm/CSM.js`（practical 分割，2~4 级）。两个坑本项目已处理：

* `csm.setupMaterial(material)` 会**覆写** `material.onBeforeCompile` ——
  所以必须先 `setupMaterial`，再把我们的 shader 注入**链式**叠上去（见 `Materials.js` 的 `patchMaterial`）。
* addon 缺失时自动降级为"单级联 + 视锥拟合 + 纹素吸附"的方向光阴影，不会让整个应用崩掉。

### 色调映射只做一次

three r152+ 只在"渲染到画布"时给材质编译 tone mapping，渲染进 composer 的 RenderTarget 时自动跳过；
所以 `renderer.toneMapping = ACESFilmic` 由链尾 `OutputPass` 统一执行，不会双重映射。

### 配光标定（很关键，别照抄"三光全开"）

天花板挡住阳光是这套美学的支点：**室内基调由弱半球光 + 低强度 IBL 支撑，阳光只从天窗漏进来**。
环境光/半球光/IBL 三样只要有一样开大，室内就会被"填平"成没有对比度的过曝白。
本项目的实测标定（无头帧缓冲回读，640×420）：

| 配置 | 亮度均值 | 标准差 | 结论 |
| --- | --- | --- | --- |
| ambient 0.55 + hemi 0.85 + IBL(全强) | 213 | 11 | ❌ 一片过曝白，看不见结构 |
| 同上但关掉 IBL | 81 | 61 | 对比极强（说明 IBL 是元凶） |
| 只留阳光 | 43 | 78 | ✅ 天花板阴影正确，光柱清晰 |
| **最终**：ambient 0.12 + hemi 0.45 + IBL 0.18 + sun 3.2 + exposure 0.95 | **123** | **27** | ✅ 洁净明亮又有纵深 |

`npm run smoke` 会把"亮度均值 40~205、标准差 > 15、色阶 > 200、B ≥ R"作为**防回归断言**锁住这套标定。

---

## 五、性能治理

`PerfGovernor` 每帧吃帧时间，用**中位数**（对 GC / shader 编译尖峰免疫）决定升降档，
p95 作为二次确认，换档后有 1.4s 冷却。一个档位同时描述所有旋钮：

| 档位 | pixelRatio | 视距 | 阴影 | AO | 体积光 | 反射 | 焦散 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LOW | 0.75 | 2 chunk / 80m | 1024×2 级 | 关 | 0.35×, 24 采样 | 关 | 128² |
| MEDIUM | 1.0 | 3 chunk / 120m | 1536×2 级 | 0.5× | 0.5×, 32 采样 | 0.35×, 隔帧 | 192² |
| HIGH | 1.0 | 3 chunk / 120m | 2048×3 级 | 0.75× | 0.5×, 48 采样 | 0.5×, 每帧 | 256² |
| ULTRA | 1.25 | 4 chunk / 160m | 2048×4 级 | 1.0× | 0.6×, 64 采样 | 0.6×, 每帧 | 320² |

一帧的几何通道数：折射 1 + 反射 0~1 + 遮挡 2（其中一次是最廉价的全黑材质）+ GTAO 预通道 1 + 主渲染 1。
这是"折射/反射/体积光/AO 全都要"的必然代价，因此每一项都可被档位降频、降分辨率或直接关闭。

---

## 六、开发过程中踩到并修掉的 three.js 真实坑

这些都是本项目在真机/无头回归里**实测**出来的，不是推测；每一条都留了对应的防回归断言。

### 1. `material.envMapIntensity` 会被 `scene.environmentIntensity` 静默覆盖（r163+）

`WebGLRenderer.js` 里有一段：

```js
if ( material.isMeshStandardMaterial && material.envMap === null && scene.environment !== null ) {
  m_uniforms.envMapIntensity.value = scene.environmentIntensity;   // ← 覆盖材质自己的值
}
```

**症状**：调材质的 `envMapIntensity` 完全没反应；室内被 IBL 填成一片没有对比度的过曝白。
实测：`ambient 0.55 + hemi 0.85 + IBL` → 全屏亮度 **213/255、标准差仅 11**，
把 `scene.environment` 置空后立刻变成 **80.8 / 标准差 60.9**（对比强烈、光柱清晰）。
**修法**：`Materials.setEnvironment(envMap)` 把 PMREM 贴图显式挂到材质上，材质级强度即刻生效
（tile 0.18 / metal 0.5 / gloss 0.65），`scene.environmentIntensity` 只留作兜底。
**标定后**：亮度 122.7 / 标准差 27.3 / 339 色阶。

### 2. 阴影贴图会在每次 `renderer.render()` 里重算

本引擎一帧有 4 个几何通道（折射、反射、遮挡×2、主渲染），默认行为等于**阴影渲 4 遍**。
**修法**：`shadowMap.autoUpdate = false`，每帧只在第一个通道前 `needsUpdate = true`。
实测 draw call 从 830 降到 502（LOW 档）。

### 3. `CSM.setupMaterial()` 会覆写 `material.onBeforeCompile`

先 `setupMaterial`，再把自己的注入**链式**叠上去（`patchMaterial` 里 `prev.call(this, shader, renderer)`），
否则要么丢级联阴影，要么丢三平面瓷砖。

### 4. `objectNormal` 在 `MeshBasicMaterial` 的顶点着色器里不存在

它只在 `USE_ENVMAP || USE_SKINNING` 时才由 `<beginnormal_vertex>` 定义。
而 `attribute position/normal/uv` 是 three 无条件注入的 —— 所以顶点注入统一用 `normal`。
（实测报错：`ERROR: 0:574: 'objectNormal' : undeclared identifier`）

### 5. 无头环境：`requestAnimationFrame` 不被驱动 + 画布内容不进截图

* 没有合成器时 rAF 永不触发 → 引擎带**驱动器降级**（1 秒内没帧就切定时器），`?smoke=1` 直接用定时器。
* `preserveDrawingBuffer` 默认 false，循环停下后画布内容失效 → 冒烟模式打开它。
* SwiftShader 软件渲染下 `--screenshot` **不会**把 WebGL 画布合成进去（截图只有 DOM）
  → 因此视觉回归改用页面内 `gl.readPixels` 直读默认帧缓冲，并输出 ASCII 亮度图。
  `tools/analyze-shot.mjs` 仍保留，供有真实 GPU 的环境做外部截图分析。

### 6. 上下文属性由 `canvas.getContext()` 决定

给 `WebGLRenderer` 传了 `context` 之后，renderer 自己的 `antialias/preserveDrawingBuffer` 选项就不再生效，
必须写在 `getContext('webgl2', {...})` 里。

### 7. 已经锐化过的焦散图不要再平方

`CausticsGenerator` 输出的图本身做过增益标定（p50≈0.15 / p99≈1.05 / max≈2.5）。
材质里若再 `caus * caus`，中间调会被压死 —— 实测焦散只贡献 **+2.3 亮度 / +1.8 对比度**，肉眼几乎不可见。
改成 `pow(caus, 1.35)` 并把强度提到 1.5 后：**+6.9 亮度 / +5.9 对比度**，整帧标准差 27.3 → 30.1。
（量测方式：`npm run probe` 在同一机位渲两次，只切换 `uCausticsIntensity`，差值即焦散的真实可见度。）

---

## 七、可替换的 PBR 占位参数

贴图全部程序化生成（`src/render/Textures.js`），若要换成真实 PBR 贴图，替换点只有一处：

```js
// src/main.js
const textures = createProceduralTextures({ ... });
// ↓ 换成你的加载器，保持同名字段即可（tileMap/tileNormal/tileRough/tileAO/foam/vista/skyEquirect/blueNoise）
```

要求：`tileMap` 为 sRGB、其余为 NoColorSpace，全部 `RepeatWrapping`；
瓷砖贴图需**可无缝平铺**（世界空间三平面映射会把它按 2m 一张铺满整个世界）。
调色板见 `DEFAULT_PALETTE`，瓷砖密度见共享 uniform `uTileScale`（0.5 = 每 2m 一张 = 每砖 25cm）。

## 八、已知取舍

* **水面不写入 GTAO 的法线**：水是自定义 ShaderMaterial，GTAO 预通道用 `MeshNormalMaterial` 覆盖渲染，
  水面法线是几何法线（平的）而不是波法线。视觉上无碍（AO 主要作用于柱脚/台阶）。
* **平面反射只对全局水位成立**：这是池核题材的合理假设；若要多水位（分层水池），需要按水位分组多张反射 RT。
* **体积光是屏幕空间近似**：会在遮挡边缘有轻微光晕溢出，这也是该风格常见的观感取向；若要严格正确需上 raymarch + 阴影图采样。
* **ChunkBuilder 还没搬进 Worker**：它已经是零 three 依赖的纯数据函数，搬进 Worker 只需把生成器换成消息往返；
  当前用帧预算切片已能稳住不掉帧，故保持简单。
* **本机验证是在软件光栅（SwiftShader）上做的**：功能与画面统计可信（帧缓冲回读），但 FPS 数字不可信。
  真实 GPU 上的性能请以浏览器里 HUD 显示的中位帧时间为准，`PerfGovernor` 会自动找到合适档位。

---

## 九、验证记录（可复现）

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 13 项全过：R1~R7 规则零违例、纯函数场一致、多 seed 稳健、柱子碰撞盒=视觉尺寸（抽查 40 根）、`cell()` 4.2µs/格（单 chunk 场域 1.7ms） |
| `npm run smoke --quality=0` | 17 项全过：25 chunk / 1859 实例 / 17.3 万三角 / 502 draw call / 13 program |
| `npm run smoke --quality=2` | 17 项全过：42 chunk / 3610 实例 / 94.8 万三角 / 1548 draw call / 33 program / 亮度 125.4 std 30.1 / 349 色阶 |
| `npm run smoke --quality=1 / 3` | 全过：831 / 1721 draw call，四档曝光一致（122~133）→ 档位只改成本、不改观感 |
| `npm run probe` | 13 段分解全部有响应：`sun-only` std 78（天花阴影正确）、`underwater-view` RGB 52/114/131（水下吸收生效）、焦散开关差值 +6.9 亮度 / +5.9 对比度 |

> 数字来自本机无头回归（Chrome + SwiftShader，640×420）。draw call 是**整帧所有通道之和**
> （`renderer.info.autoReset = false`），不是单通道数值。
