# AI 大语言模型 Benchmark 测试套件

本仓库为一个标准化的 AI 代码生成与系统架构评测套件，共包含 **37 个独立测试项目**。所有测试项按照 4 个难度阶梯目录（L1 至 L4）进行归类存储，并按技术领域整理在 **[DOMAIN_INDEX.zh.md](./DOMAIN_INDEX.zh.md)** 全景索引中。

**[English Documentation →](./README.en.md)** ｜ **[按领域分类的提示词索引（一键复制）→](./DOMAIN_INDEX.zh.md)**

---

## 1. 目录架构

```
benchmark/
├── L1_Basic/                     # Level 1: 基础工具与脚本类（5 个项目）
├── L2_Intermediate/              # Level 2: 中级 Web 应用与交互游戏类（11 个项目）
├── L3_Advanced/                  # Level 3: 高级 3D 引擎与物理仿真类（12 个项目）
├── L4_Expert/                    # Level 4: 专家级原生引擎与硬件协议类（9 个项目）
├── DOMAIN_INDEX.en.md            # 按领域分类的提示词全景索引·英文版（内嵌全文，一键复制）
├── DOMAIN_INDEX.zh.md            # 按领域分类的提示词全景索引·中文版（内嵌全文，一键复制）
├── LICENSE                       # MIT 开源许可证
├── README.md                     # 本文档（中文）
└── README.en.md                  # 英文说明文档
```

---

## 2. 评测领域说明

- **Web 游戏与交互逻辑**：考核游戏状态机、输入响应、规则闭环与 Web Audio 音效同步。
- **3D 图形、物理仿真与 Shaders**：考核 WebGL/WebGPU 着色器、刚体动力学、SO(3) 矩阵积分、SPH 流体及光线追踪。
- **视觉艺术与现代 UI 组件**：考核高密度响应式布局、弥散流体背景、SVG 矢量绘制及高级动效管线。
- **Python 工具与原生引擎**：考核 PyOpenGL、FFMPEG 视频管道、非阻塞 UDP 网络及空间距离重采样。
- **系统集成与 MCP 协议**：考核 Model Context Protocol (MCP) 服务端、操作系统 API Hook 及代码重构。

---

## 3. 测试项目全景表

