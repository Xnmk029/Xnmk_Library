# sandbox/AGENTS.md — 隔离测试与自动审阅 Agent 协议（2.0 · bare）

> 本文件是 `sandbox/` 工作区的**唯一 agent 入口协议**。
> 编排 agent、审阅 agent 进入 `sandbox/` 后必须先读本文件。
> 机读摘要见 `sandbox/protocol.json`。

## 0. 设计原则（2.0 核心变化）

**受测方只看到题面原文。** 1.x 的「纪律七条 / 作答契约 / result.json 自报 / 要求摘要」
全部移除——它们会污染测量（告知模型"你在被考试"、替模型预消化 rubric、把历史
交付文件名写进提示）。2.0 的隔离与诚信完全由**环境强制 + harness 观测**实现：

- **环境**：受测工作区在仓库外（默认 `F:\bench-runs\<model>\<run_id>`，可用
  `SANDBOX_RUNS_ROOT` 覆盖），普通项目只含 `PROMPT.md`；登记的输入 profile 可额外携带白名单资产。
  外部 cwd 只减少就地泄漏，不是访问控制；真正的读取/写入边界必须由宿主权限或容器落实，不能据此声称全盘权限 Agent 已隔离。
- **观测**：`meta.json` + `snapshot.json` 存 harness 侧
  `sandbox/runs/<model>/<run_id>/`（受测方不可见）。审阅时做快照 diff 与
  可选 transcript 扫描（H1–H3），替代自报 integrity。

## 1. 角色与边界

| 角色 | 工作目录 | 可读 | 可写 |
|---|---|---|---|
| **编排 Agent** | 仓库根 | 全仓库 | `sandbox/runs/**`（harness）、prepare 时的 workdir |
| **受测模型** | 仓库外 workdir | 仅 workdir 内文件 | 仅 workdir —— **无协议义务**（纪律不写在提示里，由环境保证） |
| **审阅 Agent** | harness dir + workdir（只读） | 题面 + 交付物 + meta/snapshot | `REVIEW.md`、`meta.json`（harness dir） |

**工具纪律**（编排与审阅共享）：不得在 `sandbox/`、workdir 或任何 run 目录内创建
agent/IDE 工具状态（`.codeartsdoer`、`.arts`、`.cursor`、`.devin`、`.codebase` 索引等）。
`review-lab/reference-assets/` 对受测与审阅同样禁读。

**审阅 Agent 禁止**：读项目 README 评分细则；读其他 run / 历史模型输出 / `暂存/` /
`Vision/` / `.git`；修改题面或交付物。

## 2. 编排 Agent · 标准流程

```text
prepare_run.py --project <名> --model <slug>
  → workdir:  <RUNS_ROOT>/<model>/<run_id>/   （受测方工作区，仅含 PROMPT.md）
  → harness:  sandbox/runs/<model>/<run_id>/  （meta.json + snapshot.json）
  → 派发词即 prepare 输出末两行（或 dispatch UI 的"派发词"按钮）

受测完成后：
review_run.py --run <harness_dir> [--transcript <会话记录>]
  → REVIEW.md + meta.verdict（PASS / PASS_WITH_WARNINGS / FAIL / INVALID）
collect_run.py --run <harness_dir> [--dry-run]
  → 交付物拷入 <project>/<slug>/，孤立主交付归一化为 answer.<ext>
```

图形化发题：`python sandbox/scripts/dispatch_api.py --port 8787 --open`
（项目勾选 → 组卷 → 复制派发词 → 审阅/收卷，全程同一页面）。

向受测模型开口时**只**发派发词（工作目录 + "任务说明在 PROMPT.md，产出写在同目录"）。
禁止附带：其他模型交付物、README 评分细项、DOMAIN_INDEX、纪律条款、result.json 模板。

## 3. 受测模型 · 协议义务：无

