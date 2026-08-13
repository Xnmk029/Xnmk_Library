# AI Prompt Test Benchmark Suite

This repository is a standardized evaluation suite containing **39 benchmark projects** (L1–L4) for auditing AI code generation, physics simulations, 3D graphics, and hardware protocols, plus a root-level **[Image/](./Image/)** partition with **6** independent image-generation items. L1–L4 projects are stored in 4 difficulty tiers and catalogued by domain in **[DOMAIN_INDEX.en.md](./DOMAIN_INDEX.en.md)**; image items are listed in **[Image/README.md](./Image/README.md)**.

**[中文文档 →](./README.md)** ｜ **[Domain Catalog with Copy-Ready Prompts →](./DOMAIN_INDEX.en.md)** ｜ **[Image Partition →](./Image/README.md)**

---

## 1. Directory Architecture

```
benchmark/
├── L1_Basic/                     # Level 1: Basic tools & scripts (5 projects)
├── L2_Intermediate/              # Level 2: Web apps & interactive games (11 projects)
├── L3_Advanced/                  # Level 3: 3D engines & physics simulation (14 projects)
├── L4_Expert/                    # Level 4: Native engines & hardware protocols (9 projects)
├── Image/                        # Image generation & editing (6 independent items)
├── DOMAIN_INDEX.en.md            # Domain catalog with embedded copy-ready prompts (English)
├── DOMAIN_INDEX.zh.md            # Domain catalog with embedded copy-ready prompts (Chinese)
├── LICENSE                       # MIT License
├── README.md                     # Chinese documentation
└── README.en.md                  # This document (English)
```

---

## 2. Technical Domains

- **Web Games & Interactive Logic**: Evaluates game state machines, input responsiveness, rule closure, and Web Audio sound synchronization.
- **3D Graphics, Physics & Shaders**: Evaluates WebGL/WebGPU shaders, rigid-body dynamics, SO(3) matrix integration, SPH fluids, and ray tracing.
- **Visual Arts & Modern UI**: Evaluates high-density responsive layouts, diffused fluid backgrounds, SVG vector drawing, and advanced motion pipelines.
- **Python Tools & Native Engines**: Evaluates PyOpenGL, FFMPEG video pipelines, non-blocking UDP networking, and spatial distance resampling.
- **System Integration & MCP Protocol**: Evaluates Model Context Protocol (MCP) servers, OS API hooks, and code refactoring.
- **Image Generation & Editing** ([`Image/`](./Image/)): Evaluates text-to-image / image-to-image, structure preservation, style constraints, and layout/text fidelity.

---

## 3. Complete Benchmark Matrix

