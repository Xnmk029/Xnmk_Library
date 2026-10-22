# Durable y-websocket

基于真实 yjs/y-websocket v2.1.0（`7c3408a33fc52bd5001d2ff80b38624961402614`，MIT）。原始出处在 [UPSTREAM.json](UPSTREAM.json)，原版文档在 [README.upstream.md](README.upstream.md)。实际修改了 `bin/server.cjs` 的 HTTP/升级路径和 `bin/utils.cjs` 的文档加载、同步、广播、持久化与回收路径；客户端 `src/y-websocket.js` 保持原样，二进制协议及公开 exports 路径不变。

## 安装与启动

需要 Node.js 24。无需 Redis、Docker、原生 LevelDB 模块或额外数据库服务。

```powershell
cd repo
npm ci --ignore-scripts
npm run dist
npm run demo:build
npm test
npm run demo
```

打开 <http://127.0.0.1:1234/>，同一页面有两个编辑窗口，分别通过标准 `WebsocketProvider` 连接 1234 和 1235。两个独立 Node 进程共用 `repo/data/demo.sqlite`。两边均禁用 BroadcastChannel，客户端不能借助同页广播绕过服务器。

演示步骤：

1. 点击“两边断网”，在 A、B 分别编辑；实际客户端文本会变化，API 已提交文本保持原值。
2. 点击“两边重连”，查看双方文本及 API 内容收敛。编辑器根据前后文本差异执行 Y.Text 局部 insert/delete，不做整段最后写入覆盖。
3. 点击“压缩房间”，检查 snapshotSeq 追上 seq、日志行数变为 0。
4. 暂停编辑，在启动终端输入 `r`：脚本强制终止并重启两个进程，比较重启前后完整更新字节、seq，并用独立 Y.Doc 验证恢复内容。页面自动重连。其他房间使用 `r roomName`。
5. 终端 `c [room]` 压缩，`q` 关闭两个服务。`npm run demo -- --smoke` 在临时数据库自动完成写入、压缩、强制重启、恢复校验并退出。

页面状态、文字、水位和时间线均来自真实客户端或 API；页面“断网”按钮只断开该编辑器的 WS，以便继续显示数据库检查结果。离线修改保留在该页面的 Y.Doc，刷新页面会丢失尚未同步的修改。演示没有实现浏览器磁盘离线缓存。

也可在两个 PowerShell 终端独立启动（`DB_PATH` 必须指向相同的绝对路径）：

```powershell
# 终端 A，工作目录 repo
$env:HOST = '127.0.0.1'
$env:PORT = '1234'
$env:DB_PATH = Join-Path (Get-Location) 'data/shared.sqlite'
$env:ROOM_IDLE_MS = '1000'
node bin/server.cjs
```

```powershell
# 终端 B，工作目录同一个 repo
$env:HOST = '127.0.0.1'
$env:PORT = '1235'
$env:DB_PATH = Join-Path (Get-Location) 'data/shared.sqlite'
$env:ROOM_IDLE_MS = '1000'
node bin/server.cjs
```

`HOST` 默认 127.0.0.1，`PORT` 默认 1234，`DB_PATH` 默认当前目录下 `data/collab.sqlite`，`ROOM_IDLE_MS` 默认 1000。demo 脚本可用 `PORT_A`、`PORT_B`、`DB_PATH` 覆盖配置，页面端口输入框对应填写。

## API

room 严格匹配 `[A-Za-z0-9_-]{1,64}`。非法 room（包括百分号编码替代字符）返回 400，WS 升级亦然。HTTP JSON 请求上限 8 MiB，WS 帧上限 8 MiB。

| 方法 / 路径 | 请求 / 响应 |
| --- | --- |
| `GET /v1/health` | `{"ok":true}` |
| `POST /v1/rooms/r/updates` | 请求 `{"updateId":"u1","update":"规范base64的V1更新"}`；返回 `{"updateId":"u1","seq":1}` |
| `GET /v1/rooms/r/state` | `update`、`text`、`lastSeq`、`snapshotSeq`、`totalUpdates` |
| `POST /v1/rooms/r/compact` | 无参数；返回 `{"snapshotSeq":1}` |
| `GET /v1/rooms/r/stats` | `lastSeq`、`snapshotSeq`、`totalUpdates`、`logRows`、`dedupRows` |

