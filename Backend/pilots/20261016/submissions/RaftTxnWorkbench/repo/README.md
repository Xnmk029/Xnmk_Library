# 三节点 Raft 条件事务与故障恢复工作台

在 etcd v3.5.17 `contrib/raftexample` 上实现。沿用 etcd Raft、rafthttp、WAL、MemoryStorage 和 Snapshotter；每个节点是独立进程、独立磁盘目录。源码来源和原始哈希见 `UPSTREAM.json`，许可证为 Apache-2.0。`go.mod` / `go.sum` 锁定依赖，两个原始测试文件保持原样。

## 快速开始

需要 Go 1.23+。自动化演练另需 Node.js 18+，无 npm 依赖。

```sh
go build -o rafttxn .
go test ./... -count=1 -timeout 90s
go vet ./...
go mod verify
node demo.mjs
```

Windows 可用 `go build -o rafttxn.exe .`，然后执行 `./demo.ps1`；其他系统可用 `sh ./demo`。演练会自行构建二进制、选择六个空闲本地端口、启动三个真实进程，完成断言后关闭进程。每次生成独立的 `artifacts/<UTC时间>/`，保留数据目录、三个节点日志、`history.json` 和浏览器可直接打开的 `report.html`。`artifacts/latest.json` 指向最近报告。失败返回非零退出码，仍生成失败证据。

手动启动时，在三个终端分别执行（Windows 使用 `./rafttxn.exe`）：

```sh
./rafttxn --id 1 --cluster http://127.0.0.1:9021,http://127.0.0.1:9022,http://127.0.0.1:9023 --port 9121 --data-dir data/1 --snap-count 8
./rafttxn --id 2 --cluster http://127.0.0.1:9021,http://127.0.0.1:9022,http://127.0.0.1:9023 --port 9122 --data-dir data/2 --snap-count 8
./rafttxn --id 3 --cluster http://127.0.0.1:9021,http://127.0.0.1:9022,http://127.0.0.1:9023 --port 9123 --data-dir data/3 --snap-count 8
```

重启使用完全相同的 ID、cluster 和 data-dir，不要为同一 ID 同时启动两个实例。Raft ID 是 cluster 列表的 1 起始位置。`--data-dir` 默认 `data-ID`，`--snap-count` 默认 10000，`--request-timeout` 默认 1500ms；保留原 `--join`。`Procfile` 也给出三节点启动配置。

## API

所有成功业务读取与事务都经共识。任意健康节点可接收请求；没有业务 HTTP 转发器或固定主节点。

```sh
curl -s http://127.0.0.1:9121/v1/txn -H 'Content-Type: application/json' -d '{"requestId":"r1","compare":[{"key":"a","modRevision":0}],"success":[{"op":"put","key":"a","value":"one"},{"op":"delete","key":"b"}]}'
curl -s 'http://127.0.0.1:9122/v1/kv?key=a'
curl -s http://127.0.0.1:9123/v1/status
```

- `POST /v1/txn`：compare 数组可空；success 必须为 1–16 个 put/delete。key 和 requestId 非空；每个数组内 key 唯一；put 的 value 必须是字符串。modRevision 必填，范围为 0–9007199254740991，拒绝小数、负数、null。未知字段、重复 JSON 字段和多段 JSON 均返回 400，验证失败不提交日志。HTTP 请求体上限 1 MiB。
- 200 响应包含 `requestId, succeeded, revision, results`。失败比较的 results 为 `[]`。结果顺序与 success 一致。相同 requestId 的同一逻辑请求返回原始结果；对象字段顺序和空白不影响身份，数组顺序影响身份。异内容返回 409，不能改动 KV。
- `GET /v1/kv?key=…`：返回 `key, value, modRevision, revision`。缺失和墓碑均为 200，value 为 null；从未写入 key 的 modRevision 为 0。
- `GET /v1/status`：允许陈旧，返回 `id, leaderId, term, appliedIndex, snapshotIndex, revision`。额外的 `installedSnapshotIndex` 只在本进程通过 Raft Ready 安装远端快照后更新；它不是从本地文件或页面推算的。
- `POST /v1/debug/partition`：`{"blockedPeerIds":[2,3]}` 全量替换本节点阻断列表；`[]` 恢复。隔离节点 1 时，同时在节点 2、3 设置 `[1]`。只供可信本地演练，无认证。
- 原 `PUT /key` 写入原始字符串，提交并应用后返回 204；原 `GET /key` 使用同样的日志屏障，存在时返回原文，缺失时 404。旧 key 包含前导 `/`。原成员 POST/DELETE 保留原提议接受语义；本任务不增加成员变更 API。
- 无 quorum 或孤立节点的读写返回 504（请求超时），**只代表结果未知**。重试请复用原 requestId 与原内容，不要为不确定的同一事务换 ID。即使本地已有去重缓存，重试也必须提交日志，少数派不会凭缓存返回成功。

