# NOTES.md —— 自行车参数化 3D 工作室与装配模拟器（qwen-3.8-flash-next 批次成果）

## 0. 入库信息

- **批次**：`暂存/qwen-3.8-flash-next-20260827`（2026-08-27 五题并行测评，本题目）
- **受测模型**：批次标签 `qwen-3.8-flash-next`；实路由 **aliyun / qwen3.8-flash**（网关无 next 型号，经确认以现有 qwen3.8-flash 派发；`model_self_report` 与日志 `replayState` 双证一致，无脱靶）
- **来源题目**：`L3_Advanced/Bicycle3D/PROJECT_PROMPT.md`（参数化 3D 工作室与装配模拟器）
- **交付**：`answer.html`（124,869 B，测评原版）｜ `answer-空镜录制版.html`（128,850 B，空镜增强版，见 §3）｜ `result.json` 12,725 B（self_check 14/15 pass，第 15 条如实标 false：无 WebGL 沙箱不能验真实 GPU/FPS）｜ `log.md` 16,184 B
- **父代理复验**：importmap JSON 合法、内联 JS 语法 2/2 PASS、TODO/占位=0、外部三维资产=0、外链仅 unpkg.com、零本地路径依赖、残留=无；要件计数 WebGLRenderer 1 / MeshToonMaterial 2 / 墨线 inverted-hull 24 / InstancedMesh 1 / 七组 UI 19 / 沿轴分解 19 / Stack·Reach 11 / Dropped 13 / 塔基齿数 74 / 重量 10
- **子代理自测**（清理前实测）：求解器 56 项断言全通过；无头场景冒烟 15 项全通过（399 网格 / ≈5.9 万三角面、21 组装配体、分解位移 ≥10 且复位矩阵漂移 <1e-6、几何编辑不动相机）
- **过程事件**：一次网关 429 insufficient_quota 中断（step 73），经 `send_message` 续跑收尾成功；此批次的"分片写入 → 拼接 → 校验 → 清理 parts"纪律使本题（历史批次曾两次零交付）一次成功

## 1. 实现结构

- **单向前推依赖架构**：`P（30 参数）→ solve() → L（几何布局解）→ 17 个 layoutXxx 固定拓扑序 → syncHulls / syncAll / HUD`。
- **21 个装配组**沿真实安装轴 `home + off·dist·smooth(t)` 合成分解动画（轮组沿车轴、前叉沿转向轴、碗组沿头管、座管上移、曲柄沿中轴、飞轮/碟片脱离花鼓、脚踏外移等），复位矩阵漂移 <1e-6。
- **NPR 赛璐璐**：MeshToonMaterial + 程序化 LUT + inverted-hull 墨线 + 两 pass 后处理（ACES / 色阶量化 / 像素化 / 饱和 / 暗角）。
- **性能**：动画合成用 rAF 合帧；辐条/链节/孔/螺栓等 InstancedMesh；几何与材质缓存复用。
- **七组 UI**：Frame Geometry / Drivetrain / Fit & Cockpit / Assembly / Colors & Finishes / Render Style / Specifications，含 22 行实时规格与分组重量条、组件标签、相机预设、重置、面板折叠；暴露 `window.__BIKE__`（params / layout / anchors() / metrics() / audit() / setExplode() / flyTo()）供自动化复核。

## 2. 已知局限（子代理如实声明，评分时参照）

链条为四圆二维凸包近似（未解内外公切线）；无逐齿啮合与可扣动刹把；把带为整段条纹贴管近似；重量为经验拟合模型；分解用统一进度 t 而非逐组件时序；辐条固定 24 根；未经人眼与真实 GPU 目视验证（观感参数取保守值）。

## 3. 空镜录制增强版说明

`answer-空镜录制版.html` = 测评原版之上追加「空镜录制」功能（2026-08-27，用户要求）：右上角 `◉ CINE` 按钮 / 快捷键 `C` / `window.__BIKE__.cine.*` 三路控制相机绕整车自动环绕（默认 4°/秒，滑杆 0–18°/秒可调）；开启时自动清场（顶栏/面板/HUD 淡出、关闭标签、禁手拖防误触、中断机位动画、轮子慢转），关闭时还原。功能为纯增量（+3,981 B），未改动原版任何渲染/交互逻辑；原版 `answer.html` 与 `log.md`/`result.json` 是测评验收时的一致口径。