| # | Directory | Title | Domain | Tier | Resources |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 01 | [`Archive`](./L1_Basic/Archive) | Automation Scripts Archive | System Integration & MCP Protocol | `L1` | [Prompt](./L1_Basic/Archive/PROJECT_PROMPT.md) \| [Rubric](./L1_Basic/Archive/README.md) |
| 02 | [`BilibiliUserscript`](./L1_Basic/BilibiliUserscript) | Bilibili IP Location Userscript | System Integration & MCP Protocol | `L1` | [Prompt](./L1_Basic/BilibiliUserscript/PROJECT_PROMPT.md) \| [Rubric](./L1_Basic/BilibiliUserscript/README.md) |
| 03 | [`PyFlowingLight`](./L1_Basic/PyFlowingLight) | Python Desktop Floating Light Widget | Python Tools & Native Engines | `L1` | [Prompt](./L1_Basic/PyFlowingLight/PROJECT_PROMPT.md) \| [Rubric](./L1_Basic/PyFlowingLight/README.md) |
| 04 | [`SVG`](./L1_Basic/SVG) | Pure SVG Vector Mona Lisa Painting Study | Visual Arts & Modern UI | `L1` | [Prompt](./L1_Basic/SVG/PROJECT_PROMPT.md) \| [Rubric](./L1_Basic/SVG/README.md) |
| 05 | [`WeChatCheckinExcel`](./L1_Basic/WeChatCheckinExcel) | WeChat Message Parser & Excel Importer | System Integration & MCP Protocol | `L1` | [Prompt](./L1_Basic/WeChatCheckinExcel/PROJECT_PROMPT.md) \| [Rubric](./L1_Basic/WeChatCheckinExcel/README.md) |
| 06 | [`2048`](./L2_Intermediate/2048) | 2048: Roguelike Fusion Web Game | Web Games & Interactive Logic | `L2` | [Prompt](./L2_Intermediate/2048/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/2048/README.md) |
| 07 | [`AMLL`](./L2_Intermediate/AMLL) | Apple Music Lyrics Player UI | Visual Arts & Modern UI | `L2` | [Prompt](./L2_Intermediate/AMLL/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/AMLL/README.md) |
| 08 | [`Balatro`](./L2_Intermediate/Balatro) | Balatro Poker Card Game Replica | Web Games & Interactive Logic | `L2` | [Prompt](./L2_Intermediate/Balatro/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/Balatro/README.md) |
| 09 | [`DoubleWishbone`](./L2_Intermediate/DoubleWishbone) | Car Front Double Wishbone Kinematics | 3D Graphics, Physics & Shaders | `L2` | [Prompt](./L2_Intermediate/DoubleWishbone/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/DoubleWishbone/README.md) |
| 10 | [`FPSlab`](./L2_Intermediate/FPSlab) | FPS Aim Lab & Multi-Game Range | Web Games & Interactive Logic | `L2` | [Prompt](./L2_Intermediate/FPSlab/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/FPSlab/README.md) |
| 11 | [`FrontendShowcase`](./L2_Intermediate/FrontendShowcase) | Cyberpunk Frontend Showcase & Portfolio | Visual Arts & Modern UI | `L2` | [Prompt](./L2_Intermediate/FrontendShowcase/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/FrontendShowcase/README.md) |
| 12 | [`GoBoard`](./L2_Intermediate/GoBoard) | Go 19x19 Triple Ko Situation Judgment | Web Games & Interactive Logic | `L2` | [Prompt](./L2_Intermediate/GoBoard/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/GoBoard/README.md) |
| 13 | [`MoTa`](./L2_Intermediate/MoTa) | Classic Flash-Style HTML Magic Tower RPG | Web Games & Interactive Logic | `L2` | [Prompt](./L2_Intermediate/MoTa/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/MoTa/README.md) |
| 14 | [`Musicgames`](./L2_Intermediate/Musicgames) | ADOFAI x Rhythm Doctor Hybrid Music Game | Web Games & Interactive Logic | `L2` | [Prompt](./L2_Intermediate/Musicgames/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/Musicgames/README.md) |
| 15 | [`PenroseStairs`](./L2_Intermediate/PenroseStairs) | Penrose Optical Illusion 3D Geometry | 3D Graphics, Physics & Shaders | `L2` | [Prompt](./L2_Intermediate/PenroseStairs/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/PenroseStairs/README.md) |
| 16 | [`Sokoban`](./L2_Intermediate/Sokoban) | Three.js Shader Grass & Sokoban Game | Web Games & Interactive Logic | `L2` | [Prompt](./L2_Intermediate/Sokoban/PROJECT_PROMPT.md) \| [Rubric](./L2_Intermediate/Sokoban/README.md) |
| 17 | [`Bicycle3D`](./L3_Advanced/Bicycle3D) | Parametric 3D Bicycle Studio & Assembly Simulator | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/Bicycle3D/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/Bicycle3D/README.md) |
| 18 | [`BicycleDrivetrain`](./L3_Advanced/BicycleDrivetrain) | **Low-poly Dynamic Bicycle Drivetrain Display Stand** | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/BicycleDrivetrain/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/BicycleDrivetrain/README.md) |
| 19 | [`EscapeFromDuckov`](./L3_Advanced/EscapeFromDuckov) | Escape from Duckov Game Design & Shaders | 3D Graphics, Physics & Shaders | `L3` | ⚠️ Planned — prompt & rubric to be published |
| 20 | [`FPV`](./L3_Advanced/FPV) | FPV Drone Freestyle 3D Simulator | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/FPV/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/FPV/README.md) |
| 21 | [`IndustrialDigitalTwin`](./L3_Advanced/IndustrialDigitalTwin) | Industrial Digital Twin Equipment Monitoring | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/IndustrialDigitalTwin/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/IndustrialDigitalTwin/README.md) |
| 22 | [`LitRPGNovel`](./L3_Advanced/LitRPGNovel) | Minecraft Hardcore LitRPG Long Novel | Web Games & Interactive Logic | `L3` | [Prompt](./L3_Advanced/LitRPGNovel/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/LitRPGNovel/README.md) |
| 23 | [`MinecraftVOxy`](./L3_Advanced/MinecraftVOxy) | Minecraft VOxy Chunk Shader & Rendering Engine | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/MinecraftVOxy/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/MinecraftVOxy/README.md) |
| 24 | [`Poolrooms3D`](./L3_Advanced/Poolrooms3D) | 3D Poolrooms Backrooms Simulator | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/Poolrooms3D/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/Poolrooms3D/README.md) |
| 25 | [`RTX`](./L3_Advanced/RTX) | Web Path Tracing GPU Workload Benchmark | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/RTX/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/RTX/README.md) |
| 26 | [`RainWorld`](./L3_Advanced/RainWorld) | Mass-Spring / PBD Cloth Dynamics | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/RainWorld/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/RainWorld/README.md) |
| 27 | [`USP`](./L3_Advanced/USP) | USP Match Gun Disassembly & Low-Poly Scene | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/USP/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/USP/README.md) |
| 28 | [`cloth`](./L3_Advanced/cloth) | 3D Mass-Spring Cloth Physics Simulation | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/cloth/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/cloth/README.md) |
| 29 | [`Minecraft`](./L3_Advanced/Minecraft) | *Minecraft-style Voxel Sandbox* | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/Minecraft/PROJECT_PROMPT.md) |
| 30 | [`teardown`](./L3_Advanced/teardown) | Teardown Voxel Diorama & Mechanical Disassembly | 3D Graphics, Physics & Shaders | `L3` | [Prompt](./L3_Advanced/teardown/PROJECT_PROMPT.md) \| [Rubric](./L3_Advanced/teardown/README.md) |
| 31 | [`BEAMhard`](./L4_Expert/BEAMhard) | BEAMhard: BeamNG Vehicle Physics & Damage | System Integration & MCP Protocol | `L4` | [Prompt](./L4_Expert/BEAMhard/PROJECT_PROMPT.md) \| [Rubric](./L4_Expert/BEAMhard/README.md) |
| 32 | [`CFD`](./L4_Expert/CFD) | Ultra-Realistic CFD Fluid Simulation & Rendering | 3D Graphics, Physics & Shaders | `L4` | [Prompt](./L4_Expert/CFD/PROJECT_PROMPT.md) \| [Rubric](./L4_Expert/CFD/README.md) |
| 33 | [`DeepSWE`](./L4_Expert/DeepSWE) | DeepSWE Benchmark Evaluation Tasks | System Integration & MCP Protocol | `L4` | [Prompt](./L4_Expert/DeepSWE/PROJECT_PROMPT.md) \| [Rubric](./L4_Expert/DeepSWE/README.md) |
| 34 | [`EngineSIM`](./L4_Expert/EngineSIM) | Engine Sound & DSP Audio Synthesis | Python Tools & Native Engines | `L4` | [Prompt](./L4_Expert/EngineSIM/PROJECT_PROMPT.md) \| [Rubric](./L4_Expert/EngineSIM/README.md) |
| 35 | [`PSMCP`](./L4_Expert/PSMCP) | Adobe Photoshop MCP Server Integration | System Integration & MCP Protocol | `L4` | [Prompt](./L4_Expert/PSMCP/PROJECT_PROMPT.md) \| [Rubric](./L4_Expert/PSMCP/README.md) |
| 36 | [`SketchUpMCP`](./L4_Expert/SketchUpMCP) | SketchUp MCP Bridge Integration | System Integration & MCP Protocol | `L4` | [Prompt](./L4_Expert/SketchUpMCP/PROJECT_PROMPT.md) \| [Rubric](./L4_Expert/SketchUpMCP/README.md) |
| 37 | [`Telemetry`](./L4_Expert/Telemetry) | RAC Telemetry & Distance-based Resampling Analysis | Python Tools & Native Engines | `L4` | [Prompt](./L4_Expert/Telemetry/PROJECT_PROMPT.md) \| [Rubric](./L4_Expert/Telemetry/README.md) |
| 38 | [`UnifiedInputManager`](./L4_Expert/UnifiedInputManager) | Unified Controller Input Manager | Python Tools & Native Engines | `L4` | [Prompt](./L4_Expert/UnifiedInputManager/PROJECT_PROMPT.md) \| [Rubric](./L4_Expert/UnifiedInputManager/README.md) |
| 39 | [`osuMania`](./L4_Expert/osuMania) | osu!mania Python OpenGL High-Perf Video Renderer | Python Tools & Native Engines | `L4` | [Prompt](./L4_Expert/osuMania/PROJECT_PROMPT.md) \| [Rubric](./L4_Expert/osuMania/README.md) |
| 40 | [`ArchPhotoreal`](./Image/ArchPhotoreal) | Architecture Photorealization | Image Generation & Editing | `Image` | [Prompt](./Image/ArchPhotoreal/PROJECT_PROMPT.md) \| [Rubric](./Image/ArchPhotoreal/README.md) |
| 41 | [`StandardBooks3D`](./Image/StandardBooks3D) | National-Standard Books 3D Product Render | Image Generation & Editing | `Image` | [Prompt](./Image/StandardBooks3D/PROJECT_PROMPT.md) \| [Rubric](./Image/StandardBooks3D/README.md) |
| 42 | [`ConstructivistPoster`](./Image/ConstructivistPoster) | Constructivist Promo Poster | Image Generation & Editing | `Image` | [Prompt](./Image/ConstructivistPoster/PROJECT_PROMPT.md) \| [Rubric](./Image/ConstructivistPoster/README.md) |
| 43 | [`WindowGlitchPoster`](./Image/WindowGlitchPoster) | Window-Overlay Glitch Poster | Image Generation & Editing | `Image` | [Prompt](./Image/WindowGlitchPoster/PROJECT_PROMPT.md) \| [Rubric](./Image/WindowGlitchPoster/README.md) |
| 44 | [`GovTechPPT`](./Image/GovTechPPT) | Government/Tech PPT Poster | Image Generation & Editing | `Image` | [Prompt](./Image/GovTechPPT/PROJECT_PROMPT.md) \| [Rubric](./Image/GovTechPPT/README.md) |
| 45 | [`TextbookPeachBlossom`](./Image/TextbookPeachBlossom) | Peach Blossom Spring Textbook Spread | Image Generation & Editing | `Image` | [Prompt](./Image/TextbookPeachBlossom/PROJECT_PROMPT.md) \| [Rubric](./Image/TextbookPeachBlossom/README.md) |