`updateId` 是非空字符串。相同 room 中 ID 和字节相同返回原 seq；ID 相同字节不同返回 409。不同 ID 即使内容相同也分配新 seq。非法 JSON、非规范 base64、损坏/截断/尾随字节的 V1 更新返回 400，验证不会修改日志、序号或活动文档。空 V1 更新 `AAA=` 是有效输入，唯一 HTTP ID 仍会计数。

例如从 repo 目录执行以下 Node 命令生成真实更新并提交：

```powershell
node -e "const Y=require('yjs'); const d=new Y.Doc(); d.getText('text').insert(0,'hello'); fetch('http://127.0.0.1:1234/v1/rooms/example/updates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({updateId:'example-1',update:Buffer.from(Y.encodeStateAsUpdate(d)).toString('base64')})}).then(r=>r.json()).then(console.log)"
Invoke-RestMethod http://127.0.0.1:1235/v1/rooms/example/state
Invoke-RestMethod -Method Post http://127.0.0.1:1234/v1/rooms/example/compact
Invoke-RestMethod http://127.0.0.1:1235/v1/rooms/example/stats
```

## 提交、恢复与快照边界

SQLite 使用 WAL 与 `synchronous=FULL`。`rooms` 保存每房间水位和一个合并后的 V1 快照；`updates(room,seq,payload)` 保存尚未压缩的原始更新；`dedup(room,update_id,seq,digest,byte_length)` 永久保存 HTTP 幂等凭据。

唯一更新在 `BEGIN IMMEDIATE` 事务中检查去重、分配连续 seq、增加 totalUpdates、插入原始 payload 和幂等凭据，然后 COMMIT。HTTP 200 只在 COMMIT 之后发送；即刻 kill 进程可恢复。提交后、响应前发生故障时，调用方可以使用同一 ID 和原字节安全重试。幂等凭据使用 SHA-256 加原字节长度识别字节一致性，采用通常的密码学抗碰撞假设，不保存完整原始 payload 副本。

标准 WS 的 step2/update 在接触活动文档前验证并持久提交，随后才应用、广播。只有新增 CRDT 信息的 WS 更新进入日志；已存在或空的 WS 内容可忽略。WS 协议没有业务持久确认帧，`provider.synced` 不能替代 HTTP durability ack。`totalUpdates` 计入唯一 HTTP 更新及实际记录的 WS 更新。

压缩在一个 `BEGIN IMMEDIATE` 事务内读取旧快照和日志，记录边界 N，以 `Y.mergeUpdates` 合并原始二进制，发布 `snapshotSeq=N`，并仅删除该 room 的 `seq<=N` 日志，最后提交。整个合并持有写事务，写者及另一压缩器串行执行；新写入在压缩提交后取得 N+1。回滚会同时保留旧快照和日志。压缩不删除 dedup，stats 直接查询数据库，成功压缩后确实没有已覆盖日志行。

快照不从可见 text 或当前文档重建。原始更新合并保留 pending structs 和 delete sets：U2 先到，或者删除集先于目标结构到达，经过压缩、kill 和重启后，U1 仍能补齐依赖。合并快照不做 CRDT tombstone 的破坏性回收，因此快照大小随文档历史结构增长；日志 payload 本身会被物理逻辑删除，SQLite 文件页面可复用，文件大小不保证立即缩小。

`state` 在一个 SQLite 读事务获取快照、日志和所有水位，再在独立临时 Y.Doc 中计算 text；返回的 update 是完整原始合并结果。响应中的内容和水位来自同一个已提交边界。`stats` 也在单一读事务内查询，无内存计数伪装。

## 跨进程 tail 与 room 生命周期

每个服务有自己的 `docs` Map 和 Y.Doc。活动 room 每 100ms 读取一次日志边界，应用 `seq>lastSeq` 的增量。如果另一进程已经压缩掉落后的日志，则先应用更新的完整快照，再应用快照后的日志，全部成功后才推进本地水位。所有数据库应用使用独立 `COMMITTED` origin，不会再次 append。健康、无长期数据库锁和事件循环阻塞时，远端更新通常在一个轮询周期内可见；测试要求在 2 秒内到达。

加载数据库是同步的；自定义 `setPersistence().bindState` 与 `setContentInitializor` 异步钩子由 `whenInitialized` 门禁等待。准备完成之前不发送任何同步结果，收到的帧有界排队。加载失败时连接关闭、失败缓存销毁，不会以空文档写回数据库。保留 `getYDoc`、`WSSharedDoc`、`docs`、`setupWSConnection` 和原有配置钩子 exports；SQLite 始终为服务的持久权威。

