# 评分规则 v2.0.0

真值来自 Node 端生成的合成评论记录，独立于候选及 BiliReveal 输出。验证每条发布时间栏的可见文字和原控件，不要求金标特定类名、节点类型或源码。

| 分组 | 检查 | 分数 | 依据 |
|---|---|---:|---|
| delivery | C01 语法 | 3 | Acorn 按原生 script 解析 |
| delivery | C02 可安装与范围 | 4 | 元数据、Bilibili-only、允许权限、`.user.js` |
| delivery | C03 完成度 | 3 | 无外部依赖/导入、TODO/FIXME |
| privacy | P01 请求/隐私/错误 | 10 | 所有场景无主动请求、写存储、弹窗、未处理错误 |
| correctness | D01 主/子独立属地 | 5 | 每条时间栏正确且只有一份 |
| correctness | D02 同用户不同属地 | 5 | 不按 UID/用户名统一赋值 |
| correctness | D03 大整数 ID | 3 | 相邻字符串 ID 不合并 |
| correctness | D04 文字不执行 | 4 | HTML 字符保真，无可执行元素 |
| correctness | D05 诱饵 | 4 | 正文/资料城市/通用 location 不推断属地 |
| correctness | D06 清空 | 4 | 无旧值，其他评论正确 |
| compatibility | F01 Lit `.data` | 5 | 无祖先 `__data` 的变体 |
| compatibility | F02 Vue3 主评论 | 5 | props / vnode 实例数据 |
| compatibility | F03 Vue3 子评论 | 5 | subReply 与 rootReply 不混淆 |
| compatibility | F04 bbComment | 5 | 旧主/子模板或页面已有响应 |
| lifecycle | L01 异步 | 3 | 节点/数据晚到仍显示 |
| lifecycle | L02 重复 | 3 | 多次更新仍唯一 |
| lifecycle | L03 pushState | 3 | 容器替换，新数据生效 |
| lifecycle | L04 replaceState/popstate | 3 | 从 Lit 切到 Vue3，新策略生效 |
| lifecycle | L05 复用 | 3 | 同 DOM 换成另一条评论 |
| resilience | R01 缺失/空字段 | 4 | 可见安静状态，不猜位置 |
| resilience | R02 页面请求失败 | 3 | 原响应未被消费/篡改，已有数据照常展示 |
| resilience | R03 后附加 Shadow Root | 3 | 异步开放影子树 |
| layout | U01 原生标签 | 4 | 原节点保留且不重复 |
| layout | U02 控件 | 3 | 无遮挡，原点击监听还工作 |
| layout | U03 窄窗口 | 3 | 720px 下长文本不越界、不盖按钮 |
| **合计** | **25 项** | **100** | |

每项通过取得该项全部分数，否则 0；失败原因、文字、元素矩形等保留。组别只是小计，不另加风格分。P01 与 HTML 执行等项目可能同时失败，相关性在原始证据中可见。

C01/C02/C03/P01 为资格门槛。失败时保留原始 `score`，判 `REJECTED`、`qualifiedScore=null`，不能进入正式榜。100 为 PASS；85–99 STRONG；60–84 PARTIAL；低于 60 FAIL。CI 退出 0 仅表示全项通过；已完成但存在失败退出 1；基础设施错误退出 2。

`diagnostic-v1` 是“历史输出在 v2 契约下的诊断通过点数”，无榜单资格。校准反例可只跑对应检查：`selection.complete=false`、`maximumScore<100`、`qualifiedScore=null`，不可当作完整百分制成绩。

## 口径细节

- 支持权限为 none、unsafeWindow、GM 样式/菜单注册；其余范围在新题面明确排除，不要求机械使用 none。
- fetch/XHR 基线页面调用打标允许；脚本主动调用禁止。图片、脚本、导航等额外 HTTP 请求也会被拦截留证。观察既有响应必须保留页面原响应。
- 缺失状态接受未提供/未获取/未知/暂无/未公开/不可用/—/-- 等，不固定金标文案。空白或只有 console 日志不算可见状态。
- 允许去掉 IP 前缀、换标签、长文本截断；不按固定像素图片匹配。

## 证据限制

回放是实际 Chromium 的页面上下文 + GM 模拟，不是完整油猴扩展和完整 B 站前端。HTTP 路由全部本地返回或阻断，但不是恶意脚本安全沙箱。它对已授权评测的生成脚本做行为审计，不加载真实账号数据，也不宣称穷尽所有潜在出站/存储渠道。实站、扩展沙箱、CSP 和沉睡条件分支需要另行验证。
