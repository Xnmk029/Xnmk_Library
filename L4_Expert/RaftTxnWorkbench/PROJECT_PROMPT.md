# Raft 在线换节点、无日志读取与条件事务 · v2

把随题 `starter.tar` 中的 etcd `contrib/raftexample` 改造成可用的三节点条件事务服务。先在当前目录执行 `tar -xf starter.tar`，在解出的 `repo/` 中继续开发。源码来自 etcd v3.5.17，commit `507c0de87bd5034e3de4ab76ebf96b54dae0cd52`，Apache-2.0；`UPSTREAM.json` 给出出处和原文件哈希。已将原 monorepo 的模块依赖改为独立 go.mod/go.sum，原业务源码和测试未修改。

这是现有仓库的演进任务。沿用 etcd Raft、rafthttp、WAL 和快照路径，修改状态机、HTTP 与必要的 Raft 集成。禁止以单机数据库、共享状态文件、固定主节点或请求转发器替代共识；不得修改依赖里的 Raft 算法。保留原示例 API 的可用性与原测试；旧 PUT 也必须在提交并应用后才返回成功。

## 启动与持久化

在 `repo/` 中 `go build -o rafttxn .`。保留 `--id`、`--cluster`、`--port`、`--join`，新增 `--data-dir`（每节点独占）、`--snap-count`（默认 10000，可设为 8）、`--request-timeout`（默认 1500ms）。先运行三个独立 voter 进程，再在线加入第四个 learner；peer URL 和 HTTP 端口各不相同，重启复用原 data-dir。初次集群的 CSV URL 按顺序对应 ID 1、2、3；新节点 4 使用 `--join=true --cluster=<四个URL>`，不得凭该 CSV 自行成为 voter。已有 WAL/快照时以持久配置为准。所有整数限制在 JSON 精确整数范围。

## 条件事务契约

`POST /v1/txn` 接受：

```json
{"requestId":"r1","compare":[{"key":"a","modRevision":0}],"success":[{"op":"put","key":"a","value":"one"},{"op":"delete","key":"b"}]}
```

key/requestId 为非空字符串，每个数组内不得重复 key；compare 可为空，success 必须含 1–16 个操作；只允许 put/delete，put 的 value 必须为字符串。非法请求 400，不提出日志。JSON 对象字段顺序和空白不影响请求身份；数组顺序属于请求内容。

每个 key 初始 `value=null, modRevision=0`。在**同一条已提交日志的确定性状态机应用**中，先检查所有 compare，再全部执行或全部不执行。全局 `revision` 从 0 开始，仅成功事务加 1；该事务写入和删除的 key 均使用这个新 modRevision。删除保留墓碑和 modRevision，删除不存在的 key 也写墓碑；不能因删除后重建出现 ABA。比较失败不改变 revision 或任何 key。

200 返回：

```json
{"requestId":"r1","succeeded":true,"revision":1,"results":[{"key":"a","value":"one","modRevision":1},{"key":"b","value":null,"modRevision":1}]}
```

results 按 success 数组顺序给出事务执行后各 key 的状态；比较失败则 `succeeded=false, results=[]`，revision 为该日志应用时的全局 revision。HTTP 200 只能在相应命令已由多数派提交且本节点应用后返回。

requestId 是整个集群永久幂等键，成功和比较失败的原始结果均须持久化。相同 ID、相同逻辑请求返回完全相同的原始 JSON 结果；相同 ID、不同内容返回 409，不能改变状态。并发重复提交、换节点重试、leader 切换、WAL 重放和快照安装后均成立。幂等判定与事务必须在同一状态机中，不能只查当前 HTTP 进程的内存表。超时 503/504 只代表结果未知，允许该命令稍后提交。

## 读取、故障和观察

`GET /v1/kv?key=a` 返回 `{"key":"a","value":"one","modRevision":1,"revision":1}`，缺失/墓碑也返回 200。所有成功读取必须线性一致：**必须使用 ReadIndex 的 quorum 确认，并等到本地状态机应用至对应 index**。本版不再接受每次 GET 追加日志屏障、隐藏写入或定期无业务写入来完成读取。允许新 term 的 Raft 正常 no-op，但 leader/term 稳定且没有业务/配置写入时，连续和并发 GET 不得推进 appliedIndex。不得以缓存 leader 身份、固定租约或“最近刚写过”代替 quorum 确认。

每次屏障使用唯一请求上下文，正确处理并发 ReadState、取消、leader 更替和晚到响应；不能用一条已确认的旧 ReadState 放行之后开始的读取。健康多数派上的任意节点应可在 5 秒内完成操作；落后节点可以短暂拒绝服务。无多数派、孤立旧 leader 上的读写必须在配置超时加 1 秒内返回 503/504，不得返回过期成功。读取取消后须回收等待者，不得让网络事件循环被慢客户端阻塞。

