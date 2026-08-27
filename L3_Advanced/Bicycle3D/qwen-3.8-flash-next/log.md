# ws-bicycle · L3「自行车：参数化 3D 工作室与装配模拟器」作答记录

- 受测模型自报：`qwen3.8-flash`（逐字取自运行时上下文「You are a coding agent powered by the qwen3.8-flash model.」）
- 题目：`task.md` 全文（题面原文 + README 评分参考），作为唯一标准
- 交付：`answer.html`（124,869 bytes，单文件）、`result.json`、本文件
- 时间线：读题 → 定架构 → 分 11 片写入 `parts/` → node 拼装 → `node --check` → 无头求解器测试（56 项）→ 无头场景冒烟测试（15 项）→ 定向修补 → 复核 → 清理

---

## 一、过程记录（中文）

### 1. 拆解与预算纪律
题面体量大（约 30 个部件族 + 30 个参数 + 七组 UI + 分解动画 + NPR），历史失败根因是「一次性重写超大 HTML 导致预算耗尽」。因此从第一步就按分片写作：

```
parts/00_head.html   DOM 骨架 + 全套 CSS + importmap + 全局 error 钩子
parts/10_core.js     数学助手 / renderer / 相机 / OrbitControls / 灯光 / LUT 与程序化贴图 /
                     材质注册表 / 几何缓存 / setSeg·setTorus·gearGeo·hull·inst 等建模 kit
parts/11_env.js      仓库工作室道具（地面·墙·海报·高窗·货架·工作台+台钳·洞板工具·维修架·胎堆·盆栽·凳·吊灯·打气筒）
parts/20_params.js   参数状态 DEFAULTS/P + solve() 几何求解器 + massEstimate() + cfgText()
parts/30_frame.js    装配轴注册表(part/place/syncPart) + 车架全管组 + 前叉 + 碗组 + 轮组(圈/花鼓/辐条/胎/内胎/气嘴)
parts/40_drivetrain.js 中轴 + 曲柄/牙盘/脚踏 + 锥形塔基飞轮 + 后拨 + 前拨 + 链条(凸包+实例化链节) + 传动比运动学
parts/50_cockpit.js  把立 + 弯把/把带/把堵/线管座 + 手变与刹把 + 座管/坐垫/滑轨 + 镂空碟片 + 夹器(碟/圈) + 5 条线管
parts/60_assembly.js updateAll 编排 + 分解动画 + 投影标签 + 相机预设补间 + 规格 HUD/重量条 + audit() 自检
parts/70_ui.js       七组控件的声明式构建器 + 配色/表面预设 + 规格表复制
parts/80_render.js   后处理(NPR 量化/像素化/饱和/暗角) + 主循环 + 指标条 + 快捷键 + window.__BIKE__ 测试面
parts/99_tail.html   </script></body></html>
```
每片只写一次、不回溯整文件重写；改动一律走「定点 edit / 小 patch 脚本」。拼装脚本 `build.js` 负责顺序 concat + 校验（分片数、`<script>` 配对、`</html>` 闭合、TODO/FIXME/placeholder/空函数体扫描、字节数）。

### 2. 校验与踩到的真问题（都修了，非纸上谈兵）
1. **`node --check`** 通过；build.js 报出 1 处「空箭头函数体」残留（`Object.keys(CAM_PRESETS).forEach(k=>{})`）→ 删除。
2. **未声明变量赋值**（strict mode 会 ReferenceError）：`CAS.free.quaternion.copy(q = axisQ(...))` → 改为块内 `const qf`。
3. **实例化计数陷阱**：`inst()` 建好即被 `fin()` 收缩 `count`，下一轮 `put()` 越界静默丢件 → 增加 `userData.max` 作为写入上限，`fin()` 只改可见数量（链条/螺栓/辐条才不会被逐轮截断）。
4. **轴向错配（最严重的一类）**：`THREE.TorusGeometry` 的环面在 XY、法线 +Z，而本车模型的车轴就是 Z。原先给轮胎/内胎多加 `rotation.x=π/2` 会让胎「平躺」；`gearGeo/rotorGeo` 用 ExtrudeGeometry 已经沿 +Z 挤出，却又被 `setFromUnitVectors(UP, Z)` 转倒。逐一改正（胎与碟片改回恒等朝向，飞轮/导轮齿片同理，只保留 Lathe 圈需要的 π/2）。
5. **螺栓朝向**：`GEO.seg6` 是沿 Y 的单位圆柱，多处 `put(...)` 传 `undefined` 朝向 → 统一改为共享四元数 `UPZ`（盘钉、五通螺栓、飞轮/碟片螺栓、后拨笼板螺钉、把立面盖螺钉）。
6. **参数脏值**：`clamp(undefined, a, b)` 旧实现原样返回 NaN → 改为非有限值回落到区间中值；随即 9 类垃圾输入 × 9 个参数全部不再产生 NaN。
7. **重量模型 NaN**：`[0,118,172][p.rings]` 在 3 片时越界 → 改 `{1:118,2:172,3:238}` 表。
8. **头管长度对紧凑度不敏感 / 后拨笼长不随齿容变化** → 提升敏感系数（0.055 m 行程、cage = 0.040 + cap×0.00075），断言才真正能测到「参数有效果」。
9. **分解动画与几何更新争抢 position** → 改为「布局写 `userData.home`，分解写 `home + off·dist·t`」的双源合成；`t=0` 时严格回到 home，矩阵可逐元素复位。
10. **指标条失真**：两 pass（主场景 + 后处理）会用后处理的 1 draw call 覆盖真实数字 → 主场景 pass 后立刻快照 `renderer.info`，再关掉 `autoReset` 跑合成。
11. **视角与传动侧**：传动件在 −Z（DRIVE=−1），故 hero 机位与全套相机预设移到 −Z 侧，工作室道具整体 `rotation.y=π` 移到车后，维修架单独反 rotation 避免挡镜头；后花鼓驱动侧法兰符号与飞轮同侧。

