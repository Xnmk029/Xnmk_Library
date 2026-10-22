# REVIEW.md · 自动审阅报告

- **run_id**: `20261019-202531-USP`
- **model**: `minimax-m3.1-flash-free`
- **project**: `L3_Advanced/USP`
- **protocol**: `2.0` (bare)
- **reviewed_at**: 2026-10-20T02:39:06+0800
- **review_scope**: `project_prompt_only`（仅对照题面，不读 README 评分细则 / 其他模型输出）
- **prompt_sha256**: `3f975197fcda8166e031929bc8d8d0c66895c47c6e0606b2a96c2131bc212d86`
- **verdict**: **PASS**

## 检查表

| ID | Status | Detail |
|---|---|---|
| P1 | **PASS** | 题面载入 829 chars |
| H1 | **PASS** | workdir 在仓库外: F:\bench-runs\minimax-m3.1-flash-free\20261019-202531-USP |
| H2 | **PASS** | 快照 diff 干净：新增 1 个文件，无修改/删除 |
| H3 | **N/A** | 未提供会话 transcript，跳过越权路径扫描 |
| D0 | **PASS** | 交付物: usp-match-lowpoly.html |
| D1 | **PASS** | 存在 HTML 交付 usp-match-lowpoly.html (90625 bytes) |
| D2 | **PASS** | 满足单 HTML 交付形态 |
| D4 | **PASS** | 已扫描 1 个文本交付物，未见占位符红线 |
| D5 | **PASS** | 未见明显路径逃逸字符串 |
| D6 | **PASS** | 未发现外部网格资产引用 |

## 题面要求对照（勾选由审阅 agent / 人工补全）

> 下列条目从题面机械提取，仅对审阅可见；受测方从未见过这份摘要。

- ### 交付要点
- - [ ] 交付单 HTML 文件（Three.js 通过可靠 CDN 引入），双击即可运行。
- - [ ] 所有模型程序化生成，不使用外部 3D 模型文件。
- - [ ] 分解/组装动画完整可循环，无跳变。
- - [ ] 不得包含 TODO 或未完成占位符。
- ### 静态红线
- - [ ] 不得包含 TODO 或未完成占位符（若题面明确要求）
- - [ ] 优先交付单文件 HTML（若题面明确要求）
- - [ ] 不依赖外部 3D/二进制资产（若题面明确要求）

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
