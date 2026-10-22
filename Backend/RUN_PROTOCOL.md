# 基础试测与专家仓库题流程

## 当前时间计分规则（2026-10-16 用户修正）

本节优先于下文历史硬截止与自动换题说明。后端新试次使用 `time_policy: penalty-no-deadline`：L1–L3 为 600 秒、L4 为 1800 秒**软计分阈值**，超过阈值继续运行，不因耗时终止或直接判功能失败，也不自动更换题目。时间包括受测模型的调研、实现与自测；独立验收、排队与人为中断间隔不计入生成时间。

百分制时间扣分为 `min(10, 10 × max(0, 实际生成秒数 / 阈值 − 1))`。每超出阈值 10% 扣 1 分，最多扣 10 分；功能验收分与时间扣分单独列出，验收完整后计算 `max(0, 功能分 − 时间扣分)`。存在 BLOCKED、环境阻塞或缺少必需验收时不形成最终总分。静态审阅和完整性结论另列，扣时不能覆盖功能或完整性问题。

当前 DSH 批次入口为 [实时报告](pilots/backend-dsh-opendes-v41f-high-20261016/REPORT.md)。原硬截止记录冻结，不覆盖；尝试原会话恢复失败于 DSH 的 `format v4 message requires a producer-owned source kind`（没有进入 provider 调用），B01/B03 已用标准 prepare 创建全新会话重测。历史中断与恢复基础设施错误不当作新试次模型得分。

`cli_suite.py execute` 识别 adapter 的软策略及 `soft_seconds_by_project`，软模式 `wall_seconds=null`，不调用超时终止。`adopt` 可接管已有 Windows 进程的等待与计时，不重启模型；`continue-soft-suite` 以一个共享并发队列接管在跑题、执行显式续跑和派发未启动题。`resume-timeouts` 仅用于用户授权的原会话恢复，完整保留之前的日志、审阅、评分与代码快照，累计运行段时间并标注中断；恢复失败不自动伪造成功或悄悄重开。

## 当前专家题 v2

现行 B07/B08 为 repository-expert-v2，预算仍为 1800 秒。只派发新题面和相同的冻结上游 starter；v1 交付、参考补丁、旧成绩及判题器均不得进入受测目录。旧版 20:50/17:37 不是新版完成时间。新试测须使用新标签，可通过 `node Backend/tools/prepare-expert-pilot.mjs <新标签>` 组卷，并使用其生成的 expert-v2-adapter.json 执行。

新增 gate 为 `expert-v2-evaluate.mjs <task> <repo> <全新证据目录>`，只覆盖新增契约。B07 原事务与故障验收仍适用，需与新 gate 合并评估；B08 的旧覆盖矩阵要按必填 epoch 契约更新，旧 `expert-evaluate.mjs` 不可直接当作新版总分器。新 gate 用 BLOCKED 标记因前置能力缺失未执行的场景，不将它们伪装成独立失败或通过。只有在完整新答卷、原回归、新 gate 和新时间记录都完成后，才可登记新版完成。

`--previous-v1` 只用于工程负对照。它运行归档的旧交付，检验新增要求能否排除旧实现，不能产生 v2 模型成绩、完成时间或整体区分度结论。负对照不提供测试器中尚未通过分支的正向校准；当前状态详见 EXPERT_V2.md。

2026-10-16 升级：下方的 600 秒/480 秒规则只描述 20261015 的基础试测，**不适用于当前 B07/B08**。新 L4 使用 1800 秒硬预算，不因超过 480 秒自动降难度或替换；须同时报告实际生成时长、独立故障验收结果与环境准备耗时。L1–L3 原记录保持不变。

专家题先验证 `STARTER_LOCK.json` 与 starter.tar 哈希，再由 `PROMPT_REGISTRY.json` 沿用现有 prepare 输入机制复制原题面和公开包。解包内容可修改，原 tar 和 PROMPT.md 不可修改。示例组卷见 `Backend/tools/prepare-expert-pilot.mjs`。包中不含评分器/历史答案；冻结源码仍须按许可证保留版权与出处。

本机 Windows workspace-write CLI 沙箱阻断包下载和缓存读取，首轮环境失败已保留。工程试测 adapter 使用 full-access CLI，外部工作目录只减少误读，不提供 OS 访问隔离；isolation_verification 必须保持 unverified，不用于正式隔离排名。不要把环境阻塞或访问权限错误计为模型能力失败。修正运行环境后须使用新标签和全新会话。

当前专家题用 `cli_suite.py prepare/execute`；结束后运行 `expert-evaluate.mjs <task> <repo> <new-evidence-dir>`，Raft 可加 `--extended` 强制越过上游 10000 条日志保留窗口，验证真实快照接收。验收在副本执行，原始交付前后哈希须一致。候选源代码与 patch 按完整相对目录归档，不使用会压平目录的通用 collect。新增报告写入 20261016，禁止重新生成覆盖 20261015 的冻结成绩。

