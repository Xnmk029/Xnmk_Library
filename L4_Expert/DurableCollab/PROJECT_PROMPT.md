# y-websocket 检查点恢复、旧客户端隔离与并发压缩 · v2

在随题 `starter.tar` 的真实 y-websocket 仓库上实现可恢复的协同后端。先执行 `tar -xf starter.tar`，在 `repo/` 内开发。基线为 yjs/y-websocket v2.1.0，commit `7c3408a33fc52bd5001d2ff80b38624961402614`，MIT。上游业务源码未改，工具链固定 lib0=0.2.99、TypeScript=4.9.5，出处及差异见 UPSTREAM.json。Node.js 24 可用；可使用原生 `node:sqlite`、Yjs 和 SQLite 事务，不需要 Redis/Docker。可更新依赖，但必须提交锁文件。首次安装可用 `npm ci --ignore-scripts`；不再使用原可选 LevelDB 存储。

沿用并实际修改现有 `bin/server.cjs` / `bin/utils.cjs` 的文档生命周期、同步和持久化路径，保留标准 y-websocket 二进制协议、`src/y-websocket.js` 客户端和公开 exports 的兼容性。不能另写一个完全绕过原服务的 REST 演示，也不能把 Y.Text 改为整段字符串最后写入覆盖。CRDT 合并使用 Yjs，不要求自行实现算法。

## 双进程与协议

启动 `node bin/server.cjs`，环境变量 `HOST=127.0.0.1`、`PORT`、`DB_PATH`、`ROOM_IDLE_MS`（默认 1000）。两个独立服务进程使用同一个本机 SQLite 文件、不同端口，客户端连接 `ws://host:port/<room>?epoch=1`。新 room 的 epoch 为 1，是持久化的文档世代号；下面定义恢复操作时的变化。进程各自有独立 Y.Doc 缓存。通过持久日志增量追赶，健康时远端提交在 2 秒内可见；不能共享 JS 内存，不能依赖浏览器 BroadcastChannel 达成跨服务同步。所有 room 为 1–64 位 ASCII 字母/数字/下划线/连字符，非法 room 返回 400/拒绝升级。双进程同时启动、WAL 恢复或迁移时须正确等待/重试 SQLite 锁，不能在设置 busy handling 前读取版本而随机退出。

支持标准同步 step1/step2/update。服务在广播更新前先持久提交；加载初始状态完成前不能向新连接发出空文档“已同步”的结果。awareness 只要求单进程内兼容和断开清理，不要求跨进程持久化。

增加以下 HTTP API（body 为 JSON）：

* `POST /v1/rooms/<room>/updates`：`{"epoch":1,"updateId":"u1","update":"<base64 Yjs V1 update>"}`。200 返回 `{"epoch":1,"updateId":"u1","seq":1}`，表示原始更新字节已持久提交，进程立即被 kill 后仍可恢复。幂等范围为 `(room,epoch,updateId)`；相同 ID 相同字节返回原 seq，不同字节 409。base64 必须规范、update 必须为有效的 Yjs V1 update；非法输入 400，不能改变日志、seq 或缓存文档。
* `GET /v1/rooms/<room>/state`：返回 `{"epoch":1,"update":"<合并后的V1更新>","text":"<Y.Text('text')>","lastSeq":1,"snapshotSeq":0,"totalUpdates":1}`。来自同一已提交边界；update 必须完整保留未满足依赖的结构和删除集，不能只导出当前可见 text。空 room 返回 epoch=1、合法空更新和零计数。
* `POST /v1/rooms/<room>/compact`：`{"epoch":1}`，200 返回 `{"epoch":1,"snapshotSeq":1}`。snapshotSeq 为这次已持久快照包含的日志上界；不得包含尚未进入快照的更新、跨 room/epoch 删除、删除上界之后的并发更新或删除幂等凭据。空 room 可返回 snapshotSeq=0。
* `GET /v1/rooms/<room>/stats`：`{"epoch":1,"lastSeq":1,"snapshotSeq":1,"totalUpdates":1,"logRows":0,"dedupRows":1}`，均为当前 epoch 的计数，源自数据库。成功压缩在无并发更新时须清除快照已覆盖的原始日志，不能只设置数字，不能永久积累全部原始 payload 冒充压缩。
* `GET /v1/health`：200 JSON 存活检查。

