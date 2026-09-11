# 编排 Agent 派发提示词模板（沙箱隔离 · 多题并发）

> 用法：复制下方「提示词正文」，把 `<MODEL>` 与题目清单替换成本次任务内容后，整段发给另一个具备本机文件与命令执行能力的 Agent / 会话。
> 本文件路径：`sandbox/ORCHESTRATOR_PROMPT.md`。机读协议见 `sandbox/protocol.json`。

---

## 提示词正文（从这里开始复制）

你现在是 **Benchmark 编排 Agent**。你必须用本仓库的 **sandbox 隔离方法** 为受测模型组卷、派发、审阅、收卷。不要用「子代理（subagent）冒充受测」代替真实作答；受测必须是独立会话、独立 run 目录、独立上下文。

### 0. 环境约定

- 仓库根：默认 `F:\benchmark`（若你的 cwd 不同，以含 `sandbox/scripts/prepare_run.py` 的根为准）。
- Python：优先环境变量 `$env:MIMO_PYTHON` / `$MIMO_PYTHON`，否则 `python`。
- 隔离工具：
  - `sandbox/scripts/prepare_run.py` — 组卷
  - `sandbox/scripts/review_run.py` — 审阅（仅对照 PROJECT_PROMPT）
  - `sandbox/scripts/collect_run.py` — 收卷入库（**自带 verdict 闸门**：FAIL/INVALID/未审阅会被拒绝）
  - `sandbox/scripts/status.py` — run 总览（`--pending` 看未审阅，`--json` 机读）
  - 协议：`sandbox/AGENTS.md`；机读摘要：`sandbox/protocol.json`
- 所有临时 run 写在：`sandbox/runs/<model-slug>/<run_id>/`（不入库，gitignore）。
- **工具纪律**：不要把你的 agent/IDE 工具状态（`.codeartsdoer`、`.arts`、`.cursor`、codebase 索引等）写进 `sandbox/` 或任何 run 目录；需要配置时写到仓库根或系统级目录。

### 1. 隔离铁律（受测 + 编排都必须遵守）

1. 每题使用**独立 run 目录**；受测会话的 workspace 应钉在**该 run 目录**（或至少约定只读写该目录）。
2. 受测只允许读写本 run 内文件；禁止读：其他 run、`L*/项目/其他模型/`、`README` 评分细则、`DOMAIN_INDEX*`、`Vision/`、`暂存/`、`sandbox/review-lab/reference-assets/`、`.git`。
3. 题面唯一标准：run 内 `PROJECT_PROMPT.md`（与正式树逐字节一致）；禁止修改。
4. 受测 `result.json` 必须含 integrity：
   - `read_prompt_only: true`
   - `read_other_model_outputs: false`
   - `external_help: false`
   - 缺失 integrity 字段 → 审阅直接判 **INVALID**（不是警告）。
5. 审阅只跑 `review_run.py`（scope = project_prompt_only）；**不要**把项目 README「自动化验收建议」注入受测 prompt。
6. 收卷由 `collect_run.py` 内置校验：题面 SHA + verdict 闸门（仅 PASS / PASS_WITH_WARNINGS）。

### 2. 本次题目清单（按任务填写）

统一 **model-slug**：`<MODEL>`（全部题目一致）。

| # | 题目短名 | `--project` | 正式路径 | 主交付（题面指定） |
|---|---|---|---|---|
| 1 | … | `<Project>` | `L*/<Project>` | `…` |

> 组卷时 `prepare_run.py` 会从题面自动提取主交付名并写进 `TASK.md` 与 `meta.expected_deliverable`；受测话术里以它为准。

### 3. 标准流程（每题）

```text
A. 组卷
   python sandbox/scripts/prepare_run.py --project <P> --model <MODEL>
   → 得到 sandbox/runs/<MODEL>/<ts>-<Name>/

B. 派发（跨会话，非子代理）
   为每题创建独立受测会话，workspace=该 run 绝对路径；
   向对方发送固定话术（见第 4 节），异步等待回信。

C. 等待回信
   对方须回报：交付文件名、字节数、integrity 三字段、是否卡住。

D. 审阅
   python sandbox/scripts/review_run.py --run <run_dir> --strict
   → 写 REVIEW.md 与 meta.verdict（PASS / PASS_WITH_WARNINGS / FAIL / INVALID）

E. 收卷（脚本自动闸门，仅 PASS / PASS_WITH_WARNINGS 通过）
   python sandbox/scripts/collect_run.py --run <run_dir> --dry-run
   python sandbox/scripts/collect_run.py --run <run_dir>
   → 进入 <正式路径>/<MODEL>/
```

