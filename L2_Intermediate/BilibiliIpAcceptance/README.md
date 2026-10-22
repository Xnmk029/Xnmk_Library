# 项目：B 站 IP 属地脚本 · 自动验收器

## 分类元数据

- **测试领域**: 系统集成与 MCP 协议（与 `BilibiliUserscript` 同族）
- **难度等级**: `L2`（中等）
- **核心技术栈**: Node.js / Userscript 元数据 / 无头 DOM 桩 / 行为断言
- **核心考核点**: 契约到断言的转化、SPA 动态行为模拟、零依赖离线工程、报告与退出码设计

## 任务定位

上游项目 `L1_Basic/BilibiliUserscript` 考的是「写一个油猴脚本」；本项目考的是**为它建一套自动验收**：把脚本的行为契约（权限最小化、不重复注入、SPA 下仍生效、缺字段降级、自身不联网）变成可执行、可复现、机器可判定的检查项，并证明验收器本身不是「永远 PASS」。

## 提示词

> 📋 **完整提示词以 [`PROJECT_PROMPT.md`](./PROJECT_PROMPT.md) 为唯一标准**，本页不内嵌副本（避免版本漂移）。
> 评测时请直接使用提示词原文，**不要修改任何技术约束**。

被测方只看到题面原文与两行派发词，看不到本 README。

## 输出要求

- 工作目录根层的零依赖 Node.js 验收项目：入口 + 正/反例 fixture + README（可选示例报告）。
- 固定结构的 JSON 报告与 `0/1/2` 退出码。
- `--self-test` 必须能证明验收器可区分正例与反例。
- 禁止子目录、点文件与 `node_modules`（会触发 harness 的禁入项检查）。

## 自动化验收建议

- 对交付物跑 `node accept.js --self-test`，断言退出码为 0（正例 PASS、反例 FAIL 都被正确识别）。
- 把真实的 `L1_Basic/BilibiliUserscript` 交付脚本（如 `grok-4.7/bilibili-desktop-ip-location.user.js`）作为 `--script` 输入，观察报告与实际脚本行为是否一致——这是验收器「不假阳性」的关键反证。
- 检查 `B4` 幂等与 `B7` 零网络两项是否真的在 DOM 桩里运行断言，而不是只做字符串匹配。
- 报告 JSON 的 `checks[].id` 必须覆盖 `A1–A5`、`B1–B8`。
