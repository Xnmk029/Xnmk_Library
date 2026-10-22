# Raft 条件事务与分区恢复 · L4

基于 [etcd/etcd](https://github.com/etcd-io/etcd/tree/507c0de87bd5034e3de4ab76ebf96b54dae0cd52/contrib/raftexample) 的真实仓库演进题。冻结 commit 为 `507c0de87bd5034e3de4ab76ebf96b54dae0cd52`，Apache-2.0。只提取原示例及其测试，增加独立模块声明，不要求下载整个 etcd monorepo。

[正式题面](PROJECT_PROMPT.md) · [来源与原文件哈希](UPSTREAM.json) · [输入包与锁定清单](STARTER_LOCK.json) · [本次试测](../../Backend/EXPERT_UPGRADE_REPORT.md)

从原示例的乐观 PUT 和本地 GET，演进到真实三进程共识服务。重点是提交与应用的区别、线性一致读的屏障、确定性条件事务、永久幂等、墓碑和一致的快照边界。允许成熟 Raft 库，让题目集中考察服务与共识层的正确集成。

| 必须验证的边界 | 可观察证据 |
|---|---|
| 多节点并发 CAS | 竞争同一 revision，仅一个成功 |
| 旧 leader 被隔离 | 多数派继续提交，旧 leader 读写均超时拒绝 |
| 响应后强制结束 | 新 leader 和原节点重启均保留已确认结果 |
| 失败事务、墓碑和幂等 | 失败结果永久重放，删除重建不能通过 revision=0 |
| 快照与追平 | KV、revision、幂等结果在快照恢复后相符 |

派发沿用 sandbox 的登记输入机制：仅 `PROMPT.md` 和 `starter.tar`，输入包 SHA-256 在 prepare 前核对，解包得到可修改的 `repo/`。评分器和历史答案不进入输入包。原上游测试在 Windows 下复用固定 WAL 目录存在清理竞态，环境检查使用每例独立进程和 cwd，保持测试源码不变。

专家试做硬预算 1800 秒，依赖准备耗时另记。生成结束时间与独立验收通过时间分列；不再应用旧题的 480 秒换题条件。当前为工程试测，等级区分度仍待多模型复测。

独立验收命令：

```powershell
node Backend/tools/expert-evaluate.mjs RaftTxnWorkbench <提交的repo绝对路径> <新的证据目录>
```

基础验收不等同穷尽式线性一致性证明；真实快照安装另用 extended 模式与完整事件记录验证，不能仅凭 snapshotIndex 增加宣称完成安装。
