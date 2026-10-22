# REVIEW.md · 自动审阅报告

- **run_id**: `20261016-013453-BilibiliUserscript`
- **model**: `nvidia-nemotron-3.5-super-vl-free`
- **project**: `L1_Basic/BilibiliUserscript`
- **protocol**: `2.0` (bare)
- **reviewed_at**: 2026-10-16T04:38:01+0800
- **review_scope**: `project_prompt_only`（仅对照题面，不读 README 评分细则 / 其他模型输出）
- **prompt_sha256**: `17353992e61d730adeb351dae62ecc5ffa28dfcbbf954f6cc8c3039d43925e9d`
- **verdict**: **PASS_WITH_WARNINGS**

## 检查表

| ID | Status | Detail |
|---|---|---|
| P1 | **PASS** | 题面载入 2178 chars |
| H1 | **PASS** | workdir 在仓库外: F:\bench-runs\nvidia-nemotron-3.5-super-vl-free\20261016-013453-BilibiliUserscript |
| H2 | **PASS** | 快照 diff 干净：新增 1 个文件，无修改/删除 |
| H3 | **PASS** | transcript (43253 chars) 未见仓库路径痕迹 |
| D0 | **PASS** | 交付物: answer.user.js |
| D1 | **WARN** | D1通用HTML关键词扫描误判：题面明确要求可安装answer.user.js；HTML出现在字符串安全处理要求中，不是要求交付HTML文件。UserScript头与纯语法检查通过；仅复核交付形态，未证明脚本功能或真实站点兼容。 |
| D4 | **PASS** | 已扫描 1 个文本交付物，未见占位符红线 |
| D5 | **PASS** | 未见明显路径逃逸字符串 |
| D6 | **N/A** | 题面未声明外部 3D 禁令或无 HTML |

## 题面要求对照（勾选由审阅 agent / 人工补全）

> 下列条目从题面机械提取，仅对审阅可见；受测方从未见过这份摘要。

- ### 交付要点
- - [ ] 仅交付一个 `answer.user.js`，原生 JavaScript，无第三方库、`@require`、远程资源或模块导入；没有 TODO / 未完成分支。
- - [ ] 标准 Userscript 元数据至少包含 `@name`、`@namespace`、`@match`、`@grant`，声明实际运行域名和权限。匹配仅限 Bilibili；`unsafeWindow` 可按需要使用，不能机械要求 `@grant none`。本环境支持 `none`、`unsafeWindow`、`GM_addStyle`/`GM.addStyle`、`GM_registerMenuCommand`/`GM.registerMenuCommand`；请求、持久化、剪贴板等额外授权不属于本题必要权限。
- - [ ] 本回放题**禁止脚本主动发起任何网络请求**；允许被动观察页面自身的既有 GET 响应。请在元数据注释中声明没有额外请求。`@connect` 不会替代普通 fetch 的 CORS 规则。
- - [ ] 不上传、不写 cookie/localStorage/sessionStorage/IndexedDB/GM 存储，不记录任何用户隐私数据，不请求剪贴板等无关权限。
- - [ ] 脚本安装后无需修改核心代码。可以观察 DOM、组件数据、生命周期和页面现有请求；保留页面原方法的返回值、异常语义和现有控件行为。
- ### 限制要点
- - [ ] 不得检索、下载、抓取或参考任何现有实现**（包括但不限于 BiliReveal 及其衍生版本、Greasy Fork / GitHub 上的同类油猴脚本，以及任何转载或镜像源码）。本任务只以题面与 `CONTRACT.md` 为输入。
- - [ ] 不得在交付物中携带外部项目的标识**：不得出现来自其他项目的名称、命名空间、CSS 类名、自定义事件名、注释署名或版权头（例如 `bilireveal`、`BiliReveal`、上游作者名及其派生标识）。
- - [ ] 交付物须为本会话独立编写。评测按可见行为计分，不按源码相似度计分；但若发现交付物复用了外部实现的标识或成段结构，本题成绩作废。
- - [ ] 允许使用模型自身的既有知识；禁止的是**本次作答过程中的联网检索与外部代码获取**。
- ### 静态红线
- - [ ] 不得包含 TODO 或未完成占位符（若题面明确要求）

## 智能层补记

> 审阅 Agent 追加：逐项勾选、引用依据、运行时观察、是否推翻机器 verdict。禁止粘贴其他模型实现。

D1通用HTML关键词扫描误判：题面明确要求可安装answer.user.js；HTML出现在字符串安全处理要求中，不是要求交付HTML文件。UserScript头与纯语法检查通过；仅复核交付形态，未证明脚本功能或真实站点兼容。

## 结论说明

- `PASS`：静态检查与观测完整性通过。
- `FAIL`：交付物红线（缺失、占位符、SVG 无效等）。
- `INVALID`：观测到的完整性违规（H1 隔离失效 / H2 快照污染 / H3 越权读题）——作废不收卷。
- `WARN`：需人工复核，不自动否决。
- 本报告**不**替代 README「自动化验收建议」中的运行时/视觉验收。

---
*由 sandbox/scripts/review_run.py 生成（protocol 2.0）。*