seq 在每个 `(room,epoch)` 内严格递增连续。每次**唯一 HTTP 更新**增加一次 totalUpdates 和 seq；重复 HTTP 更新不增加。标准 WS 携带的有实际内容的更新也记入同一日志/序号，跨进程 tail 不能重新入库。HTTP updateId 相等才视为重复，不同 ID 即便字节相同也分配新 seq。WS 的重复/无效内容允许无副作用地略过。必须区分远端日志应用与本地输入的 origin，避免同步回环。

所有 updates/compact 的 epoch 必填，缺失、非正整数或超出 JSON 精确整数范围返回 400。旧/未来 epoch 返回 409 `{"error":"EPOCH_MISMATCH","epoch":<当前值>}`，在查旧幂等结果或操作缓存前拦截；不得因旧请求曾成功而绕过隔离。WS 的二进制同步协议不变，标准 WebsocketProvider 只增加 URL params；升级时缺失/非法 epoch 返回 HTTP 400，epoch 不匹配返回 HTTP 409。

## 持久检查点、恢复与隔离旧客户端

`POST /v1/rooms/<room>/checkpoints` 接受 `{"epoch":1,"checkpointId":"cp1"}`，在一个已提交边界捕获完整合并更新（包括 pending 内容），200 返回 `{"checkpointId":"cp1","epoch":1,"seq":12}`。checkpointId 为 room 内 1–64 位 ASCII 字母/数字/下划线/连字符，永久指向不可变的内容与元数据；相同 ID 重试返回原结果，不捕获后来状态；此重试仍须通过当前 epoch 检查。检查点跨 epoch、进程和重启保留，不受日志压缩影响。

`POST /v1/rooms/<room>/restore` 接受 `{"requestId":"restore-1","expectedEpoch":1,"checkpointId":"cp1"}`。在同一事务内验证 expectedEpoch、安装该检查点、将 epoch 增加 1、将新 epoch 的 lastSeq/snapshotSeq/totalUpdates 置零、保存恢复幂等结果。200 返回 `{"requestId":"restore-1","epoch":2,"restoredCheckpointId":"cp1","seq":0}`。检查点中的更新成为新 epoch 的初始内容，后续唯一更新从 seq=1 开始；恢复不是普通 CRDT 合并，允许有意撤销检查点之后的修改。

restore requestId 在 room 内跨 epoch 永久幂等。对已成功的 ID，先核对请求内容再返回原始结果，不能因 expectedEpoch 已过期而再次恢复或拒绝合法重试；异内容 409 `{"error":"REQUEST_CONFLICT"}`。未知 ID 的 expectedEpoch 不匹配返回 409 EPOCH_MISMATCH，检查点不存在 404，非法输入 400，均不改变状态。临时失败不占用 requestId。两个不同 ID 同时以同一个 expectedEpoch 恢复，必须恰好一个成功，另一个 EPOCH_MISMATCH；不能各自读旧值后连续推进两个 epoch。

恢复提交后还必须满足：

