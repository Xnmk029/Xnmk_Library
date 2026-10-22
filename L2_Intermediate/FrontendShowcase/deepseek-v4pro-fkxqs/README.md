# NEUROLINK//OS-4 · 赛博朋克 HUD 多职业交互式简历

> `L2_Intermediate/FrontendShowcase` 参赛实现 · 模型 ID 尾缀 **`v4pro-fkxqs`**
> 「复合型创客 × 系统管理员」四职业并行的沉浸式 HUD 简历终端。

---

## 1. 启动

本目录是 `FrontendShowcase` npm Workspaces monorepo 的一个成员包，依赖由根目录
`node_modules` 提供（React 18 / three 0.170 / @react-three/fiber 8 / framer-motion 11 / Vite 6）。

```bash
cd L2_Intermediate/FrontendShowcase/deepseek-v4pro-fkxqs
npm run dev        # → http://127.0.0.1:5183/
```

其它脚本：

| 命令 | 作用 |
| :-- | :-- |
| `npm run dev` | Vite 开发服务器（端口 5183） |
| `npm run build` | 产出 `dist/` 静态包 |
| `npm run preview` | 预览构建产物（端口 4183） |
| `npm run verify` | 无头浏览器 33 项自动验收（需先启动 dev，见 §5） |

> **工作区隔离**：所有代码、配置、脚本、产物全部位于本子目录内。根目录
> `package.json` / `package-lock.json` 与其它模型目录 **零改动**，本目录也不写任何
> 会影响 workspace 行为的 npm 配置。

---

## 2. 页面结构

| 区段 | 内容 |
| :-- | :-- |
| `BOOT` | 开机自检覆盖层：6 行乱码解码日志 + 进度条，点击任意处跳过 |
| `IDENTITY` | 巨幅乱码姓名、身份总线、实时状态读数、职业图例（悬停即换色） |
| `CLASS SELECT` | 四职业入口：编号 / 代号 / 中英名 / **悬停延伸导引线** / 同步率 / ENTER |
| `LIVE 3D VIEWPORT` | WebGL 实时视窗 + 能力遥测面板 + 场景清单（四职业四套线框场景） |
| `SKILL MATRIX` | 滚动触发的 Bento 技能库（7 张卡，随所选职业整组重绘） |
| `OPS LOG` | 12 条跨职业作战日志，按年份倒序，左侧色条区分归属 |
| `DOSSIER` | 全屏转场子页面：故障条扫过 + clip-path 展开 + LayoutId 弹簧morph |
| HUD 常驻 | 顶栏导航 / 左右侧栏刻度与滚动进度 / 底部跑马灯 / 四角括号 / 扫描线与光束 |

### 四职业主题色（严格按题目要求）

| # | 职业 | 霓虹色 | 3D 场景 |
| :-: | :-- | :-- | :-- |
| 01 | AI PROMPT ENGINEER · AI 提示词专家 | `#23ff00` | 语义晶格：斐波那契球点云 + 邻接连线 + 脉动核心 |
| 02 | BICYCLE TECHNICIAN · 单车工程技师 | `#ffaa00` | 传动台架：轮圈 / 32 根辐条 / 牙盘 / 6 片飞轮 / 链条 |
| 03 | IT SYSTEMS ADMIN · IT 系统管理员 | `#00f0ff` | 机柜遥测：5U 机架 + 35 颗闪烁指示灯 + 上行数据包 |
| 04 | 3D LEVEL DESIGNER · 3D 关卡设计师 | `#ff0055` | 白盒关卡：网格地面 + 9 个体块 + 动线巡游标记 |

---

## 3. 三大核心动效实现

### 3.1 Canvas 贝塞尔扰动背景 — `src/components/CanvasBackground.jsx`

- **250 条**发光贝塞尔缎带。每条由 7 个锚点经 Catmull-Rom → 三次贝塞尔转换成 **6 段
  `bezierCurveTo`**，保证 C1 连续，共 1500 段/帧。
- **鼠标排斥扰动**：300px 半径内，每个锚点沿径向被推开 `f²·92px`（`f` 为归一化距离衰减），
  并叠加一层随主题色的径向光晕跟随指针。
- **滚轮波浪振幅**：`wheel` 事件注入 wave energy（上限 1.9），振幅系数 `1 + energy·1.75`，
  同时累积 `scrollPhase` 让波形沿 X 轴行进；能量按 `e^(-1.7Δt)` 逐帧衰减回静止。
- **职业色过渡**：目标 RGB 与不透明度每帧按 `1 - e^(-Δt·k)` 帧率无关缓动，
  悬停/选中职业时整片场平滑换色并提亮（0.92 → 1.2）。