专家完成需同时满足：生成会话结束、交付完整、核心协议/安全检查通过；截图只证明界面可呈现，不能替代故障一致性。单个默认模型的一次样本仅用于工程难度观察，不足以校准完整 L4 排名。

题目登记见 [BANK.json](BANK.json)。有效题目以 `tasks[].status == "active"` 为准；被替换题保存在 `history`，题面内容和试次证据保留。不要仅按目录数认定题库数量。

本轮参数在开跑前确定：独立新 CLI 会话、同一本机默认模型与推理配置、并发 2、每题 600 秒硬截止；生成用时超过 480 秒即进入换题筛选。时间包括模型自己的调研、编写和自测，独立评分不计入生成时间。超时的交付物仍做基础检查，分别报告“生成会话未结束”和“已有交付物是否可用”。不能用超时样本声称精确完成时间。

## 组卷与执行

沿用 `sandbox/scripts/cli_suite.py prepare/execute`，不手工拼接 run。只向受测会话提供该入口生成的两行派发词。B01 的合并题面在 `Backend/dispatch/BilibiliControlled/`；其他项目使用有效登记中的 `dispatchProject`。

```powershell
$env:PYTHONUTF8 = '1'
$pilotPython = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'

# --projects 取 BANK.json 中有效题目的 dispatchProject，--model 是本次归档标签。
& $pilotPython sandbox/scripts/cli_suite.py prepare --model <新标签> --projects <逗号分隔的项目路径>
& $pilotPython sandbox/scripts/cli_suite.py execute --model <新标签> --adapter Backend/tools/pilot-adapter.json --jobs 2 --wall 600

node Backend/tools/evaluate.mjs <新标签>
& $pilotPython sandbox/scripts/cli_suite.py finalize --model <新标签>
node Backend/tools/report.mjs <首轮标签> <替换轮标签>
```

`pilot-adapter.json` 没有 `-m` 覆盖，实际使用本机配置默认值；其中声明值是本轮读取到的配置快照，不是服务端真实模型版本的证明。换机器或更改模型前，应生成新 adapter、记录配置并使用新标签。密钥和认证文件不写入试次。

## 独立检查

`evaluate.mjs` 在 harness 内复制候选交付，实际启动本地服务，使用独立输入调用 API，执行对应的重复、冲突、重启、租约等检查，另外启动真实 Edge 留存界面截图。验证不修改仓库外原始提交，退出时终止本次验收启动的子进程。

当前也包含纯 CLI 报告型题目：独立执行命令，检查输出 JSON、文件/数据库真值，再用浏览器打开实际生成的 HTML。`--only=<项目名>` 可限定单题；`--recheck` 使用新的运行目录并写 `BASELINE.recheck.json`，保留初始 `BASELINE.json`。

基础检查是有限覆盖：界面启动成功不等同所有交互正确；有限故障用例不等同完整崩溃边界或并发一致性证明。各项 PASS/FAIL、具体错误、生成时间和验收时间保存在 `BASELINE.json`，而非由模型自报。B01 另外保存现有 25 项浏览器回放报告。

只有生成进程正常结束且基础断言全通过，才标为“基础完成”。功能部分通过、生成超时、环境启动失败分别保留。界面、持久化、跨进程行为和真正的分布式语义不得只凭源代码或截图认定。

## 换题与发布

先保存首轮报告；`replace.mjs <题号...>` 只接受已有超过 480 秒证据的题目，登记不同名称和不同题面哈希，不覆盖原题。替换题使用相同配置和预算重新组卷、运行、验收。新题继续超时则保留失败，进一步缩小任务或再次换题，不能把未测题直接填作成功。

`sync-index.mjs` 更新中英文主入口和领域索引。最终有效题目须满足总数 8、L1–L4 各 2、题面与登记哈希一致。完整压力阈值、更多随机种子、错误实现校准和多次独立生成属于后续正式版本发布条件；这次数据只用于基础难度和时长筛选。

旧题须先完成 review 并保留机器记录，再运行 `Backend/tools/archive-retired.ps1` 移入 `Backend/retired/`；旧题面不改字节。原试次保留当时的逻辑项目路径，归档映射见 BANK.json 的 history；要重新生成旧题，使用 history.archivedProject 创建新标签。不要对已经归档的原标签再次执行收卷；独立验收可以按 history 识别旧题，旧 BASELINE.json 不自动覆盖。

本轮合格交付用 `archive-pilot-source.mjs` 保存完整相对目录结构的源码与小型夹具副本；这是试测证据归档，包含源文件哈希，不作为金标。通用收卷器会压平目录和重命名入口，不适用于这里含 public/、模块相对引用及运行时生成报告的交付。最终源码副本、基础报告与运行说明均从 PILOT_REPORT.md 链接。
