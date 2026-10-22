> v1 历史报告：当前 L4 已强化为 v2，现行题面及新增门槛见 [EXPERT_V2.md](EXPERT_V2.md)。本页保留当时的用时、成绩与失败记录。

# L4 仓库题升级与试测 · 2026-10-16

两道原 L4 被替换：LedgerAudit → RaftTxnWorkbench；InventoryTransactions → DurableCollab。原因是用户要求提高专家难度，原题聚焦单机事务，与 L3 的差距不足。有效题库仍为 8 题、每级 2 题；L1–L3 的题面、旧成绩和来源保持原样。

## 选题与难度边界

| ID | 新题与上游 | 需要处理的工程问题 | 观众看到的结果 |
|---|---|---|---|
| B07 | [etcd raftexample](https://github.com/etcd-io/etcd/tree/507c0de87bd5034e3de4ab76ebf96b54dae0cd52/contrib/raftexample) | 提交/应用屏障、线性一致读、确定性原子 CAS、永久幂等、墓碑、WAL 与快照、真实分区 | 三节点角色和日志水位、少数派拒绝操作、恢复后追平 |
| B08 | [y-websocket](https://github.com/yjs/y-websocket/tree/7c3408a33fc52bd5001d2ff80b38624961402614) | 双进程日志追赶、先持久后广播、并发压缩、乱序依赖、确定性 kill 边界、room 生命周期 | 双端离线编辑后收敛、日志压缩和重启恢复 |

使用成熟共识库/CRDT 是题目约定。难点是把 HTTP、状态机、网络、持久化、快照与生命周期组合正确，不能仅调用一个库后用 UI 模拟故障。两个题目都要求修改并保持真实仓库的兼容路径。

## 冻结输入与环境验证

公开源码和许可证随 `starter.tar` 交付，经 `PROMPT_REGISTRY.json` 派发；每题有 UPSTREAM.json、STARTER_LOCK.json、commit 和逐文件 SHA-256。输入包不包含判题器、参考解和历史答案。Raft 保留原 10 个示例源文件/文档并添加独立 go.mod/go.sum；Yjs 保留业务源码，工具链固定 lib0=0.2.99、TypeScript=4.9.5，并更新 lockfile。

环境：Windows，Node v24.15.0，Go 1.23.12 windows/amd64。Go 在独立工具目录部署，不改变系统全局配置。默认 Go 模块源不可达，本次使用 goproxy.cn 并保持模块 checksum 校验。安装与原始上游探针在模型计时前完成，受测方自己的安装与自测仍包含在生成时间内。

[环境 CHECKS.json](pilots/20261016/environment/CHECKS.json) 共 13 项通过：两包哈希、Go 测试编译、7 个上游测试逐例独立进程执行、y-websocket 原 standard/tsc 检查、两类有损快照负对照。Go 原测试在 Windows 单进程共用固定 WAL 目录会发生清理竞态，故保留源码、逐例使用全新 cwd，未将此上游环境问题判成模型错误。

负对照最初误假设 `Y.encodeStateAsUpdate` 会丢 pending 内容，实测该锁定版本会保留；判题已修正为与独立 Yjs 合并真值比较，错误实现使用“仅保存可见 text”。题面约束是不能丢数据，不按所选编码函数名称判错。

## 生成与计时

本次改为每题 1800 秒硬上限，最多并行 2 个独立 CLI 会话；取消旧 480 秒自动换题条件。保留正常结束、超时、功能失败及环境失败，未通过不能记为“完成”。旧 20261015 八题成绩已冻结，不能移作新 L4 的证据。

首轮 `backend-expert-20261016` 使用 workspace-write CLI，Windows 沙箱拒绝依赖下载和用户缓存读取；在确认 EACCES 后由编排终止，保留 stdout/stderr/execution，不用于能力/完成时长统计。实际重测使用新标签 `backend-expert-open-20261016` 和全新会话，full-access CLI。OS 级隔离仍为 **unverified**；题面/输入哈希、外部 cwd 与 transcript 审查不能替代系统访问控制。因此该轮只作工程试测，不用于正式隔离排名。

<!-- EXPERT-PILOT:START -->

实际模型（运行时证据）：gpt-6-astra。完成时间包含模型安装、自测和工具等待，不含环境预检和独立评分。

| ID | 题目 | 生成会话耗时 | 会话状态 | 独立检查 | 完成判定 | 证据 |
|---|---|---:|---|---:|---|---|
| B07 | RaftTxnWorkbench | 20:50 | completed | 19/19 | 独立工程检查通过 | [检查](pilots/20261016/RaftTxnWorkbench/CHECKS.json) · [源码](pilots/20261016/submissions/RaftTxnWorkbench/repo/README.md) · [补丁](pilots/20261016/submissions/RaftTxnWorkbench/changes.patch) |
| B08 | DurableCollab | 17:37 | completed | 12/15 | 未达到全部完成 | [检查](pilots/20261016/DurableCollab-isolated-checks/CHECKS.json) · [源码](pilots/20261016/submissions/DurableCollab/repo/README.md) · [补丁](pilots/20261016/submissions/DurableCollab/changes.patch) |

- B08：two independent processes share a durable database。具体断言与原始响应见该题 CHECKS.json。
- B08：delete set before structure survives compaction and restart。具体断言与原始响应见该题 CHECKS.json。
- B08：parallel writers and two compactors preserve full update set。具体断言与原始响应见该题 CHECKS.json。

[机读结果](pilots/20261016/results.json)。源码为原始试测提交的归档，未人工补齐功能，不能当作参考解；生成会话结束不等于通过。报告与源码哈希、模型 usage、退出原因见机读结果。

<!-- EXPERT-PILOT:END -->

## 验收覆盖与局限

`Backend/tools/expert-evaluate.mjs` 在独立副本执行，结束核对原始提交哈希不变。Raft 验收包括原上游回归、并发 CAS、原子多 key、重复/冲突 ID、失败结果、墓碑、真实旧 leader 分区、多数派推进、响应后 kill、快照及无 quorum。extended 模式让一个节点离线超过原库 10000 条日志保留窗口，再验证恢复数据和上游 snapshot receive/restore 日志，避免把本地生成快照当作网络安装证据。

Yjs 使用冻结的标准客户端，禁用 BroadcastChannel，独立 Yjs 实例计算合并真值；检查跨进程 WS、离线编辑、并发去重、双压缩器、pending updates/delete sets、三个 kill 点、非法输入和 room 回收。状态与计数通过 API 观察，完整数据库审计、内存泄漏、恶意客户端安全和更大规模压力仍需扩展；截图不代替协议正确性或人工视觉评审。

压缩检查额外使用只读 SQLite 连接核验 integrity_check、实际表结构与原始 payload 回收情况，保存 DB_AUDIT.json；此探针仍不是全库形式化审计。Raft 的多客户端读写历史单独保存，并检查读取不能早于已完成写入的 revision。

本次另修正通用 transcript 审阅器的路径前缀误报：`F:\benchmark-tools` 是同级工具目录，不是 `F:\benchmark` 的子目录；JSON 中 `modRevision\"` 的后缀也不是 `Vision\` 目录。六组回归测试验证兄弟目录/标识符不触发，真实题库根/子路径、级别路径和禁入目录仍触发。原误判报告保留在 harness 的 before-path-fix 文件中。只修正路径边界，不放宽实际题库访问记录；全盘隔离仍为 unverified。

仓库审阅与副本执行只扫描源码、公开输入和必要小型资产，排除安装依赖、WAL/数据库/快照和大于 8 MiB 的运行文件；PROMPT.md 与本次不足 200 KiB 的 starter.tar 仍全量核对。通用 reviewer 新增可选 inventory/deliverable 回调，默认行为保持不变；专门回归测试确认排除 WAL 不会放过题面篡改。静态 D4 误报还包括浏览器 bundle 内的 lib0/Yjs 原有 TODO 注释，已按来源区段复核，保留原机器结论与理由，不视为自写业务占位符。

协同题原独立回放为 8/15：一个进程在并发重启时以 `SQLITE_BUSY_RECOVERY`（errcode 261）退出，后续存在连带失败。后续诊断保留了未完成回放以及一次依赖安装超时，均不作为新模型成绩。最终 12/15 回放复用**相同 package-lock** 的已安装依赖，在失败项结束后顺序恢复已退出服务，再验证其余检查；未修改模型源码。三处同时启动/重启仍失败，三个提交 kill 点、并发去重、标准 WS、离线合并和 room 重连均通过。不能将其解释为七个独立协议缺陷，也不能把恢复测试环境后的通过抹去原启动缺陷。

Raft 的 19 项独立检查全部通过，extended 实际提交 10,368 个新事务；落后节点离线时 appliedIndex=160，收到 index=10,456 的快照并恢复原幂等结果。主回放原截图只打开 API 根路径，另存 VISUAL.json 与 visual-report.png 核验了真正的历史 HTML 报告，原截图保留。视觉复核仍只确认实际报告可渲染，不替代正确性检查。

单次默认模型样本用于观察实际工作量与发现失效边界，不能据一次成功或失败推出跨模型 L4 区分度。若新题生成较快但核心安全检查未通过，应报告该失败，而非按“生成结束”当作正确完成。若确有不必要的环境/样板耗时，优化基础包后重新冻结版本与重测，不以缩掉安全边界换速度。

## 历史与复现

旧题在 [retired/LedgerAudit](retired/LedgerAudit/PROJECT_PROMPT.md) 和 [retired/InventoryTransactions](retired/InventoryTransactions/PROJECT_PROMPT.md)，原题面哈希不变。旧 registry 快照位于 [20261015/BANK.snapshot.json](pilots/20261015/BANK.snapshot.json)，旧源码与成绩仍见 [PILOT_REPORT.md](PILOT_REPORT.md)。本次归档理由单独登记，避免误记为超时换题。

按 [RUN_PROTOCOL.md](RUN_PROTOCOL.md) 组卷和验收。新题的原始源码、输入包、CLI 会话证据和独立检查分别存档；不得用会压平路径的通用 collector 收卷真实仓库。
