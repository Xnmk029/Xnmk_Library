# Benchmark Catalog · by Technical Domain

**[中文索引 →](./DOMAIN_INDEX.zh.md)** ｜ **[Back to README →](./README.en.md)**

All 37 benchmark projects organized by **5 technical domains** — no difficulty tiers here. Every prompt is embedded in full below: expand and copy, no page jumps needed.

---

## How to Use

1. Browse the domain sections below, or jump via [Quick Navigation](#quick-navigation).
2. Click **📋 Full prompt** on any project to expand the complete prompt text.
3. Click the **copy button** in the top-right corner of the code block (rendered automatically by GitHub).
4. Paste the prompt into the LLM under test — **do not modify any technical constraints**.
5. Score the output against that project's `README.md` rubric.

> All prompts are shown in their original Chinese (verbatim from source files) to keep evaluation results comparable.

---

## Quick Navigation

| Domain | Projects | Included |
|---|:-:|---|
| [🎮 Web Games & Interactive Logic](#web) | 8 | 2048 · Balatro · FPSlab · GoBoard · MoTa · Musicgames · Sokoban · LitRPGNovel |
| [🧊 3D Graphics, Physics & Shaders](#graphics) | 14 | DoubleWishbone · PenroseStairs · Bicycle3D · EscapeFromDuckov · FPV · IndustrialDigitalTwin · MinecraftVOxy · Poolrooms3D · RTX · RainWorld · USP · cloth · teardown · CFD |
| [🎨 Visual Arts & Modern UI](#ui) | 3 | SVG · AMLL · FrontendShowcase |
| [🐍 Python Tools & Native Engines](#python) | 5 | PyFlowingLight · EngineSIM · Telemetry · UnifiedInputManager · osuMania |
| [🔌 System Integration & MCP Protocol](#system) | 7 | Archive · BilibiliUserscript · WeChatCheckinExcel · BEAMhard · DeepSWE · PSMCP · SketchUpMCP |


---

<a id="web"></a>

## 🎮 Web Games & Interactive Logic

> Evaluates game state machines, input responsiveness, rule closure, and Web Audio sound synchronization.


### 06 · 2048: Roguelike Fusion Web Game
*2048：Roguelike 融合网页游戏*

📁 `L2_Intermediate/2048/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/2048/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/2048/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

请发挥创意上限，设计并编写一个网页版（不限技术栈，最好为 3D 表现形式）的【2048 融合机制 + Roguelike 元素】的游戏。可以自由决定游戏的主题、背景设定和整体视觉风格。

# 需求范围

## 核心要求：前端动效与流畅度

极其看重游戏的"手感"与"视觉解压感（Juice）"，请展现最顶尖的前端优化与动画技术：

- **无缝滑移与融合**：卡牌/方块的滑动、碰撞、合并必须极为丝滑，绝对不能出现闪烁、生硬位移或卡顿。
- **合并反馈**：合并时需要有明显的弹性缩放、微震动等物理反馈，可辅以粒子或其他克制的特效。
- **动态交互响应**：用户的每一次滑动操作，场景、UI 或特效都应有即时的、符合物理直觉的动态反馈。
- **技术栈自由**：可自由选择纯 CSS 3D、HTML5 Canvas，或通过 CDN 引入 Three.js / PixiJS / GSAP 等任何能实现极致动效的库。

## 核心要求：Roguelike 流程理解

构建一个完整的单局游玩生命周期，必须包含以下闭环：

- **局内成长与 Build 构建**：玩家在合并方块或达成特定条件时，能获得不同流派的"遗物/被动技能/卡牌增强"，这些强化必须**切实改变**后续游戏的操作、生成或结算逻辑。
- **动态生成的挑战**：随游戏推进（层数/关卡增加），出现具有差异化的敌人或障碍，难度曲线合理递增。
- **死亡与重来**：包含明确的资源消耗、血量或失败机制；失败后提供清晰的结算与重新开始流程。
- **随机差异**：每一局的体验应具有可验证的随机性。

# 交付与限制要求

- 所有 HTML、CSS 和 JavaScript 写入同一个完整的 `.html` 文件。
- 代码完全闭合且可运行，不允许出现任何 `// TODO` 或未完成的占位符。
- 外部库仅通过有效公共 CDN 引入。
- 打开文件即可游玩，无需构建步骤。
```

</details>


### 08 · Balatro Poker Card Game Replica
*小丑牌：网页卡牌游戏与动效复刻*

📁 `L2_Intermediate/Balatro/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/Balatro/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/Balatro/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

请制作一个完整复刻《小丑牌》（Balatro）玩法与动效语言的 HTML 游戏，重点还原其动效表现。这是一个学习项目，可以研究其公开源码的实现思路，但必须明确第三方代码与素材来源，并优先使用自主实现和可再分发资产。

# 需求范围

## 核心玩法闭环

- 包含发牌、选牌、出牌、弃牌、计分、回合目标、商店/强化和新一轮的完整流程。
- 手牌排序、选中、悬停、计分和结算状态应清晰可见。
- 计分逻辑（牌型识别、倍率叠加、回合目标判定）必须正确且可验证。

## 动效与反馈（Juice）

- 卡牌位移、缩放、倾斜、弹性和粒子反馈应平滑一致，还原原作"粘手"的动效语言。
- 发牌、出牌、计分飘字、商店购买等关键动作都有对应的动画反馈。

## 状态机健壮性

- 状态机必须防止重复结算、非法出牌和动画期间的竞态（快速重复输入不崩溃、不重复计分）。
- 提供重新开始和基础设置（音量/速度等）。

## 素材合规

- 使用原创或合法可再分发的图形、字体和音效；在交付说明中声明参考来源与许可证边界。

# 交付与限制要求

- 交付完整可运行网页项目（单 HTML 或小工程均可）。
- 不得把静态界面截图当作完成。
- 外部库仅通过有效公共 CDN 引入，并说明参考来源与许可。
- 不得包含 TODO 或未完成占位符。
```

</details>


### 10 · FPS Aim Lab & Multi-Game Range
*FPSlab：多游戏适应 FPS 小球练枪*

📁 `L2_Intermediate/FPSlab/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/FPSlab/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/FPSlab/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
生成一个网页版的多游戏适应FPS小球练枪网站
```

</details>


### 12 · Go 19x19 Triple Ko Situation Judgment
*围棋：三劫循环局面判断*

📁 `L2_Intermediate/GoBoard/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/GoBoard/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/GoBoard/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

````
# 任务背景

给定一个日本规则下的 19×19 围棋局面，判断当前局面的规则结果，并给出可核验的理由。本项目的核心目标是解析二值棋盘编码、识别日本规则下的循环局面（三劫循环）、以及依据规则给出严谨解释的能力。

# 局面定义

- 黑方走。
- 贴目：白方 0.5 目。
- 二值编码：`B[r][c]` 和 `W[r][c]` 是两个二值平面。
  - `B[r][c] = 1`：该交叉点有黑子。
  - `W[r][c] = 1`：该交叉点有白子。
  - 两个值均为 `0`：空交叉点。
  - 两个值均为 `1`：无效状态，本题中不会出现。
- 行从上到下编号为 (1) 至 (19)。
- 列从左到右记为 `A B C D E F G H J K L M N O P Q R S T`（标准围棋坐标中跳过 `I`）。

## 黑方二值矩阵 B

```text
0000000000000000000
0000010110000100000
0001011001000100100
0010000001000000000
0010011001001101000
0000001010010001000
0001010010001000000
1011111010100000000
0101010001000000000
0000101101000100000
0000001010000100000
0010001000001000000
0000000000001000000
0010000000001000000
0010000000000000000
0000010000000110000
0000101001000100000
0000010000000000000
0000000000000000000
```

## 白方二值矩阵 W

```text
0000000000100000000
0000001001010000000
0000000110101000000
0000000100101000010
0001000100010000000
0111110100000110100
1010101100000101100
0100000101001010100
0010001110000100100
0101010010000011000
0010110100000010000
0000000000000100000
0000000000000100000
0000000000000100100
0100000000000000000
0010000000000000100
0010000000000011000
0001100000000000000
0000000000000000000
```

# 任务要求

1. 判断当前局面的规则结果（哪一方占优或是否无胜负），**不要仅凭目数估计**。
2. 说明关键循环结构与日本规则依据：指出劫争结构、循环特征，并引用日本规则中关于"同形再现/无胜负"的判例逻辑。
3. 理由评分与最终结论分开评判——只猜中结论标签不能获得满分。

# 交付与限制要求

- 先校验两个矩阵均为 19×19 且无重叠棋子（无效状态未出现）。
- 结论允许等价表达（如"三劫循环""无胜负""no result"）。
- 输出须包含：结论标签 + 分步推理（循环结构识别过程 + 规则条文依据）。
````

</details>


### 13 · Classic Flash-Style HTML Magic Tower RPG
*MoTa：HTML 经典 Flash 风格魔塔 RPG*

📁 `L2_Intermediate/MoTa/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/MoTa/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/MoTa/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
帮我生成一个在Html下的Flash魔塔游戏
```

</details>


### 14 · ADOFAI x Rhythm Doctor Hybrid Music Game
*Musicgames：冰与火之舞 × 节奏医生 融合音游*

📁 `L2_Intermediate/Musicgames/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/Musicgames/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/Musicgames/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
结合“冰与火之舞”、“节奏医生”两个游戏，生成一款在html下的融合性音游
```

</details>


### 16 · Three.js Shader Grass & Sokoban Game
*推箱子：Three.js 草地 Shader 与推箱子*

📁 `L2_Intermediate/Sokoban/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/Sokoban/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/Sokoban/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

本任务分两个阶段：先实现一套极具游戏质感的**像素风/写实风混合草地 Shader**（参考 Dylearn 在 Godot 4.3 中《How I made grass better than 99% of games | Stylized grass 3D pixel art》一文的方案效果），再**提炼该 Shader 风格**制作一个精良的 3D 推箱子游戏。

# 需求范围

## Stage 1：草地 Shader 场景

使用 Web 3D 技术栈实现实例化草地渲染（技术栈自选），场景包含：

1. 与草地同渲染风格的 HDRI 贴图资源（HDRI 可搜索）。
2. 同风格的程序化树木，以极高的园林景观审美简单摆放，构成一个场景。
3. 一条同风格的土路。
4. 场景周围使用迷雾美化渲染距离。
5. 场景具有自然的地形起伏。

**Shader 效果要求（移植要点）：**
- 草地必须使用实例化渲染（如 InstancedMesh，约万级草叶）以控制 Draw Call；草叶为单面片几何，法线统一朝上以获得平整受光。
- 顶点着色器需实现：带相位偏移的低帧率风力动画（Stop-motion，如 12fps，各草叶相位错开避免全局卡顿）→ 多层噪波风力 → 草叶绕正交轴的世界空间弯曲 → 角色/物体经过时草叶被推开（支持多个角色，预分配固定容量）→ Y 轴看板（Billboard）对齐。
- 片元着色器需实现：非透视相机下风摆导致的"面片变扁"补偿（按风强/位移因子拉伸 UV）、混合卡通着色（分阶光照 + 柔和过渡带）、Alpha 剪裁。
- 云影：以世界 XZ 坐标采样云层噪波，投影为地面上缓慢移动的阴影。

## Stage 2：3D 推箱子游戏

1. 将 Stage 1 的场景作为主菜单页面：做一个箱子在场景道路中自己滚动、循环播放的动画。
2. 搜集经典推箱子关卡借鉴关卡设计，将草坪作为限制框设计关卡。
3. 关卡中，箱子由一个 Low-poly 风格的小鲸鱼推动；箱子保持 Low-poly 风格（模型可网络搜索，也可自行搭建）。
4. UI 风格必须与 Shader 风格一致，整体画面有精致的独立游戏感。

**UI 红线：** 不得出现 emoji、蓝紫渐变、毛玻璃等廉价元素。

# 交付与限制要求

- 交付完整可运行网页工程（单 HTML 或模块化工程均可），所需库通过可靠 CDN 引入。
- 全部 Shader 必须完整实现并生效，不得使用占位材质。
- 推箱子逻辑完整可玩：可推动、可重置、有胜利判定。
- 模型/贴图资源须声明来源；HDRI 与树木/鲸鱼模型允许网络获取但需在 README 记录出处。
- 不得包含 TODO 或缺失核心算法的占位符。
```

</details>


### 21 · Minecraft Hardcore LitRPG Long Novel
*文字：Minecraft 硬核生存小说*

📁 `L3_Advanced/LitRPGNovel/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/LitRPGNovel/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/LitRPGNovel/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
核心身份设定】

你现在是一位精通中文网络小说创作的资深白金作家。你的文字极具沉浸感、节奏明快，完全符合现代手机端读者的阅读习惯。在接下来的所有内容输出中，你必须严格遵守以下四项【文风与排版核心规约】。

【文风与排版核心规约】

一、 绝对禁用的句式与AI口癖（红线规则）

1. 禁用特定关联词：正文中绝对不允许出现“不是……而是”、“如何……但”等带有强烈AI说教味或机器翻译感的句式。

2. 禁用破折号：正文中禁止使用破折号（——），转折或拉长音请通过句号、逗号断句或语境描写来体现。

3. 禁用排比句：在普通的叙事、动作、环境描写段落中，绝对禁止使用排比句。网文讲究白描与直给，拒绝刻意堆砌辞藻和句式。

4. 禁用生硬比喻：拒绝任何不合时宜的悬空比喻或刻意的拟人化描写，确保叙事视角的客观质感。

5. 禁用否定式开头：绝对不允许以否定叙述（例如“没有……”、“这绝非……”、“这不是……”）作为任何段落的首句开头。

二、 沉浸式心理描写（自由间接引语）

1. 摒弃“解说型”独白：主角的心理活动绝不能像“游戏主播实况”或“上帝视角预言”一样对即将发生的事情进行提问或说明。

2. 心理活动本能化与碎片化：将人物的心理活动自然地融入第三人称叙述中（不需要加引号）。心理活动必须是面对突发状况时最直观的感官直觉、生理反应或断续的情绪宣泄。

三、 手机端网文排版与节奏（极简留白）

1. 控制段落字数：单段字数严格控制在 30 - 100 字之间，绝不允许出现超过 150 字的“文字大墙”。

2. 单句成段：在描写连贯动作、突发状况、情绪高潮或视线转移时，必须果断使用“一句话一段”，制造强烈的视觉冲击与快节奏。

3. 短句交错：环境描写最多用 2-3 个短句组成一段，叙事要求干脆利落，营造出极强的“呼吸感”。

四、 强感官与物理质感呈现

1. 微观生理反馈：在遭遇极端环境或战斗时，以符合常理的方式描写一点角色的微观生理反应，禁止出现“指节发白”这类描述方式，也不要出现空洞的形容词、比喻。

2. 动作直给：少用抽象的情绪词（如“他感到很绝望”），多用具体的动作和物理交互来展现人物状态。

【执行指令】

请深刻理解上述所有规约。确认理解后，无需复述规则，请直接根据我接下来提供的剧情大纲或指令，开始进行符合上述规范的网文正文创作。【测试任务】
请以《我的世界》（Minecraft）为世界观背景，创作一部生存小说的第一章。主角是一个带有现实世界记忆的普通人，突然在这个由方块构成的物理法则完全不同的世界中醒来。

【格式与风格标准】

视角：第三人称限制视角（聚焦主角）或第一人称视角。

文笔：要求整体文风使用中文网络小说风格，略带幽默。

字数：1500 - 2000字。

场景流：苏醒与环境观察 -> 第一次尝试互动（如破坏方块/收集物资） -> 发现游戏机制的诡异之处 -> 太阳西沉带来的环境压迫感（本章结束，留有悬念）。

请直接开始正文创作，不要包含任何前置或后置的解释性废话。
```

</details>


---

<a id="graphics"></a>

## 🧊 3D Graphics, Physics & Shaders

> Evaluates WebGL/WebGPU shaders, rigid-body dynamics, SO(3) matrix integration, SPH fluids, and ray tracing.


### 09 · Car Front Double Wishbone Kinematics
*双叉臂：汽车前悬挂运动学*

📁 `L2_Intermediate/DoubleWishbone/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/DoubleWishbone/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/DoubleWishbone/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
忽略工作区内的其他文件，只按照以下提示词，进行单html文件输出：
使用刚性线、可形变线与节点作为模拟基础，在web网页中生成一个双叉臂悬挂显示页面，需要包含悬挂跳动模拟、前轮转向拉杆联动车轮、主销运动路径等等演示功能，需要尽可能的演示出汽车双叉臂悬挂的真实结构。
UI整体使用工业软件风格，表现出准确、专业的视觉风格，不要emoji、圆边、阴影等非必要元素。
该项目非常重要，忽略你预设中的敷衍提示词，一定要认真实施，否则有严重后果
```

</details>


### 15 · Penrose Optical Illusion 3D Geometry
*彭罗斯阶梯：HTML 视错觉*

📁 `L2_Intermediate/PenroseStairs/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/PenroseStairs/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/PenroseStairs/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

使用 HTML 下合适的图形技术栈绘制一座彭罗斯阶梯（Penrose Stairs），要求同时具有清晰立体感和稳定的视错觉闭环。本项目的核心目标是在网页中构建立体几何、相机投影和不可能结构视错觉的能力。

# 需求范围

- **视错觉闭环**：阶梯在指定观察视角下形成看似连续上升（或下降）的闭环——沿阶梯行走/视线追踪一圈后回到原点高度。
- **立体感强化**：使用透视、遮挡、光照和色彩强化空间层级，让"不可能结构"在最佳视角下成立。
- **一键视角**：提供"返回最佳错觉视角"按钮。
- **有限旋转**：允许用户有限地旋转/缩放相机，以揭示真实几何结构；离开最佳视角后不要求仍保持错觉（这是可接受的）。
- **响应式**：页面适配常见桌面分辨率。
- **禁止作弊**：不得使用一张预渲染图片冒充交互式几何——场景必须是真实可交互的 3D 几何。

# 交付与限制要求

- 交付单 HTML 文件（可用 Three.js/Canvas 等，通过可靠 CDN 引入）。
- 场景真实可交互：相机操作后视图发生变化，几何体可被观察。
- "返回最佳视角"后相机矩阵可重复（每次返回同一视角）。
- 不得包含 TODO 或未完成占位符。
```

</details>


### 17 · Parametric 3D Bicycle Studio & Drivetrain
*自行车：参数化 3D 工作室与传动系统*

📁 `L3_Advanced/Bicycle3D/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/Bicycle3D/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/Bicycle3D/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

你是一名高级 WebGL/Three.js 开发者、创意技术专家和自行车车架工程师。请创建一个完整可运行的单文件 HTML 应用：**交互式 3D 自行车工作室与装配模拟器**（Custom Bicycle Builder & Assembly Simulator）。结果应像一个完整的交互式产品，而非静态 3D 场景或一堆互不关联的控件。

# 需求范围

## 核心目标

用户可以在 3D 中：查看完整自行车、修改车架几何与 Fit 参数、切换传动配置、调整座舱尺寸、自定义颜色与表面处理、查看装配/分解状态、实时查看几何规格与估算重量。**参数变化时相关部件必须保持对齐**——依赖组件应重定位、重缩放、旋转、出现/消失或重建，不得漂浮、穿插或脱离安装点。

## 程序化建模（禁止外部模型）

覆盖全部主要部件：车架（上/下/座/头管、链支/座支、五通、前后勾爪）、前叉、碗组、把立、弯把、手变与刹把、把带、线管、座管、坐垫、中轴、曲柄、牙盘（1/2/3 片）、脚踏、前拨、后拨、刹车夹器、碟片（带镂空细节）、轮组（圈/花鼓/辐条）、飞轮（7–12 速锥形塔基）、轮胎、内胎气嘴、多处螺栓/夹环等小五金。

## 参数化车架几何

- 独立控制 Stack、Reach、头管角、座管长度、座管角、后下叉长度。
- 提供连续"车架紧凑度/压缩度"滑杆（改变上管斜率/头管长度/座管延伸等组合，而非整体缩放）。
- 支持传统/下沉式（Dropped）后上叉切换，切换必须真实改变几何而非只改标签。

## 传动与适配

- 牙盘 1/2/3 片切换（前拨可见性随配置变化）；飞轮 7–12 速可选，齿数/宽度/间距/锥度可见变化。
- 显示 1×12、2×11、3×9 等配置文本。
- 坐垫前后、座管高度、车把宽度、抬升（Rise）、外撇角（Flare）控制，均须真实反映在几何上。

## 分解动画

- 沿真实安装轴运动：轮组沿车轴外移、前叉沿转向轴分离、碗组沿头管分解、座管上移、曲柄沿中轴分开、飞轮/碟片脱离花鼓、脚踏外移等。
- 动画可逆、平滑，禁止随机放射式散开。

## 视觉与环境

- **NPR 赛璐璐风格**：动漫式 cel shading、高对比明暗分区、清晰轮廓/墨线、图形化色块、色调分离；可加克制的像素化/海报化处理。
- 保持明亮可读基线：避免整体过暗、阴影吞噬结构、bloom 遮挡轮廓、像素化过度。
- 场景为有尺度感但不过度杂乱的仓库/自行车工作室（货架、工作台、挂墙工具等程序化道具）。
- 配色与表面预设：车架/前叉/轮圈/传动/座舱分组建色；gloss/matte/metallic/carbon-inspired 等表面预设。

## UI 与规格

- 控件按 Frame Geometry、Drivetrain、Fit & Cockpit、Assembly、Colors & Finishes、Render Style、Specifications 分组。
- 实时显示几何参数、传动规格与估算重量（重量须随配置变化响应，不能是静态值）。
- 提供重置、相机预设、组件标签、UI 折叠等基础功能；OrbitControls 可用，几何更新不得意外重置相机。

## 轻量传动展示台（附加子任务）

- 另提供低多边形动态自行车传动展示台：曲柄、牙盘、链条（连续环）、5–7 片飞轮、后拨、透明亚克力支架。
- 支持电机启停、升挡/降挡、当前挡位显示（如 "Gear: 3/7"）。
- 换挡时后拨导轮水平移动、链条路径平滑插值（lerp）并保持传动同步。

# 交付与限制要求

- 交付可复制运行的单个 HTML 代码块；Three.js 与 OrbitControls 通过可靠 CDN 引入。
- 不输出伪代码、局部片段、TODO 或要求用户补齐核心功能。
- 避免控制台报错；优先稳定流畅的交互与合理性能（复用几何/材质、辐条/链条等用实例化）。
- 完成后用中文简要解释场景图、依赖更新架构与渲染管线。
```

</details>


### 18 · Escape from Duckov Game Design & Shaders
*逃离鸭科夫：游戏系统与着色器特效*

📁 `L3_Advanced/EscapeFromDuckov` · ⚠️ **Planned benchmark: prompt & rubric to be published**


### 19 · FPV Drone Freestyle 3D Simulator
*FPV：穿越机花飞 3D 模拟器*

📁 `L3_Advanced/FPV/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/FPV/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/FPV/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景
请编写一个单文件（Single-File）网页版【FPV 穿越机花飞模拟器】。程序需包含自研的刚体动力学引擎、硬件遥控器接入、3D 场地渲染、模拟图传（VTX）后处理特效以及可配置的设置菜单。

# 需求范围

## 一、 刚体动力学与控制管线 (Physics & Flight Dynamics)
1. **SO(3) 姿态积分 (核心约束)**：
   * 严禁使用欧拉角进行姿态积分，避免万向节死锁。
   * 无人机的姿态必须完全基于三维特殊正交群 SO(3) 进行表达，其角速度更新与姿态演化必须通过其李代数 so(3) 的指数映射（Exponential Map）进行精确积分。
2. **受力模型**：
   * 完整实现包含电机总推力、重力以及与速度平方成正比的气体阻尼（Aerodynamic Drag）的平动动力学方程。
3. **Acro (手动) 模式与 PID 闭环**：
   * 映射摇杆输入为目标角速度（Target Angular Velocity）。
   * 实现三轴 PID 控制器，根据当前角速度与目标角速度的误差计算控制力矩（Torque），反馈至刚体物理系统中。

## 二、 硬件输入与参数配置 (Input & Settings UI)
1. **硬件遥控器适配**：
   * 实时读取硬件遥控设备（如 RC 摇杆/手柄），提取 4 个核心通道（Pitch, Roll, Yaw, Throttle）并进行归一化映射。
2. **交互式设置菜单**：
   * 提供可视化 GUI/菜单，支持用户实时进行**通道轴向绑定与反向设置**、**PID 参数微调**以及**气动物理参数调整**。

## 三、 3D 环境与花飞场地 (3D World & Track)
1. **环境渲染**：
   * 构建包含地表纹理与天空环境的 3D 空间。
2. **训练场地**：
   * 在场景中央生成高对比度、具备视觉参照意义的花飞障碍物组合（如环形门、可穿越的墙体废墟、立柱等）。

## 四、 图传衰弱后处理 (VTX Signal Shader)
1. **信号衰减模型**：
   * 建立基于无人机与起点距离的信号强度衰减逻辑。
2. **图形后处理着色器**：
   * 通过自定义后处理着色器模拟 5.8G 模拟图传视效：随距离增加渐进呈现雪花噪点（Static Noise）、横向画面撕裂（Horizontal Tearing）、不同步滚动条纹（Rolling Bands）；超限后彻底黑屏/失联并触发失控保护（Failsafe）。

# 交付与限制要求
* **单文件交付**：所有代码（HTML、CSS、JS、GLSL 着色器）必须整合在单个 `.html` 文件中，开箱即用。
* **物理引擎零依赖**：严禁使用任何第三方物理引擎（如 Cannon.js/Ammo.js 等），所有的无人机动力学与 SO(3) 矩阵积分运算必须由你手写实现。
* **高完整度**：代码需包含完整的初始化与主渲染循环，保证逻辑闭合且无运行时报错。
```

</details>


### 20 · Industrial Digital Twin Equipment Monitoring
*工业数字孪生设备监控*

📁 `L3_Advanced/IndustrialDigitalTwin/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/IndustrialDigitalTwin/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/IndustrialDigitalTwin/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

使用现代前端框架 + Web 3D 技术栈（如 Vue 3 + Three.js + Vite，或 React/原生方案均可）创建一个工业数字孪生设备监控页面，深色工业风。

# 需求范围

## 3D 场景

- 深色背景（`#1a1d23`）+ 雾效 + 网格地面。
- 6 台程序化设备模型（用组合几何体模拟真实外形）：
  - 空压机（横罐+封头+电机+管路）
  - 冷却泵（立式泵体+电机+进出口管）
  - 配电柜（柜体+门板+把手+指示灯+散热格栅）
  - 储气罐（立罐+封头+支腿+压力表+安全阀）
  - 注塑机（合模段+注射筒+料斗+喷嘴）
  - 液压站（油箱+电机+泵+管路）
- 每台设备头顶悬浮状态指示灯（绿=运行、黄=待机、红=告警闪烁）。
- 提供轨道相机控制（带阻尼，限制俯仰角和缩放范围）。
- 预留 GLTFLoader 或等价注释代码，说明如何替换为真实 `.glb` 模型。

## 交互

- 点击设备：高亮发光 + 相机平滑 lerp 聚焦 + 右侧弹出详情面板。
- 点击空白：关闭面板、取消高亮。
- 点击检测用 `pointerdown + pointerup`，移动距离 < 5px 才判定为点击（防 OrbitControls 拖拽误触）。
- 坐标计算用 `getBoundingClientRect()` 修正画布偏移。
- 射线检测后向上遍历 parent 查找 `userData.deviceData`。

## 右侧设备详情面板

- 设备名称、编号、状态（带颜色）、安装位置。
- 实时参数区：功率(KW)、温度(°C)、振动(mm/s)、压力(MPa)、电流(A)、累计运行(h)，等宽字体。
- 温度超 85°C 变橙红警示。
- 温度趋势条：近 30 秒色块序列（绿/蓝/橙/红）。
- 面板从右侧滑入滑出动画。

## 左侧车间总览面板

- 2×2 统计格：设备总数、运行中、待机、告警（带颜色）。
- 汇总指标：总功率、平均温度（>70°C 变红）、总电流。
- 设备列表：每行显示状态圆点 + 名称 + 实时温度，点击可直接聚焦对应 3D 模型并弹出详情。

## 模拟数据引擎

- 每台设备配置基准值和波动范围（`simProfiles`）。
- `setInterval` 每 2 秒在范围内随机取值，赋给 Vue 响应式变量。
- 总览面板和详情面板同步刷新。
- 顶栏右侧 LIVE 闪烁标记。

## 生命周期管理

- `onMounted` 初始化场景、启动渲染循环和数据流。
- `onUnmounted` 取消 `requestAnimationFrame`、清除所有定时器、移除事件监听、`dispose` 渲染器。

## 样式

- 深色半透明毛玻璃面板（`rgba` + `backdrop-filter`）。
- 等宽数字字体（Consolas）。
- 状态色：运行 `#00ff88`、待机 `#ffcc00`、告警 `#ff4444`。
- 所有面板 fixed 定位，z-index 分层（顶栏 100、总览 100、详情 999）。

# 交付与限制要求

- 交付完整 Vite + Vue 3 工程（含 `package.json`），核心实现集中在 `App.vue`。
- 安装依赖后 `npm run dev` 可直接运行，控制台无报错。
- 不得包含 TODO 或未完成占位符。
```

</details>


### 22 · Minecraft VOxy Chunk Shader & Rendering Engine
*我的世界VOxy：区块着色器与渲染引擎*

📁 `L3_Advanced/MinecraftVOxy/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/MinecraftVOxy/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/MinecraftVOxy/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

请构建一个网页版 Minecraft 风格体素渲染引擎与生存玩法 Demo（项目代号 VOxy Craft）：在浏览器中实现"确定性世界生成 → 体素网格化 → 高性能渲染 → 玩家交互 → LOD 远景"的完整纵向切片，并以里程碑驱动的方式交付。

# 需求范围

## 核心能力

1. **离线运行骨架**：提供 `启动.bat`（拉起本地静态服务器并打开浏览器），断网仍可运行；HUD 显示 FPS。3D 技术栈自选（Three.js/Babylon/原生 WebGL 均可）。
2. **数据架构与确定性噪声**：分块（chunk）数据存储；**确定性噪声**——同 seed 同输出（node 单测逐位一致）；跨 chunk 读写正确。
3. **地形生成 + 7 群系**：指数高度场 + 台地量化 + 河流下切；温度/湿度群系划分；至少平原/森林/沙漠/高原/盆地/湖泊/雪山 7 种可辨识群系。
4. **Mesh 优化三件套**：面剔除 + 贪婪合并（greedy）+ AO 烘焙 + 六向分组（实现方式自选，压缩顶点格式可选）；3×3×3 实心立方体 = 12 三角形。
5. **材质系统**：全部方块贴图由 SVG 程序化生成并构建图集，代码中零外部图片引用；支持多面材质（草顶/侧/底）与 alpha-test 透明。
6. **树木与地物**：4 种剪影可辨的树（针叶杉尖塔/棕榈弯干伞冠/樱花圆冠/巨树 2×2 ≥20 高地标）+ 矿物按深度分布 + 河流贯穿多群系。
7. **玩家交互**：Pointer Lock；AABB 扫掠碰撞；体素 DDA 射线拾取；左键破坏、右键放置、中键拾取；可行走/跳跃/飞行。
8. **Worker 异步 + 流式加载**：区块生成/网格化放入 Worker，Transferable 零拷贝回传，优先级队列（前方>周围>远景），进出视距正确加载/卸载且无泄漏。
9. **LOD 远景系统**：LOD0..n 半径 2 幂递增，特征记录（topHeight/topColor/canopy/snow/water/cliff），立体柱挤出 + 树冠凸起 + 雪帽 + 崖壁；视距滑条最大 8192，远景"森林绒感/雪山白帽/巨树地标/河湖走向"必须可辨识；每级 LOD draw call 个位数。
10. **渲染管线**：大气散射天空 + 昼夜循环、指数雾联动、水面着色器（浅水折射/深水反射 + 涟漪 + 菲涅尔）。
11. **UI 与物品栏**：工业风（深色/等宽/无圆角阴影 emoji）；创造物品栏 ≥80 种（分类+搜索+拖拽），可快捷栏取用并放置；视距滑条 256–8192；F3 调试面板（生成/网格化/渲染耗时、draw call、三角面）。
12. **单文件打包**：提供打包脚本产出可直接 `file://` 双击运行的单文件 `dist/index.html`（内联依赖，Worker 转 Blob URL 或等价方案）。

## 执行原则

- **门槛驱动**：每阶段有可机器/截图验证的验收门槛，门槛不过不进入下一阶段。
- **纵向切片**：先打通"生成→网格→渲染"最小闭环，再逐层加优化与效果。
- **可测优先**：纯逻辑模块（noise/rng/mesher/raycast/physics）带测试标记区，node 单测覆盖。
- **console 零 error** 是底线。

# 交付与限制要求

- 交付完整工程（模块化源码 + 启动脚本 + 测试 + 打包脚本 + 单文件 dist）。
- 全原创材质，零外部图片素材。
- 提供自动化测试（确定性/网格/射线/物理单测 + 无头冒烟）与性能实测记录（FPS/三角面/draw call/长帧）。
- 诚实标注未实现项（若某效果降级或省略，须明确说明原因）。
```

</details>


### 23 · 3D Poolrooms Backrooms Simulator
*池核：3D Poolrooms 步行模拟器*

📁 `L3_Advanced/Poolrooms3D/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/Poolrooms3D/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/Poolrooms3D/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
制作一个网页版3D Poolrooms（池核）模拟器，使用Three.js/WebGPU或Babylon.js。整体采用现代PBR材质，超真实光照与实时反射。水面使用高质量物理渲染（反射、折射、焦散、水波、深浅渐变），瓷砖、混凝土和墙面具有真实法线、粗糙度、AO等贴图。采用HDRI环境光+全局光照+体积雾+屏幕空间反射（SSR），营造真实潮湿空间。场景无限延伸，随机生成泳池、走廊、平台、楼梯、浅水区与深水区，无任何UI和任务，仅自由探索。第一人称控制，玩家身高约1.7m，60FPS以上流畅运行，优先保证画面真实感与沉浸感。

画面风格参考 Unreal Engine 5 的 Lumen + Nanite 视觉效果，在网页端尽可能还原真实材质、光影、水面反射和空间氛围。
```

</details>


### 24 · Web Path Tracing GPU Workload Benchmark
*RTX：Web 路径追踪房间 GPU*

📁 `L3_Advanced/RTX/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/RTX/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/RTX/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

使用 HTML 下任意合适的 Web 图形技术栈（WebGL2 / WebGPU / 路径追踪 Shader），生成一个展示路径追踪计算结果的小房间，并将其设计为**可重复执行的显卡 benchmark**。先给出简洁实施计划（Plan），再交付完整实现。

# 需求范围

## 核心要求

- 场景使用**固定相机、固定几何、固定材质和固定光源**，保证结果可复现。
- 支持渐进采样（Progressive Sampling），并显示当前 sample count、帧率或每帧耗时。
- 提供**至少三个固定 workload 档位**，明确区分：分辨率、反弹次数（bounces）、每像素采样量（spp）、降噪设置。
- 提供开始、暂停、重置和运行 benchmark 控件。
- Benchmark 采用**固定预热时长与固定采样时长**，保证可比性。
- 导出 JSON 报告，记录：GPU/浏览器信息、workload 配置、平均帧时间、P50、P95、有效样本数。
- 提供保存 PNG 功能，保留最终渲染证据（截图）。

## 技术实现要点（路径追踪）

- 实现 Monte Carlo 路径追踪核心：相机光线生成、与场景图元的求交（建议 BVH 加速遍历）、直接/间接光照、材质 BSDF 采样。
- 每帧累加采样并做渐进式平均，重置后采样计数归零。
- 小房间场景：固定视角下的地板、墙壁、若干简单几何体（球/盒）、发光面作为光源，材质固定。

# 交付与限制要求

- 禁止把软件渲染结果与硬件 GPU 结果混排统计。
- 验证渐进采样值持续增加、重置后归零；每档 workload 至少重复三次取统计。
- 报告须固定浏览器、viewport、DPR、GPU 与后台节流策略（避免标签页后台降频干扰）。
- 捕获并报告资源加载错误、Shader 编译错误、WebGL/WebGPU 上下文丢失。
- 交付单 HTML 或小工程，通过可靠 CDN 引入依赖；不得包含 TODO。
```

</details>


### 25 · Mass-Spring / PBD Cloth Dynamics
*雨世界：质点-弹簧布料模拟*

📁 `L3_Advanced/RainWorld/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/RainWorld/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/RainWorld/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

我们正在开发一款受到《雨世界》(Rain World) 启发的 2D 动作生存网页游戏原型。
核心基调是：不使用任何传统的序列帧动画（Sprite Sheets）和现成的标准刚体物理引擎（如 Matter.js 或 Box2D）。所有生物的运动、碰撞和姿态，都必须基于自定义的“节点与弹簧约束”物理模拟系统，并配合 IK（逆向运动学）实时演算。

# 需求范围

请使用原生 HTML5/JavaScript（基于 `<canvas>` 渲染）编写一个可交互的核心代码原型。我们需要实现一个能在二维地形中通过物理力学移动的“多节点软体生物”。

具体技术路径与设计要求如下：

## 1. 核心底层：自定义节点物理系统
- **禁用现成物理引擎**：必须手写物理底层，不可使用任何第三方物理库。
- **自定义物理积分算法**：需自行实现一套能够稳定处理多节点约束（如弹簧约束或固定距离约束）的迭代算法。需保证物理运算帧率稳定，确保多节点串联在受力时不发生严重的拉伸或物理崩溃。
- **环境交互**：需自行实现节点与静态地形的碰撞检测、阻挡与位置修正，并处理基础的摩擦力与重力响应。地形可以采用简化的网格系统或几何阻挡块。

## 2. 软体生物构造（Creature Rigging）
- **程序化身体拓扑**：主角的身体必须是由多个“物理节点”串联而成的柔性链条（例如包含独立的头部、躯干以及受物理惯性甩动的尾部结构），而不能是一个刚硬的矩形或单点。
- **纯物理驱动机制**：响应玩家的控制输入（如左右移动、跳跃）时，**严禁直接修改角色任何节点的绝对坐标**。一切移动都必须通过向特定的发力节点（如头部或胸部）施加定向的外力、速度向量或冲量，依靠节点间的物理约束来拉动整个躯体前进。

## 3. 程序化运动与触手解算（Procedural Locomotion & IK）
- **动态寻步与抓地**：为躯干添加基于逆向运动学（IK）的四肢/腿部。当躯干移动时，腿部应当能够通过程序化逻辑探测周边环境，寻找合法的地形作为落脚点。
- **环境附着**：只有在关键节点（或 IK 腿部）确认接触到地形表面时，才能产生起跳冲量或提供水平前进的摩擦抓地力。

# 交付与限制要求

- 交付完整可运行的纯前端工程。可以使用单一 HTML 文件（内联 CSS/JS）或标准的前端结构（如 `index.html`, `style.css`, `main.js`），无需复杂的构建工具，双击 HTML 即可在浏览器中运行。
- 必须包含可视化渲染逻辑：由于我们还没有贴图，请使用 Canvas API 绘制基础几何图形（如圆圈表示节点，线条表示约束与 IK 骨骼），以便能在浏览器中直观地观察软体生物的真实物理运动形变。
- 代码必须带有详细的中文注释，清晰阐释所使用的物理数学原理（如积分算法的选择与距离约束的求解逻辑）。
- 页面在常见桌面分辨率下正常工作，且交互流畅。
```

</details>


### 26 · USP Match Gun Disassembly & Low-Poly Scene
*USP：Match 配重手枪机械分解*

📁 `L3_Advanced/USP/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/USP/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/USP/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

请在 HTML 中生成一款 USP Match 竞技版手枪的**复古低多边形（Low-poly / PS1 风格）模型与机械分解动画**，Half-Life / PS1 游戏美学。本项目的核心目标是进行程序化低多边形建模、机械结构分解/组装动画与复古渲染质感的综合能力。

# 需求范围

## 静态展示（模型生成）

- 用 Three.js 程序化构建 USP Match 手枪，Half-Life / PS1 游戏审美。
- 分解视图（Exploded View）展示分离的部件：深色金属套筒（锁定在后）、裸露的亮银色枪管、聚合物下机匣、前部 Match 配重/补偿器、分离的弹匣。
- 高反差光纤准星：前准星亮绿色、后准星红色。
- 锐利几何网格、平直着色（flat shading）、90 年代像素化纹理质感。
- 孤立于浅灰背景上，正交或近正交展示视角，超清晰的机械轮廓。

## 机械动画（分解/组装循环）

- 平滑的 60fps 循环动画：弹匣向上滑入握把 → 套筒在裸露银色枪管上后拉复位 → 前部 Match 补偿器与发光光纤准星保持可见。
- 干净的分解-组装序列，中性灰背景。

## 可选高阶机械演示：AR-15

- 展示上下机匣围绕前枢轴打开、后分解销退出、枪机框（BCG）后移、枪机头旋转解锁的慢动作分解序列。
- 可视化小部件：拉机柄、抛壳挺、复进簧/缓冲管、击锤、扳机、阻铁、弹匣释放、保险、导气结构。
- 动画必须保持机械关联（沿真实枢轴/滑轨运动），不得随机放射式爆炸分解。
- 哑光黑阳极氧化铝 + 深色钢材质，影棚布光，技术 CAD 风格叠加层。

# 交付与限制要求

- 交付单 HTML 文件（Three.js 通过可靠 CDN 引入），双击即可运行。
- 所有模型程序化生成，不使用外部 3D 模型文件。
- 分解/组装动画完整可循环，无跳变。
- 不得包含 TODO 或未完成占位符。
```

</details>


### 27 · 3D Mass-Spring Cloth Physics Simulation
*cloth：3D 质点-弹簧布料物理仿真*

📁 `L3_Advanced/cloth/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/cloth/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/cloth/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
你是一位顶级的 WebGL 与物理引擎开发专家。请为我编写一个单文件（Single-file）HTML 项目，使用 Three.js 实现一个基于“质点-弹簧系统（Mass-Spring System）”或“质点位置动力学（Verlet Integration）”的 3D 软体布料物理仿真模型。

### 1. 技术栈要求
- 单文件 `index.html`，直接包含 HTML, CSS, JavaScript。
- 必须通过 CDN 引入依赖：
  1. Three.js (最新稳定版 r128 或以上)
  2. OrbitControls (用于 3D 视角拖拽旋转/缩放)
  3. lil-gui 或 dat.gui (用于 UI 参数调控)

### 2. 核心功能与物理模拟要求

#### A. 网格数量可调（Dynamic Grid Resolution）
- 允许用户在 UI 中调整布料的网格细分数量（例如 10x10 到 40x40）。
- 当更改网格数量时，能够平滑销毁旧的质点网格并按新分辨率重建布料。

#### B. 三大核心动作/环境模拟
1. 【风吹模拟（Wind Force）】：
   - 实现动态三维风力矢量。
   - 风力需要带有随时间变化的随机扰动/噪波效果（例如正弦波或简单 Perlin 噪波），使布料呈自然飘动。
   - UI 可调：风力开关、风速大小、风向角度。

2. 【台阶碰撞（Stair Collision）】：
   - 在场景中央下方生成 2~3 层由 BoxGeometry 构成的台阶（带有纹理或清晰材质）。
   - 实现质点与台阶（AABB 盒碰撞/表面碰撞）的物理碰撞检测与响应（含简单的反弹与摩擦力）。
   - 布料初始处于台阶上方，释放后能自然下落并“折褶”覆盖在台阶上。

3. 【布料折叠（Cloth Folding）】：
   - 物理模型中需包含**弯曲弹簧（Bending Springs）**约束，使布料保持形态并能产生自然的折痕。
   - **交互折叠**：支持鼠标射线（Raycaster）点击并拖拽布料的任意节点进行拉扯折叠。
   - **预设动作**：在 UI 中提供一个“对折/折叠（Fold Cloth）”按钮，点击后通过向特定角落应用对向作用力，演示布料自动对折的效果。

### 3. UI 控制面板（lil-gui / dat.gui）设计
请在右上角创建一个清晰的 UI 控制面板，包含以下分组：
- **布料配置**：网格分辨率 (Grid Resolution)、重力大小 (Gravity)、结构刚度 (Stiffness)、重置布料 (Reset Button)。
- **风力控制**：风力开关 (Wind On/Off)、风速大小 (Wind Force)、风向 (Wind Direction)。
- **交互与预设**：一键释放下落 (Drop onto Steps)、一键对折 (Fold Action)。

### 4. 视觉与场景细节
- 包含柔和的平行光（带阴影显示）与环境光，使用 `MeshStandardMaterial`（双面渲染 `Side: DoubleSide`）。
- 场景底面提供地板，配合台阶呈现良好的立体感和阴影投射。
- 代码必须干净整洁，物理循环与渲染循环分离，物理步长（dt）要稳定以防“模型爆炸”。

请直接给出完整的、可直接运行的 HTML 代码，不要省略任何关键算法实现。
```

</details>


### 28 · Teardown Voxel Diorama & Mechanical Disassembly
*teardown：硬表面机械与微体素场景*

📁 `L3_Advanced/teardown/PROJECT_PROMPT.md` ｜ [Source file](./L3_Advanced/teardown/PROJECT_PROMPT.md) ｜ [Rubric](./L3_Advanced/teardown/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

你是一个顶级的 WebGL 图形学开发专家与技术美术（TA）。请使用 HTML、CSS 和 JavaScript，编写一个单文件的可交互 3D Demo。该 Demo 的目标是完美复刻游戏《Teardown》（拆迁）的视觉美学，即："极简的微体素（Micro-Voxel）几何体"与"极度写实的 PBR 光影渲染"所产生的强烈物理反差感。

# 需求范围

## 技术约束

- 仅限一个完整的、可直接在浏览器双击运行的 HTML 文件（包含内联 CSS 和 JS），所需库通过可靠 CDN 引入。
- 场景体素数量较多时，必须使用实例化渲染（Instancing）或等价合批方案，而不是单独创建无数个 Mesh。

## 核心视觉要求

1. **微体素几何（Micro-Voxel Art）**：场景中所有物体由统一大小的小方块（BoxGeometry）拼装而成；**绝对不使用任何纹理贴图**，完全依靠纯色（Instance Colors）区分物体。
2. **写实 PBR 材质**：体素材质必须有明显物理区分（实现方式不限）：
   - 金属方块：高金属性、低粗糙度。
   - 玻璃方块：透射 + 折射（transmission/ior 或等价方案），实现真实透明感。
   - 木头/砖块：全漫反射、高粗糙度。
3. **影棚级光照**：物理正确光照模式；强平行光（PCFSoftShadowMap 或等价软阴影方案，较高阴影分辨率）产生锐利但边缘微柔的阴影；环境光/半球光模拟天光。
4. **电影级后处理**：需要**屏幕空间环境光遮蔽**（SSAO/HBAO 或等价方案）——小方块夹角处的浓重真实阴影是消除"塑料感"的关键；需要**景深效果**（DOF/Bokeh 或等价方案）聚焦场景中心，营造"微缩沙盘模型（Diorama）"的玩具感。

## 场景内容（微缩沙盘，约 20×20×10 体素规模）

1. 底部灰白色混凝土地基。
2. 地基上一面被破坏了一半的红砖墙。
3. 旁边散落几个金属光泽的管道（银色/生锈色）。
4. 场景中央放置半透明玻璃体素组成的窗户或发光体。

用代码逻辑（循环和条件判断）自动生成这些体素阵列，赋予不同颜色和物理材质属性。

## 交互

- 提供轨道相机控制，允许旋转、缩放、平移。
- 初始相机为 45 度俯视的等轴测（Isometric）视角。

## 城市局部沙盘扩展

在微体素视觉体系上拓展一座**有明确边界的城市局部沙盘**：

1. 自行构思城市应有元素（道路、建筑、城市设施），选择合适的沙盘大小。
2. 可搜集网络素材获取像素风格天空盒 HDRI。
3. **城市中必须有体素风格河流**。
4. 沙盘应有明显界限，表现为放置在**实心台座**上。
5. 正确表示尺度：将现有景深效果强化为更具"移轴"感的镜头。

# 交付与限制要求

- 交付完整、闭合、可直接运行的单 HTML。
- 不得包含 TODO、占位实现或要求用户补齐核心算法的说明。
- 项目输出完成后，摘取其中代码，用中文解释渲染管线的设置逻辑（SSAO/DOF 管线、InstancedMesh 策略、材质体系）。
```

</details>


### 30 · Ultra-Realistic CFD Fluid Simulation & Rendering
*CFD：超拟真流体计算与物理渲染*

📁 `L4_Expert/CFD/PROJECT_PROMPT.md` ｜ [Source file](./L4_Expert/CFD/PROJECT_PROMPT.md) ｜ [Rubric](./L4_Expert/CFD/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

你是一名精通 WebGL 和实时流体动力学的高级前端物理工程师。请编写一个网页版（HTML + CSS + JS）的【3D 纯流体动力学实时仿真与基准测试工具】，专门用于严格测试主机的 GPU 粒子渲染与 CPU 物理积分算力。整体界面需呈现严谨、克制的工业软件美学（深灰背景、绝对直角边框、无阴影、等宽字体、严禁 emoji）。

# 需求范围

## 1. 3D 流体仿真（SPH 粒子法）

- 在一个透明的 3D 封闭玻璃立方体容器内，生成 **2500–4000 个**粒子（渲染方案不限，如点精灵/实例化球体）构成的流体水块。
- 手写轻量级光滑粒子流体动力学（SPH）近似解算：实现粒子受重力下坠、以及粒子间的空间近邻排斥力（模拟流体的不可压缩性与内部压力）。
- 实现粒子与容器底面及四周侧壁的**精确物理边界碰撞、反弹与速度摩擦衰减**，完美呈现水流由于重力塌陷、撞墙拍起并回涌的动态全过程。
- **不允许依赖任何现成物理引擎**；所有粒子位置积分与碰撞逻辑必须原生手写（SPH 或等价近似粒子流体算法）。
- 使用稳定时间步，避免 NaN、能量爆炸与粒子逃逸。

## 2. 数据颜色映射（Color Mapping）

- 粒子颜色不能单一，必须根据其【瞬时运动速度】或【局部紧密密度】动态改变（例如：静止或低速为深蓝色，高速冲撞或高压区动态渐变为亮青色或亮红色），以展现流体内部的能量分布。

## 3. 性能监控与交互（Benchmark & Controls）

- 左上角覆盖极简工业风数据面板，实时显示：当前实时 FPS、活跃粒子总数、单帧物理计算耗时（ms）。
- 右侧精简控制项：一键重置流体状态、重力大小滑块、流体粘滞度（Viscosity）滑块。
- 提供固定 workload 的基准测试入口：预热后重复采样，导出 JSON（建议同时导出逐帧 CSV），结果至少包含环境、粒子数、采样时长、平均/中位/P95 帧时间、物理耗时与异常计数。

# 交付与限制要求

- 交付完整可运行的网页工程（单 HTML 或模块化工程均可，所需库通过可靠 CDN 引入）。
- **零物理引擎依赖**：严禁依赖任何第三方现成物理引擎，流体物理算法必须自研。
- **拒绝敷衍**：代码必须 100% 闭合，严禁出现任何 `// TODO` 或缺失关键核心算法的占位符。
- 固定随机种子与容器尺寸，结果可复现。
```

</details>


---

<a id="ui"></a>

## 🎨 Visual Arts & Modern UI

> Evaluates high-density responsive layouts, diffused fluid backgrounds, SVG vector drawing, and advanced motion pipelines.


### 04 · Pure SVG Vector Mona Lisa Painting Study
*SVG：纯矢量《蒙娜丽莎》笔触复刻*

📁 `L1_Basic/SVG/PROJECT_PROMPT.md` ｜ [Source file](./L1_Basic/SVG/PROJECT_PROMPT.md) ｜ [Rubric](./L1_Basic/SVG/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

请使用纯 SVG 复刻达·芬奇《蒙娜丽莎》，越还原越好，画法可自由发挥。本项目的核心目标是使用纯 SVG 组织大量矢量笔触、构图、色彩分层与远近层次的能力。

# 需求范围

必须联网搜索原片作为构图参考（博物馆或公共领域高清原作），然后用纯 SVG 完成一幅研究性复刻：

## 视觉要求

- **笔触作画**：使用数千条短弧线或锥形描边模拟古典油画罩染与晕涂法（sfumato），笔触沿面部轮廓与体积方向排布。**禁止大面积平涂与照片级渐变替代主要形体。**
- **构图对位原作**：居中半身像、四分之三侧身、双手交叠于扶手、神秘微笑、深色长发与薄纱；背景为左右不对称山水（蜿蜒小径、河流与拱桥、雾状远山）。
- **色板贴近原作**：赭褐 / 暗金 / 橄榄绿 / 深棕为主；肤色用暖赭多层分层，背景用蓝绿空气透视渐远。
- **笔触质感**：颜色具有邻近色抖动与明暗深浅分层，明暗过渡柔和无硬边——远看成画、近看可见笔触。
- **画布尺寸**：约 1200×1600（竖幅）。

## 参考与合规

- 使用博物馆或公共领域高清原作作为构图参考（须联网检索）。
- **不得**把参考位图嵌入 SVG 后伪装为矢量复刻。
- 在交付说明（README）中记录参考图来源与许可状态。

# 交付与限制要求

- 交付一个可独立打开、可解析的 `.svg` 文件。
- 不使用外链位图作为画面主体；文件结构必须可解析，**不得**仅包含一个 base64 图片节点。
- SVG 内所有图形元素（path/circle 等）数量与层次应足以支撑"笔触复刻"的评判。
- 不得包含 TODO 或占位内容。
```

</details>


### 07 · Apple Music Lyrics Player UI
*AMLL：Apple Music 动态歌词播放器*

📁 `L2_Intermediate/AMLL/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/AMLL/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/AMLL/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景
请编写一个单文件（Single-File）纯 Web 页面，高保真还原 iPad 版 Apple Music 的“沉浸式动态歌词播放器”界面，视觉与交互体验需对齐开源项目 `amll-player`。

# 需求范围
请在不依赖任何外部框架的前提下，设计并实现以下核心模块与视觉效果：

1. **界面布局 (Player Layout)**
   * 采用适合 Tablet 端的左右分栏布局。左侧包含专辑封面及播放控制区，右侧为纵向歌词展示区。
   * 全局排版需保持现代、简约，体现高级的视觉层次感。

2. **沉浸式流体背景 (Dynamic Fluid Background)**
   * 实现类似 Apple Music 的色彩渐变流动背景，要求画面具备柔和的色彩混色与沉浸式的弥散模糊感。

3. **歌词视效与交互 (Lyrics Animation System)**
   * **状态区分**：建立“当前行”与“非当前行”歌词的明暗与虚实视觉对比。
   * **平滑聚焦**：随着歌词推进或手动点击，歌词列表需具备平滑的滚动与缓动过渡，自动将目标行保持在最佳视觉区域。
   * **逐字/渐进高亮**：实现歌词播放时的动态扫光效果，模拟文字随音乐节奏逐渐被填亮的过程。

4. **模拟播放逻辑 (Playback Simulation)**
   * Mock 一套包含时间轴的歌词数据。
   * 实现播放控制逻辑，点击播放后能自动同步推进歌词并正确触发所有配套视觉动效。

# 交付与限制要求
* **单文件交付**：所有 HTML 结构、CSS 样式和 JS 逻辑必须整合在单个 `.html` 文件中，开箱即用。
* **零依赖**：严禁使用任何第三方库或框架（如 React/Vue、jQuery、GSAP、Tailwind 等），全原生实现。
* **高性能**：注重渲染性能，动画需保持流畅（60fps），尽量避免引发页面重排（Reflow）。
```

</details>


### 11 · Cyberpunk Frontend Showcase & Portfolio
*前端：赛博朋克风格前端展台*

📁 `L2_Intermediate/FrontendShowcase/PROJECT_PROMPT.md` ｜ [Source file](./L2_Intermediate/FrontendShowcase/PROJECT_PROMPT.md) ｜ [Rubric](./L2_Intermediate/FrontendShowcase/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

你是一个顶尖的前端开发专家和 UI/UX 设计师。请使用你擅长的 Web 技术栈（如 React、Vue 或原生方案）编写一个极其炫酷、具有赛博朋克科幻 HUD（Heads-Up Display）风格的"复合型创客与系统管理员"多职业交互式个人简历网页。

# 需求范围

## 设计美学要求

- **视觉格调**：深邃的科技暗色背景（`#050507`），搭配全局环境暗角（Vignette）和半透明细网格背景线。
- **色彩体系**：使用高饱和度、发光的霓虹渐变作为不同职业的主题色：
  - AI 提示词专家（AI PROMPT ENGINEER）：绿光 `#23ff00`
  - 单车工程技师（BICYCLE TECHNICIAN）：橙/黄光 `#ffaa00`
  - IT 系统管理员（IT SYSTEMS ADMIN）：青/蓝光 `#00f0ff`
  - 3D 关卡设计师（3D LEVEL DESIGNER）：粉红/玫红光 `#ff0055`

## 微动效与氛围感

- 鼠标悬停在各职业入口时，对应的导引线条延伸并亮起专属霓虹色。
- 核心状态信息和标题带有赛博朋克式字符乱码滚动加载动效（Scramble Text）。
- 页面背景为 Canvas：绘制 250 条发光的贝塞尔曲线，根据鼠标位置产生排斥扰动，随滚轮滚动产生波浪振幅，在悬停/选中不同职业时过渡变换对应发光颜色与透明度。

## 技术栈（自选，以下为参考方向）

- **核心框架**：React（或其他现代框架/原生方案，自选）
- **动效**：Framer Motion 或等价动画方案（无缝过渡与弹簧 LayoutId 动画）
- **3D 渲染**：Three.js + @react-three/fiber 或等价方案（3D 视窗展示为加分项）
- **样式**：方案自选（保持结构清晰与高自定义度）

## 项目文件结构

交付完整可运行工程，文件组织方式自定。参考结构（可选）：

1. `src/index.css`：全局基础样式与暗色网格背景
2. `src/App.css`：页面布局、赛博朋克转场框架、Bento Grid 技能库
3. `src/components/CanvasBackground.jsx`：高性能交互式 Canvas 贝塞尔扰动背景线组件
4. `src/App.jsx`：主应用入口，包含乱码滚动、不同职业的转场子页面、3D Live 视窗、滚动触发的 Bento 技能展示

# 交付与限制要求

- **工作区隔离（极重要）**：本项目采用 npm Workspaces Monorepo 结构。请在当前目录下创建一个以你名字/模型名命名的**独立子目录**（例如 `./YourModelName/`），并将所有代码（含子项目的 `package.json`）均放入该子目录中。**绝对禁止**修改或覆盖根目录下的 `package.json` 及其他已存在的项目文件夹。
- **依赖声明**：你可以在子项目的 `package.json` 中正常声明所需依赖（如 React, Three.js 等），它们会自动由根目录的 Workspace 机制接管。交付时只需确保进入你的子目录执行 `npm run dev` 能够正常启动即可。
- 页面在常见桌面分辨率下布局完整、无横向滚动条、无控制台报错。
- 所有动效须真实可交互，不得以静态截图代替。
- 不得包含 TODO 或未完成占位符。
```

</details>


---

<a id="python"></a>

## 🐍 Python Tools & Native Engines

> Evaluates PyOpenGL, FFMPEG video pipelines, non-blocking UDP networking, and spatial distance resampling.


### 03 · Python Desktop Floating Light Widget
*PY流光：Python 桌面悬浮球*

📁 `L1_Basic/PyFlowingLight/PROJECT_PROMPT.md` ｜ [Source file](./L1_Basic/PyFlowingLight/PROJECT_PROMPT.md) ｜ [Rubric](./L1_Basic/PyFlowingLight/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

请使用 Python 编写一个桌面悬浮球小部件（PY 流光）：一个置顶、无边框、半透明的桌面悬浮球，实时显示 CPU / 内存占用率，支持拖拽移动与多种视觉样式切换。本项目的核心目标是使用 Python GUI 框架（PyQt6/PySide6/Tkinter）、系统资源读取、透明无边框窗口与自定义绘制的能力。

# 需求范围

请设计并实现一个可运行的 Python 桌面悬浮球程序：

## 核心功能

- **悬浮球本体**：
  - 无边框（Frameless）+ 置顶（Always-on-Top）+ 工具窗口（Tool），带透明背景。
  - 支持鼠标拖拽移动；右键菜单提供退出、设置入口。
  - 悬浮球直径可调（约 60–140px）。
- **数据展示**：
  - 后台线程每 1 秒刷新一次 CPU 与内存占用率（模拟数据源或真实系统 API 均可，真实读取优先）。
  - 球体内以环形进度条或弧形方式可视化占用率，中央显示数字百分比。
- **视觉样式**：
  - 液态玻璃质感：径向/锥形渐变、高光、光晕与旋转光环（Rainbow / 单色可切换）。
  - 支持自定义：光环颜色、线宽、透明度、旋转速度、显示模式（常显/悬停显示）。
- **设置面板**：
  - 提供小设置窗口（滑块、颜色选择器、下拉框），修改后即时生效并保存配置。

# 交付与限制要求

- **多文件或单文件交付均可**，但必须附带 `README.md` 说明运行方式与依赖安装命令。
- 依赖声明明确（如 `PyQt6`、`psutil`），并在 README 中给出 `pip install` 命令。
- 窗口透明与置顶在 Windows 上必须正常工作；其他平台可降级但需注明。
- 程序启动后直接可见、可交互，不得包含 TODO 或半成品逻辑。
- 资源占用低：刷新线程不阻塞 UI 主线程。
```

</details>


### 32 · Engine Sound & DSP Audio Synthesis
*EngineSIM：引擎声浪与 DSP 音频合成*

📁 `L4_Expert/EngineSIM/PROJECT_PROMPT.md` ｜ [Source file](./L4_Expert/EngineSIM/PROJECT_PROMPT.md) ｜ [Rubric](./L4_Expert/EngineSIM/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

请参考开源项目 `ange-yaghi/engine-sim` 的公开原理，制作一个**计算开销较低、强化混响与驾驶听感**的浏览器发动机声音模拟项目，用于驾驶模拟软件的音频驱动。本项目的核心目标是理解开源技术项目、重建程序化发动机声音、C++ 到 Web 移植，以及把音频 DSP、车辆动力学和 Three.js 场景整合为可运行产品的能力。

# 需求范围

## 第一阶段：发动机与音频 DSP

- 实现**前中置引擎、等长排气歧管、十字曲轴 V8** 的程序化音色。
- 发火顺序、转速与主要发动机阶次必须具有明确数学关系（阶次 = 发火频率的整数倍，随 RPM 正确跟踪）。
- 支持：怠速、油门、负载、转速变化、断油/点火切断、混响（强化空间与驾驶听感）。
- 音频输出不得出现 NaN、无限值、持续削波或明显参数跳变爆音。

## 第二阶段：驾驶场景（Three.js）

- 构建一条基础赛道（含天空环境、合理光照、柏油路面与双色路肩）。
- 创建可驾驶的低多边形现代美式肌肉车，搭载上述模拟引擎。
- 车辆物理至少以**双轴单轨（Bicycle Model）**模型表达平面动力学，实现基础轮胎侧偏/纵向摩擦近似。
- HUD 显示：转速、车速、挡位、油门与关键性能状态。

## 模块化要求

- 将音频 DSP 与车辆动力学从渲染层解耦（独立模块，可分别测试）。
- 说明参考项目与自主实现部分的边界（哪些移植自 engine-sim 原理、哪些为自研增强）。

# 交付与限制要求

- 提供可运行工程与自动化测试：
  - Node 单测验证：发火间隔、主阶次、转速跟踪、输出边界（无 NaN/削波）、实时音频预算。
  - 车辆单测验证：稳定怠速、加速、制动、转向与有限状态。
  - 浏览器测试验证：音频上下文、驾驶输入、HUD 与场景渲染。
- 听感与手感保留人工主观评分；客观指标（阶次频率、输出边界、物理状态有限性）走自动化。
- 不得包含 TODO 或未完成占位符。
```

</details>


### 35 · RAC Telemetry & Distance-based Resampling Analysis
*遥测：RAC 赛车实时遥测与距离空间重采样分析*

📁 `L4_Expert/Telemetry/PROJECT_PROMPT.md` ｜ [Source file](./L4_Expert/Telemetry/PROJECT_PROMPT.md) ｜ [Rubric](./L4_Expert/Telemetry/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景
请编写一个单文件（Single-File）Python 应用程序，实现适用于赛车（RAC）游戏的【实时遥测数据接收、记录与多圈空间对比分析工具】。

# 需求范围

## 一、 网络通信与并发架构 (Networking & Concurrency)
1. **非阻塞网络接收器**：
   * 建立 UDP 遥测数据监听服务，运行于独立的子线程/协程中，确保网络 I/O 不会阻塞 UI 渲染。
2. **线程安全数据流**：
   * 实现安全的跨线程通信机制，将接收到的车辆动力学与操作输入数据实时推送至主线程与数据缓冲池。

## 二、 核心算法：基于空间距离的数据对齐 (Distance-based Resampling - 核心约束)
1. **空间维度对齐算法**：
   * **痛点解决**：摒弃传统的时间轴（Time-based）对比，解决由于各圈用时不同导致遥测曲线在横轴上无法精准对齐的问题。
   * **算法要求**：实现基于“行驶距离（Distance）”的重采样与插值算法。当加载不同采样率、不同圈速的单圈数据（如 Lap A 与 Lap B）时，算法必须将它们统一重采样至相同的距离步长网格上，实现空间维度上的曲线精准对齐。

## 三、 数据持久化与自动记录 (Data Logging & Persistence)
1. **单圈自动落盘**：
   * 实时记录当前行驶数据，具备车辆重置/新一圈触发检测机制，自动将单圈数据持久化保存为结构化文件（如 CSV）。
2. **历史记录回载**：
   * 支持从本地加载历史单圈数据并装载至分析引擎中。

## 四、 多通道交互式可视分析 UI (Interactive Telemetry UI)
1. **多通道堆叠图表**：
   * 绘制垂直堆叠的图表，分别呈现“速度-距离 (Speed vs Distance)”与“踏板操作-距离 (Pedals vs Distance)”曲线。
2. **多圈叠加对比**：
   * 支持在同一图表空间内叠加多条不同圈次的曲线（以不同色彩区分），用于直观分析驾驶细节（如刹车点早晚、出弯开油时机等）。
3. **联动十字光标 (Linked Crosshair Cursor)**：
   * 实现跟随鼠标移动的垂直联动指示线，动态显示当前距离节点上不同圈次的数据具体数值及差异（Delta）。

## 五、 内置模拟数据源 (Built-in Telemetry Simulator)
1. **独立模拟服务**：
   * 内置可在独立线程中运行的虚拟遥测数据发送器，按固定频率生成模拟动力学数据，确保在无真实游戏连接时程序依然能够完整演示接收、记录与绘图全流程。

# 交付与限制要求
* **单文件交付**：所有模块（网络接收、模拟发送、数据算法、UI 视图）必须统合在单个 `.py` 文件中，开箱即用。
* **优雅退出机制**：具备完善的异常处理与资源释放逻辑，确保退出时能安全关闭子线程与 Socket 端口。
* **高完整度**：无任何占位符（TODO），代码具备完整的运行逻辑与健壮性。
```

</details>


### 36 · Unified Controller Input Manager
*UnifiedInputManager：跨平台 Controller 统一输入管理器*

📁 `L4_Expert/UnifiedInputManager/PROJECT_PROMPT.md` ｜ [Source file](./L4_Expert/UnifiedInputManager/PROJECT_PROMPT.md) ｜ [Rubric](./L4_Expert/UnifiedInputManager/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景
本项目为一款跨平台 Python 应用程序，现需开发一个「统一控制器输入管理模块 (Unified Input Manager)」。系统需要直接与多种底层硬件接口及平台协议进行交互。

# 需求范围
请为该项目规划并设计对以下五种输入协议的支持。设计必须严格贴合它们各自官方文档的底层逻辑与数据规范：
1. XInput
2. Steam Input
3. Raw HID Input
4. PlayStation Input
5. Switch Input

# 交付要求
请输出具体的技术设计方案，包含以下三个部分：

## 一、 架构设计 (Architecture)
* 设计一个统一的输入管理器抽象层。
* 详细说明这五种底层结构完全不同的协议，如何被标准化并统一暴露给上层业务逻辑。

## 二、 核心实现 (Core Implementation)
* 分别提供这五种协议最核心的底层数据接入与解析代码（核心逻辑或伪代码）。
* 代码需直观展现你对该协议专属初始化流程或原始数据结构的理解。
* 明确标注其中需要依赖系统级调用或外部 C/C++ 封装的部分。

## 三、 架构冲突与解决方案 (Challenges & Solutions)
* 结合这五类协议官方文档中关于数据获取方式（如生命周期、并发机制、I/O 模式）的定义，分析将它们统合在一个 Python 进程中运行时，最核心的架构冲突是什么？
* 给出你的代码级解决方案。
```

</details>


### 37 · osu!mania Python OpenGL High-Perf Video Renderer
*osu!mania：Python OpenGL 高效视频渲染工具*

📁 `L4_Expert/osuMania/PROJECT_PROMPT.md` ｜ [Source file](./L4_Expert/osuMania/PROJECT_PROMPT.md) ｜ [Rubric](./L4_Expert/osuMania/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
使用 Python 和 OpenGL 编写一个高效的 osu!mania 视频渲染工具。要求尽可能像素级还原 osu! stable mania 模式的真实游玩界面。支持分辨率调整、帧率调整以及用户自定义皮肤与播放谱面。

### 核心功能与技术要求

#### 1. 渲染架构与导出引擎
- **技术栈**：使用 Python（推荐 PyOpenGL / ModernGL + GLFW 或 Pygame）搭建 OpenGL 渲染管线。
- **渲染效率**：支持高帧率实时预览与硬加速离线视频导出（集成 `ffmpeg-python` 或通过管道无缝导出 MP4 视频）。
- **参数可调**：支持自定义输出分辨率（如 1920x1080、2560x1440 等）及渲染帧率（如 60fps、120fps、240fps）。

#### 2. osu! stable Mania 界面像素级还原
- **480p 虚拟坐标映射**：osu! stable 内部采用 480p (640x480) 虚拟坐标系。系统必须自动将 `skin.ini` 中的各项数值映射至当前渲染目标分辨率。
- **轨道与舞台 (Stage Layout)**：
  - 支持 `ColumnStart`、`ColumnWidth`、`ColumnSpacing`、`ColumnRight` 等参数计算。
  - 正确渲染 `StageLeft`、`StageRight`、`StageHint`（判定线提示）、`StageLight`（按键光束）与 `StageBottom`。
- **按键与 Note 下落 (Receptors & Notes)**：
  - 完美渲染标准 Note（单点）与 Long Note (LN/长条 Note，包含 Head 头部、Body 身体纹理拉伸、Tail 尾部）。
  - 支持 `HitPosition` 参数（决定判定线的垂直 Y 轴像素位置）。
  - 正确响应 `KeyImage[N]` (未按下) 与 `KeyImage[N]D` (按下状态/按键反馈)。
- **判定与 Combo UI (Judgement & Combo UI)**：
  - 精确显示 300g (MAX)、300、200、100、50、0 (Miss) 判定文字动画（淡入、缩放与渐淡）。
  - 结合 `ComboPosition` 与自定义数字图片（`Combo-0.png` ~ `Combo-9.png`）动态渲染当前连击数。
- **血条与计分板 (Health & Score)**：
  - 支持 HP 状态栏（`scorebar-bg` / `scorebar-colour`）与 Score 计分板渲染。

#### 3. 自定义皮肤与谱面文件解析 (`skin.ini` & `.osu`)
- **`skin.ini` 解析器**：
  - 完整读取 `[Mania]` 配置段落，包括 `Keys: 4` / `Keys: 7` 等键数配置。
  - 支持精灵图片缺省回退（若皮肤缺少特定图片，能降级回退到默认图形）。
- **`.osu` 谱面解析器**：
  - 解析 `[TimingPoints]` 获取 BPM 与 Timing 时间轴。
  - 解析 `[HitObjects]` 中的轨道映射（根据 X 轴坐标计算所在音符轨道 Column = floor(x * KeyCount / 512)）。
  - 正确区分普通 Note 与 LN Note（根据类型掩码及冒号分隔的结束时间戳 `endTime`）。

#### 4. 代码质量与交付
- 代码结构清晰解耦（包含 `parser` 谱面皮肤解析模块、`engine` OpenGL 渲染引擎模块、`exporter` 视频导出器模块）。
- 提供命令行启动入口（支持传入 `.osu` 文件路径、皮肤目录路径、导出视频路径、分辨率与 FPS 参数）。
```

</details>


---

<a id="system"></a>

## 🔌 System Integration & MCP Protocol

> Evaluates Model Context Protocol (MCP) servers, OS API hooks, and code refactoring.


### 01 · Automation Scripts Archive
*归档：快捷自动化与主题脚本*

📁 `L1_Basic/Archive/PROJECT_PROMPT.md` ｜ [Source file](./L1_Basic/Archive/PROJECT_PROMPT.md) ｜ [Rubric](./L1_Basic/Archive/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

编写一组"快捷自动化与主题脚本"工具集，用于日常开发环境的自动化操作：一键切换 IDE 主题、批量文件处理、环境配置备份/恢复等。本项目的核心目标是编写 PowerShell/Batch/Python 自动化脚本、安全操作注册表与配置文件、以及提供清晰可复用脚本架构的能力。

# 需求范围

请设计并实现一个**脚本归档库**，至少包含以下三类工具（可自行扩展）：

## 1. 主题切换脚本

- 实现一个命令行脚本，可在指定 IDE/编辑器（如 Qoder、VS Code、JetBrains 系）的亮色/暗色主题之间一键切换。
- 直接读写对应 IDE 的 `settings.json` / 配置文件，要求：
  - 修改前自动备份原文件（带时间戳）。
  - 支持"切换后重启生效"提示。
  - 重复执行具备幂等性（已是目标主题时不重复写入）。
- 至少支持一种 IDE 的完整实现，其余 IDE 提供清晰的扩展接口。

## 2. 文件批处理脚本

- 实现按规则批量重命名/整理文件的脚本（如按日期归档截图、清理临时文件、批量转换编码）。
- 必须包含"试运行（dry-run）"模式，先输出将要执行的操作，确认后再真正执行。
- 所有破坏性操作（删除、覆盖）必须二次确认并写入操作日志。

## 3. 环境巡检脚本

- 输出当前系统的关键环境信息：Python/Node/Java 版本、PATH 中的关键目录、磁盘剩余空间、常用软件安装状态。
- 输出格式为对齐的文本表格或 JSON，便于人工阅读与后续解析。

# 交付与限制要求

- **多文件交付**：每个脚本独立成文件，附带一个 `README.md` 说明用途、用法与依赖。
- **零额外依赖优先**：优先使用系统自带能力（PowerShell 5.1+/Bash/Python 标准库），避免不必要的第三方包。
- **安全合规**：不执行任何破坏性系统操作；涉及文件写入必须带备份与回滚说明。
- **平台适配**：明确标注脚本运行平台（Windows/macOS/Linux），跨平台脚本需做平台分支。
- 脚本须可直接运行，不得包含 TODO 占位或需要用户补齐的核心逻辑。
```

</details>


### 02 · Bilibili IP Location Userscript
*脚本：B站 IP 归属地油猴脚本*

📁 `L1_Basic/BilibiliUserscript/PROJECT_PROMPT.md` ｜ [Source file](./L1_Basic/BilibiliUserscript/PROJECT_PROMPT.md) ｜ [Rubric](./L1_Basic/BilibiliUserscript/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

请编写一个浏览器油猴脚本（Userscript），在 B 站（bilibili.com）电脑端页面显示可从公开页面数据获得的 IP 归属地信息。本项目的核心目标是快速理解网页结构（DOM 解析）、编写用户脚本、以及处理单页应用（SPA）动态路由与异步内容加载的能力。

# 需求范围

忽略工作区内其他文件，直接编写一个可安装的 `.user.js` 脚本：

## 功能要求

- 使用标准 userscript 元数据块（`@name`、`@namespace`、`@match`、`@grant` 等），清晰声明适用域名、所需权限与外部请求。
- 支持 B 站单页应用的动态路由与异步内容加载：路由切换或 DOM 更新后功能仍然生效。
- 只展示页面或公开接口**已经返回**的归属地信息，不推断、不猜测精确位置。
- 不收集、不上传、不持久化任何用户隐私数据。
- 注入内容应尽量贴合原页面布局，避免遮挡原控件与弹层。
- 多次路由切换或 DOM 更新**不得重复插入**。
- 网络失败或字段缺失时静默降级，并提供可识别但不打扰用户的状态（如灰色占位）。

## 交付形态

- 交付一个可直接安装的 `.user.js` 文件。
- 安装后无需用户手动修改核心代码即可工作。

# 交付与限制要求

- 单文件交付，仅使用原生 JavaScript（可用 DOM API），不依赖第三方库。
- 所有网络请求必须显式声明在元数据块中。
- 代码须可直接安装运行，不得包含 TODO 或未完成占位符。
- 脚本权限遵循最小化原则：禁止无关的广域访问（如 `@grant GM_xmlhttpRequest` 仅在有真实需求时使用）。
```

</details>


### 05 · WeChat Message Parser & Excel Importer
*签到：微信打卡预约消息自动导入 Excel 系统*

📁 `L1_Basic/WeChatCheckinExcel/PROJECT_PROMPT.md` ｜ [Source file](./L1_Basic/WeChatCheckinExcel/PROJECT_PROMPT.md) ｜ [Rubric](./L1_Basic/WeChatCheckinExcel/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

````
# 任务背景

请编写一个 Python 系统：自动监听 PC 微信收到的**特定格式打卡预约消息**，提取关键字段（账号、密码、预约时间、有无绑定、是否是 diploma）及发送者微信名，自动追加写入 Excel 文件。本项目的核心目标是实现 GUI 自动化监听、正则文本解析、Excel 读写与多模块工程组织的能力。

# 需求范围

## 消息格式规范

只有包含以下结构的微信消息才会触发导入逻辑：

```text
账号：xxxx
密码：xxxx
时间：xxxx
有无绑定：xxxx
是否是diploma：xxxx
```

- 支持中文冒号 `：` 或英文冒号 `:`。
- 消息必须包含 **账号、密码、时间** 三个核心项，否则忽略。

## 导出的 Excel 结构

生成 `打卡预约数据.xlsx`（默认位于项目根目录），字段：

| 接收时间 | 消息来源(微信名) | 账号 | 密码 | 预约时间 | 有无绑定 | 是否是diploma |

- Excel 文件不存在时自动创建并写入表头；已存在时追加写入。
- 重复消息（同账号+同预约时间）可去重或保留，需在说明中声明策略。

## 监听与调度

- 使用 Windows GUI 自动化（如 pywinauto/uiautomation）监听 PC 微信聊天窗口的新消息，或提供明确的替代方案并说明理由。
- 监听指定好友/群聊（可在配置文件中设置白名单，支持"全部"）。
- 收到合法消息后，控制台实时打印解析与导入日志。
- 支持可配置项：Excel 存储路径、表头定义、监听对象列表、自动回复开关。

## 模块划分（参考）

- `config.py`：配置加载
- `parser.py`：消息正则校验与字段解析
- `excel_handler.py`：Excel 创建与追加写入
- `wechat_listener.py`：微信监听与调度
- `main.py`：主程序入口
- 单元测试：`test_parser.py`、`test_excel.py`

# 交付与限制要求

- 多文件工程交付，附带 `requirements.txt` 与 `README.md`（含安装、运行、测试步骤）。
- 解析逻辑必须通过单元测试覆盖（含中文/英文冒号、缺字段、非法格式用例）。
- 程序长时间运行不崩溃；监听失败时给出明确错误提示而非静默退出。
- 不得包含 TODO 或未完成占位符。
````

</details>


### 29 · BEAMhard: BeamNG Vehicle Physics & Damage
*BEAMhard：BeamNG 软体车辆物理与损毁模拟*

📁 `L4_Expert/BEAMhard/PROJECT_PROMPT.md` ｜ [Source file](./L4_Expert/BEAMhard/PROJECT_PROMPT.md) ｜ [Rubric](./L4_Expert/BEAMhard/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

```
# 任务背景

你是一名高级 AI 系统工程师，专精车辆工程、3D 计算机图形学、物理引擎碰撞与约束求解器设计、浏览器音频合成、以及全栈 WebGL 架构。请基于给定的 BeamNG 风格车辆资产包（`thw_ccf2(ccf2重置版)`，已预切分为 5 个 zip 分卷），在浏览器中连续单程构建一套工业级 3D 车辆仿真与渲染系统，中途不得暂停征求用户意见。

# 需求范围

## 严格约束与关键指令

1. **技术栈纯净**：交付物必须为浏览器端可运行方案（HTML5/WebGL/WebGPU 及浏览器音频能力均可，库自选）。严禁混入桌面游戏引擎原生代码（Godot GDScript、Unity C#、Unreal C++）或依赖 MCP 编辑器协议；所有物理计算与渲染逻辑必须在客户端浏览器内独立运行。
2. **连续单程执行**：任务按 Phase 1–5 划分，必须按阶段顺序一次性写完全部代码，禁止中途暂停、征求反馈或请求用户验证中间步骤。
3. **三维空间与拓扑一致**：解析转换 JBeam 节点、梁与网格顶点时，保持严格 1:1 笛卡尔坐标系映射，确保车辆动力学、悬挂刚度、软体轮胎变形与碰撞响应符合物理规律。
4. **代码完整可执行**：输出代码必须完整实现（完整 HTML 结构、CSS 动态样式、ES6 引擎逻辑、GLSL 着色器，无 `// ...` 占位），页面加载后开箱即用。

## 资产包分卷规格

| 分卷 | 大小 | 内容 |
| :--- | :--- | :--- |
| `thw_ccf2_part1.zip` | ~25MB | 核心车辆 3D 网格模型（.dae）与高分辨率车身贴图 |
| `thw_ccf2_part2.zip` | ~25MB | 车身颜色/粗糙度/数据贴图 |
| `thw_ccf2_part3.zip` | ~25MB | 悬挂与机械部件贴图 |
| `thw_ccf2_part4.zip` | ~25MB | 内饰贴图与次级材质贴图 |
| `thw_ccf2_part5.zip` | ~20MB | 完整 JBeam 物理节点-梁拓扑（115 个 .jbeam）、轮/胎资产、材质 JSON、辅助贴图 |

Phase 1 执行时须将全部分卷解包合并到统一 `vehicles/` 目录。

## Phase 1：Mod 解析、刚体物理转换与软胎解耦

- **1.1 JBeam & 3D 资产解析**：构建 Web 前端解析器，解包提取 `.jbeam` 结构定义（Node/Beam 拓扑矩阵）、3D 网格模型与材质贴图。
- **1.2 刚体/软体转换**：将底盘节点-梁网络转换为 Web 物理系统中的刚体结构（`RigidBody` + `CollisionShape` 复合，物理库或自研求解器均可）；将轮胎节点组提取为独立 `SoftBody`/可变形悬挂-车轮交互组件，配置高摩擦物理材质（`friction >= 1.2`，`rough = true`）。
- **1.3 绑定对齐**：将 3D 网格绑定到转换后的物理节点树，所有安装点与转向枢轴点无偏移对齐。

## Phase 2：Web Audio 引擎声学模拟与音频管线

- **2.1 音频提取与生成**：提取原生 `.wav` 引擎与环境音效，或构建程序化音频生成器。
- **2.2 引擎声学合成**：使用浏览器音频能力（如 Web Audio API 的振荡器/滤波器/音频工作线程等）基于缸数、排气歧管长度、发火顺序与齿比实时合成引擎声学响应曲线。
- **2.3 3D 空间音频总线**：构建多声道 3D 空间混音网络，由 RPM、油门与负载动态驱动。

## Phase 3：自动化试车场构建与空间验证

- **3.1 渲染环境与天空盒**：配置 WebGL HDR/HDRI 光照环境与天空盒；构建 ToneMapping 与 Bloom/SSR 后处理管线。
- **3.2 程序化试车场**：
  1. 悬挂测试区：比利时卵石路 + 不对称颠簸带。
  2. 转向测试区：标准绕桩赛道 + 高倾角弯道。
  3. 涉水测试区：深水水池，含流体阻力与浮力模拟。
- **3.3 车辆控制与传感器反馈**：编写车辆控制脚本（支持键盘/手柄输入）驱动车辆完成全套测试，并实时回传悬挂行程与阻尼遥测数据。

## Phase 4：GLSL NPR 动漫风格渲染与 HTML/CSS UI

- **4.1 动漫 Toon 着色器**：车辆与环境渲染使用自定义 GLSL 着色器——Cel-Shading 光阶（Step Lighting）+ 描边效果（Inverted Hull 或基于 Depth/Normal 的后处理边缘检测）。
- **4.2 FR-Legends 风格 UI**：高对比、斜切几何的动漫 HUD——动态 RPM 转速表、斜切数字车速表、实时油门/刹车/手刹输入指示条。

## Phase 5：程序化城市与 3D 矢量瓦片地图系统

- **5.1 程序化城市生成**：
  - 道路网络：L-System 或 Voronoi/Grid Graph 算法生成主干道-次干道-街区细分拓扑。
  - 体量挤出与设施摆放：从街区多边形底面自动挤出不同高度建筑基座，自动布置路灯、红绿灯与路面标线。
- **5.2 3D 矢量瓦片管线**：将道路折线/建筑底面/POI 节点切片为 QuadTree 瓦片层级（z/x/y）；运行时矢量转网格（LineString/Polygon → WebGL 3D 网格）；编写屏幕空间线宽补偿着色器，保证道路与边界轮廓线在任何相机距离/缩放下保持恒定像素宽度或抗锯齿边缘。
- **5.3 无缝缩放相机与 LOD 流式加载**：平滑平移/旋转/连续缩放（正交⇄透视无缝过渡）的相机控制器；基于视锥剔除与缩放级别动态实例化/销毁 3D 矢量瓦片块；车辆导航/大地图 HUD，城市名与 POI 标签按 LOD 淡入淡出与平滑缩放，无视觉拥挤。

# 交付与限制要求

按序单程输出完整交付物：

1. **[HTML/JS 架构与基础设施]**：Phase 1–3 的完整 HTML 页面结构、CSS 基础设计与 ES6 模块基础设施。
2. **[核心物理与音频代码]**：车辆物理控制、悬挂求解器与 Web Audio 引擎声学合成器 JavaScript 代码。
3. **[GLSL NPR 着色器代码]**：Phase 4 的 Cel-shading 光照与动漫描边渲染着色器。
4. **[程序化城市与 3D 矢量瓦片引擎]**：Phase 5 的城市生成、QuadTree 瓦片流式加载与 3D 矢量网格渲染模块。
5. **[集成 Web 应用与验证矩阵]**：完整开箱即用的单文件/多模块 HTML5 Web 应用，附样例试车场遥测输出与诊断日志。
```

</details>


### 31 · DeepSWE Benchmark Evaluation Tasks
*DeepSWE：软件工程与代码演进*

📁 `L4_Expert/DeepSWE/PROJECT_PROMPT.md` ｜ [Source file](./L4_Expert/DeepSWE/PROJECT_PROMPT.md) ｜ [Rubric](./L4_Expert/DeepSWE/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

````
# 任务背景

DeepSWE 是一个衡量前沿编码智能体（Coding Agent）在原创、长周期软件工程任务上表现的基准（Benchmark），任务来自活跃的开源仓库，覆盖 TypeScript、Go、Python、JavaScript、Rust 五种语言。请将本目录（`deep-swe/tasks`）中的任务集作为被评测对象，搭建可重复运行的评测环境，并在真实任务上运行编码智能体完成修复，最终产出结构化评分报告。

# 需求范围

## 任务格式（Harbor 格式）

每个任务目录包含：

```text
task.toml         Metadata（repo、base commit、language、image、limits）
instruction.md    智能体看到的提示词
pre_artifacts.sh  捕获智能体提交的工作为 patch
environment/      复现预构建镜像的 Dockerfile
tests/            验证器入口、保留测试与评分配置
solution/         参考解法（对智能体保密）
```

验证器只检验提示词所描述的可观察行为是否正确，不依赖内部符号名或结构；`solution/` 中的参考 patch 仅用于离线抽查，评分时不使用。

## 评测流程

1. **环境搭建**：使用 [Pier](https://github.com/datacurve-ai/pier)（Harbor 兼容框架，支持隔离任务环境与每智能体网络白名单）安装并配置；依赖 `datacurve-pier`（Python 包），要求 `Pier >= 0.3.0`（v1.1+ 使用独立验证器环境）。
2. **运行评测**：对任务集执行评测（支持全量 113 任务、随机子集采样如 `--n-tasks 10 --sample-seed 0`、或单任务 `pier run -p deep-swe/tasks/<task-id> ...`），驱动智能体（如 `mini-swe-agent`，也可驱动 `claude-code` / `codex` / `gemini-cli` / `opencode`）。
3. **结果收集**：验证器输出须包含 `reward.json`（二元奖励 + pass 分数）、`ctrf.json`（带失败信息的机器可读测试报告）、`test-stdout.txt`（原始测试输出与失败原因列表）、`run.log`（运行期间捕获的 stdout/stderr）、`reports/`（框架原生报告）。

## 分析报告

- 汇总通过率/奖励分布，按语言与仓库维度拆分。
- 抽取典型失败任务，结合 `test-stdout.txt` 与失败原因归纳失败模式（如依赖解析失败、边界条件、接口签名变化等）。
- 输出可复现的命令与参数说明。

# 交付与限制要求

- 交付：评测环境配置说明 + 运行命令 + 结构化评分报告（JSON/CSV + Markdown 摘要）。
- 不得修改任务目录中的原始任务数据（`tasks/` 只读）；环境目录（`pier-env*`）为评测运行痕迹，保留即可。
- 报告中须注明所用智能体、模型、任务子集与种子，保证可复现。
````

</details>


### 33 · Adobe Photoshop MCP Server Integration
*PSMCP：Adobe Photoshop MCP 服务端*

📁 `L4_Expert/PSMCP/PROJECT_PROMPT.md` ｜ [Source file](./L4_Expert/PSMCP/PROJECT_PROMPT.md) ｜ [Rubric](./L4_Expert/PSMCP/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

````
# 任务背景

请基于 **Model Context Protocol (MCP)** 和 **Windows COM / ExtendScript** 接口，构建一个 Adobe Photoshop 自动化控制服务端（PSMCP）。通过该 MCP 服务端，AI 助手（如 Claude、Cursor、Antigravity 等）可以对 Adobe Photoshop 进行高度灵活的自动化操作，涵盖文档创建、图层管理、文本填充、色彩绘制、图像导出以及运行自定义 ExtendScript 脚本。

# 需求范围

## 架构要求

```
PSMCP/
├── photoshop_controller.py  # 核心控制器（基于 COM 接口与 ExtendScript 封装）
├── server.py                # MCP 服务端主程序（基于 FastMCP 注册标准工具）
├── test_photoshop.py        # 诊断与连通性测试脚本
├── requirements.txt         # 项目依赖列表
├── run_server.bat           # Stdio 启动批处理脚本
└── README.md                # 使用说明文档
```

## 环境要求

- **操作系统**：Windows 10 / 11
- **软件**：Adobe Photoshop（CC 2018 / 2020 / 2024 / 2025 等支持 COM 自动化版本的 PS）
- **Python 环境**：Python 3.10+
- **依赖库**：`mcp`、`pywin32`、`pillow`

## 提供的 MCP 工具列表（Tools）

| 工具名称 | 功能描述 |
| :--- | :--- |
| `ps_get_status` | 获取 Photoshop 当前连接状态、版本、打开文档数及活动文档名 |
| `ps_create_document` | 创建新文档（宽度、高度、分辨率、名称和背景填充类型） |
| `ps_open_document` | 打开现有图像或 PSD 文件 |
| `ps_save_document` | 保存/导出当前文档（PSD、PNG、JPEG 格式） |
| `ps_get_active_doc_info` | 获取活动文档尺寸、分辨率、图层树结构与当前选中图层 |
| `ps_add_art_layer` | 新建空白像素图层 |
| `ps_add_layer_group` | 新建图层组 (Folder) |
| `ps_add_text_layer` | 添加格式化文本图层（文字、字体、字号、颜色、位置及对齐方式） |
| `ps_fill_active_layer` | 用指定 HEX 颜色填充当前图层或选区 |
| `ps_set_layer_visibility` | 设置指定图层显示/隐藏 |
| `ps_set_layer_opacity` | 修改图层不透明度 (0.0–100.0) |
| `ps_duplicate_layer` | 复制指定图层 |
| `ps_delete_layer` | 删除指定图层 |
| `ps_export_preview` | 快速导出当前画布视图为 PNG 预览图像供 AI 分析 |
| `ps_execute_extendscript` | 执行任意 ExtendScript (JS) 代码段，支持 100% 内部 DOM 与 ActionManager |

## ExtendScript 进阶控制

`ps_execute_extendscript` 须支持直接在 Photoshop 内部运行 ExtendScript 脚本，例如：

```javascript
// 获取画布所有图层名称
var layers = app.activeDocument.layers;
var names = [];
for (var i = 0; i < layers.length; i++) {
    names.push(layers[i].name);
}
names.join(", ");
```

# 交付与限制要求

- 交付完整工程（上述目录结构）+ `requirements.txt` + 启动脚本 + 说明文档。
- 提供连通性/诊断测试脚本 `test_photoshop.py`（无 PS 时可输出明确错误引导）。
- README 中给出 MCP 客户端配置示例（`claude_desktop_config.json` 等）。
- 所有工具参数须有清晰 schema（名称、类型、描述、必填项）。
- 不得包含 TODO 或未完成占位符。
````

</details>


### 34 · SketchUp MCP Bridge Integration
*草图大师MCP：SketchUp MCP 桥接器*

📁 `L4_Expert/SketchUpMCP/PROJECT_PROMPT.md` ｜ [Source file](./L4_Expert/SketchUpMCP/PROJECT_PROMPT.md) ｜ [Rubric](./L4_Expert/SketchUpMCP/README.md)

<details>
<summary>📋 Full prompt — click to expand, then copy via the button in the code block's top-right corner</summary>

````
# 任务背景

请构建一个 SketchUp MCP 桥接器（SketchUp-MCP-Bridge）：让 MCP 兼容的 AI 助手（如 Claude 等）能够**实时读取、查询、修改正在运行的 SketchUp 模型**。本项目的核心目标是实现跨进程桥接架构（Ruby 插件 ↔ Python MCP Server）、TCP/HTTP 通信、3D 几何操作与事务安全的能力。

# 需求范围

## 架构

```
┌─────────────────┐       stdio/SSE       ┌──────────────────┐      HTTP POST      ┌─────────────────────────┐
│   LLM / Agent   │ ◄──────────────────► │  MCP Server (Py) │ ◄─────────────────► │  Ruby Bridge (SketchUp) │
│  (Claude etc.)  │      MCP Protocol     │   server.py      │   127.0.0.1:18234   │  TCPServer + Timer调度   │
└─────────────────┘                       └──────────────────┘                     └─────────────────────────┘
```

## 目录结构

```
SketchUp-MCP-Bridge/
├── sketchup_plugin/
│   ├── sketchup_mcp_bridge.rb              # 扩展加载器 → 放入 Plugins/
│   └── sketchup_mcp_bridge/
│       └── main.rb                         # 核心: TCP Server + API 实现
├── mcp_server/
│   ├── server.py                           # MCP Server (Python, FastMCP)
│   └── requirements.txt
└── README.md
```

## 安装步骤

1. **SketchUp 插件**：将 `sketchup_plugin/` 下两项复制到 SketchUp Plugins 目录（如 `%AppData%\SketchUp\SketchUp 2024\SketchUp\Plugins\`），重启 SketchUp 后插件自动启动 HTTP 服务（端口 18234）；同时提供菜单 `Plugins > MCP Bridge > Start/Stop Server` 手动控制。
2. **Python MCP Server**：`cd mcp_server && pip install -r requirements.txt && python server.py`。
3. **接入 MCP 客户端**：README 提供 `claude_desktop_config.json` 配置示例。

## 可用工具（Tools）

| Tool | 功能 |
|------|------|
| `su_get_model_info` | 获取模型基本信息（单位、图元统计、选择集） |
| `su_query_dimensions` | 按名称/ID 查询物体包围盒尺寸 |
| `su_create_geometry` | 在指定坐标创建长方体并自动打组 |
| `su_set_camera_view` | 设置相机 eye/target/up 视角 |

## 关键设计要求

- Ruby Bridge 仅监听 `127.0.0.1`，不暴露到外网。
- 所有模型修改操作包裹在 `start_operation/commit_operation` 事务中，支持 Ctrl+Z 撤销。
- SketchUp API 调用强制在主线程执行（通过 `UI.start_timer` 调度），确保线程安全。
- 请求超时：Ruby 端 30s，Python 端 35s。
- 支持 stdio 与 SSE 两种 MCP 传输方式。

# 交付与限制要求

- 交付完整工程（Ruby 插件 + Python MCP Server + README 安装/配置文档）。
- 提供连通性测试方式（无 SketchUp 环境时能给出明确错误信息）。
- 所有工具参数有清晰 schema；错误响应可读、可诊断。
- 不得包含 TODO 或未完成占位符。
````

</details>

---

*Prompt contents are verbatim copies of each project's `PROJECT_PROMPT.md`; if a source file is updated, regenerate this index or verify against the source after copying.*