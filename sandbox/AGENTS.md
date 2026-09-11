# sandbox/AGENTS.md — 隔离测试与自动审阅 Agent 协议

> 本文件是 `sandbox/` 工作区的**唯一 agent 入口协议**。  
> 编排 agent、审阅 agent、临时工 agent 进入 `sandbox/` 后必须先读本文件。  
> 自动适配：本协议依赖仓库既有文档约定，不硬编码单个题目的业务细节。

---

## 0. 角色与边界

| 角色 | 工作目录 | 可读 | 可写 |
|---|---|---|---|
| **编排 Agent** | 仓库根 / sandbox | 全仓库（题面、README、脚本） | 仅 `sandbox/runs/**`、本协议允许的文档 |
| **受测模型** | 单个 `sandbox/runs/<model>/<run>/` | 仅该 run 内 `TASK.md`、`PROJECT_PROMPT.md` 及自建文件 | 仅该 run 目录 |
| **审阅 Agent** | 单个 run 目录（只读题面+交付物） | 该 run 的 `PROJECT_PROMPT.md`、交付物、`meta.json`、`result.json` | 该 run 的 `REVIEW.md`、`meta.json` |

**审阅 Agent 禁止**（防止口径泄漏与串题）：

- 读取项目 `README.md` 的「自动化验收建议 / 评分标准」（留给隔离的运行时验收会话）
- 读取其他 run、`L*/*/模型名/` 历史输出、`暂存/`、`Vision/`、`.git`
- 修改 `PROJECT_PROMPT.md` 或模型交付物本体

---

## 1. 文档自动适配规则

进入任意具体题目前，按下列顺序**机械发现**上下文，不要假设题目名：

1. **题面**：`<project>/PROJECT_PROMPT.md` — 唯一标准；受测与审阅都以它为准。
2. **项目元数据**：`<project>/README.md` 的「分类元数据 / 输出要求」— **仅编排 Agent** 可读，用于写 run 时的可选备注；不得注入受测 `TASK.md` 的评分细节。
3. **全景索引**：根 `README.md` 表格 / `DOMAIN_INDEX.zh.md` — 仅编排 Agent 用来发现项目路径。
4. **仓库纪律先例**：`Vision/scripts/vision_assemble.py` 中的 DISCIPLINE 块与 `Vision/AUTO_SCORING_PLAN.md` D4/D6 — sandbox 与之同构，改纪律时两处对齐。
5. **落库惯例**：正式树为 `L1_Basic|L2_Intermediate|L3_Advanced|L4_Expert|Image / <Project> / <model-slug>/`，交付物文件名以题面与历史 run 为准（常见 `answer.html`、`log.md`、`result.json`）。

若缺少 `PROJECT_PROMPT.md`：**不要**用 README 或 DOMAIN_INDEX 拼题面；应报错并等待正式题面。

---

## 2. 编排 Agent · 标准流程

```text
prepare_run.py --project <名|路径> --model <slug>
  → 将 run 目录（绝对路径）交给受测会话
  → 受测完成后：
review_run.py --run <run_dir>        # 或 --model <slug> --latest
  → 阅读 REVIEW.md；若 verdict 为 PASS / PASS_WITH_WARNINGS：
collect_run.py --run <run_dir>       # 先 --dry-run
  → 按需 --with-review / --overwrite
```

编排 Agent 在向受测模型开口时，**只**应粘贴或挂载 run 目录；禁止附带：

- 其他模型的 `answer.html` / `log.md` / `result.json`
- 项目 `README.md` 评分细项
- `DOMAIN_INDEX*`、历史分数表

可选：在受测提示词开头加入一行：  
`工作目录是隔离 sandbox run；只读本目录 TASK.md 与 PROJECT_PROMPT.md。详见 TASK.md。`

---

## 3. 受测模型 · 最低契约（嵌入 TASK.md，由 prepare 生成）

