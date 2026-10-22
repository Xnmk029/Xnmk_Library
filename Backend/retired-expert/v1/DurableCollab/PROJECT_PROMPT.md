# y-websocket 双进程持久协同与无损压缩

在随题 `starter.tar` 的真实 y-websocket 仓库上实现可恢复的协同后端。先执行 `tar -xf starter.tar`，在 `repo/` 内开发。基线为 yjs/y-websocket v2.1.0，commit `7c3408a33fc52bd5001d2ff80b38624961402614`，MIT。源码与 lockfile 原样保留，出处见 UPSTREAM.json。Node.js 24 可用；可使用原生 `node:sqlite`、Yjs 和 SQLite 事务，不需要 Redis/Docker。可更新依赖，但必须提交锁文件。首次安装可用 `npm ci --ignore-scripts`；不再使用原可选 LevelDB 存储。

沿用并实际修改现有 `bin/server.cjs` / `bin/utils.cjs` 的文档生命周期、同步和持久化路径，保留标准 y-websocket 二进制协议、`src/y-websocket.js` 客户端和公开 exports 的兼容性。不能另写一个完全绕过原服务的 REST 演示，也不能把 Y.Text 改为整段字符串最后写入覆盖。CRDT 合并使用 Yjs，不要求自行实现算法。

## 双进程与协议

启动 `node bin/server.cjs`，环境变量 `HOST=127.0.0.1`、`PORT`、`DB_PATH`、`ROOM_IDLE_MS`（默认 1000）。两个独立服务进程使用同一个本机 SQLite 文件、不同端口，客户端可连接任一进程的 `ws://host:port/<room>`。进程各自有独立 Y.Doc 缓存。通过持久日志增量追赶，健康时远端提交在 2 秒内可见；不能共享 JS 内存，不能依赖浏览器 BroadcastChannel 达成跨服务同步。所有 room 为 1–64 位 ASCII 字母/数字/下划线/连字符，非法 room 返回 400/拒绝升级。

支持标准同步 step1/step2/update。服务在广播更新前先持久提交；加载初始状态完成前不能向新连接发出空文档“已同步”的结果。awareness 只要求单进程内兼容和断开清理，不要求跨进程持久化。

增加以下 HTTP API（body 为 JSON）：

* `POST /v1/rooms/<room>/updates`：`{"updateId":"u1","update":"<base64 Yjs V1 update>"}`。200 返回 `{"updateId":"u1","seq":1}`，表示原始更新字节已持久提交，进程立即被 kill 后仍可恢复。updateId 每 room 永久唯一；相同 ID 相同字节返回原 seq，不同字节 409。base64 必须规范、update 必须为有效的 Yjs V1 update；非法输入 400，不能改变日志、seq 或缓存文档。
* `GET /v1/rooms/<room>/state`：返回 `{"update":"<合并后的V1更新>","text":"<Y.Text('text')>","lastSeq":1,"snapshotSeq":0,"totalUpdates":1}`。来自同一已提交边界；update 必须完整保留未满足依赖的结构和删除集，不能只导出当前可见 text。空 room 返回合法空更新和零计数。
* `POST /v1/rooms/<room>/compact`：安全压缩，200 返回 `{"snapshotSeq":1}`。snapshotSeq 为这次已持久快照包含的日志上界；不得包含尚未进入快照的更新、跨 room 删除、删除上界之后的并发更新或删除幂等凭据。空 room 可返回 0。
* `GET /v1/rooms/<room>/stats`：`{"lastSeq":1,"snapshotSeq":1,"totalUpdates":1,"logRows":0,"dedupRows":1}`。计数须源自数据库。成功压缩在无并发更新时必须清除快照已覆盖的原始日志，不能只设置数字，不能永久积累全部原始 payload 冒充压缩。
* `GET /v1/health`：200 JSON 存活检查。

seq 为每 room 严格递增连续序号。每次**唯一 HTTP 更新**增加一次 totalUpdates 和 seq；重复 HTTP 更新不增加。标准 WS 携带的有实际内容的更新也记入同一日志/序号，跨进程 tail 不能重新入库。HTTP updateId 相等才视为重复，不同 ID 即便字节相同也分配新 seq。WS 的重复/无效内容允许无副作用地略过。必须区分远端日志应用与本地输入的 origin，避免同步回环。

## 恢复与并发边界

压缩、写入、远端追赶、room 淘汰都可能并发；两个进程可同时压缩同一个 room。单调水位和快照发布须有事务或等价并发控制。压缩后的重启必须恢复全部已确认更新及去重凭据。room 最后连接断开 ROOM_IDLE_MS 后应释放文档缓存与相关定时器；HTTP 操作不能复用正在销毁的文档，新连接与旧回收任务竞态不能销毁新的 room。加载失败不得用空状态覆盖原数据。

必须正确处理：同一离线客户端连续生成更新 U1、U2，服务先收到 U2，在 U1 尚未到达时压缩、终止、重启，之后收到 U1，最终结果与独立 Yjs 合并真值相同；delete set 先于其目标结构到达也如此。不可用 `encodeStateAsUpdate(当前Y.Doc)` 丢掉尚未可见的依赖内容。

实现三个确定性故障点，默认关闭：环境变量 `BENCH_FAILPOINT` 为 `update-before-commit`、`update-after-commit` 或 `compact-before-commit`，`BENCH_MARKER` 为文件路径。仅对 HTTP 更新/压缩触发；到达对应边界后写入 marker 并暂停当前操作，直到进程被终止（不要继续响应）。before-commit 必须在数据真正提交前，after-commit 必须在数据提交后但 HTTP 返回前，compact-before-commit 必须在新快照和日志删除的事务提交前。其他进程仍可运行；不得为测试预写成功结果。验收将 kill 该进程后，借另一进程或重启检查提交边界。

## 演示与交付

交付完整修改仓库、依赖 lockfile、迁移/启动说明、自动化测试和浏览器演示入口。演示两个不同服务端口的编辑窗口，显示各自连接状态、实际 text、seq/snapshot 水位及操作时间线；断开两边网络后各自编辑，再连接回不同进程，观察内容收敛。提供执行压缩、重启后检查的脚本或按钮。页面状态必须来自真实客户端与 API。

测试至少包含：跨进程 WS 同步、离线并发编辑收敛、HTTP 并发去重与异内容冲突、压缩期间多写者、未满足依赖/删除集压缩恢复、三个故障点、room 回收重连和跨 room 隔离。README 解释 durability ack、快照事务边界、tail 水位、重复更新和 room 生命周期。用标准客户端和独立 Yjs 实例验证，不把接口返回 200 当作内容正确的证明。