2.0 下受测方不承担任何协议义务。`result.json`、`log.md` 若自愿写出会被收卷带上，
但**缺失不影响 verdict**；integrity 不再自报，由 H 检查观测。

## 4. 审阅 Agent · 自动审阅

```powershell
python sandbox/scripts/review_run.py --run <harness_dir>
python sandbox/scripts/review_run.py --model <slug> --latest
python sandbox/scripts/review_run.py --run <harness_dir> --transcript session.txt
```

机器层硬性规则：

- **H1** workdir 在仓库外 → 否则隔离失效 FAIL。
- **H2** 快照 diff：`PROMPT.md` 被改/删、已有文件被改动、新增禁入项 → FAIL（判 INVALID）。
- **H3** transcript 含仓库路径痕迹（`F:\benchmark`、`L1_Basic/`、`DOMAIN_INDEX` 等）→ INVALID；未提供 transcript 记 N/A。
- **L1** workdir 内出现禁入项 → FAIL；子目录/点文件 → WARN。
- **D0–D6** 交付物检查（缺交付物、HTML/SVG 形态、占位符红线、外部 3D 引用等）同 1.x。
- `result.json` 存在 → 记 D8 信息项，**不计入 verdict**。

verdict 规则：任一 H/L1 FAIL → `INVALID`；其余 FAIL → `FAIL`；仅 WARN →
`PASS_WITH_WARNINGS`；全净 → `PASS`。

智能层可选增强（不读 rubric、不读其他模型）：逐项勾选 REVIEW.md「题面要求对照」、
run 副本内起本地服务做运行时验证、补记结论；可将 verdict 改严，禁止无理由放宽。

## 5. 收卷 Agent 规则

1. 校验 workdir `PROMPT.md` SHA 与正式树题面一致。
2. verdict 闸门：仅 `PASS` / `PASS_WITH_WARNINGS` 收卷（其余退出码 3）；
   `--force` 强收写进 MIGRATION.md。
3. 孤立主交付归一化为 `answer.<ext>`；多文件保留原名；原名映射写进 MIGRATION.md。
4. 旧协议 run（meta.protocol_version ≠ 2.0）拒绝收卷（退出码 4）。

## 6. 失败与作废

| 情形 | 处理 |
|---|---|
| H1 workdir 在仓库内 | INVALID，作废 |
| H2 快照污染（题面被改/新增禁入项） | INVALID，作废 |
| H3 transcript 出现仓库路径 | INVALID，作废 |
| workdir 缺交付物 | D0 FAIL；重开新 run |
| 交付物含 TODO/占位符 | D4 FAIL |
| 未审阅即收卷 | collect 拒绝（verdict 闸门） |
| 题面 SHA 与正式树不一致 | collect 拒绝入库 |

## 7. 旧 run 处置

`sandbox/runs/` 下 protocol 1.1 的 run（live-test/live-pro/pangu/candidate-1 等）
由 `status.py` 标 `[deprecated]`，`review_run` / `collect_run` 对其退出码 4。
分数对比只在同协议内进行；如需重测，用 bare 模式重新组卷。

## 8. 命令速查

```text
python sandbox/scripts/prepare_run.py --list
python sandbox/scripts/prepare_run.py --project <P> --model <M>
python sandbox/scripts/dispatch_api.py --port 8787 [--open]     # 图形化发题
python sandbox/scripts/status.py      [--model <M>] [--pending] [--json]
python sandbox/scripts/review_run.py  --run <harness_dir> [--transcript f] [--strict]
python sandbox/scripts/collect_run.py --run <harness_dir> [--dry-run] [--with-review] [--force]
```

## 9. 外部 Agent 接入清单

1. 读本文件（或 `protocol.json`）后再动手。
2. 认领角色，只在角色可写范围内操作。
3. 工具状态写到仓库根或系统级目录，不进 `sandbox/` 与 workdir。
4. 流水线只走 `sandbox/scripts/` 命令或 dispatch UI；不手工拼 run。
5. 派发词只用 `prepare` / UI 生成的两行——**不要**自行添加纪律、契约或提示。