> See **[Image/README.md](./Image/README.md)** for the image partition overview.

---
## 4. Tier Breakdown & Registry

### Level 1: Basic Tools & Scripts

Targeting single-file tools, DOM parsing, automation scripts, and vector graphics.

- [`Archive`](./L1_Basic/Archive): Automation scripts & theme switching benchmark
- [`BilibiliUserscript`](./L1_Basic/BilibiliUserscript): Bilibili IP location userscript DOM parser
- [`PyFlowingLight`](./L1_Basic/PyFlowingLight): Python desktop transparent floating light widget
- [`SVG`](./L1_Basic/SVG): Pure SVG Mona Lisa vector painting study
- [`WeChatCheckinExcel`](./L1_Basic/WeChatCheckinExcel): WeChat PC message listener & Excel importer

### Level 2: Web Applications & Interactive Games

Targeting state machine implementation, Canvas 2D games, UI animations, and physical UI components.

- [`2048`](./L2_Intermediate/2048): 2048 Roguelike fusion web game
- [`AMLL`](./L2_Intermediate/AMLL): Apple Music dynamic lyrics player with fluid blur background
- [`Balatro`](./L2_Intermediate/Balatro): Balatro poker card game & juice animation replica
- [`DoubleWishbone`](./L2_Intermediate/DoubleWishbone): Car front double wishbone kinematics
- [`FPSlab`](./L2_Intermediate/FPSlab): FPS Aim Lab with sensitivity converter & crosshair builder
- [`FrontendShowcase`](./L2_Intermediate/FrontendShowcase): Cyberpunk anime cel-shader frontend showcase
- [`GoBoard`](./L2_Intermediate/GoBoard): Go 19x19 triple ko situation judgment & rules parser
- [`MoTa`](./L2_Intermediate/MoTa): Classic Flash-style HTML Magic Tower RPG
- [`Musicgames`](./L2_Intermediate/Musicgames): ADOFAI x Rhythm Doctor hybrid rhythm game
- [`PenroseStairs`](./L2_Intermediate/PenroseStairs): Penrose optical illusion 3D isometric stairs
- [`Sokoban`](./L2_Intermediate/Sokoban): Three.js instanced grass shader & Sokoban game