### 3. 测试结果（全部为可复跑的实测，不是估计）
- `node geo-test.mjs` → **ALL PASS 56 checks**：30 参数 × min/mid/max 有限性与工程区间、9 类垃圾输入、锚点对齐（链支/两轴等高/勾爪/轮地相切/头管顶点=stack·reach）、6 组「参数改了几何就真的动」差分断言、1×12 / 2×11 / 3×9 的片数·总宽·间距·锥度·链线·档位文本、换档后 RD 导轮平面与所选 cog 严格同面、5 个方向的重量响应。
- `node smoke.mjs` → **SMOKE ALL PASS 15 checks**：模块可加载、场景 399 可视网格 / ~5.9 万三角面、启动无 NaN、车贴地、七组 UI 节点数==7、34 参数 min/mid/max 全量重建无 NaN、离散开关（dropped/rim-disc/1×3×/背景/线框/阴影/表面/波段数/车架显隐）全通过、21 组分解位移≥10 且中间态单调、**复位后世界矩阵漂移 <1e-6**、几何编辑不动相机、7/9/11/12 速 cogs==HUD==RD、标签/相机/audit/reset 干净、页内 audit 11 项全绿。

---

## 二、按题面要求的中文说明

### 场景图（scene graph）
```
scene ─ bgTex(渐变天空) / fog / key+fill+rim+hemi
 ├─ envRoot (rotation.y = π)         仓库工作室道具，纯程序化；非 studio 背景时整体隐藏
 └─ bike    (position.y = GROUND_Y − solve().groundY)   ← 车轮直径/胎宽变化时整车自动贴地
     ├─ frameG   车架：头管/上管/下管/座管/左右座支/左右链支/五通壳/叉片/碟座/水壶柱/座管夹/螺栓
     ├─ forkG    前叉：转向管(碳纤维)/叉冠/左右叉腿/叉片/桶轴/侧标
     ├─ headG    碗组：下杯/上杯/下挡圈/顶盖/1–4 片垫圈/顶盖螺栓
     ├─ wheelF ─ rotorF            前轮（圈=Lathe 截面 / 胎+内胎=Torus / 花鼓+双法兰 / 24 实例辐条 / 气嘴+气帽 / 圈贴）
     ├─ wheelR ─ rotorR ─ casG     后轮 + 飞轮（cogs 沿 Z 堆叠 + 锥形塔基 + 锁环 + spider）作为子节点，随轮同转
     ├─ bbG / crankR ─ ring0..2 + pedalR / crankL ─ pedalL   中轴与曲柄组（曲柄组自带 rotation.z = 曲柄角）
     ├─ chG     链条：凸包曲线 → TubeGeometry 滚子 + 内/外链节两套 InstancedMesh
     ├─ rdG / fdG                后拨（挂钩·膝关节·平行四边连杆·双齿导轮·笼板）/ 前拨（抱箍·内外笼板）
     ├─ stemG / barG             把立（含面盖螺栓）/ 弯把（把管 + 左右把带 + 把堵 + 线管座 + 两只手变组）
     ├─ seatG                    座管（沿座管轴两段 + 后移折角）+ 坐垫（挤出泪滴壳 + 底壳 + 滑轨 + 4 螺栓）
     ├─ brakeG                   前后夹器，disc/rim 两种真实形态互换
     └─ cabG                     前刹/后刹/后拨/前拨/Loop 五条线管 + 露出的内线
```
每个装配组都是 `bike` 的直接子节点（或挂在轮/曲柄之下以共享旋转），**局部坐标即车身坐标**（五通 = 原点，+X 向前，+Y 向上，−Z 为传动侧），因此「安装轴」就是一个常向量，分解动画无需再解世界矩阵。