本协议版本变更时，同步更新 `sandbox/README.md`、`sandbox/protocol.json`。

## 10. 可选视觉输入 profile：bare-vision-v1

适用范围仅 `Vision/PairedVision/v1/public/PV1-*` 登记的 8 个条件；普通项目仍沿用原 bare 流程。
入口为 `Vision/PairedVision/ORCHESTRATOR.zh.md`，批量命令 `vision_suite.py prepare/execute/finalize`。
受测目录只含原题面及锁定图片，所有协议/评分/金标留在 harness 侧。
本节授予**机器评分模块** `vision_profile.py` 最小读取例外：可校验该发布包 LOCK.json 并调用锁定的 private/score.py 与相应 gold；不授予审阅 Agent 读取金标、历史答案或源码的权限。
机器输出写 `SCORE.json`、`REVIEW.md`、meta；组卷可写 suite manifest；收卷写 `Vision/PairedVision/results/<model>/<run_id>/`。
仅 schema 合法且完整性未失败的答案可收卷；可评分不等于正确，低分/零分亦归档。`--force` 不得绕过此 profile 的收卷闸门。
collect 必须再次核对全部输入、答案和快照、发布版本、评分报告、transcript，拒收审阅后变更。
默认隔离状态为 `unverified`，即使 H1–H3 通过也不能证明 OS 权限隔离。宿主隔离证据由编排方另存并人工审阅。
通用 CLI adapter 启动独立会话，保留原始输出与预算；身份与 usage 缺失保持 null，不能依据模型自述补全。

## 11. 探索 profile：legacy-vision-explore-v1