| 序号 | 项目目录 | 项目名称 | 领域 | 阶梯 | 资源入口 |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 01 | [`Archive`](./L1_Basic/Archive) | **归档：快捷自动化与主题脚本** | 系统集成与 MCP 协议 | `L1` | [提示词](./L1_Basic/Archive/PROJECT_PROMPT.md) \| [评分标准](./L1_Basic/Archive/README.md) |
| 02 | [`BilibiliUserscript`](./L1_Basic/BilibiliUserscript) | **脚本：B站 IP 归属地油猴脚本** | 系统集成与 MCP 协议 | `L1` | [提示词](./L1_Basic/BilibiliUserscript/PROJECT_PROMPT.md) \| [评分标准](./L1_Basic/BilibiliUserscript/README.md) |
| 03 | [`PyFlowingLight`](./L1_Basic/PyFlowingLight) | **PY流光：Python 桌面悬浮球** | Python 工具与原生引擎 | `L1` | [提示词](./L1_Basic/PyFlowingLight/PROJECT_PROMPT.md) \| [评分标准](./L1_Basic/PyFlowingLight/README.md) |
| 04 | [`SVG`](./L1_Basic/SVG) | **SVG：纯矢量《蒙娜丽莎》笔触复刻** | 视觉艺术与现代 UI 组件 | `L1` | [提示词](./L1_Basic/SVG/PROJECT_PROMPT.md) \| [评分标准](./L1_Basic/SVG/README.md) |
| 05 | [`WeChatCheckinExcel`](./L1_Basic/WeChatCheckinExcel) | **签到：微信打卡预约消息自动导入 Excel 系统** | 系统集成与 MCP 协议 | `L1` | [提示词](./L1_Basic/WeChatCheckinExcel/PROJECT_PROMPT.md) \| [评分标准](./L1_Basic/WeChatCheckinExcel/README.md) |
| 06 | [`2048`](./L2_Intermediate/2048) | **2048：Roguelike 融合网页游戏** | Web 游戏与交互逻辑 | `L2` | [提示词](./L2_Intermediate/2048/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/2048/README.md) |
| 07 | [`AMLL`](./L2_Intermediate/AMLL) | **AMLL：Apple Music 动态歌词播放器** | 视觉艺术与现代 UI 组件 | `L2` | [提示词](./L2_Intermediate/AMLL/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/AMLL/README.md) |
| 08 | [`Balatro`](./L2_Intermediate/Balatro) | **小丑牌：网页卡牌游戏与动效复刻** | Web 游戏与交互逻辑 | `L2` | [提示词](./L2_Intermediate/Balatro/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/Balatro/README.md) |
| 09 | [`DoubleWishbone`](./L2_Intermediate/DoubleWishbone) | **双叉臂：汽车前悬挂运动学** | 3D 图形、物理仿真与 Shaders | `L2` | [提示词](./L2_Intermediate/DoubleWishbone/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/DoubleWishbone/README.md) |
| 10 | [`FPSlab`](./L2_Intermediate/FPSlab) | **FPSlab：多游戏适应 FPS 小球练枪** | Web 游戏与交互逻辑 | `L2` | [提示词](./L2_Intermediate/FPSlab/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/FPSlab/README.md) |
| 11 | [`FrontendShowcase`](./L2_Intermediate/FrontendShowcase) | **前端：赛博朋克风格前端展台** | 视觉艺术与现代 UI 组件 | `L2` | [提示词](./L2_Intermediate/FrontendShowcase/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/FrontendShowcase/README.md) |
| 12 | [`GoBoard`](./L2_Intermediate/GoBoard) | **围棋：三劫循环局面判断** | Web 游戏与交互逻辑 | `L2` | [提示词](./L2_Intermediate/GoBoard/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/GoBoard/README.md) |
| 13 | [`MoTa`](./L2_Intermediate/MoTa) | **MoTa：HTML 经典 Flash 风格魔塔 RPG** | Web 游戏与交互逻辑 | `L2` | [提示词](./L2_Intermediate/MoTa/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/MoTa/README.md) |
| 14 | [`Musicgames`](./L2_Intermediate/Musicgames) | **Musicgames：冰与火之舞 × 节奏医生 融合音游** | Web 游戏与交互逻辑 | `L2` | [提示词](./L2_Intermediate/Musicgames/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/Musicgames/README.md) |
| 15 | [`PenroseStairs`](./L2_Intermediate/PenroseStairs) | **彭罗斯阶梯：HTML 视错觉** | 3D 图形、物理仿真与 Shaders | `L2` | [提示词](./L2_Intermediate/PenroseStairs/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/PenroseStairs/README.md) |
| 16 | [`Sokoban`](./L2_Intermediate/Sokoban) | **推箱子：Three.js 草地 Shader 与推箱子** | Web 游戏与交互逻辑 | `L2` | [提示词](./L2_Intermediate/Sokoban/PROJECT_PROMPT.md) \| [评分标准](./L2_Intermediate/Sokoban/README.md) |
| 17 | [`Bicycle3D`](./L3_Advanced/Bicycle3D) | **自行车：参数化 3D 工作室与传动系统** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/Bicycle3D/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/Bicycle3D/README.md) |
| 18 | [`EscapeFromDuckov`](./L3_Advanced/EscapeFromDuckov) | **逃离鸭科夫：游戏系统与着色器特效** | 3D 图形、物理仿真与 Shaders | `L3` | ⚠️ 拟建测试项（提示词与说明待发布） |
| 19 | [`FPV`](./L3_Advanced/FPV) | **FPV：穿越机花飞 3D 模拟器** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/FPV/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/FPV/README.md) |
| 20 | [`IndustrialDigitalTwin`](./L3_Advanced/IndustrialDigitalTwin) | **工业数字孪生设备监控** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/IndustrialDigitalTwin/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/IndustrialDigitalTwin/README.md) |
| 21 | [`LitRPGNovel`](./L3_Advanced/LitRPGNovel) | **文字：Minecraft 硬核生存小说** | Web 游戏与交互逻辑 | `L3` | [提示词](./L3_Advanced/LitRPGNovel/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/LitRPGNovel/README.md) |
| 22 | [`MinecraftVOxy`](./L3_Advanced/MinecraftVOxy) | **我的世界VOxy：区块着色器与渲染引擎** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/MinecraftVOxy/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/MinecraftVOxy/README.md) |
| 23 | [`Poolrooms3D`](./L3_Advanced/Poolrooms3D) | **池核：3D Poolrooms 步行模拟器** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/Poolrooms3D/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/Poolrooms3D/README.md) |
| 24 | [`RTX`](./L3_Advanced/RTX) | **RTX：Web 路径追踪房间 GPU** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/RTX/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/RTX/README.md) |
| 25 | [`RainWorld`](./L3_Advanced/RainWorld) | **雨世界：质点-弹簧布料模拟** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/RainWorld/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/RainWorld/README.md) |
| 26 | [`USP`](./L3_Advanced/USP) | **USP：Match 配重手枪机械分解** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/USP/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/USP/README.md) |
| 27 | [`cloth`](./L3_Advanced/cloth) | **cloth：3D 质点-弹簧布料物理仿真** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/cloth/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/cloth/README.md) |
| 28 | [`teardown`](./L3_Advanced/teardown) | **teardown：硬表面机械与微体素场景** | 3D 图形、物理仿真与 Shaders | `L3` | [提示词](./L3_Advanced/teardown/PROJECT_PROMPT.md) \| [评分标准](./L3_Advanced/teardown/README.md) |
| 29 | [`BEAMhard`](./L4_Expert/BEAMhard) | **BEAMhard：BeamNG 软体车辆物理与损毁模拟** | 系统集成与 MCP 协议 | `L4` | [提示词](./L4_Expert/BEAMhard/PROJECT_PROMPT.md) \| [评分标准](./L4_Expert/BEAMhard/README.md) |
| 30 | [`CFD`](./L4_Expert/CFD) | **CFD：超拟真流体计算与物理渲染** | 3D 图形、物理仿真与 Shaders | `L4` | [提示词](./L4_Expert/CFD/PROJECT_PROMPT.md) \| [评分标准](./L4_Expert/CFD/README.md) |
| 31 | [`DeepSWE`](./L4_Expert/DeepSWE) | **DeepSWE：软件工程与代码演进** | 系统集成与 MCP 协议 | `L4` | [提示词](./L4_Expert/DeepSWE/PROJECT_PROMPT.md) \| [评分标准](./L4_Expert/DeepSWE/README.md) |
| 32 | [`EngineSIM`](./L4_Expert/EngineSIM) | **EngineSIM：引擎声浪与 DSP 音频合成** | Python 工具与原生引擎 | `L4` | [提示词](./L4_Expert/EngineSIM/PROJECT_PROMPT.md) \| [评分标准](./L4_Expert/EngineSIM/README.md) |
| 33 | [`PSMCP`](./L4_Expert/PSMCP) | **PSMCP：Adobe Photoshop MCP 服务端** | 系统集成与 MCP 协议 | `L4` | [提示词](./L4_Expert/PSMCP/PROJECT_PROMPT.md) \| [评分标准](./L4_Expert/PSMCP/README.md) |
| 34 | [`SketchUpMCP`](./L4_Expert/SketchUpMCP) | **草图大师MCP：SketchUp MCP 桥接器** | 系统集成与 MCP 协议 | `L4` | [提示词](./L4_Expert/SketchUpMCP/PROJECT_PROMPT.md) \| [评分标准](./L4_Expert/SketchUpMCP/README.md) |
| 35 | [`Telemetry`](./L4_Expert/Telemetry) | **遥测：RAC 赛车实时遥测与距离空间重采样分析** | Python 工具与原生引擎 | `L4` | [提示词](./L4_Expert/Telemetry/PROJECT_PROMPT.md) \| [评分标准](./L4_Expert/Telemetry/README.md) |
| 36 | [`UnifiedInputManager`](./L4_Expert/UnifiedInputManager) | **UnifiedInputManager：跨平台 Controller 统一输入管理器** | Python 工具与原生引擎 | `L4` | [提示词](./L4_Expert/UnifiedInputManager/PROJECT_PROMPT.md) \| [评分标准](./L4_Expert/UnifiedInputManager/README.md) |
| 37 | [`osuMania`](./L4_Expert/osuMania) | **osu!mania：Python OpenGL 高效视频渲染工具** | Python 工具与原生引擎 | `L4` | [提示词](./L4_Expert/osuMania/PROJECT_PROMPT.md) \| [评分标准](./L4_Expert/osuMania/README.md) |

