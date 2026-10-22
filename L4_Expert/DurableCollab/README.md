# 持久协同、检查点恢复与 epoch 隔离 · L4 v2

基于 [yjs/y-websocket](https://github.com/yjs/y-websocket/tree/7c3408a33fc52bd5001d2ff80b38624961402614) 的仓库演进题。commit `7c3408a33fc52bd5001d2ff80b38624961402614`，MIT。保留原协议和客户端，扩展真实服务的持久化与生命周期。

[正式题面](PROJECT_PROMPT.md) · [来源](UPSTREAM.json) · [冻结输入清单](STARTER_LOCK.json) · [v2 强化与反例验证](../../Backend/EXPERT_V2.md) · [v1 历史试测](../../Backend/EXPERT_UPGRADE_REPORT.md)

两个独立进程各自维护 Y.Doc，共享 SQLite 持久日志；要求跨服务同步、提交确认、快照压缩与 room 淘汰保持一致。Yjs 负责 CRDT，考核服务工程中的加载、提交、广播、追赶和回收次序。

v2 加入不可变检查点和恢复事务。恢复增加 epoch，关闭旧连接并拒绝旧离线文档；旧压缩器在恢复之后才完成时，不能发布旧快照或删除新日志。恢复自身也要在响应丢失和进程强杀后保持永久幂等。原有同步、压缩和并发启动缺陷仍在考核范围。

| 必须验证的边界 | 可观察证据 |
|---|---|
| 跨进程同步 | 标准客户端关闭 BroadcastChannel 后仍收敛 |
| 离线并发编辑 | 与独立 Yjs 合并真值一致 |
| 双写者、双压缩器 | 日志清理后数据完整且幂等记录仍有效 |
| 乱序依赖与删除集 | 后续更新先到，压缩重启后补齐前序仍完整 |
| 三个确定性 kill 点 | 提交前无新结果，提交后重试返回同一 seq |
| room 回收竞态 | 快速断开重连不丢状态、不串 room |
| 检查点恢复 | 旧操作不回灌；新的 Y.Doc 读取恢复后的内容 |
| epoch 隔离 | 旧 HTTP 返回 409，旧 socket 以 4009 关闭 |
| 跨恢复的压缩竞态 | 释放旧压缩器后，新 epoch 日志仍完整，重启不丢失 |
| 恢复幂等 | 两个并发恢复恰好一个成功，响应丢失后重试不再推进 epoch |

输入包只包含公开上游源码、许可证、依赖锁和出处；未含评分器、参考答案或历史提交。工具链将 lib0 固定为 0.2.99、TypeScript 固定为 4.9.5，原业务源码不变，基线 `npm test` 通过。`npm ci --ignore-scripts` 避免构建本题不用的可选原生 LevelDB。

题面关于快照的约束是**不能丢失 pending structs / delete sets**，不禁止合法的 Yjs 编码 API。锁定版本的 `encodeStateAsUpdate` 实测可以保留 pending 内容；独立反例使用“只保存可见 text 并重建文档”的错误压缩器，不能因为函数名称就判错。

硬预算仍为 1800 秒。v1 的 17:37、12/15 是历史证据，不能作为 v2 成绩。v2 已实现新增契约的验收脚本并使用旧交付做反例；尚未生成完整 v2 答卷或校准所有新增分支。

```powershell
node Backend/tools/expert-v2-evaluate.mjs DurableCollab <提交的repo绝对路径> <新的证据目录>
```

验收使用冻结的上游标准客户端与独立 Yjs 真值，关闭 BroadcastChannel；候选提交只在证据目录副本执行。新增 gate 不是完整替代 v1 覆盖矩阵：旧 HTTP/WS 回归须按新增的必填 epoch 更新，原 `expert-evaluate.mjs` 不可不经修改就当作 v2 协同题总评分器。