## 共识、状态机与恢复设计

### 事务与读取

每次 HTTP 请求生成随机独立 token，用于定位本进程的等待者；token 不参与请求内容身份。事务以结构化 JSON 编码进入一条 Raft 日志。单个状态机互斥锁内依次完成：按 requestId 查永久结果 → 比较规范化请求内容 → 检查全部 compare → 原子应用全部操作 → 记录结果。成功事务只加一次全局 revision；删除不存在的 key 也写入墓碑并使用本次 revision。失败比较不改变 revision。永久表同时保存成功和失败的原始 JSON 字节及规范化请求内容，409 不覆盖原记录。

读取采用**提交等价日志屏障**，不是本地 leader 判断。read 命令进入 Raft 日志，仅在多数派提交且本节点应用时读取 KV 并生成响应。这样 follower、旧 leader 和刚恢复节点走相同协议，无法跳过 quorum。读不会增加业务 revision，也不会占用永久 requestId 表，但会增加 Raft 索引、产生 WAL 和快照开销。

### 应用与快照边界

生产入口启用严格应用协议：每一批 committed entries（包括空条目、配置条目）携带末尾索引；状态机先完成应用和 appliedIndex 更新，再关闭 applyDone。Raft 集成等待该通知后才生成快照、压缩日志、Advance。HTTP 结果在命令应用时生成，等待通道容量为 1，通知不等待 HTTP 客户端。诊断 appliedIndex 直接读状态机字段，而不是 Raft 的提交索引。

保留上游 `newRaftNode` 的原提交流适配器，以兼容不确认每条消息的原测试；可执行文件只使用 `newConfiguredRaftNode(..., strict=true)`。原测试源码没有修改。

快照 JSON 版本为 1，包含 `version, appliedIndex, revision, states, dedup`；states 包含全部墓碑，dedup 包含完整历史响应。未知版本及不一致的快照索引使进程停止，避免带着错误状态继续服务。版本升级需显式迁移，不能把上游无版本 map 快照当作 v1 快照。

恢复首先用 `wal.ValidSnapshotEntries` 和 `LoadNewestAvailable` 选择 WAL 认可的快照，不能取磁盘上孤立的最新文件。所选快照的**确切内容和索引**通过应用通道安装，再重放其后的已提交 WAL。运行中的远端快照同样先落盘，后应用，再继续发布日志；接收路径使用真实 rafthttp snapshot 消息。快照写盘顺序是 SaveSnap → WAL SaveSnapshot/fsync → ReleaseLockTo；WAL.Save 错误和存储错误都终止进程，不返回假成功。

触发条件是 `appliedIndex - snapshotIndex > snap-count`；生产环境保留最近 snap-count 条日志作为追赶窗口。演练让落后距离超过该窗口，从而必须传输快照，不能仅凭重放未压缩日志通过测试。

### 取消、超时和锁顺序