---

## 4. 难度阶梯与项目清单

### Level 1: 基础工具与脚本类 (L1_Basic)

针对单文件小工具、DOM 节点解析、自动化脚本与矢量图形绘制能力。

- [`Archive`](./L1_Basic/Archive): 归档：快捷自动化与主题脚本
- [`BilibiliUserscript`](./L1_Basic/BilibiliUserscript): 脚本：B站 IP 归属地油猴脚本
- [`PyFlowingLight`](./L1_Basic/PyFlowingLight): PY流光：Python 桌面悬浮球
- [`SVG`](./L1_Basic/SVG): SVG：纯矢量《蒙娜丽莎》笔触复刻
- [`WeChatCheckinExcel`](./L1_Basic/WeChatCheckinExcel): 签到：微信打卡预约消息自动导入 Excel 系统

### Level 2: 中级 Web 应用与交互游戏类 (L2_Intermediate)

针对复杂状态机、2D Canvas 游戏、UI 交互动效与物理 UI 组件能力。

- [`2048`](./L2_Intermediate/2048): 2048：Roguelike 融合网页游戏
- [`AMLL`](./L2_Intermediate/AMLL): AMLL：Apple Music 动态歌词播放器
- [`Balatro`](./L2_Intermediate/Balatro): 小丑牌：网页卡牌游戏与动效复刻
- [`DoubleWishbone`](./L2_Intermediate/DoubleWishbone): 双叉臂：汽车前悬挂运动学
- [`FPSlab`](./L2_Intermediate/FPSlab): FPSlab：多游戏适应 FPS 小球练枪
- [`FrontendShowcase`](./L2_Intermediate/FrontendShowcase): 前端：赛博朋克风格前端展台
- [`GoBoard`](./L2_Intermediate/GoBoard): 围棋：三劫循环局面判断
- [`MoTa`](./L2_Intermediate/MoTa): MoTa：HTML 经典 Flash 风格魔塔 RPG
- [`Musicgames`](./L2_Intermediate/Musicgames): Musicgames：冰与火之舞 × 节奏医生 融合音游
- [`PenroseStairs`](./L2_Intermediate/PenroseStairs): 彭罗斯阶梯：HTML 视错觉
- [`Sokoban`](./L2_Intermediate/Sokoban): 推箱子：Three.js 草地 Shader 与推箱子