### Level 3: 3D Engines & Physics Simulation

Targeting WebGL/Three.js engines, custom GLSL shaders, rigid body dynamics, and PBR environments.

- [`Bicycle3D`](./L3_Advanced/Bicycle3D): Parametric 3D bicycle studio & assembly simulator
- [`BicycleDrivetrain`](./L3_Advanced/BicycleDrivetrain): Low-poly dynamic bicycle drivetrain display stand
- [`EscapeFromDuckov`](./L3_Advanced/EscapeFromDuckov): Escape from Duckov game mechanics & fog shaders ⚠️ Planned, prompt to be published
- [`FPV`](./L3_Advanced/FPV): FPV drone freestyle 3D simulator with SO(3) attitude integration & VTX noise shader
- [`IndustrialDigitalTwin`](./L3_Advanced/IndustrialDigitalTwin): Industrial digital twin equipment monitoring & raycasting
- [`LitRPGNovel`](./L3_Advanced/LitRPGNovel): Minecraft LitRPG long novel controlled narrative
- [`MinecraftVOxy`](./L3_Advanced/MinecraftVOxy): Minecraft VOxy voxel chunk shader & rendering engine
- [`Poolrooms3D`](./L3_Advanced/Poolrooms3D): 3D Poolrooms backrooms simulator with PBR water shaders
- [`RTX`](./L3_Advanced/RTX): Web Monte Carlo path tracing GPU benchmark
- [`RainWorld`](./L3_Advanced/RainWorld): Mass-spring / PBD cloth dynamics & obstacle collision
- [`USP`](./L3_Advanced/USP): USP Match gun disassembly & low-poly mechanical animation
- [`cloth`](./L3_Advanced/cloth): 3D mass-spring cloth physics simulation with wind & stair collision
- [`Minecraft`](./L3_Advanced/Minecraft): Minecraft-style Voxel Sandbox
- [`teardown`](./L3_Advanced/teardown): Teardown voxel diorama & mechanical disassembly