- **性能策略**：250 条曲线按 4 个景深层分组，**每层合并为一条 path 只 stroke 两次**
  （宽而淡 = bloom，细而亮 = core），即每帧 8 次 stroke 而非 500 次；`lighter` 叠加混合
  产生真实发光；DPR 上限 1.5；帧成本 EMA 超阈值时自动降级（关 bloom → 减层）。
  实测提交成本 **< 1ms/帧**。
- 页面不可见（`document.hidden`）或档案层打开时自动停摆，避免与 `backdrop-filter` 叠加空转。

### 3.2 Scramble Text 乱码滚动 — `src/components/ScrambleText.jsx`

- 字符从左到右逐个锁定，未锁定的尾部每两帧重掷一次乱码字形；
  已解码段与滚动段拆成两个 span，滚动段实时套用当前主题霓虹色 + 发光。
- 直接写 `textContent`（零 React 重渲染），并在 `useLayoutEffect` 里先画一帧满乱码，
  **首帧即占满最终盒子，零布局抖动**。
- 全站 **46 个** scramble 实例共享 **同一个 rAF ticker**（`src/lib/raf.js`），
  不会出现几十条独立动画循环。
- `whenInView` 模式接 `useInView`，滚动进场才开始解码。

### 3.3 转场与 LayoutId 弹簧

- 职业入口的代号徽章与档案页标题徽章共享 `layoutId={'class-code-'+id}`，
  点击时用 spring(260/26) 无缝 morph；顶栏当前区段下划线（`layoutId="hud-nav-underline"`）、
  视窗职业页签高亮（`layoutId="viewport-tab-glow"`）同理。
- 档案层入场：4 条故障条横扫 + 面板 `clip-path: inset(46% → 0%)` 展开；
  退场只动 `opacity/scale`（**刻意避开 `filter`/`clip-path` 退场**——见 §6 踩坑记录）。
- 导引线：`.class-guide-lit` 宽度 0% → 100% spring 延伸，末端菱形节点与下垂连接线随之点亮。

---

## 4. 文件结构

```
deepseek-v4pro-fkxqs/
├── index.html                       # 含内联 SVG favicon 与预挂载 shell（无白闪）
├── vite.config.js
├── package.json / .gitignore
├── scripts/verify.mjs               # 无头浏览器 33 项验收
├── artifacts/                       # 验收截图 + verify-report.json
└── src/
    ├── main.jsx                     # React 18 StrictMode 挂载
    ├── index.css                    # #050507 底色 · 双密度细网格 · 全局暗角 · 关键帧
    ├── App.css                      # HUD 骨架 · 职业选择器 · 视窗 · Bento · 档案转场
    ├── App.jsx                      # 主编排：主题总线 / 区段观测 / 档案状态机 / 键盘
    ├── lib/
    │   ├── raf.js                   # 全站共享 rAF ticker
    │   └── color.js                 # hex→rgb / 帧率无关缓动 / mulberry32 PRNG
    ├── data/careers.js              # 四职业全量档案数据（含确定性 PRNG 生成的图表序列）
    └── components/
        ├── CanvasBackground.jsx     # 250 条贝塞尔扰动背景
        ├── ScrambleText.jsx         # 乱码滚动解码
        ├── BootOverlay.jsx          # 开机自检
        ├── HudChrome.jsx            # 顶栏 / 侧栏 / 跑马灯 / 四角
        ├── CareerSelector.jsx       # 四职业入口 + 导引线
        ├── CareerDossier.jsx        # 全屏转场子页面
        ├── LiveViewport.jsx         # R3F 画布 + 遥测面板
        ├── BentoSkills.jsx          # 滚动触发 Bento 技能库
        ├── OpsTimeline.jsx          # 跨职业作战日志
        ├── Meters.jsx               # 环形表盘 / 能力条 / 火花线 / 点阵热图
        └── scenes/CareerScenes.jsx  # 四套 three.js 霓虹线框场景 + 相机 Rig
```

---

## 5. 自动化验收

```bash
npm run dev                 # 终端 A
npm run verify              # 终端 B（复用工作区已装的 puppeteer-core + 本机 Chrome）
```

`scripts/verify.mjs` 用无头 Chrome 跑完整交互链路，**33/33 全绿**（连续 5 轮稳定复现）：

