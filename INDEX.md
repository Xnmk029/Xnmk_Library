# AI Prompt Test Benchmark Suite

Standardized evaluation repository containing 36 benchmark projects designed for auditing and evaluating AI code generation, system architecture, physics simulations, 3D graphics, and protocol integrations.

---

## 1. Overview

This repository establishes a multi-dimensional benchmark suite for auditing LLM coding performance. Each project provides standardized system prompts, technical constraints, expected architecture specifications, and verification guidelines.

### Technical Domains

- **Web Games & Interactive Logic**: State machine design, input responsiveness, game rules, and Web Audio integration.
- **3D Graphics, Physics & Shaders**: WebGL/WebGPU shaders, rigid body dynamics, SO(3) rotations, SPH fluids, and ray tracing.
- **Visual Arts & Modern UI**: High-density layouts, glassmorphism, SVG vector rendering, and complex UI animation pipelines.
- **Python Tools & Native Engines**: PyOpenGL, FFMPEG video pipelines, non-blocking UDP networking, and spatial data resampling.
- **System Integration & MCP Protocol**: Model Context Protocol (MCP) servers, OS API hooks, and repository refactoring tasks.

---

## 2. Benchmark Project Matrix

| No. | Directory | Title | Domain | Difficulty Level | Resources |
| :---: | :--- | :--- | :--- | :---: | :---: |
| 01 | [`2048`](./2048) | **2048：Roguelike 融合网页游戏 Benchmark**<br>*2048: Roguelike Fusion Web Game* | Web Games & Interactive Logic | `L2` | [Prompt](./2048/README.md) \| [README](./2048/README.md) |
| 02 | [`AMLL`](./AMLL) | **AMLL：Apple Music 动态歌词播放器 Benchmark**<br>*Apple Music Lyrics Player UI* | Visual Arts & Modern UI | `L2` | [Prompt](./AMLL/PROJECT_PROMPT.md) \| [README](./AMLL/README.md) |
| 03 | [`Archive`](./Archive) | **归档：快捷自动化与主题脚本 Benchmark**<br>*Automation Scripts Archive* | System Integration & MCP Protocol | `L1` | [Prompt](./Archive/README.md) \| [README](./Archive/README.md) |
| 04 | [`BEAMhard`](./BEAMhard) | **BEAMhard：BeamNG 软体车辆物理与损毁模拟 Benchmark**<br>*BEAMhard: BeamNG Vehicle Physics & Damage* | System Integration & MCP Protocol | `L4` | [Prompt](./BEAMhard/README.md) \| [README](./BEAMhard/README.md) |
| 05 | [`Balatro`](./Balatro) | **小丑牌：网页卡牌游戏与动效复刻 Benchmark**<br>*Balatro Poker Card Game Replica* | Web Games & Interactive Logic | `L2` | [Prompt](./Balatro/README.md) \| [README](./Balatro/README.md) |
| 06 | [`Bicycle3D`](./Bicycle3D) | **自行车：参数化 3D 工作室与传动系统 Benchmark**<br>*Parametric 3D Bicycle Studio & Drivetrain* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./Bicycle3D/README.md) \| [README](./Bicycle3D/README.md) |
| 07 | [`BilibiliUserscript`](./BilibiliUserscript) | **脚本：B站 IP 归属地油猴脚本 Benchmark**<br>*Bilibili IP Location Userscript* | System Integration & MCP Protocol | `L1` | [Prompt](./BilibiliUserscript/README.md) \| [README](./BilibiliUserscript/README.md) |
| 08 | [`CFD`](./CFD) | **CFD：超拟真流体计算与物理渲染 Benchmark**<br>*Ultra-Realistic CFD Fluid Simulation & Rendering* | 3D Graphics, Physics & Shaders | `L4` | [Prompt](./CFD/README.md) \| [README](./CFD/README.md) |
| 09 | [`DeepSWE`](./DeepSWE) | **DeepSWE：软件工程与代码演进 Benchmark**<br>*DeepSWE Benchmark Evaluation Tasks* | System Integration & MCP Protocol | `L4` | [Prompt](./DeepSWE/README.md) \| [README](./DeepSWE/README.md) |
| 10 | [`DoubleWishbone`](./DoubleWishbone) | **双叉臂：汽车前悬挂运动学 Benchmark**<br>*Car Front Double Wishbone Kinematics* | 3D Graphics, Physics & Shaders | `L2` | [Prompt](./DoubleWishbone/README.md) \| [README](./DoubleWishbone/README.md) |
| 11 | [`EngineSIM`](./EngineSIM) | **EngineSIM：引擎声浪与 DSP 音频合成 Benchmark**<br>*Engine Sound & DSP Audio Synthesis* | Python Tools & Native Engines | `L4` | [Prompt](./EngineSIM/README.md) \| [README](./EngineSIM/README.md) |
| 12 | [`EscapeFromDuckov`](./EscapeFromDuckov) | **逃离鸭科夫：游戏系统与着色器特效 Benchmark**<br>*Escape from Duckov Game Design & Shaders* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./EscapeFromDuckov/README.md) \| [README](./EscapeFromDuckov/README.md) |
| 13 | [`FPSlab`](./FPSlab) | **FPSlab：多游戏适应 FPS 小球练枪 Benchmark**<br>*FPS Aim Lab & Multi-Game Range* | Web Games & Interactive Logic | `L2` | [Prompt](./FPSlab/PROJECT_PROMPT.md) \| [README](./FPSlab/README.md) |
| 14 | [`FPV`](./FPV) | **FPV：穿越机花飞 3D 模拟器 Benchmark**<br>*FPV Drone Freestyle 3D Simulator* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./FPV/PROJECT_PROMPT.md) \| [README](./FPV/README.md) |
| 15 | [`FrontendShowcase`](./FrontendShowcase) | **前端：赛博朋克风格前端展台 Benchmark**<br>*Cyberpunk Frontend Showcase & Portfolio* | Visual Arts & Modern UI | `L2` | [Prompt](./FrontendShowcase/README.md) \| [README](./FrontendShowcase/README.md) |
| 16 | [`GoBoard`](./GoBoard) | **围棋：三劫循环局面判断 Benchmark**<br>*Go 19x19 Triple Ko Situation Judgment* | Web Games & Interactive Logic | `L2` | [Prompt](./GoBoard/README.md) \| [README](./GoBoard/README.md) |
| 17 | [`IndustrialDigitalTwin`](./IndustrialDigitalTwin) | **工业数字孪生设备监控 Benchmark**<br>*Industrial Digital Twin Equipment Monitoring* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./IndustrialDigitalTwin/README.md) \| [README](./IndustrialDigitalTwin/README.md) |
| 18 | [`LitRPGNovel`](./LitRPGNovel) | **文字：Minecraft 硬核生存小说 Benchmark**<br>*Minecraft Hardcore LitRPG Long Novel* | Web Games & Interactive Logic | `L3` | [Prompt](./LitRPGNovel/README.md) \| [README](./LitRPGNovel/README.md) |
| 19 | [`MinecraftVOxy`](./MinecraftVOxy) | **我的世界VOxy：区块着色器与渲染引擎 Benchmark**<br>*Minecraft VOxy Chunk Shader & Rendering Engine* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./MinecraftVOxy/README.md) \| [README](./MinecraftVOxy/README.md) |
| 20 | [`MoTa`](./MoTa) | **MoTa：HTML 经典 Flash 风格魔塔 RPG Benchmark**<br>*Classic Flash-Style HTML Magic Tower RPG* | Web Games & Interactive Logic | `L2` | [Prompt](./MoTa/PROJECT_PROMPT.md) \| [README](./MoTa/README.md) |
| 21 | [`Musicgames`](./Musicgames) | **Musicgames：冰与火之舞 × 节奏医生 融合音游 Benchmark**<br>*ADOFAI x Rhythm Doctor Hybrid Music Game* | Web Games & Interactive Logic | `L2` | [Prompt](./Musicgames/PROJECT_PROMPT.md) \| [README](./Musicgames/README.md) |
| 22 | [`PSMCP`](./PSMCP) | **PSMCP：Adobe Photoshop MCP 服务端 Benchmark**<br>*Adobe Photoshop MCP Server Integration* | System Integration & MCP Protocol | `L4` | [Prompt](./PSMCP/README.md) \| [README](./PSMCP/README.md) |
| 23 | [`PenroseStairs`](./PenroseStairs) | **彭罗斯阶梯：HTML 视错觉 Benchmark**<br>*Penrose Optical Illusion 3D Geometry* | 3D Graphics, Physics & Shaders | `L2` | [Prompt](./PenroseStairs/README.md) \| [README](./PenroseStairs/README.md) |
| 24 | [`Poolrooms3D`](./Poolrooms3D) | **池核：3D Poolrooms 步行模拟器 Benchmark**<br>*3D Poolrooms Backrooms Simulator* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./Poolrooms3D/README.md) \| [README](./Poolrooms3D/README.md) |
| 25 | [`PyFlowingLight`](./PyFlowingLight) | **PY流光：Python 桌面悬浮球 Benchmark**<br>*Python Desktop Floating Light Widget* | Python Tools & Native Engines | `L1` | [Prompt](./PyFlowingLight/README.md) \| [README](./PyFlowingLight/README.md) |
| 26 | [`RTX`](./RTX) | **RTX：Web 路径追踪房间 GPU Benchmark**<br>*Web Path Tracing GPU Workload Benchmark* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./RTX/README.md) \| [README](./RTX/README.md) |
| 27 | [`RainWorldCloth`](./RainWorldCloth) | **雨世界：质点-弹簧布料模拟 Benchmark**<br>*Mass-Spring / PBD Cloth Dynamics* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./RainWorldCloth/README.md) \| [README](./RainWorldCloth/README.md) |
| 28 | [`SVG`](./SVG) | **SVG：纯矢量《蒙娜丽莎》笔触复刻 Benchmark**<br>*Pure SVG Vector Mona Lisa Painting Study* | Visual Arts & Modern UI | `L1` | [Prompt](./SVG/README.md) \| [README](./SVG/README.md) |
| 29 | [`SketchUpMCP`](./SketchUpMCP) | **草图大师MCP：SketchUp MCP 桥接器 Benchmark**<br>*SketchUp MCP Bridge Integration* | System Integration & MCP Protocol | `L4` | [Prompt](./SketchUpMCP/README.md) \| [README](./SketchUpMCP/README.md) |
| 30 | [`Sokoban`](./Sokoban) | **推箱子：Three.js 草地 Shader 与推箱子 Benchmark**<br>*Three.js Shader Grass & Sokoban Game* | Web Games & Interactive Logic | `L2` | [Prompt](./Sokoban/README.md) \| [README](./Sokoban/README.md) |
| 31 | [`Telemetry`](./Telemetry) | **遥测：RAC 赛车实时遥测与距离空间重采样分析 Benchmark**<br>*RAC Telemetry & Distance-based Resampling Analysis* | Python Tools & Native Engines | `L4` | [Prompt](./Telemetry/PROJECT_PROMPT.md) \| [README](./Telemetry/README.md) |
| 32 | [`USP`](./USP) | **USP：Match 配重手枪机械分解 Benchmark**<br>*USP Match Gun Disassembly & Low-Poly Scene* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./USP/README.md) \| [README](./USP/README.md) |
| 33 | [`UnifiedInputManager`](./UnifiedInputManager) | **UnifiedInputManager**<br>*UnifiedInputManager* | System Integration & MCP Protocol | `L2` | [Prompt](./UnifiedInputManager/PROJECT_PROMPT.md) \| [README](./UnifiedInputManager/README.md) |
| 34 | [`WeChatCheckinExcel`](./WeChatCheckinExcel) | **签到：微信打卡预约消息自动导入 Excel 系统 Benchmark**<br>*WeChat Message Parser & Excel Importer* | System Integration & MCP Protocol | `L1` | [Prompt](./WeChatCheckinExcel/README.md) \| [README](./WeChatCheckinExcel/README.md) |
| 35 | [`cloth`](./cloth) | **cloth：3D 质点-弹簧布料物理仿真 Benchmark**<br>*3D Mass-Spring Cloth Physics Simulation* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./cloth/PROJECT_PROMPT.md) \| [README](./cloth/README.md) |
| 36 | [`osuMania`](./osuMania) | **osu!mania：Python OpenGL 高效视频渲染工具 Benchmark**<br>*osu!mania Python OpenGL High-Perf Video Renderer* | Python Tools & Native Engines | `L4` | [Prompt](./osuMania/PROJECT_PROMPT.md) \| [README](./osuMania/README.md) |
| 37 | [`teardown`](./teardown) | **teardown：硬表面机械与微体素场景 Benchmark**<br>*Teardown Voxel Diorama & Mechanical Disassembly* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./teardown/README.md) \| [README](./teardown/README.md) |
| 38 | [`前端`](./前端) | **前端**<br>*前端* | System Integration & MCP Protocol | `L2` | [Prompt](./前端/README.md) \| [README](./前端/README.md) |
| 39 | [`双叉臂`](./双叉臂) | **双叉臂**<br>*双叉臂* | System Integration & MCP Protocol | `L2` | [Prompt](./双叉臂/README.md) \| [README](./双叉臂/README.md) |
| 40 | [`小丑牌`](./小丑牌) | **小丑牌**<br>*小丑牌* | System Integration & MCP Protocol | `L2` | [Prompt](./小丑牌/README.md) \| [README](./小丑牌/README.md) |
| 41 | [`推箱子`](./推箱子) | **推箱子**<br>*推箱子* | System Integration & MCP Protocol | `L2` | [Prompt](./推箱子/README.md) \| [README](./推箱子/README.md) |
| 42 | [`池核`](./池核) | **池核**<br>*池核* | System Integration & MCP Protocol | `L2` | [Prompt](./池核/README.md) \| [README](./池核/README.md) |

