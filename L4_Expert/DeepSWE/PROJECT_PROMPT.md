# 任务背景

DeepSWE 是一个衡量前沿编码智能体（Coding Agent）在原创、长周期软件工程任务上表现的基准（Benchmark），任务来自活跃的开源仓库，覆盖 TypeScript、Go、Python、JavaScript、Rust 五种语言。请将本目录（`deep-swe/tasks`）中的任务集作为被评测对象，搭建可重复运行的评测环境，并在真实任务上运行编码智能体完成修复，最终产出结构化评分报告。

# 需求范围

## 任务格式（Harbor 格式）

每个任务目录包含：

```text
task.toml         Metadata（repo、base commit、language、image、limits）
instruction.md    智能体看到的提示词
pre_artifacts.sh  捕获智能体提交的工作为 patch
environment/      复现预构建镜像的 Dockerfile
tests/            验证器入口、保留测试与评分配置
solution/         参考解法（对智能体保密）
```

验证器只检验提示词所描述的可观察行为是否正确，不依赖内部符号名或结构；`solution/` 中的参考 patch 仅用于离线抽查，评分时不使用。

## 评测流程

1. **环境搭建**：使用 [Pier](https://github.com/datacurve-ai/pier)（Harbor 兼容框架，支持隔离任务环境与每智能体网络白名单）安装并配置；依赖 `datacurve-pier`（Python 包），要求 `Pier >= 0.3.0`（v1.1+ 使用独立验证器环境）。
2. **运行评测**：对任务集执行评测（支持全量 113 任务、随机子集采样如 `--n-tasks 10 --sample-seed 0`、或单任务 `pier run -p deep-swe/tasks/<task-id> ...`），驱动智能体（如 `mini-swe-agent`，也可驱动 `claude-code` / `codex` / `gemini-cli` / `opencode`）。
3. **结果收集**：验证器输出须包含 `reward.json`（二元奖励 + pass 分数）、`ctrf.json`（带失败信息的机器可读测试报告）、`test-stdout.txt`（原始测试输出与失败原因列表）、`run.log`（运行期间捕获的 stdout/stderr）、`reports/`（框架原生报告）。

## 分析报告

- 汇总通过率/奖励分布，按语言与仓库维度拆分。
- 抽取典型失败任务，结合 `test-stdout.txt` 与失败原因归纳失败模式（如依赖解析失败、边界条件、接口签名变化等）。
- 输出可复现的命令与参数说明。

# 交付与限制要求

- 交付：评测环境配置说明 + 运行命令 + 结构化评分报告（JSON/CSV + Markdown 摘要）。
- 不得修改任务目录中的原始任务数据（`tasks/` 只读）；环境目录（`pier-env*`）为评测运行痕迹，保留即可。
- 报告中须注明所用智能体、模型、任务子集与种子，保证可复现。