`GET /v1/status` 为允许陈旧的诊断接口，至少返回 `id, leaderId, term, appliedIndex, snapshotIndex, revision, configIndex, voterIds, learnerIds`；ID 数组升序。appliedIndex 必须代表状态机已应用的位置。快照应同时包含 KV、墓碑、revision、完整幂等结果和有效成员配置；快照边界、apply 通知、ConfState 和恢复顺序必须一致。进程被强制结束后，已确认数据和幂等结果不能丢失。落后节点在日志压缩后仍能通过真实快照传输追平。

增加仅用于本地演练的 `POST /v1/debug/partition`，请求 `{"blockedPeerIds":[2,3]}` 全量替换本节点阻断列表；空数组恢复。阻断必须作用于真实 Raft peer 网络收发（含已建立的流），不能只影响业务 HTTP 或诊断状态。验收会在各侧同时配置，以隔离原 leader；客户端 HTTP 始终可访问。

## 在线成员变更：不能靠停服重建集群

`GET /v1/members` 返回 `{"configIndex":3,"members":[{"id":1,"peerUrl":"http://127.0.0.1:9021","learner":false}]}`；示例仅展示一项，实际返回当前完整列表，按 ID 升序。它是线性一致读取，也必须通过 ReadIndex。configIndex 为最后一次已应用配置日志的位置，初始配置由原集群的已应用配置日志确定；配置变化不能改变业务 revision。

`POST /v1/members` 接受以下三种请求，均使用同一集群的永久 requestId 命名空间（与 /v1/txn 共用）：

```json
{"requestId":"add-4","op":"addLearner","id":4,"peerUrl":"http://127.0.0.1:4921"}
{"requestId":"promote-4","op":"promote","id":4}
{"requestId":"remove-3","op":"remove","id":3}
```

200 返回 `{"requestId":"add-4","configIndex":42,"members":[...]}`，members 格式同上，表示该配置已由 Raft 提交并在本节点应用。相同 ID 相同逻辑请求永久返回原始结果，不能因为当前配置已经不同而重新执行；相同 ID 异内容或跨事务/成员操作复用返回 409。仅缓存于收到 HTTP 的进程不成立。非法输入 400；不存在/不适用的成员操作 409；暂时不可完成的变更 503/504，不能以 200 返回“已排队”。

通过 etcd Raft 的配置变更机制实际添加 learner、晋升 voter 和移除 voter，不得只改诊断 JSON、HTTP 路由或启动参数。变更串行化，一次至多一个未完成配置提议，使用库的安全配置语义，不自行改写共识算法。必须满足：

1. learner 能接收日志和快照，但不能投票、参与 quorum 或使没有多数 voter 的分区恢复读写可用。
2. 晋升前取得当前已提交屏障，并确认目标 learner 已追平该边界；离线或落后的 learner 必须在请求预算内返回 503/504，不能提前提交晋升。追平后可用相同请求重试。
3. 成功晋升 4、移除 3 后，voter 为 1、2、4；即使随后停掉 1 和 3，2 与 4 仍须形成多数派完成事务。不得继续按最初三个 ID 计算多数派。
4. 节点 3 一旦应用移除，停止业务服务或返回 410；尚未获知移除的旧副本也必须经 quorum 屏障，不能继续返回陈旧 200。重启不能把已移除节点按旧 CSV 重新加入。
5. 快照传输和整群重启后，成员、learner 身份、configIndex、业务状态和跨类型幂等结果均保持；旧 add/promote/remove 请求重试返回当时结果，不改变当前成员集合。无需实现自动扩容控制器。

## 演示与交付

交付完整 `repo/`、锁定依赖、README、自动化回归测试和 `demo` 启动入口。提供浏览器可打开的工作台或由真实历史生成的 HTML 报告：显示四进程 term/leader/applied/snapshot、voter/learner、配置日志、事务返回和分区恢复时间线。真实演示并发 CAS、旧 leader 隔离、无日志读取、learner 追平/晋升/替换旧 voter、按新 quorum 提交及快照恢复。界面不能自行生成一致性结论。

保留原版所有事务/故障测试，并补充：稳定 term 下至少 64 次读不增加日志；learner 不能补足 quorum；离线 learner 拒绝晋升；在线换节点后按新 quorum 读写；旧配置节点重启不会复活；成员请求跨进程、跨快照重放；ReadIndex 等待中取消和换主不能泄漏或错误复用屏障。说明锁顺序、配置与业务应用的共同边界、取消后的晚到事件及快照版本。测试必须实际运行，不能把库本身正确当作集成已经正确。