等待者先注册，再向提议通道发送；发送阶段和等待应用阶段均选择请求 context。超时或客户端断开后移除等待者；不会取消已经提交给 Raft 的命令。后续应用照常改动状态并保存永久结果；若等待者已移除，就不通知。快照安装跳过了某个正在等待的日志时，该等待者可能超时，客户端用同一 ID 重试取得结果。

状态机锁只保护 KV、revision、去重表、appliedIndex 和等待者。持锁期间不调用 Raft、不等待提议通道、不等待 HTTP；只向容量为 1 的专用结果通道通知。快照序列化在同一锁内完成。Raft 主循环等待 applyDone 时不持有状态机锁或分区锁。HTTP status 先取得 Raft status，之后才读取状态机字段。分区锁只保护 peer 阻断集合，调用 rafthttp CutPeer/MendPeer；与状态机锁无嵌套。

### 网络分区

分区作用于真实 peer 传输：rafthttp CutPeer 暂停该 peer 的 stream reader 和消息发送；Ready 出站消息另有过滤；入站 HTTP stream/pipeline/snapshot 握手受阻；Process 对已经进入现有连接的消息再次过滤。两侧同时设置后，现有流也不能把被隔离节点的消息交给 Raft。MendPeer 恢复。客户端 HTTP 端口不受阻断。启用 CheckQuorum 和 PreVote；所有成功读仍必须经日志屏障。

## 回归测试与证据

`txn_test.go` 覆盖严格输入、失败原子性、删除 ABA、成功/失败去重、409、快照版本和等待者取消后的延迟应用。原 `kvstore_test.go`、`raftexample_test.go` 原样保留。

`demo.mjs` 是自动化集成回归入口，执行并断言以下真实进程行为：

1. 三节点并发 12 个 CAS 只有一个成功；多 key 同 revision；任一 compare 失败则全部不变。
2. 并发跨节点相同 ID 去重；对象换序不影响身份；数组换序或异内容 409；失败结果不随新 revision 改变。
3. 删除墓碑与重建防 ABA；非法请求 400；旧 PUT 确认后跨节点立即读取。
4. 同时隔离旧 leader 两侧的真实 peer 流；少数派读、写、旧 ID 重试均在 2500ms 内返回 503/504；多数派重新选举并继续提交。
5. 多数派压缩日志后恢复，检查 `installedSnapshotIndex` 及旧成功/失败结果；对未知结果安全重试。
6. 收到成功响应后立即 SIGKILL 全部三个进程，复用原目录重启，验证值与响应字节不丢。
7. 停止一个 follower，继续写到超过日志保留窗口，再启动；同时检查实际 Raft `restored snapshot` 日志、安装索引和读取结果。
8. 从已落盘快照再次重启，旧 ID 仍返回原结果；最后全互相隔离验证无 quorum 读拒绝，然后恢复三节点线性读取。

HTML 只展示脚本已经记录的节点状态、请求和断言，不自行产生一致性结论。请求包含原始正文、HTTP 状态、耗时、节点和时间；失败记录不会被隐藏。每次运行完整保留证据，不覆盖历史。

可选竞态检查：

```sh
CGO_ENABLED=1 go test -race ./... -count=1 -timeout 90s
CGO_ENABLED=1 go build -race -o rafttxn-race .
RAFTTXN_BINARY=/absolute/path/rafttxn-race node demo.mjs
```

Windows 需可用的 64 位 C 编译器并设置 `CC`。已提供普通构建/测试日志及实际演练报告；最终验证摘要见 `VALIDATION.md`。

## 范围与成本

这是本地故障验证工作台，不提供认证、TLS、压测容量目标或自动历史清理。永久幂等表按请求数量增长，全部保存在内存和快照内；日志屏障让读取产生持久化开销；超大历史的快照序列化可能增加请求延迟。整数上限是 JSON 精确范围，revision 耗尽返回持久化的 507 结果，Raft 索引或 term 耗尽则停止进程。演练验证进程强杀恢复，假定节点磁盘仍然可用。