1. 只读本 run；禁读仓库其它路径与网络代写。  
2. 按题面交付；HTML 项目默认 `answer.html`。  
3. 写 `result.json`，必须含 `integrity` 三字段（见 prepare 生成的契约模板）。  
4. 不得修改 `PROJECT_PROMPT.md`。  
5. 如实自报；审阅将把 `integrity` 失败直接判 `INVALID`。

---

## 4. 审阅 Agent · 自动审阅流程

当被要求「审阅 / auto-review」某 run 时：

### 4.1 机器层（必做）

```powershell
python sandbox/scripts/review_run.py --run <run_dir>
# 或
python sandbox/scripts/review_run.py --model <slug> --latest
```

脚本产出 `REVIEW.md` 与 `meta.verdict`（`PASS` / `PASS_WITH_WARNINGS` / `FAIL` / `INVALID`）。

### 4.2 智能层（脚本无法覆盖时，可选增强）

在**不读 rubric、不读其他模型**的前提下，审阅 Agent 可：

1. 打开本 run 的 `PROJECT_PROMPT.md` 与主交付 HTML。  
2. 对 `REVIEW.md` 中「题面要求对照」清单逐项勾选 `[x]` / `[ ]`，并把依据写进该项（引用代码行或结构名）。  
3. 若需要运行时验证：在 run 目录内起本地服务或 headless 打开；**仍不得**读取 run 外文件。  
4. 将补充结论**追加**到 `REVIEW.md` 的「智能层补记」一节；**不得**删除脚本生成的检查表。  
5. 若判定需要推翻机器 verdict，在补记中写明，并可将 `meta.verdict` 改为更严值（禁止放宽为 PASS 而无说明）。

### 4.3 禁止事项（再强调）

- 禁止打开 `<project>/README.md` 的验收细项作为打分表（需要时应另开「运行时验收会话」）。  
- 禁止用其他模型实现做 diff 对照。  
- 禁止修改题面或为模型「补做」作业。

---

## 5. 收卷 Agent 规则

1. `collect_run.py` 校验题面 SHA 与正式树一致。  
2. 默认只拷交付物 + `result.json` + `log.md`；`MIGRATION.md` 自动写入。  
3. 已存在同名文件时默认改名 `~1`；仅在明确要求时 `--overwrite`。  
4. 正式树子目录名 = `meta.model`（与历史 slug 风格一致：小写、连字符）。

---

## 6. 失败与作废

| 情形 | 处理 |
|---|---|
| `integrity` 自报窥题 / 外援 | verdict=`INVALID`，不收卷 |
| 题面 SHA 与正式树不一致 | collect 拒绝入库 |
| run 缺交付物 | D0 FAIL；重跑新 run，不复用污染目录 |
| 疑似读了 README 评分细项 | 人工标记；新 run 重测 |

---

## 7. 扩展点

- **运行时验收**（读 README 自动化建议）：保持**另一个** agent 角色与提示词，工作副本可从 run 目录复制到临时目录，**不要**放宽本审阅协议。  
- **更强隔离**：把 `sandbox/runs` 指到仓库外磁盘路径。  
- **多题联考**：循环 `prepare_run`；模型 slug 相同、run_id 不同；仍禁止共享目录。  
- **与 Vision 对齐**：判分/审计继续用 `Vision/scripts/`；sandbox 只负责 L1–L4 / Image 的 HTML·脚本类临时测。

---

## 8. 命令速查

```text
python sandbox/scripts/prepare_run.py --list
python sandbox/scripts/prepare_run.py --project <P> --model <M>
python sandbox/scripts/review_run.py  --model <M> --latest [--strict]
python sandbox/scripts/collect_run.py --run <dir> [--dry-run] [--with-review] [--overwrite]
```

本协议版本变更时，同步更新 `sandbox/README.md` 与 `Vision/AUTO_SCORING_PLAN.md` 中的纪律对齐说明（若有）。