---

## 3. Classification by Difficulty Level

### Level 1: Basic Utility & Scripting (L1)

Entry-level tasks focused on single-file utilities, DOM parsing, or vector graphic layout.

- [`Archive`](./Archive): Automation scripts & theme switching benchmark
- [`BilibiliUserscript`](./BilibiliUserscript): Bilibili IP location userscript DOM parser
- [`PyFlowingLight`](./PyFlowingLight): Python desktop transparent floating light widget
- [`SVG`](./SVG): Pure SVG Mona Lisa vector painting study
- [`WeChatCheckinExcel`](./WeChatCheckinExcel): WeChat PC message listener & Excel importer

### Level 2: Intermediate Web Applications & Interactive Logic (L2)

Intermediate benchmarks requiring state machine implementation, 2D Canvas games, or complex UI animations.

- [`2048`](./2048): 2048 Roguelike fusion web game
- [`AMLL`](./AMLL): Apple Music dynamic lyrics player with fluid blur background
- [`Balatro`](./Balatro): Balatro poker card game & juice animation replica
- [`DoubleWishbone`](./DoubleWishbone): Car front double wishbone kinematics
- [`FPSlab`](./FPSlab): FPS Aim Lab with sensitivity converter & crosshair builder
- [`FrontendShowcase`](./FrontendShowcase): Cyberpunk anime cel-shader frontend showcase
- [`GoBoard`](./GoBoard): Go 19x19 triple ko situation judgment & rules parser
- [`MoTa`](./MoTa): Classic Flash-style HTML Magic Tower RPG
- [`Musicgames`](./Musicgames): ADOFAI x Rhythm Doctor hybrid rhythm game
- [`PenroseStairs`](./PenroseStairs): Penrose optical illusion 3D isometric stairs
- [`Sokoban`](./Sokoban): Three.js instanced grass shader & Sokoban game