### 依赖更新架构（单向前推，无手写联动表）
1. **唯一事实源**是 `P`（约 30 个参数）。UI 控件只做两件事：写 `P[key]`、`requestUpdate()` 置 `dirty`。
2. 主循环每帧最多一次 `updateAll()`（拖动滑杆天然合帧，不会一帧重算多次）。
3. `updateAll()` 第一行 `L = solve(P)`：一次纯函数求解，产出**全部锚点与派生量**（头管顶 A、头管底 B、前轴 FA（含 rake/拖曳距反解）、后轴 RA、上管两端、座支桥点、座管顶、坐垫中心、把横中心、飞轮齿面 z 表、链线、后拨枢轴与双导轮、轮半径、地面高度、管长合计……）。UI 层不允许读取彼此控件状态，只读 `L`。
4. 之后按固定拓扑序调用 17 个 `layoutXxx()`：车架→前叉→碗组→前后轮→中轴→曲柄→飞轮→后拨→前拨→链条→把立→把横→座垫→左右碟片→夹器→线管。下游依赖上游锚点，但都只读 `L`，彼此不互相查询，因此不存在环依赖与「谁最后写谁赢」的问题。
5. 部件定位手段统一：`setSeg(mesh, a, b, r)` 用单位圆柱按两点定向/定长/定粗；`setTorus/gearGeo/setTube` 只在参数键变化时重建几何并 dispose 旧的；`inst()+put()+fin()` 写实例矩阵。
6. 收尾三件事：`syncHulls()`（按父节点当前 scale/新几何重算墨线）、`syncAll()`（把 `home + off·dist·smooth(t)` 写回每个装配组，实现分解与几何更新互不覆盖）、`updateSpecs()/updateLabels()`（HUD、重量条、标签）。
7. **相机与几何解耦**：`camera/controls` 只在 `flyTo()` 补间与 OrbitControls 阻尼里改变；`updateAll()` 全程不触碰，测试已断言。
8. **运动学联动**：`SPIN_A`（曲柄角）经 `gearRatio() = 前齿/后齿` 映射到前后轮转角；飞轮、碟片是轮/曲柄的子节点，因此自然继承旋转。

### 渲染管线（每帧两 pass）
1. **材质层**：所有车体件用 `MeshToonMaterial` + 程序化 `gradientMap`（2–5 阶 Cel 阶梯，由 canvas 生成、`NearestFilter` 无插值）；阶梯曲线按表面预设切换（gloss 高反差、matte 柔和、metallic 深暗带、carbon 强对比 + 碳布贴图），实现「色块分区 + 明暗硬边」。
2. **墨线层**：关键件挂一枚几何副本子网格，材质为 `BackSide` 纯墨色，按父节点当前 scale 与包围盒做逐轴 `1 + t/半程` 外扩（inverted hull），线宽由 Render Style 滑杆 0–3 实时控制，`renderOrder=-2` 先写深度。
3. **主 pass**：`renderer.render(scene, camera)` 渲入 HalfFloat + MSAA(4) 的离屏 RT；此处快照 `renderer.info`（draw call / 三角面 / 几何 / 贴图数）供指标条。
4. **合成 pass**：全屏四边形 `ShaderMaterial` 依次做 ① 可选像素化（UV 网格量化，默认关）② ACES 色调映射 + 曝光 ③ 色阶量化 posterise（色调分离，默认 7 阶）④ 饱和度 ⑤ 轻微暗角 ⑥ gamma 编码输出。灯光保持高位、量化阶数不高、像素化默认关闭，以守住「明亮可读基线、不吞结构」。
5. **叠加层**：DOM 侧另有网点 `#grain`（multiply 混合）与 15 条沿装配轴投影的组件标签（`Vector3.project`）；阴影由 `PCFSoftShadowMap` 单光源 1024² 提供，可一键关闭。
6. 性能策略：几何/材质集中缓存复用、辐条与链条与螺栓全部 InstancedMesh、布局改动只在 dirty 帧重建、`setPixelRatio` 上限 2。

---

## 三、四条【诚信声明】（逐条对应 `result.json.integrity`）

