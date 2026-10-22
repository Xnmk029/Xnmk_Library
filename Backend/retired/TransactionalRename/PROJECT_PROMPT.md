# 事务化批量重命名与撤销

实现 Node.js 24 原生命令行批量重命名工具，交付 rename.js 和简短 README。只处理 root 根层普通文件，每个文件不超过 1 MiB；不处理子目录，不跟随链接；data 位于 root 外且两目录互不包含。同一 data 按单作业运行。报告用默认 HTML 表格显示旧名称、新名称和状态。

node rename.js --root <目录> --data <目录> plan --map <JSON路径>，JSON 为 [{from:"a.txt",to:"b.txt"},...]。from/to 为不含 / 或 \ 的普通文件名，不得为 . 或 ..，且二者不同；from 各不重复，to 各不重复。来源必须存在；已有目标仅当也属于本批来源时允许，因此必须支持 a→b、b→a 的交换。其他名称冲突退出 1，参数错误退出 2，不改文件。成功输出 {id,actions:[{from,to,sha256}]}，actions 按 from 排序；记录原内容 SHA-256，规划不得改 root 文件。

node rename.js --root <目录> --data <目录> apply --plan <id>：先核对所有相关来源内容和目标存在状态仍与计划一致，不一致退出 1 且不执行任何动作；通过暂存或等价方法支持交换与循环，不能覆盖丢失文件。完成后输出 {status:"applied"}、退出 0；重复 apply 同计划幂等。

node rename.js --root <目录> --data <目录> undo --plan <id>：仅当相关文件仍匹配执行后状态时还原旧文件名和内容，成功输出 {status:"undone"}；外部改动则退出 1 并保留外部内容。重复 undo 幂等，undone 计划不可重新 apply。与计划无关的 root 文件必须保持不变。

node rename.js --root <目录> --data <目录> report --plan <id> --out <HTML路径>：输出 {id,status,actions} 并生成表格报告，路径按纯文本转义。所有命令 stdout 为单个 JSON。

变更前先把原内容备份到 data，并持久记录 applying；进程中断后，下一命令先恢复相关旧文件与 planned 状态，再处理请求。成功响应前提交完整状态，不能留下暂存文件。仅考文件名和字节内容，不要求保留文件时间与 ACL。演示使用本地临时夹具。
