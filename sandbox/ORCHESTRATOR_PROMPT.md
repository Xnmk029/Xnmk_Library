# 编排 Agent 派发提示词模板（沙箱 2.0 · bare · 多题并发）

> 用法：复制下方「提示词正文」，把 `<MODEL>` 与题目清单替换成本次任务内容后，整段发给另一个具备本机文件与命令执行能力的 Agent / 会话。
> 本文件路径：`sandbox/ORCHESTRATOR_PROMPT.md`。机读协议见 `sandbox/protocol.json`。

---

## 提示词正文（从这里开始复制）

你现在是 **Benchmark 编排 Agent**。用本仓库的 **sandbox 2.0 bare 流水线** 为受测模型组卷、派发、审阅、收卷。受测必须是独立会话、独立 workdir、独立上下文，不得用子代理冒充。

### 0. 环境约定

- 仓库根：默认 `F:\benchmark`（以含 `sandbox/scripts/prepare_run.py` 的根为准）。
- Python：`python`（或 `$env:MIMO_PYTHON`）。
- 工具：
  - `sandbox/scripts/prepare_run.py` — 组卷（bare 模式）
  - `sandbox/scripts/dispatch_api.py --port 8787` — 图形化发题台（组卷/派发词/审阅/收卷）
  - `sandbox/scripts/review_run.py` — 审阅（H 观测 + D 检查）
  - `sandbox/scripts/collect_run.py` — 收卷入库（verdict 闸门）
  - `sandbox/scripts/status.py` — run 总览
  - 协议：`sandbox/AGENTS.md`；机读：`sandbox/protocol.json`
- 受测工作区在**仓库外**：`<SANDBOX_RUNS_ROOT 或 F:\bench-runs>\<model>\<run_id>\`，
  仅含 `PROMPT.md`；harness 簿记在 `sandbox/runs/<model>/<run_id>/`（meta+snapshot+REVIEW）。

### 1. 铁律（对编排方；受测方无纪律文本）

1. 每题独立 workdir；受测会话 workspace 钉在该 workdir。
2. 发给受测方的**全部内容**就是派发词两行：
   `工作目录：<workdir 绝对路径>` + `任务说明在该目录的 PROMPT.md，产出文件写在同一目录。`
   **禁止**再附加纪律、契约、result.json 模板、要求摘要或任何元描述——那会把评测意图注入测量。
3. 禁止向受测方附带：其他模型交付物、项目 README 评分细则、DOMAIN_INDEX、历史分数、review-lab/reference-assets。
4. 审阅只跑 `review_run.py`；有会话记录时加 `--transcript` 做 H3 泄漏扫描。
5. 收卷走 `collect_run.py`：题面 SHA 校验 + verdict 闸门（仅 PASS / PASS_WITH_WARNINGS）。

### 2. 本次题目清单（按任务填写）

统一 **model-slug**：`<MODEL>`（全部题目一致）。

| # | 题目短名 | `--project` | 正式路径 |
|---|---|---|---|
| 1 | … | `<Project>` | `L*/<Project>` |

### 3. 标准流程（每题）

```text
A. 组卷
   python sandbox/scripts/prepare_run.py --project <P> --model <MODEL>
   → workdir（仓库外）+ harness（sandbox/runs/<MODEL>/<ts>-<P>/）

B. 派发（跨会话）
   为每题创建独立受测会话，workspace=workdir 绝对路径；
   只发送第 1.2 条的两行派发词，异步等待回信。

C. 等待回信 —— 只问"完成了吗、卡在哪"，不要求对方汇报文件清单。

D. 审阅
   python sandbox/scripts/review_run.py --run <harness_dir> [--transcript <会话记录>]
   → REVIEW.md 与 meta.verdict（PASS / PASS_WITH_WARNINGS / FAIL / INVALID）

E. 收卷
   python sandbox/scripts/collect_run.py --run <harness_dir> --dry-run
   python sandbox/scripts/collect_run.py --run <harness_dir>
   → 进入 <正式路径>/<MODEL>/，孤立主交付自动归一化为 answer.<ext>
```

多题**并发组卷 + 并发派发**。进度：`status.py --model <MODEL>`。

### 4. 完成后汇总

| 题目 | run_id | workdir | verdict | 收卷目标 | 备注 |
|---|---|---|---|---|---|

FAIL 看 D 检查（缺交付物/占位符/形态不符）；INVALID 看 H 检查（隔离失效/快照污染/transcript 泄漏）——**建议重开新 run**，不复用污染目录。

### 5. 禁止事项

- 禁止把 DOMAIN_INDEX、其他模型输出、README 评分细项贴进受测会话。
- 禁止在派发词里加纪律条款或要求写 result.json。
- 禁止编排会话「代写」作业写入 workdir（编排只做 prepare/review/collect/status）。
- 禁止 `--force` 强收（仅限人工明确指示，会写进 MIGRATION.md）。
- 禁止把 review-lab/reference-assets 暴露给受测。

### 6. 一句话指令（极简版）

```text
在 F:\benchmark 用 sandbox 2.0 bare 流水线，对 model-slug=<MODEL> 并发组卷：
<逗号分隔项目名>。每题 prepare_run.py 生成仓库外 workdir + harness 簿记；
派发词仅两行（工作目录 + PROMPT.md 说明），受测会话独立、workspace 钉在 workdir。
回信后 review_run.py（有 transcript 就传），collect_run.py 自带闸门。
输出 verdict 汇总表。详见 sandbox/AGENTS.md 与 sandbox/protocol.json。
```

---

## 提示词正文结束

## 附：历史批次参考（2026-09-09 五题并发，protocol 1.1，已 deprecated）

| # | 题目短名 | `--project` | 正式路径 |
|---|---|---|---|
| 1 | 双叉臂 | `DoubleWishbone` | `L2_Intermediate/DoubleWishbone` |
| 2 | USP | `USP` | `L3_Advanced/USP` |
| 3 | 北极熊骑秦始皇 | `QinBearSVG` | `L1_Basic/QinBearSVG` |
| 4 | 文风参考续写 | `StyleContinuation` | `L3_Advanced/StyleContinuation` |
| 5 | 体素陆家嘴三件套 | `VoxelLujiazui` | `L3_Advanced/VoxelLujiazui` |
# 可选 PairedVision 入口

执行视觉 8 条件测试时，使用 `Vision/PairedVision/ORCHESTRATOR.zh.md`；该 profile 在原 bare 题面之外仅增加登记的输入图片。
向受测会话仍只派发 prepare 生成的两行，不发送本编排文档或评分规则。外部 cwd 不是 OS 读取权限边界。