最后一个 WS 连接关闭后启动 ROOM_IDLE_MS 空闲计时。重连取消回收；回收回调检查 Map 中对象身份，旧实例的回收不能销毁新实例。销毁会清除 tail、idle、ping、awareness 和 callback debounce 计时器。HTTP 操作直接使用数据库和临时文档，不创建长期缓存，也不复用正在销毁的文档。awareness 仅单进程传播，连接断开会删除该连接控制的状态。

## 数据库初始化与迁移

第一次启动自动建目录、初始化 v1 SQLite schema（`PRAGMA user_version=1`）。后续启动复用同一数据库，不重置序号和凭据；高于 v1 的数据库拒绝启动，防止未知版本被覆盖。

本实现移除了可选 y-leveldb 依赖，不再使用 `YPERSISTENCE`。原版 LevelDB 数据不能直接作为 DB_PATH。若已有旧服务数据，应在旧服务的环境中导出每个 room 的完整 Yjs V1 二进制更新，再通过本服务的 updates API 导入，给每个导入记录稳定且唯一的 updateId。不要把可见字符串当作迁移数据，尤其是未满足依赖的更新。随题仓库没有待迁移数据库。

SQLite 文件必须位于支持 SQLite 本机锁语义的本地文件系统。备份时使用 SQLite 备份机制，或先停止全部进程再复制数据库及仍存在的 WAL；运行中单独拷贝主数据库文件不能保证包含所有确认提交。

## 故障点与验证

仅 HTTP 写入/压缩支持故障点；默认关闭。给专门的故障进程设置 `BENCH_FAILPOINT` 和 `BENCH_MARKER`（父目录须存在），等待 marker 后强制 kill，不要等待请求成功：

| 故障点 | marker 出现时的状态 | kill 后结果 |
| --- | --- | --- |
| `update-before-commit` | 日志、序号、凭据已在未提交事务中写入 | 整个事务回滚，无 seq 空洞 |
| `update-after-commit` | 更新事务已 COMMIT，尚未响应 | 更新及凭据可恢复，重试返回原 seq |
| `compact-before-commit` | 新快照和删除处于未提交事务 | 旧快照和全部旧日志仍在 |

命中后当前请求不返回，进程内其他存储操作返回 503，健康检查仍工作。before-commit 的写事务持锁直到 kill；另一进程能继续通过 WAL 读已提交状态，写入会退避重试，最多 10 秒后返回 503。正常写锁等待 100ms 后异步退避，不在事件循环中长时间等待。故障测试在锁持有时读取另一进程的已提交状态，随后 kill，再通过新进程检查恢复。

`npm test` 执行 Standard 静态检查、上游客户端 TypeScript 检查和 10 项 Node 测试（含父测试）。测试真实启动不同端口的独立服务，使用未修改的标准客户端、禁用 BC、用独立 Yjs 实例校验文本和状态向量：跨进程 WS、awareness 清理、离线并发插入删除、并发 HTTP 去重/冲突、压缩后永久去重、多写者双压缩器、跨快照追赶、跨 room 隔离、pending structs/delete sets、三个 marker+SIGKILL 故障点、缓存释放与重连身份、初始化等待、加载失败保护。

浏览器实测与命令结果见 [artifacts/VERIFICATION.md](artifacts/VERIFICATION.md)，页面截图见 [artifacts/browser-demo.png](artifacts/browser-demo.png)。

## 文件入口

| 文件 | 用途 |
| --- | --- |
| `bin/storage.cjs` | SQLite 事务、原始更新校验、快照、幂等凭据、故障点 |
| `bin/utils.cjs` | 原服务文档生命周期、标准 WS 协议、提交后广播、远端追赶 |
| `bin/server.cjs` | HTTP API、升级校验、浏览器演示静态入口 |
| `demo/` | 双服务窗口、真实状态与时间线，bundle 可离线使用 |
| `scripts/demo.cjs` | 双进程启动、强制重启并检查、自动 smoke 模式 |
| `test/` | 集成测试和生命周期测试 |

MIT，保留上游 LICENSE。此为本机协同后端实现，没有加入身份认证或多租户授权。
