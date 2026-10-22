# 双进程持久协同与无损压缩 · L4

基于 [yjs/y-websocket](https://github.com/yjs/y-websocket/tree/7c3408a33fc52bd5001d2ff80b38624961402614) 的仓库演进题。commit `7c3408a33fc52bd5001d2ff80b38624961402614`，MIT。保留原协议和客户端，扩展真实服务的持久化与生命周期。

[正式题面](PROJECT_PROMPT.md) · [来源](UPSTREAM.json) · [冻结输入清单](STARTER_LOCK.json) · [本次试测](../../Backend/EXPERT_UPGRADE_REPORT.md)

两个独立进程各自维护 Y.Doc，共享 SQLite 持久日志；要求跨服务同步、提交确认、快照压缩与 room 淘汰保持一致。Yjs 负责 CRDT，考核服务工程中的加载、提交、广播、追赶和回收次序。

| 必须验证的边界 | 可观察证据 |
|---|---|
| 跨进程同步 | 标准客户端关闭 BroadcastChannel 后仍收敛 |
| 离线并发编辑 | 与独立 Yjs 合并真值一致 |
| 双写者、双压缩器 | 日志清理后数据完整且幂等记录仍有效 |
| 乱序依赖与删除集 | 后续更新先到，压缩重启后补齐前序仍完整 |
| 三个确定性 kill 点 | 提交前无新结果，提交后重试返回同一 seq |
| room 回收竞态 | 快速断开重连不丢状态、不串 room |

输入包只包含公开上游源码、许可证、依赖锁和出处；未含评分器、参考答案或历史提交。工具链将 lib0 固定为 0.2.99、TypeScript 固定为 4.9.5，原业务源码不变，基线 `npm test` 通过。`npm ci --ignore-scripts` 避免构建本题不用的可选原生 LevelDB。

题面关于快照的约束是**不能丢失 pending structs / delete sets**，不禁止合法的 Yjs 编码 API。锁定版本的 `encodeStateAsUpdate` 实测可以保留 pending 内容；独立反例使用“只保存可见 text 并重建文档”的错误压缩器，不能因为函数名称就判错。

硬预算为 1800 秒；准备、生成和独立验收分开记录。不沿用旧 L4 的 480 秒换题阈值。当前为工程试测，不能据单次结果声称多模型难度校准完成。

```powershell
node Backend/tools/expert-evaluate.mjs DurableCollab <提交的repo绝对路径> <新的证据目录>
```

验收使用冻结的上游标准客户端与独立 Yjs 真值，评分时关闭 BroadcastChannel；候选提交只在证据目录副本执行。SQLite 的 WAL/SHM 文件与进程日志保留在验收证据中。
