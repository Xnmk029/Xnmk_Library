# BilibiliUserscript 自动化验证复核

复核日期：2026-10-15，Asia/Shanghai。范围是当前工作区的冻结题面、评分器和本地合成回放；未执行真实 B 站与完整油猴扩展验收，也未重跑所有历史模型答案。

## 结论

**有合适的自动化机制，而且已经实现：Playwright 驱动真实 Chromium，在本地回放三代评论组件，注入候选脚本，按行为断言评分。** 比自行实现轻量 DOM 桩更适合检查本题的组件、布局和动态生命周期。建议继续使用现有机制，先修复本次发现的两个漏检点，再冻结新版本作为正式批次基线。

本次没有修改冻结题面、金标、评分器或历史校准结果。运行证据保存在新的 `runs/review-20261015/`；关键摘要和可复现探针另外存入本目录的 `evidence/`。

## 已有能力与实际执行结果

入口：[harness/cli.mjs](../L1_Basic/BilibiliUserscript/harness/cli.mjs)。题面：[REPLAY_V2.md](../L1_Basic/BilibiliUserscript/prompts/REPLAY_V2.md)；数据契约：[CONTRACT.md](../L1_Basic/BilibiliUserscript/fixtures/CONTRACT.md)；评分：[SCORING.md](../L1_Basic/BilibiliUserscript/docs/SCORING.md)。

| 项目 | 本次结果 | 证据 |
|---|---|---|
| 题面、权重、判分与金标来源契约测试 | 6/6 通过 | [命令与结果摘要](evidence/gold-summary.json) |
| 修订金标，新 seed `20261015` | 25/25，100/100，PASS | [完整 HTML](../L1_Basic/BilibiliUserscript/runs/review-20261015/gold.html)、[持久摘要](evidence/gold-summary.json) |
| 属地写成固定北京 | D01 检出 | [反例汇总](evidence/probes-summary.json) |
| 重复追加标签 | L02 检出 | 同上 |
| 主动 fetch | P01 检出 | 同上 |
| `localStorage.setItem` | P01 检出 | 同上 |
| 属地插入可执行 HTML | D04、P01 检出 | 同上 |
| 只有元数据，无功能 | D01 检出 | 同上 |
| 页面额外透明遮挡层 | **U02/U03 未检出** | [实际鼠标点击证据](evidence/gap-proof.json) |
| `localStorage[key] = value` | **P01 未检出** | [真实写入与空监测记录](evidence/gap-proof.json) |

运行环境：Node v24.15.0、Windows 10.0.26200、Edge 155.0.4283.45、Playwright 1.63.0。完整环境和题面/引擎/金标 SHA-256 见 JSON 摘要。反例只运行指定场景及共同检查，分母为 23–26 等局部分值；不能当成完整百分制成绩。

现有 25 项覆盖：语法和元数据、最小权限、属地与评论对应、大整数 ID、纯文本处理、三代组件、SPA、异步节点、DOM 复用、缺字段、失败响应、原生标签、窄窗口和原控件。每个场景使用独立浏览器上下文；HTTP 请求在本地返回或阻断；报告包含逐条检查、事件、请求、元素矩形和来源哈希，支持截图。

## 已复现的两个漏检点

### 1. 程序触发 click 不等于用户能点击

[assertions.mjs](../L1_Basic/BilibiliUserscript/harness/assertions.mjs) 的 `clickNativeControls()` 调用 `button.click()`。这能确认点击监听器仍在，但不会做真实指针命中测试。现有几何检查主要观察时间栏内文本和按钮，未覆盖时间栏之外的页面遮挡层。

复现方式是在金标后追加一个覆盖视口、接收指针事件的透明 div。U02 和 U03 仍通过；独立浏览器探针发现按钮中心的命中元素是 `review-overlay`。实际鼠标点击后监听计数仍为 0，移除遮挡层再点击变为 1。因此这是功能被破坏后的假通过，不只是理论风险。

**建议修复：**使用 Playwright locator 的真实 `click()` 或真实鼠标事件，不能使用 `force: true` 绕过可操作性检测。保留几何检查作为补充；增加遮挡层、`pointer-events: none`、点击事件被捕获阶段吞掉等反例；对 Open Shadow DOM 也使用能穿透开放影子树的定位方式。事件未到达原控件必须失败，不能仅凭元素存在判通过。

