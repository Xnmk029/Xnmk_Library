# REVIEW.md · 自动审阅报告

- **run_id**: `20261016-013453-QinBearSVG`
- **model**: `nvidia-nemotron-3.5-super-vl-free`
- **project**: `L1_Basic/QinBearSVG`
- **protocol**: `2.0` (bare)
- **reviewed_at**: 2026-10-16T04:38:01+0800
- **review_scope**: `project_prompt_only`（仅对照题面，不读 README 评分细则 / 其他模型输出）
- **prompt_sha256**: `8eb163cf71fffd2c2a7e275e5bfb353bda29250783f981ce42bc222cafc47253`
- **verdict**: **PASS**

## 检查表

| ID | Status | Detail |
|---|---|---|
| P1 | **PASS** | 题面载入 23 chars |
| H1 | **PASS** | workdir 在仓库外: F:\bench-runs\nvidia-nemotron-3.5-super-vl-free\20261016-013453-QinBearSVG |
| H2 | **PASS** | 快照 diff 干净：新增 1 个文件，无修改/删除 |
| H3 | **PASS** | transcript (37031 chars) 未见仓库路径痕迹 |
| D0 | **PASS** | 交付物: output.svg |
| D1 | **PASS** | 存在 SVG 交付 output.svg (6577 bytes) |
| S1 | **PASS** | SVG 含根节点与矢量图元 |
| S2 | **PASS** | 未发现外链/base64 冒充主体 |
| D4 | **PASS** | 已扫描 1 个文本交付物，未见占位符红线 |
| D5 | **PASS** | 未见明显路径逃逸字符串 |
| D6 | **N/A** | 题面未声明外部 3D 禁令或无 HTML |

## 题面要求对照（勾选由审阅 agent / 人工补全）

> 下列条目从题面机械提取，仅对审阅可见；受测方从未见过这份摘要。

- （无）

## 智能层补记

> 审阅 Agent 追加：逐项勾选、引用依据、运行时观察、是否推翻机器 verdict。禁止粘贴其他模型实现。

（待补记）

## 结论说明

- `PASS`：静态检查与观测完整性通过。
- `FAIL`：交付物红线（缺失、占位符、SVG 无效等）。
- `INVALID`：观测到的完整性违规（H1 隔离失效 / H2 快照污染 / H3 越权读题）——作废不收卷。
- `WARN`：需人工复核，不自动否决。
- 本报告**不**替代 README「自动化验收建议」中的运行时/视觉验收。

---
*由 sandbox/scripts/review_run.py 生成（protocol 2.0）。*
