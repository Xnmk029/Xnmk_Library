# NOTES.md — 场景图、依赖更新架构与渲染管线说明

## 一、场景图（Scene Graph）

```
Scene
├─ HemisphereLight / AmbientLight / DirectionalLight(阴影) / SpotLight×2（仓库吊灯+灯罩/灯泡）
├─ studio（工作室道具，米制单位）
│   ├─ 地面 CircleGeometry(15m)+程序化网格贴图、背墙+侧墙、发光窗+窗棂
│   ├─ 工作台+4 腿、台上工具(InstancedMesh 细杆+头)、挂板+挂墙工具(实例化)
│   ├─ 货架+18 零件盒(InstancedMesh + setColorAt 分色)、轮胎堆×3、工具箱、纸箱×3、立式气筒
├─ bikeRoot（自行车根：scale=0.001 使内部使用 mm 建模；position.y=0.267m 使轮胎触地）
│   ├─ part:frame       —— 车架全管组/五通/勾爪/后夹器
│   ├─ part:fork        —— 舵管/叉肩/双叉臂/前夹器（沿转向轴分解）
│   ├─ part:headset     —— 上下碗+顶盖（沿头管分解）
│   ├─ part:wheelFront / wheelRear —— 胎/圈/花鼓/法兰/轴/辐条(InstancedMesh)/气嘴
│   ├─ part:discFront / discRear —— 镂空碟片+6 安装螺栓（沿 -Z 脱离花鼓）
│   ├─ part:cassette    —— 7–12 速齿轮片(每片按齿数生成)+锁环+塔基锥
│   ├─ part:crankDs / crankNds —— 中轴/曲柄/蜘蛛盘/牙盘(1/2/3)/盘钉；非驱动曲柄
│   ├─ part:pedalDs / pedalNds —— 脚踏（沿 ±Z 外移）
│   ├─ part:fd / rd     —— 前拨(1x 时为空组)/后拨(随飞轮最大齿经摆动)
│   ├─ part:chain       —— 链节 InstancedMesh（沿包角闭合样条）
│   ├─ part:cockpit     —— 把立/弯把/手变/刹把/把带(两段子曲线)/端盖
│   ├─ part:post        —— 座管/夹头/坐垫(参数化放样)/座弓（沿座管轴分解）
│   ├─ part:cables      —— 线管×3~4（沿车架折线；分解时隐藏）
│   └─ labelsGroup      —— 部件标签 Sprite（可选）
```

坐标约定：`+X = 车头方向，+Y = 上，+Z = 驱动侧（右）`；整车在 bikeRoot 内以 **mm** 建模，通过根缩放 0.001 与世界（米）无缝衔接。

### 关键派生点（单一事实源）
`solveFrame(state)` 在 XY 平面解出：BB(0,0)、头管上端 T=(reach,stack)、头管下端 B、前轴 A、后轴 Rr=(-chainstay, 70)、座管上端 S、上管衔点 J、下沉衔点 Jd、头管长/前叉长、轴距、转向轴/座管轴单位向量。**所有部件（车架、前叉、轮组、座舱、线管…）全部从这些点派生**，因此参数变化时天然对齐：
- 前叉=头管下端→前轴；前轮中心=前轴；碟片/夹器=前轴±偏置；舵管/把组=头管上端沿转向轴外延；
- 座管、坐垫、座弓=座管轴；中轴曲柄牙盘=BB；后拨/飞轮/后碟=后轴。

## 二、依赖更新架构（Declarative Part Registry）

```js
part(key, deps, build)  // parts[] = { key, deps, build, group }
rebuild(keys)           // 仅重建 deps 与变更键相交的部件
```

- **多控件 → 变更键**：滑杆/选择/取色写入 `state[k]` 后调用 `onKey(k,v)` → `rebuild([k])`。
- **几何键聚合**：Stack/Reach/头管角/座管长/座管角/后下叉/紧凑度/下沉 归为 GEOM_KEYS；任何键变化都会触发所有依赖几何的部件重建（如 chainstay → frame/fork/轮组/碟片/飞轮/曲柄?/FD/RD/chain/cockpit/post/cables 全部重建，保证 rear 端整体移动）。
- **依赖声明**：`cassette` 依赖 `speeds`+几何；`fd` 依赖 `rings`；`rd`/`chain` 依赖 `speeds`+`rings`；`cables` 依赖几何+把组参数+rings/speeds（其端点随把组/夹器/拨器）。
- **视觉键**：颜色/表面/色阶/轮廓 → `rebuild(['all'])`（全量重建，靠缓存保持廉价）。
- **缓存**：材质按 (color|finish|steps|carbon) 缓存；几何按参数签名缓存（锥形管、齿轮形、碟片、坐垫放样、工具/零件盒）；轮廓材质按线宽缓存；实例化对象（辐条/链节）每次重建但共享几何。
- **摄像机保持不变**：重建路径不触碰 camera/controls；只有用户点击相机预设（applyCam，含 0.55s 缓动）才改视角。
- **分解系统**：每部件在构建末尾 `markExplode(group, dir, dist)` 记录真实安装轴与距离；每帧按 `explosion.value`（0..1，指数缓动逼近 target）将 `group.position = base + dir·value·dist`。线管在分解>3% 时隐藏，避免不真实拉伸。

## 三、渲染管线（NPR 赛璐璐）

1. **色调分离**：`MeshToonMaterial.gradientMap` 使用程序生成的 1×N DataTexture（NearestFilter，2–5 阶可调，幂次重映射）。灯光（Hemisphere+Ambient+Directional+2 Spot）被量化成明暗色块，实现动漫式赛璐璐明暗分区。
2. **轮廓墨线**：inverted-hull —— 每个主体网格挂一个 BackSide `ShaderMaterial` 子网格，顶点着色器中在**世界空间**沿法线外推 `uW`（mm→m 换算，0.5–1.8mm），得到稳定、非均匀缩放安全的黑色轮廓；开关与线宽可调。
3. **阴影**：单一 DirectionalLight 投影（PCFSoft，2048 贴图，bias 校正），地面接收；`shadows` 开关只切换光源 `castShadow`（免材质重编译）。吊灯 SpotLight 不投影，避免重影。
4. **表面预设**：gloss=5 阶、matte=3 阶、metallic=4 阶+冷灰偏色+微弱自发光、carbon=3 阶+程序化 2D 碳纤编织贴图（canvas 纹理，RepeatWrapping）。
5. **像素化（可选）**：`renderer.setPixelRatio(0.22)` + `canvas.image-rendering:pixelated` 实现克制海报化；关闭时恢复 devicePixelRatio。
6. **输出**：`SRGBColorSpace` 输出、无 bloom/后处理（避免遮轮廓与过曝），明亮基线：浅灰背景+高环境光+白色地面网格。
7. **性能**：辐条/链节/工具/零件盒用 InstancedMesh；单位几何（锥形管/盒）实例级缩放复用；材质与几何缓存命中时重建为零新分配；每帧仅遍历 18 个部件组与 ~210 次 draw call（无头统计 210 calls / ~31k 三角形）。
8. **自测**：node --check + Node 无头 harness（stub DOM/WebGLRenderer，加载真实模块，21/21 断言）+ Puppeteer 真实 WebGL（SwiftShader）多视角截图与控制台错误捕获。