### Level 3: 高级 3D 引擎与物理仿真类 (L3_Advanced)

针对 WebGL/Three.js 3D 渲染引擎、自定义 GLSL 着色器、质点弹簧物理及 PBR 场景能力。

- [`Bicycle3D`](./L3_Advanced/Bicycle3D): 自行车：参数化 3D 工作室与传动系统
- [`EscapeFromDuckov`](./L3_Advanced/EscapeFromDuckov): 逃离鸭科夫：游戏系统与着色器特效 ⚠️ 拟建测试项，提示词待发布
- [`FPV`](./L3_Advanced/FPV): FPV：穿越机花飞 3D 模拟器
- [`IndustrialDigitalTwin`](./L3_Advanced/IndustrialDigitalTwin): 工业数字孪生设备监控
- [`LitRPGNovel`](./L3_Advanced/LitRPGNovel): 文字：Minecraft 硬核生存小说
- [`MinecraftVOxy`](./L3_Advanced/MinecraftVOxy): 我的世界VOxy：区块着色器与渲染引擎
- [`Poolrooms3D`](./L3_Advanced/Poolrooms3D): 池核：3D Poolrooms 步行模拟器
- [`RTX`](./L3_Advanced/RTX): RTX：Web 路径追踪房间 GPU
- [`RainWorld`](./L3_Advanced/RainWorld): 雨世界：质点-弹簧布料模拟
- [`USP`](./L3_Advanced/USP): USP：Match 配重手枪机械分解
- [`cloth`](./L3_Advanced/cloth): cloth：3D 质点-弹簧布料物理仿真
- [`teardown`](./L3_Advanced/teardown): teardown：硬表面机械与微体素场景

### Level 4: 专家级原生引擎与硬件协议类 (L4_Expert)

针对 Python 原生图形渲染、DSP 音频合成、UDP 实时遥测及硬件 SDK 接口协议能力。

- [`BEAMhard`](./L4_Expert/BEAMhard): BEAMhard：BeamNG 软体车辆物理与损毁模拟
- [`CFD`](./L4_Expert/CFD): CFD：超拟真流体计算与物理渲染
- [`DeepSWE`](./L4_Expert/DeepSWE): DeepSWE：软件工程与代码演进
- [`EngineSIM`](./L4_Expert/EngineSIM): EngineSIM：引擎声浪与 DSP 音频合成
- [`PSMCP`](./L4_Expert/PSMCP): PSMCP：Adobe Photoshop MCP 服务端
- [`SketchUpMCP`](./L4_Expert/SketchUpMCP): 草图大师MCP：SketchUp MCP 桥接器
- [`Telemetry`](./L4_Expert/Telemetry): 遥测：RAC 赛车实时遥测与距离空间重采样分析
- [`UnifiedInputManager`](./L4_Expert/UnifiedInputManager): UnifiedInputManager：跨平台 Controller 统一输入管理器
- [`osuMania`](./L4_Expert/osuMania): osu!mania：Python OpenGL 高效视频渲染工具

---

## 5. 评测与审计指南

1. 从上方表格中选择目标评测领域或难度阶梯对应的项目。
2. 打开对应项目目录下的 `PROJECT_PROMPT.md` 文件获取完整提示词 —— 或直接打开 **[DOMAIN_INDEX.zh.md](./DOMAIN_INDEX.zh.md)**，全部提示词已内嵌其中，展开即可一键复制。
3. 将提示词直接输入给待测 AI 大语言模型，**不要修改任何技术约束**。
4. 对照该项目 `README.md` 中定义的验收与评分标准进行客观评估。

---

## 6. 开源协议

本项目基于 [MIT 许可证](LICENSE) 开源。
