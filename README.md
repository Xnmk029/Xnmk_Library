# AI 大语言模型 Benchmark 测试套件 (AI Prompt Test Benchmark Suite)

本仓库为一个标准化的 AI 代码生成与系统架构评测套件，共包含 37 个独立测试项目。所有测试项按照 **4 个难度阶梯目录 (L1 至 L4)** 进行规范化归类管理。

This repository is a standardized evaluation suite containing 37 benchmark projects organized into **4 difficulty tier directories (L1 to L4)** for auditing AI code generation, physics simulations, 3D graphics, and hardware protocols.

---

## 1. 目录架构 (Directory Architecture)

```
F:\benchmark
├── L1_Basic/                     # Level 1: 基础工具与脚本类 (5 个项目 / 5 Projects)
├── L2_Intermediate/              # Level 2: 中级 Web 应用与交互游戏类 (11 个项目 / 11 Projects)
├── L3_Advanced/                  # Level 3: 高级 3D 引擎与物理仿真类 (12 个项目 / 12 Projects)
├── L4_Expert/                    # Level 4: 专家级原生引擎与硬件协议类 (9 个项目 / 9 Projects)
├── INDEX.md                      # 双语全景索引 / Master Bilingual Index
├── LICENSE                       # MIT 开源许可证 / MIT License
└── README.md                     # 主说明文档 / Primary Readme
```

---

## 2. 评测领域说明 (Technical Domains)

- **Web 游戏与交互逻辑 (Web Games & Interactive Logic)**：考核游戏状态机、输入响应、规则闭环与 Web Audio 音效同步。
- **3D 图形、物理仿真与 Shaders (3D Graphics, Physics & Shaders)**：考核 WebGL/WebGPU 着色器、刚体动力学、SO(3) 矩阵积分、SPH 流体及光线追踪。
- **视觉艺术与现代 UI 组件 (Visual Arts & Modern UI)**：考核高密度响应式布局、弥散流体背景、SVG 矢量绘制及高级动效管线。
- **Python 工具与原生引擎 (Python Tools & Native Engines)**：考核 PyOpenGL、FFMPEG 视频管道、非阻塞 UDP 网络及空间距离重采样。
- **系统集成与 MCP 协议 (System Integration & MCP Protocol)**：考核 Model Context Protocol (MCP) 服务端、操作系统 API Hook 及代码重构。

---

## 3. 测试项目全景表 (Complete Benchmark Matrix)