### Level 4: Native Engines & Hardware Protocols

Targeting native Python/C++/OpenGL rendering engines, DSP audio synthesis, UDP telemetry, and hardware protocols.

- [`BEAMhard`](./L4_Expert/BEAMhard): BeamNG vehicle physics & mesh damage simulation benchmark
- [`CFD`](./L4_Expert/CFD): Ultra-realistic SPH fluid simulation & refraction shader
- [`DeepSWE`](./L4_Expert/DeepSWE): Repository-level software engineering & code refactoring benchmark
- [`EngineSIM`](./L4_Expert/EngineSIM): Engine sound procedural DSP synthesis & spectrogram analysis
- [`PSMCP`](./L4_Expert/PSMCP): Adobe Photoshop MCP server integration & COM automation
- [`SketchUpMCP`](./L4_Expert/SketchUpMCP): SketchUp CAD MCP bridge integration & SSE transport
- [`Telemetry`](./L4_Expert/Telemetry): RAC car real-time telemetry receiver, distance-based resampling & delta crosshair UI
- [`UnifiedInputManager`](./L4_Expert/UnifiedInputManager): Unified controller input manager for XInput, SteamInput, RawHID, PS, Switch
- [`osuMania`](./L4_Expert/osuMania): Python OpenGL high-performance video renderer with 480p skin.ini mapping & FFMPEG pipe

---

## 5. Evaluation Guidelines

1. Select a benchmark project from the table above based on target domain or difficulty level.
2. Retrieve the full prompt from the project's `PROJECT_PROMPT.md` — or open **[DOMAIN_INDEX.en.md](./DOMAIN_INDEX.en.md)**, where every prompt is embedded and can be copied in one click.
3. Submit the prompt text to the target LLM under test **without modifying technical constraints**.
4. Evaluate the generated outputs against the rubric specified in the project's `README.md`.

---

## 6. License

This project is licensed under the [MIT License](LICENSE).
