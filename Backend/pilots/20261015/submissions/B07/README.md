# 并发转账账本

需要 Node.js 24，无第三方依赖。所有命令 stdout 恰好输出一行 JSON；成功退出 0，业务或运行错误退出 1，参数错误退出 2。金额单位由调用方统一指定，余额为非负安全整数，转账额为正安全整数。

```powershell
node ledger.js --db demo.db init --accounts a:100,b:100,c:100
node ledger.js --db demo.db transfer --id first --from a --to b --amount 30
node ledger.js --db demo.db report --out audit.html
Start-Process audit.html
```

重复 `init` 不重置现有账户，也不添加新账户。请求 ID 是非空字符串，账户 ID 只接受英文字母、数字、下划线。相同请求 ID、相同参数返回首次结果和退出码，包括余额不足、未知账户、收款余额超出安全整数范围的失败；同 ID 不同参数返回冲突，原结果不变。参数无效的请求不落库。

## 多终端演示

在本目录先执行一次（使用新的数据库文件）：

```powershell
node ledger.js --db race.db init --accounts a:100,b:100,c:100
```

然后在两个终端尽量同时执行：

```powershell
# 终端 A
node ledger.js --db race.db transfer --id race-b --from a --to b --amount 80
# 终端 B
node ledger.js --db race.db transfer --id race-c --from a --to c --amount 80
```

两笔中恰有一笔成功，另一笔余额不足；a 剩余 20，总额仍为 300。重新执行这两条命令，得到各自第一次的结果，不会再次扣款。即使后来向 a 补款，失败请求重放仍返回失败；要重新尝试交易必须使用新 ID。修改任一请求的 `--amount` 为 1，保持该 ID，会得到冲突。

每次命令都是独立进程，输出后自动退出。关闭终端、重新打开后执行：

```powershell
node ledger.js --db race.db init --accounts a:999,b:999,c:999
node ledger.js --db race.db report --out race-audit.html
Start-Process race-audit.html
```

余额不会被 init 覆盖，已确认交易仍在，`auditOk` 为 true。若强制终止尚未输出结果的转账进程，可用原 ID、原参数重试以确认提交结果。

## 持久化与审计

SQLite 使用 WAL、`synchronous=FULL` 和 `BEGIN IMMEDIATE`。余额变更、成功流水、幂等响应在同一事务内提交，提交后才输出；业务失败也先持久化响应。遇到 SQLite 锁竞争会等待并重试，不把忙锁当作余额不足。适用于本机多个进程共享同一文件，数据库及其 `-wal`、`-shm` 文件应一起保留，不要手动删除活动数据库的边文件。

报告在一致的读取事务中从持久化数据检查初始总额、逐账户余额重建、历史非负余额、连续序号、请求唯一性、指定格式的 SHA-256 链和成功响应。JSON 账户按 ID 二进制顺序排列，流水按 seq 排列；总额超过安全整数范围时以十进制字符串输出，避免精度损失。HTML 使用默认表格、转义所有输入，不加载外部资源。报告生成成功退出 0，审计结论查看 `auditOk`；检测到数据不一致时仍输出报告并标为 false。

哈希链可发现不一致，但没有外部可信锚点，无法证明拥有数据库写权限的人没有整体重写历史。SQLite 的持久化保证以本地文件系统及存储设备正确执行同步写入为前提。
