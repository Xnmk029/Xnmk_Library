# 并发转账账本与审计报告

实现 Node.js 24 原生命令行转账账本，使用 node:sqlite 持久化。对多个进程同时提交的转账，保证余额不为负、总额守恒、请求幂等，输出可直接打开的 HTML 审计报告。只交付 ledger.js 和简短 README；报告由命令运行生成，使用默认表格样式即可。

命令格式：node ledger.js --db <文件> init --accounts a:100,b:100,c:100；node ledger.js --db <文件> transfer --id <requestId> --from a --to b --amount 30；node ledger.js --db <文件> report --out <HTML文件>。所有命令 stdout 只输出一个 JSON。init 首次创建账户，重复 init 不重置已有库，成功退出 0。

账户 ID 限字母/数字/下划线；余额与 amount 都是安全整数，amount 必须为正，不能向自己转账。transfer 成功退出 0，输出 {ok:true,seq,requestId,from,to,amount}；余额不足、未知账户或同 requestId 不同参数退出 1，输出 {ok:false,error}；参数错误退出 2。相同 requestId 和相同参数重试必须返回第一次的结果与退出码，包含余额不足的失败结果。不同参数冲突不能改余额。同一 requestId 最多一笔成功账本记录。

转账的账户更新、成功账本行和幂等响应须在同一 SQLite 事务提交，响应成功前持久化。多个独立进程共用一个数据库时也要遵守；正常竞争需等待锁，不能随意把数据库忙算作业务失败。进程强制结束再启动，已确认转账仍在。

成功账本行 {seq,requestId,from,to,amount,prevHash,hash}，seq 从 1 连续递增；第一行 prevHash 为 64 个 0，其余是前一行 hash；hash=SHA256(prevHash+"\n"+JSON.stringify({seq,requestId,from,to,amount}))，JSON 字段按所示顺序，UTF-8 编码。失败转账不进入成功账本。

report 输出 {accounts:[{id,balance}],total,ledger:[账本行],auditOk}，账户按 ID 排序，账本按 seq 排序；必须从真实持久化数据计算余额守恒与审计链一致性。HTML 表格显示账户余额、总额、每笔转账与审计结果，输入文本要转义，不加载外部资源。演示用多个终端同时争抢同一账户余额、重放请求、重新启动并生成报告。