### Level 3: Advanced 3D Engines & Physics Simulations (L3)

High-complexity 3D web applications, custom GLSL shaders, and physical simulations.

- [`Bicycle3D`](./Bicycle3D): Parametric 3D bicycle studio & mechanical drivetrain
- [`cloth`](./cloth): 3D mass-spring cloth physics simulation with wind & stair collision
- [`EscapeFromDuckov`](./EscapeFromDuckov): Escape from Duckov game mechanics & fog shaders
- [`FPV`](./FPV): FPV drone freestyle 3D simulator with SO(3) attitude integration & VTX noise shader
- [`IndustrialDigitalTwin`](./IndustrialDigitalTwin): Industrial digital twin equipment monitoring & raycasting
- [`LitRPGNovel`](./LitRPGNovel): Minecraft LitRPG long novel controlled narrative
- [`MinecraftVOxy`](./MinecraftVOxy): Minecraft VOxy voxel chunk shader & rendering engine
- [`Poolrooms3D`](./Poolrooms3D): 3D Poolrooms backrooms simulator with PBR water shaders
- [`RainWorldCloth`](./RainWorldCloth): Mass-spring / PBD cloth dynamics & obstacle collision
- [`RTX`](./RTX): Web Monte Carlo path tracing GPU benchmark
- [`teardown`](./teardown): Teardown voxel diorama & mechanical disassembly
- [`USP`](./USP): USP Match gun disassembly & low-poly mechanical animation

