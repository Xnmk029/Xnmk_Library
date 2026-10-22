# 可撤销目录同步与差异报告

实现 Node.js 24 原生命令行目录同步工具，交付 sync.js 和简短 README。同步普通文件内容，不跟随符号链接或 junction，单文件上限 1 MiB；空目录不计入同步真值。源、目标、data 三个目录不得互相包含，只能修改目标和 data。HTML 差异报告使用简单原生表格，输入路径按纯文本转义。

命令：node sync.js --data <目录> plan --source <源目录> --target <目标目录>，输出单个 JSON {id,actions:[{path,type,sha256Before,sha256After}]}，type 为 create/update/remove；相对路径用 / 分隔，actions 按路径排序，没有变化的文件不列入，缺失哈希用 null。计划记录源与目标所有普通文件的路径和 SHA-256，规划不得修改目标，也不能仅凭大小或 mtime 判断变化。

node sync.js --data <目录> apply --plan <id>：先核对源与目标完整指纹仍匹配计划，不匹配退出 1 且不改动任何目标文件；备份旧目标后执行，完整成功输出 {status:"applied"} 并退出 0。重复执行已 applied 计划幂等，不再次破坏文件。apply 不可用于 rolledback 计划。

node sync.js --data <目录> rollback --plan <id>：仅当目标仍匹配应用后结果时恢复执行前目标树，输出 {status:"rolledback"} 并退出 0；外部变动时退出 1，不覆盖新内容。重复 rollback 幂等。

node sync.js --data <目录> report --plan <id> --out <HTML路径>：从持久计划读取并输出 {id,status,actions}，生成显示状态与每项差异的 HTML 表格；报告不得触发同步。各命令 stdout 只输出一个 JSON；业务冲突退出 1，参数错误退出 2。

计划、备份与状态须持久化。执行动作前先保存完整备份并把状态记录为 applying；进程中断后，下一次命令先把 applying 计划恢复为执行前目标内容和 planned 状态，再处理请求。成功输出前必须已完整提交状态。无需全目录中间瞬间原子可见，但成功响应及重启后的目标不能是半份结果。演示仅使用本地临时夹具文件。