```
PASS  boot overlay renders
PASS  canvas bezier field mounted
PASS  webgl 3d viewport mounted — 1 canvas
PASS  four class entries — 4 rows
PASS  bento skill cards — 7 cards
PASS  scramble instances — 46 nodes
PASS  ops log rows — 12 rows
PASS  hud ticker present
PASS  bezier field is painting pixels — 8682 lit samples
PASS  default theme = class 01 green — #23ff00
PASS  hover class 02 retints field to orange — #ffaa00
PASS  guide line extended on hover — 210.6px
PASS  dossier sub-page opens — MEC-02
PASS  dossier missions rendered — 3
PASS  dossier gauges rendered — 5
PASS  dossier prev/next class step — SYS-03
PASS  dossier closes on escape
PASS  bento cards revealed on scroll — 7/7
PASS  proficiency bars animated in — 5/5
PASS  viewport tab switches class theme — #ff0055
PASS  field declares 250 bezier ribbons — 250 ribbons × 6 cubic segments (7 anchors)
PASS  field colour eased to class 04 magenta — rgb(247, 8, 91) · intensity 0.921
PASS  pointer repulsion field engaged — pointer 1081,503 · radius 300px
PASS  wheel input injects wave amplitude energy — energy 1.5495 · phase 2.288
PASS  wave energy decays back to rest
PASS  field frame cost within budget — < 1ms/frame · quality tier 2
PASS  no clipped panel/card content
PASS  no horizontal scroll @ 1920x1080 / 2560x1440 / 1440x900
PASS  zero page errors / zero console errors / zero failed requests
```

为了让「250 条曲线 / 排斥 / 滚轮波浪」可被外部客观断言（而不是靠肉眼），
`CanvasBackground` 在运行时挂出只读探针 `window.__NEUROLINK_FIELD__`
（曲线数、段数、排斥半径、当前 wave energy、缓动后的 RGB、帧成本、帧计数），
组件卸载时移除。

截图产物见 `artifacts/`：boot / 职业悬停 / 档案转场 / Bento / 视窗 / 三档分辨率首屏。

---

## 6. 工程记录（真实踩坑）

1. **`AnimatePresence` + `filter` 退场会卡死**：开机层原本 `exit={{opacity:0, filter:'blur(6px)'}}`，
   在部分时序下 filter 补间不完成 → 退场动画永不 resolve → 覆盖层永久留在 DOM 里挡住整页。
   改为只动 `opacity/scale` 后彻底稳定；档案层退场同样移除了 `clip-path`。
2. **父级 variant 树里的 `whileInView` 子元素不可靠**：Bento 卡片用 stagger variants 编排，
   卡内能力条若各自使用 `whileInView`，会有 2/5 条被父级传播的 variant 状态覆盖而永远停在 `scaleX:0`。
   已把 `Meters.jsx` 全部改为显式 `useInView` 门控 —— 确定性 5/5。
3. **无头浏览器空转时不产帧**：纯 `sleep` 期间 headless Chrome 停止 BeginFrame，
   衰减看起来像「冻结」。验收脚本改为在页面内用 `requestAnimationFrame` 驱动真实帧，
   并按 **帧数**（而非墙钟时间）断言能量衰减。
4. **favicon 404 会污染控制台**：改为 `index.html` 内联 SVG data-URI，控制台归零。
5. `<button>` 的内容模型只允许 phrasing content，职业入口内的 `<h3>` 已换成 `.cn-title` span。

---

## 7. 交互一览

| 操作 | 反馈 |
| :-- | :-- |
| 移动鼠标 | 250 条缎带径向排斥 + 主题色光晕跟随；3D 视窗相机视差 |
| 滚动滚轮 | 背景波浪振幅涨落并沿 X 轴行进，随后自然衰减 |
| 悬停职业入口 / 图例 / 日志 | 导引线延伸点亮、整站 HUD 与背景场换成该职业霓虹色 |
| 点击职业入口 / 图例 / 日志 | 展开全屏档案转场子页面（徽章 LayoutId morph） |
| 档案页 `←` / `→` / `Esc` | 上一/下一职业、关闭（同时锁定页面滚动） |
| 视窗职业页签 | 切换 3D 场景 + 遥测 + Bento 技能库整组重绘 |
| 顶栏导航 | 平滑滚动到区段；下划线弹簧跟随当前区段 |
| 滚动到技能库 | Bento 卡片 stagger 进场、环形表盘/能力条/火花线/点阵依次生长 |

## 8. 兼容与性能

- 目标 `es2020`，Chrome / Edge / Firefox 现代版本；纯桌面优先，1440×900 → 2560×1440 布局完整，
  三档分辨率实测 **无横向滚动条**。
- 无任何网络字体与外部资源（字体走 Bahnschrift/Cascadia/Consolas 系统栈），断网可运行。
- 3D 视窗滚出视口即 `frameloop="never"` 停摆；背景场在页面隐藏或档案层打开时停摆。
- 全部动效为真实运行时代码，无静态截图替代，无 TODO / 占位符。
