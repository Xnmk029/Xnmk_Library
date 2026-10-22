> 历史报告：以下“当前”均指 2026-10-15 的题库状态。2026-10-16 两道 L4 已升级，现行状态见 [BANK.json](BANK.json) 和 [新报告](EXPERT_UPGRADE_REPORT.md)。[原始字节快照](pilots/20261015/PILOT_REPORT.frozen.md) 已冻结；本页仅修正退役题链接。

# 后端题库基础试测与时间筛选

日期：2026-10-15（Asia/Shanghai）。

当前 **8 题**，L1–L4 各 2 题；**8/8** 已在 480 秒内正常结束并通过独立基础检查。累计试测 21 个题面版本，退役 13 个，旧版本不计入有效题库。有效题平均生成用时 6:25。

本机默认 gpt-6-astra / high；CLI 0.162.0-alpha.17.2。每题独立新会话，600 秒硬上限、480 秒筛选线，最多同时运行 2 个生成进程。每版题面只进行一次生成；这是基础工程筛选。模型与 token 用量来自运行时 trace / CLI 事件，缺失值保留 null。

生成用时包含读取、思考、实现、自测与工具等待，不含排队及独立验收。达到截止时间的样本是右删失数据，不能写成“600 秒完成”。通过数是基础检查计数，各题分母不同，不是统一百分制成绩。

## 当前有效题目

| ID | 等级 | 题目 | 生成用时 | 基础检查 | 结论 | 复核入口 |
|---|---|---|---:|---:|---|---|
| B01 | L1 | [B 站评论 IP 属地脚本](../Backend/dispatch/BilibiliControlled/PROJECT_PROMPT.md) | 7:20 | 26/26 | 基础通过 | [报告](../sandbox/runs/backend-pilot-20261015/20261015-214240-BilibiliControlled/BASELINE.recheck.json) · [截图](../sandbox/runs/backend-pilot-20261015/20261015-214240-BilibiliControlled/baseline-evidence/U02.png) · [源码](../Backend/pilots/20261015/submissions/B01/PILOT-NOTE.md) |
| B02 | L1 | [HTTP 健康探针与可视化报告](../L1_Basic/HttpHealthProbe/PROJECT_PROMPT.md) | 4:45 | 6/6 | 基础通过 | [报告](../sandbox/runs/backend-replacement-20261015/20261015-223200-HttpHealthProbe/BASELINE.json) · [截图](../sandbox/runs/backend-replacement-20261015/20261015-223200-HttpHealthProbe/baseline-ui.png) · [源码](../Backend/pilots/20261015/submissions/B02/README.md) |
| B03 | L2 | [目录重复文件检测器](../L2_Intermediate/DuplicateFileInspector/PROJECT_PROMPT.md) | 7:53 | 6/6 | 基础通过 | [报告](../sandbox/runs/backend-replacement-20261015/20261015-220307-DuplicateFileInspector/BASELINE.json) · [截图](../sandbox/runs/backend-replacement-20261015/20261015-220307-DuplicateFileInspector/baseline-ui.png) · [源码](../Backend/pilots/20261015/submissions/B03/README.md) |
| B04 | L2 | [本地短链接与访问统计台](../L2_Intermediate/LocalShortLinks/PROJECT_PROMPT.md) | 5:39 | 7/7 | 基础通过 | [报告](../sandbox/runs/backend-replacement-20261015/20261015-225514-LocalShortLinks/BASELINE.json) · [截图](../sandbox/runs/backend-replacement-20261015/20261015-225514-LocalShortLinks/baseline-ui.png) · [源码](../Backend/pilots/20261015/submissions/B04/README.md) |
| B05 | L3 | [乱序订单事件回放与对账报告](../L3_Advanced/OrderEventReplay/PROJECT_PROMPT.md) | 5:01 | 7/7 | 基础通过 | [报告](../sandbox/runs/backend-replacement-20261015/20261015-231709-OrderEventReplay/BASELINE.json) · [截图](../sandbox/runs/backend-replacement-20261015/20261015-231709-OrderEventReplay/baseline-ui.png) · [源码](../Backend/pilots/20261015/submissions/B05/README.md) |
| B06 | L3 | [限流与熔断代理工作台](../L3_Advanced/ResilientGateway/PROJECT_PROMPT.md) | 5:59 | 8/8 | 基础通过 | [报告](../sandbox/runs/backend-replacement-20261015/20261015-220026-ResilientGateway/BASELINE.json) · [截图](../sandbox/runs/backend-replacement-20261015/20261015-220026-ResilientGateway/baseline-ui.png) · [源码](../Backend/pilots/20261015/submissions/B06/README.md) |
| B07 | L4 | [并发转账账本与审计报告](retired/LedgerAudit/PROJECT_PROMPT.md) | 7:56 | 8/8 | 基础通过 | [报告](../sandbox/runs/backend-replacement-20261015/20261015-224134-LedgerAudit/BASELINE.recheck.json) · [截图](../sandbox/runs/backend-replacement-20261015/20261015-224134-LedgerAudit/baseline-ui.png) · [源码](../Backend/pilots/20261015/submissions/B07/README.md) |
| B08 | L4 | [库存预占与结算事务台](retired/InventoryTransactions/PROJECT_PROMPT.md) | 6:44 | 8/8 | 基础通过 | [报告](../sandbox/runs/backend-replacement-20261015/20261015-221325-InventoryTransactions/BASELINE.json) · [截图](../sandbox/runs/backend-replacement-20261015/20261015-221325-InventoryTransactions/baseline-ui.png) · [源码](../Backend/pilots/20261015/submissions/B08/README.md) |

