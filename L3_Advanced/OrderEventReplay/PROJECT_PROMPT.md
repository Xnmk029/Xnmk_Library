# 乱序订单事件回放与对账报告

实现 Node.js 24 原生命令行订单事件回放器，交付 replay.js 和简短 README。输入最多 10,000 行、1 MiB 的 UTF-8 JSONL；空行忽略。全部按完整批次重放，输出确定性的订单状态、逐事件回执和 HTML 对账报告，使用简单原生表格。

命令 node replay.js --input <JSONL文件> --out <HTML文件>。JSON 产物与 HTML 同路径但扩展名为 .json，且只包含 {orders,receipts,summary}；stdout 只输出 summary JSON。合法批次退出 0，即使存在业务拒绝或版本缺口；输入结构错误或事件冲突退出 2，并保持已有 HTML/JSON 产物不变。

每条事件为 {eventId,orderId,version,type,payload}：ID 为非空字符串，必须完整保留超出安全整数范围的数字形字符串；version 为正的安全整数；type 仅 CREATE/PAY/CANCEL/REFUND。CREATE 的 payload 为 {amount}，amount 是正的安全整数，单位为分；其他类型的 payload 必须为 {}。不接受额外字段。结构化字段相同的同 eventId 重复只保留一条，summary.duplicates 增加；同 eventId 不同内容或同 (orderId,version) 对应不同 eventId 是批次冲突，退出 2。对象字段的输入顺序不影响重复判断。

按 orderId 的 Unicode 码点字典序分组，组内按 version 升序；每个订单从 version 1 开始消费。遇到缺口后，该事件及该订单后续事件都记 PENDING_GAP，不应用。补齐缺口后重新完整重放，后续事件可正常生效。

状态初始 ABSENT、amount=0、lastVersion=0。CREATE 仅在 version=1 且 ABSENT 时成功，进入 PENDING 并设置 amount；PAY 仅 PENDING→PAID；CANCEL 仅 PENDING→CANCELLED；REFUND 仅 PAID→REFUNDED。合法转移记 APPLIED。错误状态上的合法类型记 REJECTED_TRANSITION，状态和金额保持，但该 version 仍被消费，lastVersion 前进。缺口事件不推进 lastVersion。

orders 为 [{orderId,status,amount,lastVersion}]，包含所有订单（包括 ABSENT）；receipts 为每条唯一事件的 [{eventId,orderId,version,result}]，按 orderId、version 排序。summary 为 {orders,statusCounts,paidAmount,refundedAmount,applied,rejected,pending,duplicates}：orders 为订单数；statusCounts 包含五种状态的计数；paidAmount/refundedAmount 分别是当前 PAID/REFUNDED 订单金额之和；applied/rejected/pending 为回执分类数。相同事件集合的任意输入乱序须生成语义相同的 JSON，不加入时间戳或其他字段。

HTML 分别用表格显示订单状态和事件回执，清楚显示拒绝和缺口；所有输入文本按纯文本处理，不加载外部资源。演示先回放缺 CREATE 的 PAY，再补 CREATE 重放，对比状态；同时演示重复事件、已取消订单再次支付被拒绝。