### 2. Storage 方法拦截没有覆盖属性写入

[monitor.mjs](../L1_Basic/BilibiliUserscript/harness/monitor.mjs) 包装了 `Storage.prototype.setItem/removeItem/clear`。浏览器的 `localStorage["review-probe"] = "synthetic"` 可以真实写入数据，却没有经过这些 JavaScript 包装函数。本次 P01 仍通过；独立探针读取到 `synthetic`，而 `persistent-write` 事件列表为空。

**建议修复：**至少增加候选运行前后的 localStorage/sessionStorage 全键值比较和独立浏览器存储事件监测，覆盖点属性、括号属性、删除、写后删等操作。前后快照只能发现残留变化，不能单独证明从未写入；需对瞬时写入保留浏览器侧事件证据，并用反例验证。Cookie、IndexedDB、GM 存储继续分别覆盖；不要用一次空快照宣称所有持久化渠道都已穷尽。

## 为什么不直接拿 L2 的轻量 DOM 验收题来判所有脚本

[BilibiliIpAcceptance](../L2_Intermediate/BilibiliIpAcceptance/PROJECT_PROMPT.md) 是“让模型实现验收器”的另一道题，不是当前 L1 评分器的同义词。它要求零依赖和轻量 DOM 桩，适合考察有限契约到断言的转换，但题面没有完整冻结任意脚本会用到的 DOM/组件接口；简化 DOM 也不能证明真实布局和点击命中。

此外，L2 题要求 `@run-at` 并明确排除若干子域；L1 v2 的元数据和域名要求不是同一套。直接交叉判分可能把两道题的契约差异算成候选错误。应分别冻结目标契约；L2 可以提供有限桩协议与正反例，浏览器兼容性另由真实浏览器回放负责。

## 建议的验证层次

1. **静态预检：**语法、安装元数据、声明权限、外部依赖；这不能替代运行时行为证明。
2. **受控浏览器回放：**作为批量自动评分主线；输入由评测器生成，检查最终可见结果、真实点击、请求与存储行为。金标、多种子、故意错误同时校准。
3. **真实油猴扩展的小规模冒烟：**验证安装、执行时机、页面/沙箱上下文和授权行为。受控回放的 GM shim 不能替代这一层。
4. **实站抽查：**真实 B 站页面、当日组件和响应单独留证，按现有 [LIVE_ACCEPTANCE.md](../L1_Basic/BilibiliUserscript/docs/LIVE_ACCEPTANCE.md) 记录。登录、风控和站点变动应与脚本逻辑失败分开。

本次仅执行前两层及独立探针。脚本与监测钩子共处页面上下文，不是恶意代码安全隔离设施；正式批次要把判分器和私有数据放在候选工作区之外，并为评测进程配置外部超时，避免死循环卡住批次。

## 复现命令

使用现有已安装依赖和 Edge。新环境先在题目目录按锁文件执行 `npm ci --ignore-scripts --no-audit --no-fund`；浏览器不自动下载。

```powershell
Set-Location F:\benchmark\L1_Basic\BilibiliUserscript
node --test tests/*.test.mjs
node harness/cli.mjs --script gold/bilireveal-bench.user.js --track controlled-v2 --seed 20261015 --out runs/review-20261015/gold.json --html runs/review-20261015/gold.html --artifacts runs/review-20261015/gold-evidence --screenshots all

Set-Location F:\benchmark
node Backend/evidence/probe.mjs
node Backend/evidence/verify-gaps.mjs
```

`probe.mjs` 生成 8 个诊断变体，写入独立的 `runs/review-20261015/` 并保存报告；不修改原金标或评分器。`verify-gaps.mjs` 独立验证遮挡确实阻止鼠标点击、属性赋值确实落入 Storage。`evidence/*.json` 是本次运行快照，重新运行不会自动覆盖这些审计摘要。

后续修复应按现有版本规范升级评测版本、重新校准，再报告前后变化。修复后探针预期也需更新：这份探针用于复现当前漏检，不应把修复后不再漏检误报为评测器退化。
