# 派发与封存

1. 明确版本和轨道。正式新生成采用 controlled-v2；历史探查采用 diagnostic-v1。
2. 创建 Benchmark 外的新模型工作区，只放题面、公开契约和调用元数据，不开放金标、判分器、私有参数和历史答案。
3. 记录真实模型 ID、提供方、推理档位、温度、工具/网络策略、tokens、用时与失败重试。未知字段保留 null。
4. 第一版 `answer.user.js` 立即封存哈希，再回放；修复版本另存，分别报告首轮/修复表现。
5. 只在输入、策略、种子、引擎指纹与浏览器环境一致的运行间排名。受控轨道分别记录题面和 CONTRACT.md 的 SHA-256；历史轨道的 contractSha256 为 null。

```powershell
node tools/prepare-run.mjs --out F:\bench-runs\new-BilibiliUserscript-run --model exact-model-id --track controlled-v2
```

使用者填入真实 model ID。该工具拒绝已有目录，创建 PROMPT.md、CONTRACT.md 和 run-manifest.json；不调用模型，不产生 API 费用。外部派发器读两份输入，输出 answer.user.js，并按实际调用补齐 manifest。

工具不能替调用平台强制隔离父目录或禁用外部工具，派发器负责只提供独立目录并记录实际策略。默认 controlled-v2 使用闭合资料，可编辑/语法检查/本地自测；有外部调研工具的运行单独标记，不与闭合资料混排。

金标来源公开，模型可能有训练记忆或检索复用。变动 ID、属地和关联可识别部分硬编码，但不声称消除了数据污染。

历史模型目录可直接作 --script 输入，不改动产出。用户提供 AI 脚本复制到 calibration/candidates 并记录重命名，模型与生成题面未知，所以不猜测身份，不放正式榜。

推荐正式批次每模型至少 3 次独立生成，固定预算和相同工具策略；同一输出在固定 seed 集合回放。报告平均/最低分、资格通过率和首轮全通过率。费用和时间单列，不混成未经说明的性能分。

首次批次前运行 npm test 与 npm run calibrate。变更题面、fixture、权重或金标必须升级版本并重新校准，不能在某个候选失分后偷偷放宽要求。