1. **`read_files_outside_workspace = false`**：全过程只读写 `F:\benchmark\暂存\qwen-3.8-flash-next-20260827\ws-bicycle\` 内自己的文件。未读取/列举/搜索 `L3_Advanced/Bicycle3D`、`BicycleDrivetrain`、其他 L1–L4 批次、`iso-test/bicycle-split`、`tools`、`Vision`、`DOMAIN_INDEX*.md`、`index.html`、`.git`、`.pi`，也未触碰 `C:\Users\Administrator\.dsh`（含 sessions 中其他模型的同题作答）。所有 `read/glob/grep/edit/write/pwsh` 目标路径都在工作目录内；`pwsh` 仅用于本目录的 node 脚本，未做列盘、目录遍历、进程或环境变量勘察、凭据文件读取。
2. **`used_git_history = false`**：未执行任何 git 命令（含 status/log/show/worktree/checkout），未读取 `.git` 对象或任何历史版本；全部代码为本次会话从零生成。
3. **`created_subagents_or_workflows = false`**：未调用 subagent / subagent_next / subagent_fork / workflow / ralph / list_agents / send_message / interrupt_agent / job_* / dev_* / create_goal / update_goal，未并行任何子代理，本次作答唯一作答者为我自己。
4. **`used_external_model_or_web = false`**：未调用 qwen_chat / qwen_generate / qwen_vision / qwen_video / qwen_tts，未访问任何 chat-completions 端点，未使用 web_search，未打开任何题目相关检索。唯一的网络动作是题面明确允许的「通用库下载」：在本工作目录 `npm install three@0.161.0 --no-save`（纯通用 3D 库，用于本地无头自测），页面运行时依赖走 unpkg CDN。

补充说明（不作免责声明，仅陈述事实）：交付前未向本题评分方或任何第三方求证过评分标准，`self_check` 完全按 `task.md` 内两段原文逐条自查，其中「真实浏览器 GPU 渲染/FPS 实测」一项在无 GPU 沙箱内无法验证，故 `pass=false` 并在 `notes` 中写明，而非填 `true`。

---

## 四、自测脚手架（已按契约全部清理）

开发期在工作目录内建立、并在收尾时删除的脚手架：

| 脚本 | 作用 |
|---|---|
| `build.js` | 按固定顺序 concat `parts/*` → `answer.html`；校验分片数、`<script>` 配对、`</html>` 闭合、TODO/FIXME/placeholder/空函数体扫描、字节数；导出 `.answer.js` 供 `node --check` |
| `geo-test.mjs` | 用 `new Function` 把 `parts/10_core.js` 的数学助手 + `parts/20_params.js` 的 `solve()` **原文**抽出到 Node，配一个 20 行的 Vector3 polyfill，跑 56 项求解器断言 |
| `harness.mjs` | 伪造 DOM（document / canvas 2D / input / details）与 `WebGLRenderer`、替换 OrbitControls 为轻量替身，把 `answer.html` 的模块脚本还原成 `.module.test.mjs`，用**真实的 three 模块**跑场景图代码 |
| `smoke.mjs` | 在上面的无头环境里驱动 15 项断言（全参数 min/mid/max 重建、开关组合、分解可逆性矩阵比较、相机不动性、换档一致性、标签/预设/audit/reset、指标） |
| `patch.mjs` / `patch2.mjs` | 定点文本修补（规避 PowerShell 引号转义问题），不做整文件重写 |

**这些脚本没有保留**：`geo-test.mjs` 与 `build.js` 依赖 `parts/` 分片、`harness.mjs`/`smoke.mjs` 依赖本地 `node_modules/three@0.161.0`，而按交付契约 `parts/` 与 `node_modules/` 必须删除；保留半套脚本只会留下无法运行的死引用。若要复现上述 71 项断言，可按本节与第一节 2 条的描述重建（先 `npm i three@0.161.0 --no-save`，再从 `answer.html` 反向抽取模块体即可，无需 `parts/`）。`answer.html` 本身不依赖任何本地包：运行期只从 unpkg CDN 取 `three@0.161.0` 与其 `examples/jsm/controls/OrbitControls.js`。

收尾清理清单（已删除）：`parts/`（11 片源码）、`node_modules/`（three@0.161.0）、`package.json`、`package-lock.json`、`build.js`、`geo-test.mjs`、`harness.mjs`、`smoke.mjs`、`patch.mjs`、`patch2.mjs`、`.answer.js`、`.module.test.mjs`。
最终保留：`answer.html`、`result.json`、`log.md`（`task.md` 原样未改）。

## 五、最终交付清单
| 文件 | 字节 | 说明 |
|---|---|---|
| `answer.html` | 124,869 | 单文件交互应用；3 个 `<script>` 块配对，`</html>` 闭合，TODO/FIXME/placeholder = 0，`node --check` 通过 |
| `result.json` | ~13 KB | 15 条 self_check（14 pass / 1 如实标 false）+ 四项 integrity 全 false + 局限说明 |
| `log.md` | 本文件 | 中文过程记录、四条诚信声明、场景图 / 依赖更新架构 / 渲染管线说明 |
