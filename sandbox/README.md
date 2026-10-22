# sandbox — 隔离临时测试工作区（protocol 2.0 · bare）

Godot 原生工程已接入可选 profile native-godot-v1，支持仓库外组卷、独立运行验收、完整目录归档与失败样本保留。操作见 [GODOT_RUNS.md](GODOT_RUNS.md)。它提供轻量工程运行隔离，OS 访问权限仍为 unverified。

Blender 产品建模已接入 native-blender-v1，支持原题面与锁定参考图白名单组卷、原生 .blend 副本验收、尺寸/资源检查及完整工程归档。操作见 [BLENDER_RUNS.md](BLENDER_RUNS.md)；视觉评分人工填写，OS/MCP 读取隔离仍为 unverified。

给受测模型做**临时性**测试。2.0 的核心变化：**受测方仅见题面原文**——
没有纪律条款、没有作答契约、没有 result.json 要求、没有 rubric 摘要。
组卷使用仓库外目录，完整性由 harness 快照 diff 与 transcript 扫描观测。目录位置本身不限制读取权限；真正的文件访问隔离须由宿主落实。登记的输入 profile 可额外携带白名单题图。

## 快速开始（编排侧）

```powershell
$env:PYTHONUTF8=1

# 0) 列出可测项目
python sandbox/scripts/prepare_run.py --list

# 1) 组卷（bare 模式）
python sandbox/scripts/prepare_run.py --project USP --model my-model-slug
# → workdir : F:\bench-runs\my-model-slug\<ts>-USP\   （受测工作区，仅含 PROMPT.md）
# → harness : sandbox\runs\my-model-slug\<ts>-USP\    （meta.json + snapshot.json）

# 或图形化发题：
python sandbox/scripts/dispatch_api.py --port 8787 --open
# → 浏览器勾选题目 → 组卷 → 复制派发词 → 粘贴给受测会话

# 2) 把派发词（两行：工作目录 + "任务说明在 PROMPT.md，产出写在同目录"）发给受测模型

# 3) 审阅 / 查看进度
python sandbox/scripts/review_run.py --model my-model-slug --latest
python sandbox/scripts/review_run.py --run <harness_dir> --transcript session.txt
python sandbox/scripts/status.py --model my-model-slug

# 4) 收卷（verdict 闸门：仅 PASS / PASS_WITH_WARNINGS；孤立主交付归一化为 answer.<ext>）
python sandbox/scripts/collect_run.py --run <harness_dir> --dry-run
python sandbox/scripts/collect_run.py --run <harness_dir>
```

## 目录布局

```
sandbox/
├── AGENTS.md              # agent 协议（唯一入口文档）
├── README.md              # 本说明
├── protocol.json          # 机读协议摘要（2.0）
├── ORCHESTRATOR_PROMPT.md # 编排派发提示词模板
├── dispatch/
│   └── index.html         # 图形化发题客户端（由 dispatch_api.py 提供）
├── scripts/
│   ├── sandbox_lib.py     # 公共库（发现/哈希/快照/泄漏扫描）
│   ├── prepare_run.py     # 组卷：workdir(仓库外) + harness(meta+snapshot)
│   ├── dispatch_api.py    # 发题 API + UI host（stdlib，无依赖）
│   ├── review_run.py      # 审阅：H1–H3 观测 + D 检查 → REVIEW.md + verdict
│   ├── collect_run.py     # 收卷：verdict 闸门 + SHA 校验 + 归一化命名
│   └── status.py          # run 总览（1.x run 标 deprecated）
├── review-lab/            # 离线对照实验室（与流水线解耦，详见其 README）
└── runs/                  # harness 侧簿记（meta/snapshot/REVIEW，受测方不可见）
    └── <model>/<run_id>/

# 受测工作区（仓库外，默认 F:\bench-runs，可用 SANDBOX_RUNS_ROOT 覆盖）
<RUNS_ROOT>/<model>/<run_id>/
    ├── PROMPT.md          # 题面逐字节拷贝
    └── <交付物>           # 模型产出；收卷时孤立主交付 → answer.<ext>
```

## 登记题面（PROMPT_REGISTRY.json，可选）

默认派发 `<project>/PROJECT_PROMPT.md`。若某项目的**正式排名题面**不是它（例如
`L1_Basic/BilibiliUserscript` 的排名轨道是受控回放题 `prompts/REPLAY_V2.md`，
而 `PROJECT_PROMPT.md` 是冻结的历史入口），可在项目根放一个登记文件：

```json
{
  "schemaVersion": 1,
  "dispatchPrompt": "prompts/REPLAY_V2.md",
  "sha256": "<该文件的 sha256；不符即拒绝派发>",
  "inputFiles": ["fixtures/CONTRACT.md"],
  "note": "为什么该项目改发登记题面"
}
```

