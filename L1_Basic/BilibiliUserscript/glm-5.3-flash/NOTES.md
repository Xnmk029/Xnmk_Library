# NOTES.md — 真实页面对照：选择器↔快照证据映射表（迭代 #2）

校准对象：`answer.user.js` v2.0.0（2026-08-27）
快照目录：`reference/`；机器可读偏移索引：`reference/evidence-index.json`
偏移号 = 该 key 在文件中的首次出现字节位置（0-based），用于精确复核。

## 0. 抓取台账（全部 GET / 不带 cookie / 未登录 / 合计 5 次 ≤ 10 上限）

| # | 时间(+08:00) | URL | 存档 | HTTP | 字节 |
|---|---|---|---|---|---|
| 1 | 2026-08-27T01:03:34 | https://www.bilibili.com/video/av170001/ | snap-video-av170001.html | 200 | 169,114 |
| 2 | 2026-08-27T01:04:07 | https://api.bilibili.com/x/v2/reply?type=1&oid=170001&pn=1&ps=20&sort=1 | api-reply-av170001.json | 200 | 43,198 |
| 3 | 2026-08-27T01:06:51 | https://s1.hdslb.com/bfs/static/jinkela/video/video.8244368d….js | bundle-video-main.js | 200 | 3,566,561 |
| 4 | 2026-08-27T01:07:07 | https://s1.hdslb.com/bfs/seed/jinkela/commentpc/bili-comments.js | comp-bili-comments.js | 200 | 586,462 |
| 5 | 2026-08-27T01:07:07 | https://s1.hdslb.com/bfs/seed/jinkela/commentpc/new-comment.min.js | comp-new-comment.min.js | 200 | 761,461 |

## 1. 结构事实 ↔ 实现取点 映射表

| # | 实现 element（v2） | 快照文件 | 偏移 | 原文关键片段（截录） |
|---|---|---|---|---|
| E1 | 评论挂载壳 `#commentapp` | snap-video-av170001.html | 124,680 | `<div id="commentapp" data-v-14517dd1></div>`（空壳，内容由前端注入） |
| E2 | oid 来源 `window.__INITIAL_STATE__.aid` | snap-video-av170001.html | 38,155 | `"aid":170001,"bvid":"BV17x411w7KC"`（videoData 为兼容防御分支） |
| E3 | 主楼条目 `.list-item.reply-wrap` | comp-new-comment.min.js | 278,089 | `'…class="list-item reply-wrap ' + (item.isTop||item.isUpTop?'is-top':'') + '" data-id="' + item.rpid + …` |
| E4 | 楼中楼条目 `.reply-item.reply-wrap` | comp-new-comment.min.js | 306,976 / 308,286 / 382,028 | `'<div class="reply-item reply-wrap" data-id="' + item.rpid + '" data-index="' + i + '">'` |
| E5 | rpid 定位属性 **data-id**（非 data-rpid） | comp-new-comment.min.js | 同 E3/E4 | 两级模板均为 `data-id="' + item.rpid + '"` |
| E6 | 徽标宿主首选 `.info > .time-location` | comp-new-comment.min.js | 283,394 | `'<div class="info">', … ,'<span class="time-location">', '<span class="reply-time">'…` |
| E7 | 宿主候选链后位 info/user/userInfo | comp-new-comment.min.js | 283,340 上下文；楼中楼模板见 E4 | `attachUserBlock/userInfo` 片段：楼中楼含 `<span class="userInfo">`；黑名单变体含 `class="blacklist-font-color name"` |
| E8 | 原生 IP 属地气泡类 `.reply-location`；文案 `IP属地：${item?.reply_control?.location}` | comp-new-comment.min.js | 283,542（第二处 307,516） | **该行当前以 `//` 注释停用**：`// item?.reply_control?.location ? \`<span class="reply-location">IP属地：…</span>\` : ''` |
| E9 | IP 字段唯一读取路径 `reply_control.location`（省份级裸文本） | comp-new-comment.min.js | 283,542 | 模板变量本身即字段路径（配合下方 JSON 负向证据） |
| E10 | 组件容器 CSS 链 `.comment-list .list-item .reply-box .reply-item`；运行时 `find('.reply-box .reply-item')` | comp-new-comment.min.js | 550,418 / 338,459 | 样式串原文 + jQuery find 原文 |
| E11 | 渲染器无 Shadow DOM（jQuery light-DOM 直渲）；bili-comments.js 仅个别控件 attachShadow(mode:"open") | comp-new-comment.min.js(全文 attachShadow=0) / comp-bili-comments.js | 14,143 | ⇒ v2 扫描层实现 light+open-shadow 双路径为形态升级防御 |
| E12 | 主评论列表接口（legacy 免签）：`x/v2/reply?type=&oid=&pn=&ps=&sort=` 返回 code=0 | api-reply-av170001.json | 1 | `"code":0,"message":"OK"`，page.count=186,004，replies[] 含嵌套子回复 |
| E13 | **负向证据**：未登录响应不含任何 IP 字段 | api-reply-av170001.json | 7,559 起 | 全文 `"location"` 键出现次数=0；reply_control 键联合={max_line,sub_reply_entry_text,sub_reply_title_text,support_share,time_desc,translation_switch}；member.user_profile 键不存在 |

