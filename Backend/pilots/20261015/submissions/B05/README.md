# 订单事件回放器

需要 Node.js 24，无第三方依赖。在本目录执行：

```powershell
node replay.js --input demo-gap.jsonl --out demo-gap.html
node replay.js --input demo-complete.jsonl --out demo-complete.html
node --test replay.test.js
```

每次读取整个批次，生成指定 HTML 和同名 `.json` 文件；stdout 仅一行 summary JSON。输出目录须已存在。合法批次退出 0（含业务拒绝和版本缺口）；结构错误、冲突或运行错误退出 2，错误说明写入 stderr。结构错误和冲突在写出前发现，已有 HTML/JSON 保持不变。文件先在目标目录暂存再逐个替换；两个文件的替换不构成跨文件事务。

输入为 UTF-8 JSONL，最大 1 MiB、10,000 个物理行（空行计入上限但忽略内容，末尾换行不额外计一行），支持 CRLF。字段严格遵循 PROMPT.md；ID 始终作为字符串保留。相同 eventId 的字段顺序无关重复仅计一次，重复出现次数计入 duplicates；内容变化或同订单同版本的不同 eventId 拒绝整个批次。

按订单 ID 的 Unicode 码点顺序、版本升序回放。拒绝的事件仍消费版本；首个缺口及其后事件均等待补齐。补齐时应提供完整历史重新执行，不读取上次报告。HTML 使用原生表格和内联样式，输入文本转义，无脚本或外部资源。

金额单位为分。单笔金额必须为正安全整数；汇总内部使用 BigInt，并输出精确的 JSON 整数文本。若汇总超过安全整数范围，下游应使用支持大整数的 JSON 解析器，普通 JavaScript JSON.parse 会损失精度。

## 演示对比

| 观察项 | demo-gap | demo-complete |
| --- | --- | --- |
| 订单 `900719925474099312345` | ABSENT，amount=0，lastVersion=0 | PAID，amount=1299，lastVersion=2 |
| `pay-A` 回执 | PENDING_GAP | APPLIED |
| `cancelled-order` | CANCELLED，lastVersion=3 | CANCELLED，lastVersion=3 |
| 取消后再次支付 `pay-B` | REJECTED_TRANSITION | REJECTED_TRANSITION |
| applied / rejected / pending / duplicates | 2 / 1 / 1 / 1 | 4 / 1 / 0 / 1 |
| paidAmount / refundedAmount | 0 / 0 | 1299 / 0 |

两个演示都包含字段顺序不同的 `pay-A` 重复事件。第二个批次补入 CREATE，完整重放后原先等待的 PAY 生效。生成的 HTML 可直接用浏览器打开查看，JSON 仅含 orders、receipts、summary。

测试覆盖全部状态、版本消费、后续缺口、字段校验、两类冲突、乱序一致性、Unicode 排序、长数字形 ID、UTF-8 与容量边界、精确金额汇总、HTML 转义及错误时已有产物不变。
