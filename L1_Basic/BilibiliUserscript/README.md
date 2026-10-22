# BilibiliUserscript Benchmark

评测 AI 生成的 B 站逐条评论 IP 属地油猴脚本，采用 **BiliReveal v2.3.0 参考金标、透明修订金标和独立行为回放**。候选按行为计分，不按源码相似度、注释数量或代码行数计分。

原项目保留在 L1 基础脚本分类；无资料的真实 B 站多代组件适配实际接近 L2。给定数据契约后的受控回放测基础到中级实现能力。分析见 [PROMPT_ANALYSIS.md](docs/PROMPT_ANALYSIS.md)。

## 版本和可比性

| 轨道 | 输入 | 用途 | 正式排名 |
|---|---|---|---|
| diagnostic-v1 | [原题](PROJECT_PROMPT.md) | 历史输出的补充诊断 | 否，不能追溯套用 v2 要求 |
| controlled-v2 (replay-v2, ≤2.0.0) | [回放题面](prompts/REPLAY_V2.md) 修订前字节 + [公开契约](fixtures/CONTRACT.md) | 已完成的校准与 review | 否，题面已修订，旧 `promptSha256` 记录保留 |
| controlled-v2 (replay-v3, ≥2.1.0) | [回放题面](prompts/REPLAY_V2.md) 现行字节 + [公开契约](fixtures/CONTRACT.md) | 新一轮可重复生成评测 | 完整测试及门槛通过后可以 |

> **旧成绩（原题 `PROJECT_PROMPT.md` 与 2.0.0 版回放题面）一律不参与正式排名**，原地保留以示可查。
> 下方 `<原有模型目录>/` 下的历史交付属于此列：可用于诊断与回归参考，**不得与现行题面成绩混排**。
> 现行题面自 2.1.0 起新增「作答来源限制」（禁止联网检索/参考现有实现、禁止携带外部项目标识），
> 因此 2.1.0 之前的成绩在口径上也不再可比。修订记录见 [benchmark.json](benchmark.json) 的 `promptRevision`。

原题与用户指定历史 PROMPT.md 字节一致，SHA-256 为 `575a468e0c5347734ed01078bef8d6a573fc43d9079c4d4d851889161fd988bd`。旧说明留存于 [HISTORICAL_README.md](docs/HISTORICAL_README.md)。全景索引仍链接原题，派发新版时必须明确选择 controlled-v2。

## 项目架构

```text
PROJECT_PROMPT.md            历史原题
benchmark.json              版本、轨道、环境、判分策略
package.json/package-lock   基础设施依赖锁定
prompts/REPLAY_V2.md         明确行为边界的新题面
fixtures/CONTRACT.md         可交给模型的数据结构
fixtures/cases.json          25 项检查和权重
fixtures/replay.mjs          三代组件合成回放
gold/upstream/               原版脚本、README、MIT 许可证
gold/patches/runtime.js      题面一致性补丁
gold/bilireveal-bench.user.js 修订金标
gold/provenance.json         上游及构建输入/输出哈希
harness/                    静态检查、监测、独立断言、浏览器运行、报告
schemas/report.schema.json  结构化报告格式
tools/                      金标重建、隔离工作区准备
tests/                      判分契约与源哈希测试
calibration/                AI 诊断副本和校准证据
docs/                       难度、架构、评分、派发、实站验收
runs/                       临时结果和失败截图，Git 忽略
<原有模型目录>/             历史交付
```

## 运行

需要 Node.js 22+ 和现代 Chromium；候选仍是原生单文件，Playwright/Acorn 属于评测器。

```powershell
Set-Location F:\benchmark\L1_Basic\BilibiliUserscript
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run gold:build
node harness/cli.mjs --script gold/bilireveal-bench.user.js --out runs/gold.json --html runs/gold.html
```

默认使用已安装 Edge（`--channel msedge`），也可指定 `--channel chrome` 或 `--browser <Chromium绝对路径>`。不自动下载浏览器，使用独立无头浏览器和全新上下文。

```powershell
node harness/cli.mjs --script F:\bench-runs\example\answer.user.js --track controlled-v2 --seed 20260930 --out runs/example.json --html runs/example.html --artifacts runs/example-evidence
npm run calibrate
```

JSON 保存判分、逐条文字/矩形/点击、网络/存储事件、题面/契约/源码哈希与浏览器版本；HTML 可直接打开。指定 `--artifacts` 后默认留存失败截图，`--screenshots all` 留存全部。退出码 0 为全项通过，1 为已完成但存在失败，2 为输入/依赖/启动错误。

## 评分与结果

总分 100：交付 10、请求/隐私/错误 10、准确性 25、组件兼容 20、生命周期 15、降级 10、布局 10。见 [SCORING.md](docs/SCORING.md)。

首次校准：修订金标两组 seed 均为 100/100，原版 Lite 为 71/100，用户提供的 AI 脚本为 87/100；六种故意错误全部检出，契约测试 6/6 通过。原版与 AI 的结果仅为补充诊断，不是历史题正式成绩或实站排名。详情见 [校准说明](calibration/README.md)，机器结果见 [summary.json](calibration/results/summary.json)。

通过合成回放不能代替真实 B 站与真实油猴管理器验收。后者按 [LIVE_ACCEPTANCE.md](docs/LIVE_ACCEPTANCE.md) 单独记录。

新一轮模型测试按 [RUN_PROTOCOL.md](docs/RUN_PROTOCOL.md) 创建隔离工作区，只发题面/公开契约，记录调用配置、封存第一版输出再判分。维护与数据流见 [ARCHITECTURE.md](docs/ARCHITECTURE.md)。金标来源及改动见 [PATCHES.md](gold/PATCHES.md)，保留 [MIT 许可证](gold/upstream/LICENSE)。