## 2. v1 → v2 校准发现的缺陷清单（均已修复）

| # | 缺陷（v1 行为） | 证据反证 | v2 修复 |
|---|---|---|---|
| D1 | 属性名猜写 data-rpid/data-reply-id；条目类泛配 .reply-item/.list-item | E3/E4/E5：真实属性为 **data-id**，两级模板类形如上 | 条目收集走 ITEM_QUERY；核心处理按 marker 类族 classifyItem/直接逐条处理，rpid 一律读 data-id |
| D2 | IP 字段三路猜测（rc.location/ip_location/user_profile.location） | E8/E9：唯一路径 rc.location；E13：另两路键根本不存在 | extractEntry 仅读 rc.location；normalize 兼容裸省份与「IP属地：」前缀两种返回形态 |
| D3 | 未考虑组件渲染形态（Shadow DOM / jQuery 注入壳） | E11 | forEachReachableRoot 递归 open shadowRoot 并逐一挂观察器；扫描层与节点工具不依赖全局 querySelectorAll 单路径 |
| D4 | 徽标宿主 .user-name 系猜测（渲染器 0 命中） | E6/E7 | HOST_CANDIDATES=['time-location','info','user','userInfo']，均出自模板原文 |
| D5 | 计划性调用二级接口 x/v2/reply/reply、attr 数字盲扫补数据 | E12/E13 + 配额纪律 | 删除二级接口与盲扫；主动外呼收敛为一个已实测端点的只读 GET，且仅当 P1/P3 缺数据时触发一次 |
| D6 | fetch credentials:'include' | 权限最小化原则 | P2 改 credentials:'omit'；登录态敏感数据由 P1 被动监听覆盖（页面自身请求自带会话） |
| D7 | （回放自测发现）二次处理时自家徽标文本命中 IP_RE，被误判 native | replay S1/S3/S4 失败复现 | processItemNode 先查自家旧徽标再走 native 判定；幂等更新路径与原生展示路径彻底分离 |

## 3. v2 数据通路 ↔ 证据对照

| 通路 | 行为 | 证据 |
|---|---|---|
| P1 被动监听（document-start 包装 window.fetch） | url 含 `/x/v2/reply` 的页面自身请求 clone 后只读吸收 data.replies（递归含楼中楼），兼容 legacy 与 wbi/main 变体，免签名/免风控/随会话 | 页面真实加载了 commentpc 组件脚本并调接口（REQ#3 bundle 内 commentpc 引用；REQ#2 实测端点族） |
| P2 显式回退（credentials:'omit' 单次 GET） | 仅当能从 URL/__INITIAL_STATE__ 确凿取得 oid 且该目标从未尝试过时发起；失败连续 3 次闩锁停呼 | E2/E12：URL→aid 映射与端点可用性均有实抓验证；type/oid 参数语义为本端点既有约定 |
| P3 DOM 透传（light + open shadow 双路径） | 条目已含 `.reply-location` 或任意「IP属地」文本 → nativeSeen 跳过不插徽标；否则按 data-id/byMid 取映射注入灰字徽标（元素级 inline 样式，shadow 内同样生效） | E6/E7/E8/E10/E11 |

## 4. fixture 回放自测构成说明（_selftest/replay.test.js，19 断言）

- **JSON 数据**：直接读取 reference/api-reply-av170001.json 的真实条目对象
  （一级评论、嵌套子回复 root!=0 者均取自实抓响应）。
- **DOM 片段**：按 comp-new-comment.min.js 模板字符串逐字重建
  （主楼 `list-item reply-wrap[data-id=rpid][data-index]`、楼中楼 `reply-item reply-wrap[同]`、
  `info > time-location > reply-time`、楼中楼 `user > userInfo` 宿主链、`reply-box` 挂载容器）。
- **合成规则披露**：真实快照为未登录抓取，`reply_control.location` 未下发（E13）；
  回放中 location 值（浙江/湖南/广东/四川/上海/江苏）为合成注入以模拟登录态下发形态，
  字段路径与数据形状依据 E8/E9 的渲染器模板原文。除此之外无任何虚构结构。

## 5. 已知局限（迭代 #2 新增）

1. 登录态下现网是否仍下发 location 字段无法在无凭据约束内验证；若服务端彻底停发，
   脚本对未知条目保持零动作（P3 原生透传路径仍有效），不会出现错误标注。
2. t.bilibili.com 动态页 / /opus/ 图文页的 oid→type 参数组合未做实抓校准：
   其评论主要依赖 P1/P3 通路；resolveTarget 保留相应分支仅供 P2 兜底，相关局限如实披露。
3. closed Shadow Root 无法枚举（平台限制）；若评论组件迁移到 closed 形态，
   扫描器将退化为 light-DOM 观察＋路由兜底轮询，属静默降级而非功能报错。
4. 抓取配额克制（5/10）：未实测「未登录前端运行时」的最终渲染 DOM——组件脚本的
   无 attachShadow 证据与 jQuery 渲染链已支持 light-DOM 判断，且双路径实现使该不确定性不影响可用性。