范围为 `Vision/catalog/BANK.json` 中有题面与金标的旧题（MusicTheory / Geometry / RealScene / AnimeID / Iteration），
不含 PairedVision、Historical 副本、CuratedSubset、仅参考素材与降级题。入口 `legacy_vision.py prepare/finalize`。
旧 `PROJECT_PROMPT.md` 是维护文档（含金标路径乃至答案），组卷只取其中唯一的 ```text 提示词块 + 图片（改名 stem_NN）；
工作目录用不透明 `LV-<sha10>` 编号，原题 ID 只在 harness。`legacy_vision.py` 获同等最小金标读取例外，报告不写金标值。
自由文本命中为暂定，未命中记 `pending_human` 而非零分；Iteration 在此为 Agent 工具协议，须与 `visual-only-api` 校准成绩分列。
这是探索性 profile，不是正式发布，隔离恒为 `unverified`。

## 12. 冻结 r6 的 Agent CLI 辅助测试（2026-09-29）

用户明确要求暂不人工复审，使用本机 DeepSeek Harness、CodeBuddy 等 CLI 继续测试。
新增 `iteration_cli.py prepare/execute/summarize`，profile 为 `iteration-r6-agent-cli-v1`。
组卷严格复制 `Vision/iteration/20260921/holdout/holdout-v2-r6/SUITE.json` 中 12 条件的公开题面和图像，金标、清单、适配器、历史答案不进入仓库外工作目录。
只有机器评分模块 `iteration_cli.py summarize` 获最小金标读取例外，调用原 strict-leaf-v1 评分；不授予受测 CLI 或独立审阅 Agent 金标访问。
按原题内字段、轨内均分、跨轨等权规则报告，完整性或结构无效时不输出整卷总分。
每题新进程、600 秒、不自动重试、保留错误与探针失败。状态、PID、原始输出、输入和输出快照均在 harness。
本轮使用文件/图像工具；CLI 原生图片预处理与主测不同，不合并排行，也不视为人类复审。
OS 级隔离仍为 unverified。协议只作专项扩展，不改变既有冻结主测与人工证据缺失事实。

## 13. 原生 Godot profile：native-godot-v1

登记文件为项目根的 BENCH_PROFILE.json，当前项目 NativeWorkflowBench/GodotShader 与 NativeWorkflowBench/GodotGameDemo。默认 prompt_only 仍只复制原始题面；续作题可登记 prompt_and_locked_archives，由 PROMPT_REGISTRY.json 列出输入 ZIP，再由 BENCH_PROFILE.json 的 locked_inputs 锁定 basename、SHA-256 与字节数。prepare、review、collect 必须核对输入；ZIP 原样保留，解压后的源码可编辑。禁止把旧提示词、评审、分数、金标、录像或缓存作为续作输入。Godot 项目发现、审阅和收卷使用既有 prepare/review/collect 入口。操作见 GODOT_RUNS.md。

机器模块 godot_profile.py 获本 profile 的最小运行权限：读取登记、题面、交付与快照，在 harness 的独立副本上调用固定 Godot 导入/GPU 启动/截图，不读取参考解或其他模型答案。原始提交不修改；每次验收有唯一 user://、TEMP/TMP 和进程，缓存不进入交付归档。

收卷保留完整工程的相对路径与全部普通/二进制依赖，归档前核对已审阅快照与运行证据。完整性有效但运行失败的样本可保留 FAIL 归档，以避免只保留成功样本；此为本 profile 的专门例外。INVALID、陈旧证据和改动过的题面/交付拒收，force 不可绕过。原生工程不会被重命名或压平为 answer 文件。

运行检查与视觉评分分开：GPU 启动不验证六模式、交互、像素稳定性或风格质量，视觉评分始终待人工；工程 fixtures 不属于模型成绩。宿主/Agent/MCP 的读取边界未经验证时，isolation_verification 必须保持 unverified，不因目录、哈希或运行检查通过而升级。

## 14. 原生 Blender profile：native-blender-v1

登记文件为项目根的 BENCH_PROFILE.json，首题 NativeWorkflowBench/BlenderMXMaster3S。prepare 仅复制原题面和登记的 references/** 文件白名单，不复制项目说明、环境探针、模型答案或 harness 状态。白名单内容、正式题面与登记均冻结 SHA-256；参考图和公开尺寸资料属于本题输入。纯文字变体可明确登记 input_payload=prompt_only 且 input_files={}，此时 prepare 只复制原题面，仍执行完整的快照、原生验收与收卷检查；与带图条件分列记录。

机器模块 blender_profile.py 获最小原生验收权限：只检查当前提交及输入完整性，在 harness 的独立副本和独立用户配置/TEMP 上，用登记 Blender 版本/build 打开 .blend 并生成受控 GPU 预览与结构/尺寸报告。自动执行嵌入脚本关闭，原始提交不修改。运行检查不能代替曲面、材质、拓扑与连续证据的人工评分。

原生 Blender 登记可提供 expected_dimensions_xyz_mm 和 liquid_volume（对象名、目标 mL、容差）。验收从冻结登记读取工程尺寸与可选闭合液体网格体积条件；原鼠标题未登记时保留原 84.3×124.9×51 mm 检查，不将鼠标尺寸用于瓶类新题。液体体积检查考虑求值网格、世界变换和场景单位，几何闭合与容积符合不替代材质/形体视觉评分。

review/collect 走现有入口。完整工程、二进制资源和相对路径保留；完整性有效的运行失败样本可保留 FAIL 归档。INVALID、题面/参考图变更、陈旧或被改动的运行证据均拒收，force 不可绕过，已有归档不覆盖。工程 fixtures 标注 engineering_fixture，不调用模型、不形成模型成绩。

每个 Agent/MCP run 需绑定独立 Blender 文件、进程、用户配置和端口；图像输入注册与原生副本验收不证明 OS 或 MCP Python 文件读取边界有效，isolation_verification 仍为 unverified。实际模型、接入方式、会话日志和 usage 由派发宿主保存；未知值不从模型自述补全。