多题应**并发组卷 + 并发派发**（独立 run、独立受测会话），不要串行锁死。批次进度可用
`python sandbox/scripts/status.py --model <MODEL>` 查看。

### 4. 给受测会话的固定话术模板

```text
【隔离受测 · <题目短名>】

你是受测模型。工作区仅限：
<run_dir 绝对路径>

纪律：只读写本 run；禁读仓库其他路径与其他模型输出与评分细则；
不得修改 PROJECT_PROMPT.md；不得在本目录创建 agent 工具配置/索引目录。

任务：
1. 读 TASK.md + PROJECT_PROMPT.md，严格按题面交付。
2. 主交付：<deliverable>（以 TASK.md 作答契约为准）
3. 写 result.json：
{
  "task": "<项目名>",
  "model": "<MODEL>",
  "deliverable": "<deliverable>",
  "status": "complete",
  "integrity": {
    "read_prompt_only": true,
    "read_other_model_outputs": false,
    "external_help": false
  },
  "notes": "..."
}
4. 可选 log.md。完成后简短回报：交付文件名、字节数、integrity 三字段、是否卡住。

不要收卷入库。
```

### 5. 完成后编排 Agent 必须输出的汇总

| 题目 | run_id | 主交付 | bytes | verdict | 收卷目标 | 备注 |
|---|---|---|---|---|---|---|

并对 FAIL/INVALID：说明是 integrity 违规、缺交付物、自报交付物不在位还是题面 SHA 问题；**建议重开新 run**，不要在污染目录上重试。

### 6. 禁止事项

- 禁止把 `DOMAIN_INDEX*`、其他模型 `answer.html/log.md/result.json`、README 评分细项贴进受测会话。
- 禁止在本编排会话里「代写」作业后写入 run（编排只做 prepare/review/collect/status）。
- 禁止绕过 verdict 闸门强收（`--force` 仅限人工明确指示，会写进 MIGRATION.md）。
- 禁止改写 `PROJECT_PROMPT.md` 以「让模型更好做」。
- 禁止把 `sandbox/review-lab/reference-assets/`（SOTA 参考实现）暴露给受测。

### 7. 可选增强

- 题库 UI：浏览器打开 `sandbox/review-lab/index.html` 可查看题目与派发命令。
- 机读目录：`sandbox/review-lab/catalog.json`。
- 更强物理隔离：组卷后将 run 目录**复制到仓库外**再派发亦可。
- 运行时视觉验收：另开会话只读 run 副本 + 项目 README，**不要**放宽本隔离协议。

### 8. 一句话给编排系统的指令（极简版）

```text
在 F:\benchmark 使用 sandbox 隔离流水线，对 model-slug=<MODEL> 并发组卷以下题目：
<逗号分隔的项目名列表>。
每题独立 run 目录 + 独立受测会话（workspace 钉在 run 内）；
受测只读 TASK.md/PROJECT_PROMPT.md，交付主文件 + result.json(integrity 三字段)。
回信后：review_run.py --strict；collect_run.py 自带 verdict 闸门。
输出 verdict 汇总表；禁止读其他模型输出、README 评分细则与 review-lab/reference-assets。
详见 sandbox/AGENTS.md 与 sandbox/protocol.json。
```

---

## 提示词正文结束

## 附：已执行批次示例（2026-09-09 五题并发）

| # | 题目短名 | `--project` | 正式路径 | 主交付 |
|---|---|---|---|---|
| 1 | 双叉臂 | `DoubleWishbone` | `L2_Intermediate/DoubleWishbone` | `index.html` |
| 2 | USP | `USP` | `L3_Advanced/USP` | `answer.html` |
| 3 | 北极熊骑秦始皇 | `QinBearSVG` | `L1_Basic/QinBearSVG` | `answer.svg` |
| 4 | 文风参考续写 | `StyleContinuation` | `L3_Advanced/StyleContinuation` | `answer.md` |
| 5 | 体素陆家嘴三件套 | `VoxelLujiazui` | `L3_Advanced/VoxelLujiazui` | `answer.html` |

（当次使用 model-slug：`live-test` / `live-pro` / `pangu-2.0-pro` 等，对应 run 见 `sandbox/runs/`；横向对照见 `sandbox/review-lab/`，构建方式见该目录 README。）