B01 的 26 项包含“脚本存在”及原有 25 项回放检查；既有行为权重为 100 分。B01 派发的是题面与契约合并的试测输入，实际输入哈希见 meta/results，不与历史轨道混排。

## 难度观察

| ID | 观察 |
|---|---|
| B01 | 历史 L1 上沿；三代组件受控适配接近 L2，真实站点另验。 |
| B02 | L1：有限输入、请求超时、并发上限与可视化报告。 |
| B03 | L2：真实内容判重、文件边界与持久结果；用时接近筛选线。 |
| B04 | L2：HTTP 跳转、幂等别名与并发持久计数。 |
| B05 | L3：乱序事件、版本缺口、去重与状态机的确定性投影。 |
| B06 | L3：限流窗口与熔断恢复，重点在失败和并发边界。 |
| B07 | L4 候选：跨进程事务、幂等与审计链；用时接近筛选线。 |
| B08 | L4 候选：预占、支付、取消、过期竞争与总量守恒。 |

本轮强模型全部基础通过，尚不足以证明 L1–L4 的跨模型区分度。等级按正确性边界分层，用时不必随等级单调增加；L4 当前以事务一致性与审计为目标等级，完整故障矩阵和更多模型样本仍需后续校准。B03、B07 只有数秒预算余量，后续应优先复测其用时稳定性。

## 全部试次与替换证据