- `dispatchPrompt` 与 `inputFiles` 都必须落在项目目录内；`sha256` 用于钉住字节，
  题面被改动而登记未同步时，`prepare_run.py` 直接报错而不是悄悄换题。
- `inputFiles` 会随题面一起拷进 workdir（题面声明"可以阅读 CONTRACT.md"时二者必须同发），
  并被记录进 `meta.input_files`；**它们是被给定的输入，不是模型交付物**，
  故 `list_deliverables` 会排除它们，收卷不会把它们当答案。
- 未放登记文件的项目行为完全不变（仍发 `PROJECT_PROMPT.md`）。
- `meta.prompt_source` / `meta.prompt_registered` 记录实际派发了哪一份题面；
  `collect_run.py` 的题面 SHA 闸门也比对**实际派发的那一份**。

## 为什么不再有纪律文本

1.x 用「dir + 七条纪律」隔离：受测输入里约 70% 是治理文本（评测意识注入、
要求摘要=半泄漏 rubric、文件名从历史模型目录投票、result.json 自报诚信）。
2.0 把这些全部移出提示词：

| 1.x 做法 | 2.0 替代 |
|---|---|
| 纪律七条 | 仓库外空目录——无物可读，无需禁止 |
| result.json integrity 自报 | H1 目录位置 / H2 快照 diff / H3 transcript 扫描 |
| TASK.md 要求摘要 | 移到 REVIEW.md，仅审阅可见 |
| expected_deliverable 投票 | 不指定文件名；收卷时归一化 |
| 缺 result.json → INVALID | result.json 完全可选；verdict 只看观测与交付物 |

## 旧 run

`sandbox/runs/` 下 protocol 1.1 的 run 标 `[deprecated]`，审阅/收卷对其拒绝
（退出码 4）。跨协议分数不混排。

## 相关

- 全景题表：根目录 `README.md` / `DOMAIN_INDEX.zh.md`
- Agent 协议：[`sandbox/AGENTS.md`](./AGENTS.md)；机读版 [`sandbox/protocol.json`](./protocol.json)
- 对照实验室：[`sandbox/review-lab/README.md`](./review-lab/README.md)
# PairedVision 可选 profile（2026-09-21）

8 条件视觉测试已接入 prepare/review/collect 与现有 dispatch 项目发现。
执行入口：[一句提示词与操作说明](../Vision/PairedVision/ORCHESTRATOR.zh.md)。
批量组卷：`python sandbox/scripts/vision_suite.py prepare --model <slug>`。
受测目录仅含题面和登记图片；机器侧评分可读锁定金标，审阅 Agent 不获得该权限。
外部 cwd 不等同 OS 隔离，默认 `unverified`；成绩与交付 verdict 分开记录，工程 fixtures 不算模型成绩。

# Legacy Vision 探索 profile（2026-09-23）

`python sandbox/scripts/legacy_vision.py prepare --model <slug> [--tracks Geometry,RealScene]` 组卷旧视觉题（222 题），
`finalize --suite <manifest> --transcripts <dir> [--collect]` 审阅/评分/收卷。只发提示词块与图片，编号不透明；
自由文本评分为启发式，未命中待人工。规则见 [`AGENTS.md`](./AGENTS.md) 第 11 节。

# 冻结 r6 Agent CLI 辅助测试（2026-09-29）

用户要求暂缓人工复审后，使用 `scripts/iteration_cli.py prepare/execute/summarize` 对同一 r6 的 12 条件进行独立 CLI 测试。
具体通道、预算和证据规则见 [测试计划](../Vision/iteration/20260921/cli-review/20260929/PLAN.zh.md)；本轮与无工具 API 主测分列，不能替代人类盲审。
# Godot 续作题输入（2026-10-16）

`native-godot-v1` 新增可选 `prompt_and_locked_archives`：`PROMPT_REGISTRY.json` 登记公开 ZIP，`BENCH_PROFILE.json.locked_inputs` 冻结名称、SHA-256 与字节数，prepare/review/collect 共同校验。候选只接收正式题面和登记输入；解压源码可编辑，输入 ZIP 原样保留。旧 prompt_only 路径不变，OS 隔离仍为 unverified。详见 [GODOT_RUNS.md](GODOT_RUNS.md)。

# Blender 纯文字变体（2026-10-18）

Blender 原生 profile 允许明确登记 `input_payload: prompt_only` 和 `input_files: {}` 的纯文字变体；该条件只发题面，沿用原生验收与收卷，和带图条件分列。首个文字变体为 `NativeWorkflowBench/BlenderMXMaster3STextOnly`。
