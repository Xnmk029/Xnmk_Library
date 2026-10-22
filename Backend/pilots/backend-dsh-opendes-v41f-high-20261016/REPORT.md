# DSH / OpenDesign / DeepSeek V4.1 Flash / high 实测

按用户修正，L1–L3 600 秒、L4 1800 秒仅为计分阈值；超过阈值持续运行，不自动终止，也不因超时直接判功能失败。并发 2，每题独立会话。原硬截止中断的 B01/B03 尝试原会话恢复时遇到 DSH 自身格式错误（未进入模型调用），已保留全部中断/错误证据，并安排全新独立会话重测；表中使用各题最新试次，旧记录不混入新成绩。

时间扣分（百分制）：min(10, 10 × max(0, 累计生成秒数 / 阈值 − 1))，即每超出阈值 10% 扣 1 分，最多扣 10 分。功能验收分与时间扣分分列；完整验收后计算 max(0, 功能分 − 时间扣分)。BLOCKED 或验收覆盖不完整时不计算总分。生成时间累计各运行段，不计人工中断间隔、排队和独立验收时间；运行中扣分为暂计。

| 题号 | 题目 | 生成状态 | 累计生成用时 | 独立验收 | 时间扣分 | 扣时后分数 | 静态审阅 |
|---|---|---|---:|---|---:|---:|---|
| B01 | BilibiliUserscript | completed | 3733.7s | 26/26 PASS | 10.0 | 90.0 | PASS_WITH_WARNINGS |
| B02 | HttpHealthProbe | completed | 787.0s | 6/6 PASS | 3.116 | 96.884 | PASS |
| B03 | DuplicateFileInspector | completed | 741.8s | 6/6 PASS | 2.362 | 97.638 | PASS_WITH_WARNINGS |
| B04 | LocalShortLinks | completed | 473.1s | 7/7 PASS | 0.0 | 100.0 | PASS_WITH_WARNINGS |
| B05 | OrderEventReplay | completed | 656.6s | 7/7 PASS | 0.943 | — | INVALID |
| B06 | ResilientGateway | completed | 1258.2s | 8/8 PASS | 10.0 | 90.0 | PASS_WITH_WARNINGS |
| B07 | RaftTxnWorkbench | completed | 12658.2s | 18/19 PASS；4/10 PASS，5 BLOCKED | 10.0 | — | INVALID |
| B08 | DurableCollab | completed | 5783.2s | 15/15 PASS；13/13 PASS | 10.0 | — | INVALID |

配置证据见 [CONFIG.json](CONFIG.json)，机读记录和证据路径见 [RESULTS.json](RESULTS.json)。每题原始日志、provider response model、usage、输入完整性与代码快照均单独保存。

静态审阅通过不代表功能通过；BLOCKED 表示前置能力不满足，未作为独立通过或失败。外部工作目录不证明操作系统访问隔离，isolation 保持 unverified。初始硬截止报告冻结在 REPORT.initial-hard-stop.md；各题初始日志、评分及审阅保存在 attempts/initial-hard-cutoff，初始源码归档不覆盖。续跑不是无中断完成时间，不能直接混入无中断排名。不因单次超时自动替换题目。

- B07：candidate browser demonstration: Error: No candidate HTML demonstration/report found
    at file:///F:/benchmark/Backend/tools/expert-evaluate.mjs:89:661
    at check (file:///F:/benchmark/Backend/tools/expert-evaluate.mjs:28:109)
    at raft (file:///F:/benchmark/Backend/tools/expe；R2-linearizable-member-view: AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

504 !== 200

    at configuration (file:///F:/benchmark/Backend/tools/expert-v2-evaluate.mjs:24:83)
    at process.processTicksAndRejections (node:internal/process/task_queues:104