### Level 4: Expert Native Engines & Systems Engineering (L4)

Expert-level engineering tasks including native C++/Python pipelines, DSP audio synthesis, and MCP server bridges.

- [`BEAMhard`](./BEAMhard): BeamNG vehicle physics & mesh damage simulation benchmark
- [`CFD`](./CFD): Ultra-realistic SPH fluid simulation & refraction shader
- [`DeepSWE`](./DeepSWE): Repository-level software engineering & code refactoring benchmark
- [`EngineSIM`](./EngineSIM): Engine sound procedural DSP synthesis & spectrogram analysis
- [`osuMania`](./osuMania): Python OpenGL high-performance video renderer with 480p skin.ini mapping & FFMPEG pipe
- [`PSMCP`](./PSMCP): Adobe Photoshop MCP server integration & COM automation
- [`SketchUpMCP`](./SketchUpMCP): SketchUp CAD MCP bridge integration & SSE transport
- [`Telemetry`](./Telemetry): RAC car real-time telemetry receiver, distance-based resampling & delta crosshair UI

---

## 4. Audit Guidelines

1. Select a benchmark task from the matrix according to the target domain or evaluation scope.
2. Retrieve the prompt text from the corresponding `PROJECT_PROMPT.md` file.
3. Provide the prompt to the AI model under evaluation without modifying structural constraints.
4. Evaluate generated artifacts based on the verification criteria documented in each project's `README.md`.
