# 校准记录

日期：2026-09-30（Asia/Shanghai）。首次冻结版本为 2.0.0。

使用 Windows 10.0.26200、Node v24.15.0、Edge 154.0.4258.37、playwright-core 1.63.0。每个场景创建独立浏览器上下文，HTTP 响应在本地回放，未访问真实 B 站或真实账号。

## 完整回放结果

| 对象 | 轨道 | 分数 | 失败项 | 解释 |
|---|---|---:|---|---|
| BiliReveal Bench 修订金标，seed 20260930 | controlled-v2 | 100/100 | 无 | 完整通过 |
| 同一修订金标，seed 73191 | controlled-v2 | 100/100 | 无 | 变化数据下完整通过 |
| BiliReveal v2.3.0 Lite 原版 | diagnostic-v1 | 71/100 | P01、D04、D05、D06、L04、R01 | 新题契约补充诊断 |
| 用户提供的 AI 脚本 | diagnostic-v1 | 87/100 | F01、F03、L04 | 新题契约补充诊断 |

AI 脚本的缺口：仅有操作栏 `.data` 的 Lit 变体、Vue 3 楼中楼和从 Lit 切换到 Vue 3 的 SPA 路由。原版的失分涉及 HTML 字符处理、缺失状态、跨组件 SPA；P01 源于测试属地字符串被解析成图片后触发额外请求，详细证据在原始报告。不能把修订金标补齐后的能力说成原版原有能力。

提供的 AI 脚本来自 Downloads 文件，按字节复制，仅把 `.users.js` 改名为 `.user.js` 以符合交付包装。模型和实际生成题面未知，见 [origin.json](candidates/origin.json)。两份诊断输出均不具备正式排名资格，`qualifiedScore` 为 null；71 与 87 也不能据此推断两者真实 B 站的整体体验。

- [修订金标报告](results/gold-seed-20260930.html)
- [原版 Lite 诊断](results/upstream-bilireveal-lite.html)
- [AI 脚本诊断](results/supplied-ai.html)
- [机器汇总](results/summary.json)

## 反例校准

| 故意错误 | 应被检出的项 | 结果 |
|---|---|---|
| 把所有属地写成固定北京 | D01 | 检出 |
| 每次更新追加重复标签 | L02 | 检出 |
| 写入 localStorage | P01 | 检出 |
| 发起额外网络请求 | P01 | 检出 |
| 把属地写入 innerHTML | D04 | 检出，另触发 P01 |
| 只有元数据、不实现功能 | D01 | 检出 |

反例运行的是静态检查、请求/错误门槛和指定目标场景，分母为 23/24/25 等局部分值。它们只证明判分器能拒绝相应错误，不是完整 100 分的模型成绩。

## 复现与证据

运行 `npm test`（6 项契约测试）和 `npm run calibrate`。金标两次正例、两份诊断及六种反例共 10 个目标，`allCalibrationChecksPassed` 为 true。校准通过是指正例全通过且反例命中预期失败；不代表每个被诊断对象通过。

逐条报告记录候选 SHA-256、引擎文件指纹、题面/契约哈希和浏览器版本。失败截图及事件文件位于 Git 忽略的 `runs/calibration-evidence/`，反例脚本位于 `runs/calibration-mutants/`；运行校准可重建。固定金标字节及补丁见 [provenance.json](../gold/provenance.json)。

真实站点和完整油猴管理器验收仍为 **NOT_RUN**，按 [LIVE_ACCEPTANCE.md](../docs/LIVE_ACCEPTANCE.md) 另行记录。
