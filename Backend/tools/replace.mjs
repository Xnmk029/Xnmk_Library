import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const bankPath=path.join(root,'Backend/BANK.json');
const bank=JSON.parse(fs.readFileSync(bankPath,'utf8'));
const common=`只使用 Node.js 24 原生模块，无第三方依赖。交付 server.js、原生网页和简短 README。启动 node server.js --port <端口> --data <数据目录>，只监听 127.0.0.1；GET /health 返回 {"ok":true}，GET / 提供操作界面。界面只需实用的表单、列表和状态，用户数据按纯文本展示。所有展示来自真实 API。错误返回非 2xx 与 {"error":"原因"}。数据目录不存在则创建，重启时复用；不能以浏览器缓存代替服务端状态。无需账号、外部服务或依赖安装。`;
const replacements={
B02:{name:'LogInspector',title:'JSONL 日志筛选台',body:`实现小型日志筛选工具：在页面粘贴或选择 UTF-8 JSONL 日志，点击分析，展示级别统计、坏行、筛选后记录和原始行号。允许一次处理到内存，输入上限 2 MiB；不要求独立 CLI、超大文件或流式索引。

POST /api/analyze 接收原始 UTF-8 请求体，响应 {total,invalid,counts,records,errors}。每行字段 timestamp（带时区 RFC3339）、level（DEBUG/INFO/WARN/ERROR）、service、message（字符串），request_id 可选字符串。空行忽略；坏 JSON、非法字段或时间记录在 errors:[{line,reason}]，不影响其他行；行号从 1 开始。total/invalid/counts 为筛选前计数，counts 包含四种级别；records:[{line,timestamp,level,service,message,request_id}] 按 UTC 时间排序，同毫秒按原行号排序；缺 request_id 用 null，重复日志保留。

可选查询参数 level、request_id、from、to 取交集；时间范围左闭右开。不要求支持毫秒以下的排序精度。筛选后仍保留原行号。网页可筛选和导出当前 JSON 结果。`},
B03:{name:'DuplicateFileInspector',title:'目录重复文件检测器',body:`实现只读重复文件检测器，额外参数 --root <工作目录>。网页可启动扫描、查看进度、展开重复文件分组和查看上次结果；不做删除、移动或自动清理。只扫描根目录内普通文件，不跟随符号链接和 junction。

POST /api/scan 启动扫描并等待完成，返回 {groups:[{sha256,size,paths}],scanned,skipped}；paths 是相对根目录路径数组，按字符串字典序排序，groups 按首个路径排序；只有字节完全相同且至少两份的文件才归为一组。scanned 为成功读取的文件数，skipped 为无法读取或超限的文件数，单文件上限 8 MiB。零字节文件也可重复，不能仅凭文件大小或文件名判重复。GET /api/result 返回最近一次完整扫描结果，服务重启后保留。并发扫描请求合并到同一运行或返回 409，不能发布半份结果。根外路径不可读取。

演示时用同名不同内容、不同名相同内容、空文件和中文文件名。扫描结果显示真实 SHA-256，用户修改文件后再次扫描结果更新。`},
B04:{name:'WebhookInspector',title:'Webhook 签名与去重调试台',body:`实现本地 Webhook 调试台：签名请求到达后，界面显示事件 ID、原始请求体、SHA-256 和去重状态；本题不实现向其他服务重放或自动重试。

额外参数 --source demo --secret demo-key。POST /hooks/demo 接收 JSON 原始字节，X-Event-Id 为字符串，X-Signature 格式 sha256=<小写十六进制>，签名为 HMAC-SHA256(secret,原始请求体)。验签必须早于 JSON 解析。无效签名 401；首个有效事件 201 {id}；同 ID 相同原始字节重复 200 {id} 且稳定复用 ID；同 ID 不同原始字节在正确重签后返回 409。最多接收 1 MiB。

GET /api/events 返回 {events:[{id,eventId,source,sha256}]}，GET /api/events/<id> 返回 {id,eventId,source,body}，body 为原始 UTF-8 请求体。并发重复请求只能新增一条。事件持久化，重启不丢；密钥不得出现在界面、API 和日志。交付一个本地签名发送示例供演示。`},
B05:{name:'ReversibleDirectorySync',title:'目录增量同步与撤销工作台',body:`实现源目录到目标目录的同步预览、执行和撤销，额外启动参数 --source <源目录> --target <目标目录>。网页显示计划中的新增、更新、移除动作，用户点击执行或撤销，显示实际状态。本题处理普通文件，单文件不超过 1 MiB，不跟随符号链接或 junction；源、目标和 data 三个目录不能互相包含，启动时验证。只可改动目标与 data，不可修改源。

POST /api/plan 比较源和目标的相对路径与 SHA-256，返回 {id,actions:[{path,type,sha256Before,sha256After}]}，type 为 create/update/remove；没有差异的文件不入动作，缺失的哈希用 null。路径用 / 分隔，actions 按路径排序。计划保存当时源与目标的完整文件指纹，规划不改动目标。GET /api/plans/<id> 返回计划与 status（planned/applying/applied/rolledback）。

POST /api/plans/<id>/apply 必须先验证源与目标都仍匹配计划指纹，任一变化返回 409，且不改动任何目标文件；然后备份旧目标并执行动作，全部成功后返回 200 {status:"applied"}。重复调用已完成计划返回同状态，不重复破坏文件。源文件变动、目标新增/移除也属于冲突；不要只验证同名文件的大小或时间。

POST /api/plans/<id>/rollback 对已应用计划还原执行前目标树，成功返回 200 {status:"rolledback"}，重复撤销幂等；只有目标仍匹配该计划应用后的结果时才可撤销，外部修改后返回 409，不能覆盖外部改动。已撤销计划不可重新 apply，需创建新计划。

计划、备份和状态持久保存。进程在执行中被强制终止后，重启先恢复该计划执行前的完整目标树，再允许接收请求；不能把半执行状态报告为 applied。对外不要求文件系统中间瞬间的全目录原子可见性，但成功响应和重启后的状态必须完整一致。演示限定使用本地临时夹具文件。`},
B06:{name:'ResilientGateway',title:'限流与熔断代理工作台',body:`实现本地 HTTP 代理与状态界面，展示请求次数、真正的上游调用数、限流拒绝、熔断状态和请求结果。额外启动参数 --upstream <本地HTTP地址> --limit 3 --window-ms 1000 --timeout-ms 150 --failure-threshold 2 --open-ms 500。本题只代理 GET，不做任务队列、持久化租约或多进程调度。

GET /relay?path=<以/开头的路径> 将请求实际发送到固定 upstream 的该路径，返回上游真实状态码和原始字节；拒绝绝对 URL、//host 与协议变换，不能让调用者换掉目标主机。单次上游超过 timeout-ms 返回 504。

所有 relay 请求先执行固定窗口限流：窗口从该服务收到首个 relay 请求起算，每 window-ms 重置，最多放行 limit 个，超限 429，不能访问上游。通过限流后再检查熔断。连续 failure-threshold 次网络失败、超时或 HTTP 5xx 使 CLOSED 转 OPEN；HTTP 4xx 不算故障，成功 2xx/3xx 重置连续故障计数。OPEN 内请求返回 503，不能访问上游；open-ms 后进入 HALF_OPEN，只允许一个探测，其余并发请求 503。探测成功回 CLOSED，失败重新 OPEN 并重计等待时间。

GET /api/stats 返回 {state,requests,upstreamCalls,rateRejected,circuitRejected}；requests 计所有 relay 请求，upstreamCalls 仅计真实发出的请求，其余字段计相应拒绝。重启清零计数与状态，必须在 README 明示；无持久化要求。网页可输入路径发送真实请求、显示返回内容并刷新 stats。`},
B07:{name:'VersionedConfig',title:'版本化配置发布与回滚台',body:`实现配置发布服务，页面显示当前版本、配置、版本历史和冲突提示，支持编辑发布与回滚。重点是并发条件更新、原子持久化和崩溃后恢复；本题为单服务，不要求共识或通用文本协同引擎。

配置固定为 {label:string,enabled:boolean,endpoints:[{name:string,url:string}]}，label 非空，endpoint 名称非空且唯一，url 必须是合法 http/https URL。初始配置 {label:"initial",enabled:false,endpoints:[]}，初始 revision 为 0。GET /api/config 返回 {revision,config,sha256}，sha256 按配置的 JSON.stringify 字节（字段固定按 label,enabled,endpoints，endpoint 按 name,url；数组保留顺序）计算。GET /api/history 返回 {versions:[{revision,config,sha256}]}，含初始版本。

PUT /api/config 使用 If-Match:<期望revision>，JSON {requestId,config}；原子比较版本并提交，成功 200 返回新快照，版本不匹配 409，配置非法 422。POST /api/rollback 使用同样 If-Match，JSON {requestId,targetRevision}；回滚创建递增的新 revision，不能倒退版本号或删除历史。所有修改按 requestId 幂等：相同路径和载荷重试返回原结果，重复 ID 不同载荷 409，已成功请求的重试即便 If-Match 旧了也返回其原结果。错误请求不能改变当前配置与历史。

成功响应前须持久提交整个快照、历史与幂等结果；进程被强制终止再启动，不丢已经确认的版本，不返回拼接的半份配置。并发读写只允许看到完整旧快照或完整新快照。可使用 Node 原生 SQLite 事务。演示开两个窗口读同一版本，一个先提交，另一个因旧版本冲突，再回滚并刷新。`},
B08:{name:'InventoryTransactions',title:'库存预占与结算事务台',body:`实现库存预占与结算服务，页面显示可用、预占、已售数量和订单列表，支持预占、支付、取消。重点是并发下不超卖、原子状态转换、过期与支付竞争、跨重启幂等；本题是单服务，不要求分布式共识。

额外参数 --capacity 10 --ttl-ms 1200。初始 capacity 个同类单位，订单 quantity 为正整数。POST /api/orders 接收 {requestId,quantity}：容量足够时原子预占，201 {id,status:"reserved",quantity,expiresAt}，不足 409；数量非法 422。POST /api/orders/<id>/pay 接收 {requestId}：尚未过期的 reserved 转 paid，200 返回订单；已 paid 可幂等返回；expired/cancelled 返回 409。POST /api/orders/<id>/cancel 接收 {requestId}：reserved 转 cancelled 并释放，重复取消可返回同结果，paid/expired 返回 409。到期以服务器持久化的 expiresAt 为准，超时 reserved 转 expired 并释放，读取/支付/预占前要处理到期；支付和到期只能有一个结果。

GET /api/inventory 返回 {capacity,available,reserved,sold}，必须始终 available+reserved+sold=capacity 且均非负。GET /api/orders 返回 {orders:[...]}；GET /api/orders/<id> 返回订单。所有修改按 requestId 幂等：相同路径与载荷重试返回原状态码和订单，不再扣库存；同 ID 不同路径/载荷 409。成功响应前持久化订单、库存和幂等结果，原生 SQLite 事务可用。原子状态必须跨重启保留。

演示用并发请求争抢最后库存，观察成功数量和不足提示；让预占过期释放；支付后重启，库存和订单仍一致。网页显示真实到期状态，不仅在前端倒计时。`},
};
const httpProbe={name:'HttpHealthProbe',title:'HTTP 健康探针与可视化报告',cli:true,body:`编写 Node.js 24 命令行健康探针。用户提供 JSON 文件，根结构为 [{id:string,url:string},...]，访问本地 HTTP 目标，输出 JSON 结果和可直接打开的 HTML 报告。HTML 用表格和原生 details 展示绿/红状态、HTTP 状态与错误，使用简洁默认样式即可。

命令 node probe.js --config <JSON路径> --out <HTML路径> --timeout-ms 150 --concurrency 2。JSON 产物与 HTML 同路径但扩展名为 .json，结构 {results:[{id,url,status,ok,error}],summary:{total,healthy,failed}}。results 严格保留输入顺序。HTTP 2xx 为 ok:true、error:null；非 2xx 为失败且保留真实 status；连接失败或超时的 status:null，error 为非空字符串。每个目标独立超时，失败不影响其他目标；最多 concurrency 个请求同时在途。重定向不跟随，3xx 也视为失败。

本题只允许 http://127.0.0.1:<端口>/... 目标，拒绝含用户名/密码、其他主机或其他协议的 URL；id 必须是非空字符串，URL 不合法或配置 JSON 错误时退出 2，并保持已有输出文件不变。输入合法时完成全部检查并写报告；全健康退出 0，有失败退出 1。HTML 中的 id、URL 和错误必须按纯文本展示，不能执行输入携带的标记。交付 probe.js 和 README.md，全部使用原生模块，报告由程序运行生成；README 给出配置与命令示例。`};
const ledgerAudit={name:'LedgerAudit',title:'并发转账账本与审计报告',cli:true,body:`实现 Node.js 24 原生命令行转账账本，使用 node:sqlite 持久化。对多个进程同时提交的转账，保证余额不为负、总额守恒、请求幂等，输出可直接打开的 HTML 审计报告。只交付 ledger.js 和简短 README；报告由命令运行生成，使用默认表格样式即可。

命令格式：node ledger.js --db <文件> init --accounts a:100,b:100,c:100；node ledger.js --db <文件> transfer --id <requestId> --from a --to b --amount 30；node ledger.js --db <文件> report --out <HTML文件>。所有命令 stdout 只输出一个 JSON。init 首次创建账户，重复 init 不重置已有库，成功退出 0。

账户 ID 限字母/数字/下划线；余额与 amount 都是安全整数，amount 必须为正，不能向自己转账。transfer 成功退出 0，输出 {ok:true,seq,requestId,from,to,amount}；余额不足、未知账户或同 requestId 不同参数退出 1，输出 {ok:false,error}；参数错误退出 2。相同 requestId 和相同参数重试必须返回第一次的结果与退出码，包含余额不足的失败结果。不同参数冲突不能改余额。同一 requestId 最多一笔成功账本记录。

转账的账户更新、成功账本行和幂等响应须在同一 SQLite 事务提交，响应成功前持久化。多个独立进程共用一个数据库时也要遵守；正常竞争需等待锁，不能随意把数据库忙算作业务失败。进程强制结束再启动，已确认转账仍在。

成功账本行 {seq,requestId,from,to,amount,prevHash,hash}，seq 从 1 连续递增；第一行 prevHash 为 64 个 0，其余是前一行 hash；hash=SHA256(prevHash+"\\n"+JSON.stringify({seq,requestId,from,to,amount}))，JSON 字段按所示顺序，UTF-8 编码。失败转账不进入成功账本。

report 输出 {accounts:[{id,balance}],total,ledger:[账本行],auditOk}，账户按 ID 排序，账本按 seq 排序；必须从真实持久化数据计算余额守恒与审计链一致性。HTML 表格显示账户余额、总额、每笔转账与审计结果，输入文本要转义，不加载外部资源。演示用多个终端同时争抢同一账户余额、重放请求、重新启动并生成报告。`};
const syncReport={name:'DirectorySyncReport',title:'可撤销目录同步与差异报告',cli:true,body:`实现 Node.js 24 原生命令行目录同步工具，交付 sync.js 和简短 README。同步普通文件内容，不跟随符号链接或 junction，单文件上限 1 MiB；空目录不计入同步真值。源、目标、data 三个目录不得互相包含，只能修改目标和 data。HTML 差异报告使用简单原生表格，输入路径按纯文本转义。

命令：node sync.js --data <目录> plan --source <源目录> --target <目标目录>，输出单个 JSON {id,actions:[{path,type,sha256Before,sha256After}]}，type 为 create/update/remove；相对路径用 / 分隔，actions 按路径排序，没有变化的文件不列入，缺失哈希用 null。计划记录源与目标所有普通文件的路径和 SHA-256，规划不得修改目标，也不能仅凭大小或 mtime 判断变化。

node sync.js --data <目录> apply --plan <id>：先核对源与目标完整指纹仍匹配计划，不匹配退出 1 且不改动任何目标文件；备份旧目标后执行，完整成功输出 {status:"applied"} 并退出 0。重复执行已 applied 计划幂等，不再次破坏文件。apply 不可用于 rolledback 计划。

node sync.js --data <目录> rollback --plan <id>：仅当目标仍匹配应用后结果时恢复执行前目标树，输出 {status:"rolledback"} 并退出 0；外部变动时退出 1，不覆盖新内容。重复 rollback 幂等。

node sync.js --data <目录> report --plan <id> --out <HTML路径>：从持久计划读取并输出 {id,status,actions}，生成显示状态与每项差异的 HTML 表格；报告不得触发同步。各命令 stdout 只输出一个 JSON；业务冲突退出 1，参数错误退出 2。

计划、备份与状态须持久化。执行动作前先保存完整备份并把状态记录为 applying；进程中断后，下一次命令先把 applying 计划恢复为执行前目标内容和 planned 状态，再处理请求。成功输出前必须已完整提交状态。无需全目录中间瞬间原子可见，但成功响应及重启后的目标不能是半份结果。演示仅使用本地临时夹具文件。`};
const shortLinks={name:'LocalShortLinks',title:'本地短链接与访问统计台',body:`实现一个单机短链接服务，交付 server.js 和简短 README。页面由服务端直接生成默认 HTML 表单和链接表格，用户可以创建短链接、点击跳转、刷新查看访问次数；只覆盖创建、跳转、计数和重启保持。

POST /api/links 接收 {url,slug?}，url 仅允许 http://127.0.0.1:<端口>/...，拒绝用户名/密码或其他主机/协议，按 new URL(url).href 保存。slug 如提供，必须匹配 [A-Za-z0-9_-]{3,24} 且区分大小写；未提供则生成独立唯一 slug。新建 201 返回 {slug,url,visits:0}；已有相同 slug 和相同 URL 返回 200 与当前记录；同 slug 不同 URL 返回 409，不覆盖原记录；非法 URL/slug 返回 422。不同 slug 可以指向同一 URL。

GET /s/<slug> 返回 302，Location 为已保存 URL，并将该链接 visits 原子增加 1；服务本身不请求目标。HEAD /s/<slug> 返回相同跳转头但不计访问；未知 slug 返回 404。并发 20 次 GET 不能丢计数。GET /api/links 返回 {links:[{slug,url,visits}]}，按 slug 字典序排列。

创建记录和访问计数须在响应前持久化，重启保持。根页面使用原生表单提交创建，可增加 POST /create 处理 URL 编码表单并跳回根页面；API 与页面共享真实状态。以本地测试接收页作为跳转目标演示，不访问外部网站。`};
const renameReport={name:'TransactionalRename',title:'事务化批量重命名与撤销',cli:true,body:`实现 Node.js 24 原生命令行批量重命名工具，交付 rename.js 和简短 README。只处理 root 根层普通文件，每个文件不超过 1 MiB；不处理子目录，不跟随链接；data 位于 root 外且两目录互不包含。同一 data 按单作业运行。报告用默认 HTML 表格显示旧名称、新名称和状态。

node rename.js --root <目录> --data <目录> plan --map <JSON路径>，JSON 为 [{from:"a.txt",to:"b.txt"},...]。from/to 为不含 / 或 \\ 的普通文件名，不得为 . 或 ..，且二者不同；from 各不重复，to 各不重复。来源必须存在；已有目标仅当也属于本批来源时允许，因此必须支持 a→b、b→a 的交换。其他名称冲突退出 1，参数错误退出 2，不改文件。成功输出 {id,actions:[{from,to,sha256}]}，actions 按 from 排序；记录原内容 SHA-256，规划不得改 root 文件。

node rename.js --root <目录> --data <目录> apply --plan <id>：先核对所有相关来源内容和目标存在状态仍与计划一致，不一致退出 1 且不执行任何动作；通过暂存或等价方法支持交换与循环，不能覆盖丢失文件。完成后输出 {status:"applied"}、退出 0；重复 apply 同计划幂等。

node rename.js --root <目录> --data <目录> undo --plan <id>：仅当相关文件仍匹配执行后状态时还原旧文件名和内容，成功输出 {status:"undone"}；外部改动则退出 1 并保留外部内容。重复 undo 幂等，undone 计划不可重新 apply。与计划无关的 root 文件必须保持不变。

node rename.js --root <目录> --data <目录> report --plan <id> --out <HTML路径>：输出 {id,status,actions} 并生成表格报告，路径按纯文本转义。所有命令 stdout 为单个 JSON。

变更前先把原内容备份到 data，并持久记录 applying；进程中断后，下一命令先恢复相关旧文件与 planned 状态，再处理请求。成功响应前提交完整状态，不能留下暂存文件。仅考文件名和字节内容，不要求保留文件时间与 ACL。演示使用本地临时夹具。`};
const orderReplay={name:'OrderEventReplay',title:'乱序订单事件回放与对账报告',cli:true,body:`实现 Node.js 24 原生命令行订单事件回放器，交付 replay.js 和简短 README。输入最多 10,000 行、1 MiB 的 UTF-8 JSONL；空行忽略。全部按完整批次重放，输出确定性的订单状态、逐事件回执和 HTML 对账报告，使用简单原生表格。

命令 node replay.js --input <JSONL文件> --out <HTML文件>。JSON 产物与 HTML 同路径但扩展名为 .json，且只包含 {orders,receipts,summary}；stdout 只输出 summary JSON。合法批次退出 0，即使存在业务拒绝或版本缺口；输入结构错误或事件冲突退出 2，并保持已有 HTML/JSON 产物不变。

每条事件为 {eventId,orderId,version,type,payload}：ID 为非空字符串，必须完整保留超出安全整数范围的数字形字符串；version 为正的安全整数；type 仅 CREATE/PAY/CANCEL/REFUND。CREATE 的 payload 为 {amount}，amount 是正的安全整数，单位为分；其他类型的 payload 必须为 {}。不接受额外字段。结构化字段相同的同 eventId 重复只保留一条，summary.duplicates 增加；同 eventId 不同内容或同 (orderId,version) 对应不同 eventId 是批次冲突，退出 2。对象字段的输入顺序不影响重复判断。

按 orderId 的 Unicode 码点字典序分组，组内按 version 升序；每个订单从 version 1 开始消费。遇到缺口后，该事件及该订单后续事件都记 PENDING_GAP，不应用。补齐缺口后重新完整重放，后续事件可正常生效。

状态初始 ABSENT、amount=0、lastVersion=0。CREATE 仅在 version=1 且 ABSENT 时成功，进入 PENDING 并设置 amount；PAY 仅 PENDING→PAID；CANCEL 仅 PENDING→CANCELLED；REFUND 仅 PAID→REFUNDED。合法转移记 APPLIED。错误状态上的合法类型记 REJECTED_TRANSITION，状态和金额保持，但该 version 仍被消费，lastVersion 前进。缺口事件不推进 lastVersion。

orders 为 [{orderId,status,amount,lastVersion}]，包含所有订单（包括 ABSENT）；receipts 为每条唯一事件的 [{eventId,orderId,version,result}]，按 orderId、version 排序。summary 为 {orders,statusCounts,paidAmount,refundedAmount,applied,rejected,pending,duplicates}：orders 为订单数；statusCounts 包含五种状态的计数；paidAmount/refundedAmount 分别是当前 PAID/REFUNDED 订单金额之和；applied/rejected/pending 为回执分类数。相同事件集合的任意输入乱序须生成语义相同的 JSON，不加入时间戳或其他字段。

HTML 分别用表格显示订单状态和事件回执，清楚显示拒绝和缺口；所有输入文本按纯文本处理，不加载外部资源。演示先回放缺 CREATE 的 PAY，再补 CREATE 重放，对比状态；同时演示重复事件、已取消订单再次支付被拒绝。`};
const ids=process.argv.slice(2);if(!ids.length)throw Error('Provide measured slow task IDs');
for(const id of ids){const i=bank.tasks.findIndex(t=>t.id===id&&t.status==='active'),old=bank.tasks[i],def=replacements[id];if(!old||!def)throw Error('No replacement definition for '+id);
 const chosen=old.name==='LogInspector'?httpProbe:old.name==='VersionedConfig'?ledgerAudit:old.name==='ReversibleDirectorySync'?syncReport:old.name==='DirectorySyncReport'?renameReport:old.name==='TransactionalRename'?orderReplay:old.name==='WebhookInspector'?shortLinks:def;
 if((bank.history||[]).some(t=>t.name===chosen.name))throw Error('No new shorter candidate configured; refusing to reintroduce a retired task');
 const records=JSON.parse(fs.readFileSync(path.join(root,'Backend/pilots/20261015/results.json'),'utf8')).records.filter(r=>r.promptSha256===old.promptSha256);
 const record=records.at(-1);if(!record||record.generationSeconds<=480)throw Error('No measured slow evidence for '+id);
 const levelDir=old.project.split('/')[0],project=`${levelDir}/${chosen.name}`;fs.mkdirSync(path.join(root,project),{recursive:true});
 const prompt=`# ${chosen.title}\n\n${chosen.body}\n${chosen.cli?'':'\n## 运行与交付\n\n'+common+'\n'}`;
 if(fs.existsSync(path.join(root,project,'PROJECT_PROMPT.md')))throw Error('Replacement already exists');
 fs.writeFileSync(path.join(root,project,'PROJECT_PROMPT.md'),prompt);
 fs.writeFileSync(path.join(root,project,'README.md'),`# ${chosen.title}\n\n- 题号：${id}\n- 难度：${old.level}（待基础试测确认）\n- 原题：${old.title}\n- 替换原因：原试次 ${record.generationSeconds} 秒，超过 480 秒筛选线。\n- 题面：[PROJECT_PROMPT.md](PROJECT_PROMPT.md)\n- [试测与替换记录](../../Backend/PILOT_REPORT.md)\n\n基础验收应独立验证题面中的输入/输出、错误、并发、持久化与可操作界面。基础通过不等同完整压力和故障注入认证。\n`);
 const retired={...old,status:'retired',retiredReason:'measured-generation-over-480-seconds',replacementProject:project,measuredSeconds:record.generationSeconds};
 bank.history??=[];bank.history.push(retired);
 bank.tasks[i]={id,level:old.level,name:chosen.name,title:chosen.title,project,prompt:project+'/PROJECT_PROMPT.md',dispatchProject:project,status:'active',replaces:old.project,promptSha256:crypto.createHash('sha256').update(prompt).digest('hex')};
}
bank.version=(bank.history||[]).some((t,i,arr)=>arr.findIndex(x=>x.id===t.id)!==i)?'1.2.0-pilot':'1.1.0-pilot';fs.writeFileSync(bankPath,JSON.stringify(bank,null,2)+'\n');console.log('Registered replacements: '+ids.join(', '));