| 试次 | 进程结果 | 生成/截止秒数 | 复核检查 | 验收秒数 | 时间筛选 |
|---|---|---:|---:|---:|---|
| 20261015-214240-BilibiliControlled | completed | 439.8 | 26/26 | 54.56 | 预算内 |
| 20261015-214240-LogTimeline | timeout | 601.0 | 6/6 | 3.06 | 超时长预算 |
| 20261015-214241-DurableJobQueue | timeout | 601.2 | 6/7 | 7.17 | 超时长预算 |
| 20261015-214241-LocalFileSearch | completed | 565.6 | 8/8 | 7.23 | 超时长预算 |
| 20261015-214241-OfflineCollabNotes | timeout | 601.0 | 6/7 | 3.6 | 超时长预算 |
| 20261015-214241-ReplicaKV | timeout | 601.0 | 3/5 | 5.97 | 超时长预算 |
| 20261015-214241-ResumableTransfer | timeout | 601.1 | 6/8 | 9.11 | 超时长预算 |
| 20261015-214241-WebhookInbox | timeout | 601.1 | 8/8 | 3.85 | 超时长预算 |
| 20261015-215414-LogInspector | completed | 570.0 | 5/5 | 3.03 | 超时长预算 |
| 20261015-220026-ResilientGateway | completed | 359.0 | 8/8 | 6.66 | 预算内 |
| 20261015-220307-DuplicateFileInspector | completed | 473.5 | 6/6 | 3.75 | 预算内 |
| 20261015-221115-VersionedConfig | completed | 540.1 | 8/8 | 3.72 | 超时长预算 |
| 20261015-221325-InventoryTransactions | completed | 404.3 | 8/8 | 5.49 | 预算内 |
| 20261015-222054-ReversibleDirectorySync | timeout | 600.9 | 7/7 | 5.23 | 超时长预算 |
| 20261015-222254-WebhookInspector | completed | 532.1 | 8/8 | 3.78 | 超时长预算 |
| 20261015-223200-HttpHealthProbe | completed | 285.0 | 6/6 | 1.44 | 预算内 |
| 20261015-224134-LedgerAudit | completed | 475.6 | 8/8 | 4.51 | 预算内 |
| 20261015-225202-DirectorySyncReport | timeout | 601.2 | 4/7 | 1.96 | 超时长预算 |
| 20261015-225514-LocalShortLinks | completed | 339.1 | 7/7 | 4.7 | 预算内 |
| 20261015-230424-TransactionalRename | timeout | 601.0 | 7/7 | 3.03 | 超时长预算 |
| 20261015-231709-OrderEventReplay | completed | 301.0 | 7/7 | 2.6 | 预算内 |

完整记录、初始/复核结果和输出文件哈希：[results.json](pilots/20261015/results.json)。原始日志、execution.json、题面快照、BASELINE 和截图保存在对应 harness；合格交付的源码副本位于 submissions，含逐文件哈希与省略项清单。源码副本是模型试测输出，独立评分器未以它作为金标。

## 验收器与题面复核记录

初始报告全部保留。通用 D1 曾把题面提及 HTML 误当成必须交付独立 .html 文件；已按“运行时生成报告/服务端渲染”的明确契约复核，原机器判定与更正理由保存在 meta/REVIEW。早期基础检查漏了 README 必交项，已补齐并对相关旧样本复核。

Webhook 题没有规定 attempts 的数组顺序，独立断言改为验证两次真实投递及状态集合，保留 BASELINE.original 并重新验证。退役日志精简版的 total 口径不够明确，复核接受合法行数/全部非空行数两种解释；当前有效题已改为字段含义明确的 HTTP 探针。

通用 H3 原先把普通词“暂存”误判为路径痕迹；现在只对路径形式的该词触发，3 组回归测试仍确认真实目录和仓库路径可被发现。相关原始 INVALID 判定另存，复核记录没有声称 OS 访问隔离已证实。

界面检查包含实际浏览器启动、可见结果与截图，但未穷尽每个交互；有限故障用例也不代表完整混沌认证。账本的强制终止是否命中窗口见 acknowledged-persistence 的 detail，未命中时只记跨进程持久化覆盖。B01 已知的点击遮挡/Storage 属性赋值漏检仍见 [专项报告](BILIBILI_AUTOMATION.md)。

## 判定与复现

超过 480 秒的版本替换，600 秒未退出标记生成未完成；模型输出的文件出现时间不能代替交付完成。功能缺项、题面歧义、评分器误报和模型接口/环境错误分别记录。新题使用相同模型配置与预算重新生成，候选答案不作人工修补。

运行入口见 [RUN_PROTOCOL.md](RUN_PROTOCOL.md)。本轮为外部工作目录加观测的基础试测，isolationVerification 保持 unverified；结果不作为正式跨模型排名。
