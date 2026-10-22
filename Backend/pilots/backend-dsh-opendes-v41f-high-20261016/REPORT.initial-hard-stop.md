# DSH / OpenDesign / DeepSeek V4.1 Flash / high 实测

本轮使用当前 8 道有效题面（含 L4 v2），每题独立新会话，并发 2。L1–L3 600 秒、L4 1800 秒硬预算。超时记录是截止时长，不能称为完成时间。独立验收不计入生成时间。

| 题号 | 题目 | 生成状态 | 生成用时 | 独立验收 | 静态审阅 |
|---|---|---|---:|---|---|
| B01 | BilibiliUserscript | timeout | 600.9s | 0/1 PASS | FAIL |
| B02 | HttpHealthProbe | pending | — | 待验收 | — |
| B03 | DuplicateFileInspector | timeout | 600.9s | 6/6 PASS | PASS_WITH_WARNINGS |
| B04 | LocalShortLinks | pending | — | 待验收 | — |
| B05 | OrderEventReplay | pending | — | 待验收 | — |
| B06 | ResilientGateway | pending | — | 待验收 | — |
| B07 | RaftTxnWorkbench | pending | — | 待验收 | — |
| B08 | DurableCollab | pending | — | 待验收 | — |

配置证据见 [CONFIG.json](CONFIG.json)，机读记录和证据路径见 [RESULTS.json](RESULTS.json)。每题原始日志、provider response model、usage、输入完整性与代码快照均单独保存。

静态审阅通过不代表功能通过；BLOCKED 表示前置能力不满足，未作为独立通过或失败。外部工作目录不证明操作系统访问隔离，isolation 保持 unverified。本轮不覆盖先前模型成绩，也不根据单次时长自动替换题目。

- B01：candidate: AssertionError [ERR_ASSERTION]: No .user.js delivered
    at file:///F:/benchmark/Backend/tools/evaluate.mjs:42:32
    at check (file:///F:/benchmark/Backend/tools/evaluate.mjs:33:53)
    at runOne (file:///F:/benchmark/Backend/tools/evaluate.mjs:42:
