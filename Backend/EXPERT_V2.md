# L4 v2：在线成员演进与跨恢复隔离

本次按“再加强题目”的要求，继续提高现有两道 L4 的正确性边界。题库仍是 **8 个有效任务、每级 2 题**；L1–L3 题面未修改，上游仓库、commit、依赖输入包及许可证不变。按后续用户修正，L4 的 **1800 秒**改为软计分阈值，超时持续运行并扣分；计分与历史硬截止证据的处理见 [RUN_PROTOCOL.md](RUN_PROTOCOL.md)。

## 新增了什么

| 题目 | v1 已考核 | v2 新增的必要能力 | 直接可见的演示 |
|---|---|---|---|
| [B07 · Raft](../L4_Expert/RaftTxnWorkbench/PROJECT_PROMPT.md) | 原子条件事务、幂等、分区、WAL/快照 | ReadIndex 无日志读取；learner 添加/追平/晋升；移除旧 voter；按新 quorum 工作；配置与幂等一起恢复 | 64 次读取而 appliedIndex 不增；第四节点先当 learner，换掉旧节点后仍可提交 |
| [B08 · 协同恢复](../L4_Expert/DurableCollab/PROJECT_PROMPT.md) | 双进程同步、压缩、乱序依赖和 kill 恢复 | 不可变检查点；原子恢复与永久恢复幂等；epoch 隔离旧 HTTP/WS/离线文档；旧压缩器晚到不能覆盖新数据 | 恢复到检查点，旧窗口以 4009 断开；旧离线内容被拒绝；释放旧压缩器后新内容重启仍在 |

两题集中加强已有架构中的协调问题，不增加额外数据库、外部服务或页面数量。

## 为什么比上一版难

B07 的 v1 允许把每次读取变成一次日志提议，能够复用事务提交通路。v2 要求真正处理 ReadIndex/ReadState、应用屏障、请求取消与 leader 更替；稳定 term 的读不能写日志。再加入真实在线配置变更后，quorum、快照 ConfState、learner 资格和业务状态必须遵循同一应用顺序。把成员列表改成 JSON 或按初始三个 ID 计算多数派都会失败。

B08 的 v1 可以把持久状态当作永远向前合并的 CRDT 更新。v2 的恢复会有意撤销检查点后的内容，因此不能继续无条件合并所有旧客户端输入。恢复必须在一个事务中切换 epoch、安装检查点并保存操作结果；连接、异步加载、去重、压缩和缓存回收都要识别旧 epoch。最关键的竞态是：旧压缩器先读数据 → 另一进程恢复并写入新数据 → 释放旧压缩器；旧任务必须返回冲突而不破坏新状态。

公开契约明确了 HTTP 状态码、ID 命名空间、同 ID 重试顺序、序号重置、旧 socket 的关闭码、临时失败及可释放故障点，减少依赖评审者临场解释的空间。

## 本轮验证

<!-- EXPERT-V2-CONTROLS:START -->

判定器/快照检查 **8/8 通过**，见 [ORACLE_TESTS.tap](pilots/20261016-v2/ORACLE_TESTS.tap)。旧交付回放实际检出了以下新增门槛：

| 旧交付 | 自动检出的不满足项 | 后续未执行场景 | 证据 |
|---|---|---:|---|
| Raft v1 | 64 次读使 appliedIndex 从 5 增至 69；缺少成员 API | 5 项 BLOCKED | [回放](pilots/20261016-v2/previous-v1-final/RaftTxnWorkbench/CHECKS.json) |
| 协同 v1 | 无 epoch；缺失 epoch 的写入仍成功；无检查点 API | 8 项 BLOCKED | [回放](pilots/20261016-v2/previous-v1-final/DurableCollab/CHECKS.json) |

Raft 旧实现仍通过“丢失 quorum 后不能复用旧屏障”的检查；被淘汰的原因是新增能力不足，不是把其原有正确性判错。后续配置迁移/恢复场景因前置 API 缺失没有实际运行，不能按失败数量夸大区分度。这里的 FAIL 是预期的旧版本负对照结果，不是新模型成绩。

[机读记录](pilots/20261016-v2/RESULTS.json) 包含题面版本、证据哈希与验证范围；执行时的 GRADER.mjs/HARNESS.mjs 快照与原始请求响应同目录保留。

<!-- EXPERT-V2-CONTROLS:END -->

新增执行入口为 [expert-v2-evaluate.mjs](tools/expert-v2-evaluate.mjs)，运行时只复制普通源码和必要小型资产，在独立副本启动真实服务，保留请求、响应、进程、判题器快照及哈希，并核对原始源码未变。`BLOCKED` 表示前置能力不满足而没有运行的场景；它不是独立失败或通过。反例使用旧交付，既不交给新受测模型，也不当作 v2 参考解。

**验证范围：**本轮完成题面、可执行新增 gate、判定器单元检查及旧交付负对照。尚未生成新的完整 v2 答卷，未测 v2 完成时间；尚未用合格的 v2 实现端到端跑通所有新增分支，也未完成多模型难度校准。旧版 20:50 / 17:37、19/19 / 12/15 保留为历史数据，不挂到新版。

新增 gate 不等同完整回归：B07 需同时通过原事务/故障矩阵；B08 原同步/持久化/压缩矩阵须按必填 epoch 更新后执行，原 v1 协同评分器不可直接算新版总分。两个题面都要求答卷交付自己的完整回归与故障脚本，后续完整试测仍应独立验证。

## 派发与历史

新派发只含 v2 PROMPT.md 与原冻结 starter.tar；不携带旧答案、补丁或验收脚本。现行题面与输入哈希见 [BANK.json](BANK.json) 和项目 PROMPT_REGISTRY.json。新模型会话须使用新标签，方法见 [RUN_PROTOCOL.md](RUN_PROTOCOL.md)。

v1 原题面与输入完整冻结于 [Raft v1](retired-expert/v1/RaftTxnWorkbench/PROJECT_PROMPT.md) 和 [协同 v1](retired-expert/v1/DurableCollab/PROJECT_PROMPT.md)，原 registry 快照见 [previous-BANK.json](pilots/20261016-v2/previous-BANK.json)。v1 时长与失败记录仍见 [历史试测报告](EXPERT_UPGRADE_REPORT.md)。