1. 所有旧 epoch HTTP 更新立即被拒绝；来自另一进程的旧 WS 连接在 2 秒内以 close code **4009** 关闭并清理 awareness。每次 WS 写入必须在提交事务内复核连接 epoch，不能仅在升级时检查。
2. 旧离线客户端重连不能把被撤销的修改自动合并回新 epoch；旧 URL 拒绝升级。演示客户端发现恢复后应明确提示，并使用**全新 Y.Doc** 连接新 epoch；不能把旧 doc 清空后当普通删除操作上传。
3. 远端 tail、缓存刷新、初始化、room 回收、压缩都要携带 epoch。旧加载/回收/压缩任务晚到不能覆盖新 doc、清掉新日志或使 epoch 倒退。所有读响应的内容、水位和 epoch 必须来自同一数据库边界。
4. 同一 updateId 可在新 epoch 重新使用并获得新 seq；旧 epoch 的去重凭据不能误伤新请求。恢复 requestId 和检查点本身必须跨 epoch 保留。

## 恢复与并发边界

压缩、写入、远端追赶、room 淘汰都可能并发；两个进程可同时压缩同一个 room。单调水位和快照发布须有事务或等价并发控制。压缩后的重启必须恢复全部已确认更新及去重凭据。room 最后连接断开 ROOM_IDLE_MS 后应释放文档缓存与相关定时器；HTTP 操作不能复用正在销毁的文档，新连接与旧回收任务竞态不能销毁新的 room。加载失败不得用空状态覆盖原数据。

必须正确处理：同一离线客户端连续生成更新 U1、U2，服务先收到 U2，在 U1 尚未到达时压缩或创建检查点，终止重启或恢复到该检查点，之后在当前 epoch 收到 U1，最终结果与独立 Yjs 合并真值相同；delete set 先于其目标结构到达也如此。合法 Yjs 编码 API 可以使用，判据是原始依赖内容是否完整保留。

实现三个确定性故障点，默认关闭：环境变量 `BENCH_FAILPOINT` 为 `update-before-commit`、`update-after-commit` 或 `compact-before-commit`，`BENCH_MARKER` 为文件路径。仅对 HTTP 更新/压缩触发；到达对应边界后写入 marker 并暂停当前操作，直到进程被终止（不要继续响应）。before-commit 必须在数据真正提交前，after-commit 必须在数据提交后但 HTTP 返回前，compact-before-commit 必须在新快照和日志删除的事务提交前。其他进程仍可运行；不得为测试预写成功结果。验收将 kill 该进程后，借另一进程或重启检查提交边界。

本版新增 `restore-before-commit`、`restore-after-commit`，同样写 marker 后暂停并等待 kill，分别验证整个恢复事务回滚及“提交成功但响应未知”的永久重试。

另新增可释放的 `compact-after-read`：压缩器读完 `(epoch,seq,完整输入)` 后、发布快照前写 marker，异步等待 `BENCH_RELEASE` 指定文件出现，不能持有阻止另一进程恢复的写事务。等待期间另一进程恢复使 epoch 改变，释放后该压缩请求必须返回 409 EPOCH_MISMATCH，丢弃旧快照，不得删除任何新 epoch 日志。故障点只能控制时序，不能绕过正常数据库逻辑。

## 演示与交付

交付完整修改仓库、依赖 lockfile、迁移/启动说明、自动化测试和浏览器演示入口。演示两个不同服务端口的编辑窗口，显示实际 text、epoch、seq/snapshot 水位及时间线；先演示正常离线收敛，再创建检查点、继续编辑并恢复，展示旧连接被关闭、旧离线修改被拒绝、新 doc 读取恢复结果。提供压缩竞态、恢复响应丢失和重启检查脚本。页面状态必须来自真实客户端与 API。

保留原有同步/压缩/故障测试并按 epoch 契约升级，新增：并发恢复只有一个赢家；相同恢复 ID 在新 epoch 仍返回原结果；旧 socket 和离线 doc 不能复活撤销内容；旧压缩器在新 epoch 写入之后才释放；含 pending structs/delete sets 的检查点恢复；恢复提交前后强杀；新 epoch 重用 updateId；反复同时重启和初始化失败保护。README 解释恢复的线性化点、epoch 事务检查、缓存/连接隔离及旧任务取消。用标准客户端和独立 Yjs 实例验证，不把接口返回 200 当作内容正确的证明。