| 序号 (#) | 项目名称 (Directory) | 中英文名称 (Chinese / English Title) | 领域 (Domain) | 阶梯 (Tier) | 资源入口 (Resources) |
| :---: | :--- | :--- | :--- | :---: | :---: |
| 01 | [`Archive`](./L1_Basic/Archive) | **归档：快捷自动化与主题脚本 Benchmark**<br>*Automation Scripts Archive* | 系统集成与 MCP 协议<br>(System Integration & MCP Protocol) | `L1` | [提示词 (Prompt)](./L1_Basic/Archive/PROJECT_PROMPT.md) \| [说明 (README)](./L1_Basic/Archive/README.md) |
| 02 | [`BilibiliUserscript`](./L1_Basic/BilibiliUserscript) | **脚本：B站 IP 归属地油猴脚本 Benchmark**<br>*Bilibili IP Location Userscript* | 系统集成与 MCP 协议<br>(System Integration & MCP Protocol) | `L1` | [提示词 (Prompt)](./L1_Basic/BilibiliUserscript/PROJECT_PROMPT.md) \| [说明 (README)](./L1_Basic/BilibiliUserscript/README.md) |
| 03 | [`PyFlowingLight`](./L1_Basic/PyFlowingLight) | **PY流光：Python 桌面悬浮球 Benchmark**<br>*Python Desktop Floating Light Widget* | Python 工具与原生引擎<br>(Python Tools & Native Engines) | `L1` | [提示词 (Prompt)](./L1_Basic/PyFlowingLight/PROJECT_PROMPT.md) \| [说明 (README)](./L1_Basic/PyFlowingLight/README.md) |
| 04 | [`SVG`](./L1_Basic/SVG) | **SVG：纯矢量《蒙娜丽莎》笔触复刻 Benchmark**<br>*Pure SVG Vector Mona Lisa Painting Study* | 视觉艺术与现代 UI 组件<br>(Visual Arts & Modern UI) | `L1` | [提示词 (Prompt)](./L1_Basic/SVG/PROJECT_PROMPT.md) \| [说明 (README)](./L1_Basic/SVG/README.md) |
| 05 | [`WeChatCheckinExcel`](./L1_Basic/WeChatCheckinExcel) | **签到：微信打卡预约消息自动导入 Excel 系统 Benchmark**<br>*WeChat Message Parser & Excel Importer* | 系统集成与 MCP 协议<br>(System Integration & MCP Protocol) | `L1` | [提示词 (Prompt)](./L1_Basic/WeChatCheckinExcel/PROJECT_PROMPT.md) \| [说明 (README)](./L1_Basic/WeChatCheckinExcel/README.md) |
| 06 | [`2048`](./L2_Intermediate/2048) | **2048：Roguelike 融合网页游戏 Benchmark**<br>*2048: Roguelike Fusion Web Game* | Web 游戏与交互逻辑<br>(Web Games & Interactive Logic) | `L2` | [提示词 (Prompt)](./L2_Intermediate/2048/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/2048/README.md) |
| 07 | [`AMLL`](./L2_Intermediate/AMLL) | **AMLL：Apple Music 动态歌词播放器 Benchmark**<br>*Apple Music Lyrics Player UI* | 视觉艺术与现代 UI 组件<br>(Visual Arts & Modern UI) | `L2` | [提示词 (Prompt)](./L2_Intermediate/AMLL/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/AMLL/README.md) |
| 08 | [`Balatro`](./L2_Intermediate/Balatro) | **小丑牌：网页卡牌游戏与动效复刻 Benchmark**<br>*Balatro Poker Card Game Replica* | Web 游戏与交互逻辑<br>(Web Games & Interactive Logic) | `L2` | [提示词 (Prompt)](./L2_Intermediate/Balatro/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/Balatro/README.md) |
| 09 | [`DoubleWishbone`](./L2_Intermediate/DoubleWishbone) | **双叉臂：汽车前悬挂运动学 Benchmark**<br>*Car Front Double Wishbone Kinematics* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L2` | [提示词 (Prompt)](./L2_Intermediate/DoubleWishbone/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/DoubleWishbone/README.md) |
| 10 | [`FPSlab`](./L2_Intermediate/FPSlab) | **FPSlab：多游戏适应 FPS 小球练枪 Benchmark**<br>*FPS Aim Lab & Multi-Game Range* | Web 游戏与交互逻辑<br>(Web Games & Interactive Logic) | `L2` | [提示词 (Prompt)](./L2_Intermediate/FPSlab/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/FPSlab/README.md) |
| 11 | [`FrontendShowcase`](./L2_Intermediate/FrontendShowcase) | **前端：赛博朋克风格前端展台 Benchmark**<br>*Cyberpunk Frontend Showcase & Portfolio* | 视觉艺术与现代 UI 组件<br>(Visual Arts & Modern UI) | `L2` | [提示词 (Prompt)](./L2_Intermediate/FrontendShowcase/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/FrontendShowcase/README.md) |
| 12 | [`GoBoard`](./L2_Intermediate/GoBoard) | **围棋：三劫循环局面判断 Benchmark**<br>*Go 19x19 Triple Ko Situation Judgment* | Web 游戏与交互逻辑<br>(Web Games & Interactive Logic) | `L2` | [提示词 (Prompt)](./L2_Intermediate/GoBoard/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/GoBoard/README.md) |
| 13 | [`MoTa`](./L2_Intermediate/MoTa) | **MoTa：HTML 经典 Flash 风格魔塔 RPG Benchmark**<br>*Classic Flash-Style HTML Magic Tower RPG* | Web 游戏与交互逻辑<br>(Web Games & Interactive Logic) | `L2` | [提示词 (Prompt)](./L2_Intermediate/MoTa/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/MoTa/README.md) |
| 14 | [`Musicgames`](./L2_Intermediate/Musicgames) | **Musicgames：冰与火之舞 × 节奏医生 融合音游 Benchmark**<br>*ADOFAI x Rhythm Doctor Hybrid Music Game* | Web 游戏与交互逻辑<br>(Web Games & Interactive Logic) | `L2` | [提示词 (Prompt)](./L2_Intermediate/Musicgames/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/Musicgames/README.md) |
| 15 | [`PenroseStairs`](./L2_Intermediate/PenroseStairs) | **彭罗斯阶梯：HTML 视错觉 Benchmark**<br>*Penrose Optical Illusion 3D Geometry* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L2` | [提示词 (Prompt)](./L2_Intermediate/PenroseStairs/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/PenroseStairs/README.md) |
| 16 | [`Sokoban`](./L2_Intermediate/Sokoban) | **推箱子：Three.js 草地 Shader 与推箱子 Benchmark**<br>*Three.js Shader Grass & Sokoban Game* | Web 游戏与交互逻辑<br>(Web Games & Interactive Logic) | `L2` | [提示词 (Prompt)](./L2_Intermediate/Sokoban/PROJECT_PROMPT.md) \| [说明 (README)](./L2_Intermediate/Sokoban/README.md) |
| 17 | [`Bicycle3D`](./L3_Advanced/Bicycle3D) | **自行车：参数化 3D 工作室与传动系统 Benchmark**<br>*Parametric 3D Bicycle Studio & Drivetrain* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/Bicycle3D/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/Bicycle3D/README.md) |
| 18 | [`EscapeFromDuckov`](./L3_Advanced/EscapeFromDuckov) | **逃离鸭科夫：游戏系统与着色器特效 Benchmark**<br>*Escape from Duckov Game Design & Shaders* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/EscapeFromDuckov/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/EscapeFromDuckov/README.md) |
| 19 | [`FPV`](./L3_Advanced/FPV) | **FPV：穿越机花飞 3D 模拟器 Benchmark**<br>*FPV Drone Freestyle 3D Simulator* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/FPV/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/FPV/README.md) |
| 20 | [`IndustrialDigitalTwin`](./L3_Advanced/IndustrialDigitalTwin) | **工业数字孪生设备监控 Benchmark**<br>*Industrial Digital Twin Equipment Monitoring* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/IndustrialDigitalTwin/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/IndustrialDigitalTwin/README.md) |
| 21 | [`LitRPGNovel`](./L3_Advanced/LitRPGNovel) | **文字：Minecraft 硬核生存小说 Benchmark**<br>*Minecraft Hardcore LitRPG Long Novel* | Web 游戏与交互逻辑<br>(Web Games & Interactive Logic) | `L3` | [提示词 (Prompt)](./L3_Advanced/LitRPGNovel/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/LitRPGNovel/README.md) |
| 22 | [`MinecraftVOxy`](./L3_Advanced/MinecraftVOxy) | **我的世界VOxy：区块着色器与渲染引擎 Benchmark**<br>*Minecraft VOxy Chunk Shader & Rendering Engine* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/MinecraftVOxy/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/MinecraftVOxy/README.md) |
| 23 | [`Poolrooms3D`](./L3_Advanced/Poolrooms3D) | **池核：3D Poolrooms 步行模拟器 Benchmark**<br>*3D Poolrooms Backrooms Simulator* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/Poolrooms3D/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/Poolrooms3D/README.md) |
| 24 | [`RTX`](./L3_Advanced/RTX) | **RTX：Web 路径追踪房间 GPU Benchmark**<br>*Web Path Tracing GPU Workload Benchmark* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/RTX/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/RTX/README.md) |
| 25 | [`RainWorldCloth`](./L3_Advanced/RainWorldCloth) | **雨世界：质点-弹簧布料模拟 Benchmark**<br>*Mass-Spring / PBD Cloth Dynamics* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/RainWorldCloth/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/RainWorldCloth/README.md) |
| 26 | [`USP`](./L3_Advanced/USP) | **USP：Match 配重手枪机械分解 Benchmark**<br>*USP Match Gun Disassembly & Low-Poly Scene* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/USP/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/USP/README.md) |
| 27 | [`cloth`](./L3_Advanced/cloth) | **cloth：3D 质点-弹簧布料物理仿真 Benchmark**<br>*3D Mass-Spring Cloth Physics Simulation* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/cloth/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/cloth/README.md) |
| 28 | [`teardown`](./L3_Advanced/teardown) | **teardown：硬表面机械与微体素场景 Benchmark**<br>*Teardown Voxel Diorama & Mechanical Disassembly* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L3` | [提示词 (Prompt)](./L3_Advanced/teardown/PROJECT_PROMPT.md) \| [说明 (README)](./L3_Advanced/teardown/README.md) |
| 29 | [`BEAMhard`](./L4_Expert/BEAMhard) | **BEAMhard：BeamNG 软体车辆物理与损毁模拟 Benchmark**<br>*BEAMhard: BeamNG Vehicle Physics & Damage* | 系统集成与 MCP 协议<br>(System Integration & MCP Protocol) | `L4` | [提示词 (Prompt)](./L4_Expert/BEAMhard/PROJECT_PROMPT.md) \| [说明 (README)](./L4_Expert/BEAMhard/README.md) |
| 30 | [`CFD`](./L4_Expert/CFD) | **CFD：超拟真流体计算与物理渲染 Benchmark**<br>*Ultra-Realistic CFD Fluid Simulation & Rendering* | 3D 图形、物理仿真与 Shaders<br>(3D Graphics, Physics & Shaders) | `L4` | [提示词 (Prompt)](./L4_Expert/CFD/PROJECT_PROMPT.md) \| [说明 (README)](./L4_Expert/CFD/README.md) |
| 31 | [`DeepSWE`](./L4_Expert/DeepSWE) | **DeepSWE：软件工程与代码演进 Benchmark**<br>*DeepSWE Benchmark Evaluation Tasks* | 系统集成与 MCP 协议<br>(System Integration & MCP Protocol) | `L4` | [提示词 (Prompt)](./L4_Expert/DeepSWE/PROJECT_PROMPT.md) \| [说明 (README)](./L4_Expert/DeepSWE/README.md) |
| 32 | [`EngineSIM`](./L4_Expert/EngineSIM) | **EngineSIM：引擎声浪与 DSP 音频合成 Benchmark**<br>*Engine Sound & DSP Audio Synthesis* | Python 工具与原生引擎<br>(Python Tools & Native Engines) | `L4` | [提示词 (Prompt)](./L4_Expert/EngineSIM/PROJECT_PROMPT.md) \| [说明 (README)](./L4_Expert/EngineSIM/README.md) |
| 33 | [`PSMCP`](./L4_Expert/PSMCP) | **PSMCP：Adobe Photoshop MCP 服务端 Benchmark**<br>*Adobe Photoshop MCP Server Integration* | 系统集成与 MCP 协议<br>(System Integration & MCP Protocol) | `L4` | [提示词 (Prompt)](./L4_Expert/PSMCP/PROJECT_PROMPT.md) \| [说明 (README)](./L4_Expert/PSMCP/README.md) |
| 34 | [`SketchUpMCP`](./L4_Expert/SketchUpMCP) | **草图大师MCP：SketchUp MCP 桥接器 Benchmark**<br>*SketchUp MCP Bridge Integration* | 系统集成与 MCP 协议<br>(System Integration & MCP Protocol) | `L4` | [提示词 (Prompt)](./L4_Expert/SketchUpMCP/PROJECT_PROMPT.md) \| [说明 (README)](./L4_Expert/SketchUpMCP/README.md) |
| 35 | [`Telemetry`](./L4_Expert/Telemetry) | **遥测：RAC 赛车实时遥测与距离空间重采样分析 Benchmark**<br>*RAC Telemetry & Distance-based Resampling Analysis* | Python 工具与原生引擎<br>(Python Tools & Native Engines) | `L4` | [提示词 (Prompt)](./L4_Expert/Telemetry/PROJECT_PROMPT.md) \| [说明 (README)](./L4_Expert/Telemetry/README.md) |
| 36 | [`UnifiedInputManager`](./L4_Expert/UnifiedInputManager) | **UnifiedInputManager：跨平台 Controller 统一输入管理器 Benchmark**<br>*Unified Controller Input Manager* | Python 工具与原生引擎<br>(Python Tools & Native Engines) | `L4` | [提示词 (Prompt)](./L4_Expert/UnifiedInputManager/PROJECT_PROMPT.md) \| [说明 (README)](./L4_Expert/UnifiedInputManager/README.md) |
| 37 | [`osuMania`](./L4_Expert/osuMania) | **osu!mania：Python OpenGL 高效视频渲染工具 Benchmark**<br>*osu!mania Python OpenGL High-Perf Video Renderer* | Python 工具与原生引擎<br>(Python Tools & Native Engines) | `L4` | [提示词 (Prompt)](./L4_Expert/osuMania/PROJECT_PROMPT.md) \| [说明 (README)](./L4_Expert/osuMania/README.md) |

---

## 4. 难度阶梯与项目清单 (Tier Breakdown & Registry)

### Level 1: 基础工具与脚本类 (L1_Basic)

针对单文件小工具、DOM 节点解析、自动化脚本与矢量图形绘制能力。
Targeting single-file tools, DOM parsing, automation scripts, and vector graphics.

- [`Archive`](./L1_Basic/Archive): 归档：快捷自动化与主题脚本 Benchmark (Automation scripts & theme switching benchmark)
- [`BilibiliUserscript`](./L1_Basic/BilibiliUserscript): 脚本：B站 IP 归属地油猴脚本 Benchmark (Bilibili IP location userscript DOM parser)
- [`PyFlowingLight`](./L1_Basic/PyFlowingLight): PY流光：Python 桌面悬浮球 Benchmark (Python desktop transparent floating light widget)
- [`SVG`](./L1_Basic/SVG): SVG：纯矢量《蒙娜丽莎》笔触复刻 Benchmark (Pure SVG Mona Lisa vector painting study)
- [`WeChatCheckinExcel`](./L1_Basic/WeChatCheckinExcel): 签到：微信打卡预约消息自动导入 Excel 系统 Benchmark (WeChat PC message listener & Excel importer)

### Level 2: 中级 Web 应用与交互游戏类 (L2_Intermediate)

针对复杂状态机、2D Canvas 游戏、UI 交互动效与物理 UI 组件能力。
Targeting state machine implementation, Canvas 2D games, UI animations, and physical UI components.

- [`2048`](./L2_Intermediate/2048): 2048：Roguelike 融合网页游戏 Benchmark (2048 Roguelike fusion web game)
- [`AMLL`](./L2_Intermediate/AMLL): AMLL：Apple Music 动态歌词播放器 Benchmark (Apple Music dynamic lyrics player with fluid blur background)
- [`Balatro`](./L2_Intermediate/Balatro): 小丑牌：网页卡牌游戏与动效复刻 Benchmark (Balatro poker card game & juice animation replica)
- [`DoubleWishbone`](./L2_Intermediate/DoubleWishbone): 双叉臂：汽车前悬挂运动学 Benchmark (Car front double wishbone kinematics)
- [`FPSlab`](./L2_Intermediate/FPSlab): FPSlab：多游戏适应 FPS 小球练枪 Benchmark (FPS Aim Lab with sensitivity converter & crosshair builder)
- [`FrontendShowcase`](./L2_Intermediate/FrontendShowcase): 前端：赛博朋克风格前端展台 Benchmark (Cyberpunk anime cel-shader frontend showcase)
- [`GoBoard`](./L2_Intermediate/GoBoard): 围棋：三劫循环局面判断 Benchmark (Go 19x19 triple ko situation judgment & rules parser)
- [`MoTa`](./L2_Intermediate/MoTa): MoTa：HTML 经典 Flash 风格魔塔 RPG Benchmark (Classic Flash-style HTML Magic Tower RPG)
- [`Musicgames`](./L2_Intermediate/Musicgames): Musicgames：冰与火之舞 × 节奏医生 融合音游 Benchmark (ADOFAI x Rhythm Doctor hybrid rhythm game)
- [`PenroseStairs`](./L2_Intermediate/PenroseStairs): 彭罗斯阶梯：HTML 视错觉 Benchmark (Penrose optical illusion 3D isometric stairs)
- [`Sokoban`](./L2_Intermediate/Sokoban): 推箱子：Three.js 草地 Shader 与推箱子 Benchmark (Three.js instanced grass shader & Sokoban game)

### Level 3: 高级 3D 引擎与物理仿真类 (L3_Advanced)

针对 WebGL/Three.js 3D 渲染引擎、自定义 GLSL 着色器、质点弹簧物理及 PBR 场景能力。
Targeting WebGL/Three.js engines, custom GLSL shaders, rigid body dynamics, and PBR environments.

- [`Bicycle3D`](./L3_Advanced/Bicycle3D): 自行车：参数化 3D 工作室与传动系统 Benchmark (Parametric 3D bicycle studio & mechanical drivetrain)
- [`cloth`](./L3_Advanced/cloth): cloth：3D 质点-弹簧布料物理仿真 Benchmark (3D mass-spring cloth physics simulation with wind & stair collision)
- [`EscapeFromDuckov`](./L3_Advanced/EscapeFromDuckov): 逃离鸭科夫：游戏系统与着色器特效 Benchmark (Escape from Duckov game mechanics & fog shaders)
- [`FPV`](./L3_Advanced/FPV): FPV：穿越机花飞 3D 模拟器 Benchmark (FPV drone freestyle 3D simulator with SO(3) attitude integration & VTX noise shader)
- [`IndustrialDigitalTwin`](./L3_Advanced/IndustrialDigitalTwin): 工业数字孪生设备监控 Benchmark (Industrial digital twin equipment monitoring & raycasting)
- [`LitRPGNovel`](./L3_Advanced/LitRPGNovel): 文字：Minecraft 硬核生存小说 Benchmark (Minecraft LitRPG long novel controlled narrative)
- [`MinecraftVOxy`](./L3_Advanced/MinecraftVOxy): 我的世界VOxy：区块着色器与渲染引擎 Benchmark (Minecraft VOxy voxel chunk shader & rendering engine)
- [`Poolrooms3D`](./L3_Advanced/Poolrooms3D): 池核：3D Poolrooms 步行模拟器 Benchmark (3D Poolrooms backrooms simulator with PBR water shaders)
- [`RainWorldCloth`](./L3_Advanced/RainWorldCloth): 雨世界：质点-弹簧布料模拟 Benchmark (Mass-spring / PBD cloth dynamics & obstacle collision)
- [`RTX`](./L3_Advanced/RTX): RTX：Web 路径追踪房间 GPU Benchmark (Web Monte Carlo path tracing GPU benchmark)
- [`teardown`](./L3_Advanced/teardown): teardown：硬表面机械与微体素场景 Benchmark (Teardown voxel diorama & mechanical disassembly)
- [`USP`](./L3_Advanced/USP): USP：Match 配重手枪机械分解 Benchmark (USP Match gun disassembly & low-poly mechanical animation)

### Level 4: 专家级原生引擎与硬件协议类 (L4_Expert)

针对 Python 原生图形渲染、DSP 音频合成、UDP 实时遥测及硬件 SDK 接口协议能力。
Targeting native Python/C++/OpenGL rendering engines, DSP audio synthesis, UDP telemetry, and hardware protocols.

- [`BEAMhard`](./L4_Expert/BEAMhard): BEAMhard：BeamNG 软体车辆物理与损毁模拟 Benchmark (BeamNG vehicle physics & mesh damage simulation benchmark)
- [`CFD`](./L4_Expert/CFD): CFD：超拟真流体计算与物理渲染 Benchmark (Ultra-realistic SPH fluid simulation & refraction shader)
- [`DeepSWE`](./L4_Expert/DeepSWE): DeepSWE：软件工程与代码演进 Benchmark (Repository-level software engineering & code refactoring benchmark)
- [`EngineSIM`](./L4_Expert/EngineSIM): EngineSIM：引擎声浪与 DSP 音频合成 Benchmark (Engine sound procedural DSP synthesis & spectrogram analysis)
- [`osuMania`](./L4_Expert/osuMania): osu!mania：Python OpenGL 高效视频渲染工具 Benchmark (Python OpenGL high-performance video renderer with 480p skin.ini mapping & FFMPEG pipe)
- [`PSMCP`](./L4_Expert/PSMCP): PSMCP：Adobe Photoshop MCP 服务端 Benchmark (Adobe Photoshop MCP server integration & COM automation)
- [`SketchUpMCP`](./L4_Expert/SketchUpMCP): 草图大师MCP：SketchUp MCP 桥接器 Benchmark (SketchUp CAD MCP bridge integration & SSE transport)
- [`Telemetry`](./L4_Expert/Telemetry): 遥测：RAC 赛车实时遥测与距离空间重采样分析 Benchmark (RAC car real-time telemetry receiver, distance-based resampling & delta crosshair UI)
- [`UnifiedInputManager`](./L4_Expert/UnifiedInputManager): UnifiedInputManager：跨平台 Controller 统一输入管理器 Benchmark (Unified controller input manager for XInput, SteamInput, RawHID, PS, Switch)

---

## 5. 评测与审计指南 (Evaluation Guidelines)

1. 从上方表格中选择目标评测领域或难度阶梯对应的项目。
   Select a benchmark project from the table above based on target domain or difficulty level.
2. 打开对应项目目录下的 `PROJECT_PROMPT.md` 文件获取完整提示词。
   Retrieve the prompt defined in the project's `PROJECT_PROMPT.md` file.
3. 将提示词直接输入给待测 AI 大语言模型。
   Submit the prompt text to the target LLM under test without modifying technical constraints.
4. 对照该项目 `README.md` 中定义的验收与评分标准进行客观评估。
   Evaluate the generated outputs against the rubric specified in the project's `README.md`.

---

## 6. 开源协议 (License)

本项目基于 [MIT 许可证](LICENSE) 开源。
This project is licensed under the [MIT License](LICENSE).
