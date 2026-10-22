# 三节点 Raft 条件事务与故障恢复工作台

把随题 `starter.tar` 中的 etcd `contrib/raftexample` 改造成可用的三节点条件事务服务。先在当前目录执行 `tar -xf starter.tar`，在解出的 `repo/` 中继续开发。源码来自 etcd v3.5.17，commit `507c0de87bd5034e3de4ab76ebf96b54dae0cd52`，Apache-2.0；`UPSTREAM.json` 给出出处和原文件哈希。已将原 monorepo 的模块依赖改为独立 go.mod/go.sum，原业务源码和测试未修改。

这是现有仓库的演进任务。沿用 etcd Raft、rafthttp、WAL 和快照路径，修改状态机、HTTP 与必要的 Raft 集成。禁止以单机数据库、共享状态文件、固定主节点或请求转发器替代共识；不得修改依赖里的 Raft 算法。保留原示例 API 的可用性与原测试；旧 PUT 也必须在提交并应用后才返回成功。

## 启动与持久化

在 `repo/` 中 `go build -o rafttxn .`。保留 `--id`、`--cluster`、`--port`，新增 `--data-dir`（每节点独占）、`--snap-count`（默认 10000，可设为 8）、`--request-timeout`（默认 1500ms）。同一二进制运行三个独立进程，peer URL 和 HTTP 端口各不相同；重启复用原 data-dir。所有整数限制在 JSON 精确整数范围。

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

`GET /v1/kv?key=a` 返回 `{"key":"a","value":"one","modRevision":1,"revision":1}`，缺失/墓碑也返回 200。所有成功读取必须线性一致：使用 ReadIndex 并等待本地应用到屏障索引，或提交等价的日志屏障。仅凭自认为 leader、缓存 term 或本地 map 不成立。健康多数派上的任意节点应可在 5 秒内完成操作；落后节点可以短暂拒绝服务。无多数派、孤立旧 leader 上的读写必须在配置超时加 1 秒内返回 503/504，不得返回过期成功。

`GET /v1/status` 为允许陈旧的诊断接口，至少返回 `id, leaderId, term, appliedIndex, snapshotIndex, revision`。appliedIndex 必须代表状态机已应用的位置。快照应同时包含 KV、墓碑、revision 和完整幂等结果；快照边界、apply 通知和恢复顺序必须一致。进程被强制结束后，已确认数据和幂等结果不能丢失。落后节点在日志压缩后仍能通过真实快照传输追平。

增加仅用于本地演练的 `POST /v1/debug/partition`，请求 `{"blockedPeerIds":[2,3]}` 全量替换本节点阻断列表；空数组恢复。阻断必须作用于真实 Raft peer 网络收发（含已建立的流），不能只影响业务 HTTP 或诊断状态。验收会在各侧同时配置，以隔离原 leader；客户端 HTTP 始终可访问。不要求动态成员变更的新 API。

## 演示与交付

交付完整 `repo/`、锁定依赖、README、自动化回归测试和 `demo` 启动入口。提供浏览器可打开的工作台或由真实历史生成的 HTML 报告：显示三节点 term/leader/applied/snapshot、事务返回与超时、分区及恢复时间线。用真实进程和响应演示：并发 CAS 只成功一次 → 隔离旧 leader → 多数派继续提交且少数派拒读写 → 恢复追平 → 杀进程并重启 → 从压缩后的快照恢复。界面不能自行生成一致性结论。

测试至少覆盖：竞争 CAS、多 key 原子性、失败结果去重、同 ID 异内容、删除 ABA、无 quorum 读、提交后立即终止、快照后旧 ID 重试，以及落后节点安装快照。说明设计中的等待者取消、超时与日志稍后提交、锁顺序、快照版本和恢复边界。测试用例与记录必须来自实际运行，不能把成功启动等同完成故障验证。
