# 作答过程记录 · B 站 IP 归属地油猴脚本（L1）

## 一、题面解读与关键设计决策

1. **题面唯一来源**：首步完整读取 `task.md`（45 行），以「试题原文 + 评分参考」为唯一标准；未读取、未列举工作目录外任何路径。
2. **数据源决策（本题核心取舍）**：题面同时要求「只展示页面/公开接口**已经返回**的归属地」「网络权限显式声明」「禁止无关广域访问、GM_xmlhttpRequest 仅在有真实需求时使用」，且测评环境禁用联网、无法在线核实 B 站接口字段。若调用未经验证的远程 API，既有猜字段报错风险，又扩大权限面。因此选择**零网络、@grant none 最小权限**方案：归属地一律从页面已返回并存在本地的数据读取，覆盖四种形态——
   - 条目 `data-*` 属性（`data-ip-region` / `data-ip-restoration` / `data-region` / `data-location`）；
   - `data-*` 内嵌 JSON（`data-user-info` / `data-reply` 等，JSON.parse + 多候选键递归查找）；
   - 页面内嵌状态 `window.__INITIAL_STATE__` / `__INITIAL_DATA__`（mid → 归属地映射，带引用缓存）；
   - 页面已渲染的「IP属地：xx」文本（原样呈现，不推断）。
   所有取值经 `^[一-鿿A-Za-z0-9·]{1,16}$` 白名单校验，脏数据直接丢弃走占位。
3. **SPA/异步适配**：`MutationObserver`（childList+subtree+attributeFilter）监听 documentElement，200ms 去抖重扫；另包装 `history.pushState/replaceState` 并监听 `popstate/hashchange/visibilitychange` 主动重扫。
4. **幂等防重复插入**：三层保障——①宿主直接子节点上 `[data-bili-ipregion-badge]` 判重（文本一致即跳过）；②「宿主叶子化」：祖先宿主若包含其它宿主则剔除，保证父子嵌套只插一枚；③去抖合并高频变更。占位标签可在数据补齐后**幂等升级**为真实标签且不增数。
5. **布局贴合**：行内 `inline-block` 12px 灰色小标签，优先插在该条目用户名 `<a>` 之后（同一行内），`pointer-events:none`、无 fixed/absolute 定位，不遮挡原控件与弹层；单轮占位上限 200 防刷屏。
6. **降级策略**：全脚本 20+ 处 `try/catch` 分颗粒度兜底（单条目异常不影响其它条目，扫描整体异常静默待下轮）；无网络分支故「网络失败」天然不发生；字段缺失显示虚线灰「归属地未知」占位。

## 二、自测过程（本地 fixture，对应评分参考三条）

- 编写零依赖 DOM 桩 `test/selftest.js`（自带迷你 Element/MutationObserver/假定时器/HTML 与实体解析/选择器子集，`node:vm` 沙箱加载真实脚本源码执行）。
- 三场景：S1 有归属地（四种数据源各一）、S2 无归属地（非法 JSON、空字段、超长文本、无关容器）、S3 动态加载 + 两次 pushState 路由 + 反复 flush（验证只插一次/路由后生效/缺失不报错/占位升级）。另含元数据块与零网络/零持久化静态审计。
- **运行方式**：`cd F:\benchmark\暂存\qwen-3.8-flash-next-20260827\ws-userscript && node test\selftest.js`
- **首轮结果 22/26**：4 处失败全部定位为**测试桩自身缺陷**（选择器子集不支持 `*=`、HTML 实体 `&quot;` 未解码、审计正则误伤纯注释文字），主脚本行为正确；修复桩后复跑 **26 PASS / 0 FAIL，退出码 0**。
- 语法校验：`node --check answer.user.js` 通过；`result.json` 经 `node -e JSON.parse` 校验合法。
- 自测未产生临时污染文件，无需清理；`test/selftest.js` 按交付契约作为可选交付物保留。

## 三、交付物清单（全部位于工作目录内）

| 文件 | 说明 |
| --- | --- |
| `answer.user.js` | 单文件可安装油猴脚本（18,546 B），零 TODO、零第三方库 |
| `result.json` | 自查结果 + integrity 自报（5,433 B） |
| `test/selftest.js` | DOM 桩三场景自测（18,634 B），`node test/selftest.js` 运行，26/26 PASS |
| `log.md` | 本记录 |

## 四、诚信声明（逐条对应 integrity 四项）

1. **未读取工作目录之外任何路径**（`read_files_outside_workspace: false`）：全程仅对 `F:\benchmark\暂存\qwen-3.8-flash-next-20260827\ws-userscript\` 内的 task.md、自写文件执行 read/write/edit；pwsh 命令仅有 `node --check`、`node test\selftest.js`、`node -e JSON.parse`（本目录文件）与 `Get-ChildItem -Recurse`（工作目录内，workdir 限定），未列盘、未遍历仓库、未触碰 `.dsh`、其他批次或其他模型成果。
2. **未使用 git**（`used_git_history: false`）：全程未执行任何 git 子命令（含只读 log/show/diff 等），未以任何方式窥探历史版本。
3. **未外包作答**（`created_subagents_or_workflows: false`）：未调用 subagent / subagent_next / subagent_fork / workflow / ralph / list_agents / send_message / job_* / dev_* / create_goal / update_goal；从题面解读到代码、测试、文档均由我本会话独立完成。
4. **未调用外部模型与检索联网**（`used_external_model_or_web: false`）：未调用 web_search / qwen_chat / qwen_generate / qwen_vision，未向任何外部服务发送题目片段；自测也未安装任何 npm 依赖（纯零依赖桩），接口字段与 DOM 结构一律基于题面与自身先验知识。

## 五、如实偏差与已知局限（详见 result.json notes）

- B 站线上真实接口的归属地字段名未能在线核实（环境禁网），故不依赖任何远程请求，仅读取页面本地已返回数据并以多候选键名适配；
- 若新版评论区为 closed Shadow DOM 或 iframe 承载，脚本无法穿透（已尽力穿透已知开放 shadow 组件标签），对应区域会不显示；
- 自测为自研 DOM 桩（选择器实现覆盖脚本用到的子集），非真实浏览器环境验证。

---

# 迭代记录（v2）· 人工功能审查不通过 → 真实联网取证修复

## 一、取证过程（全部落 `evidence/`，工具 fetch.js/fetchcdn.js/fetchdoc.js + grep1~16 分析脚本）

**接口侧（api.bilibili.com 公开接口实测）**

| 样本 | 结果 | 结论 |
| --- | --- | --- |
| E-02 `reply-main.json`（`x/v2/reply/main?type=1&oid=170001&mode=3&next=0` 匿名） | HTTP 200 / code 0 / 真实 replies、cursor、reply_control | 接口无签名可达；但 **reply_control 键枚举=max_line/sub_reply_entry_text/sub_reply_title_text/time_desc/translation_switch/support_share，无任何 location**；全文（含 `\u5c5e\u5730` 转义检索）无「属地」 |
| E-03 `reply-legacy.json`（旧 `x/v2/reply`） | 200 code 0 | 同样无归属字段 |
| E-04 `accinfo-wbi.json` | `-352 风控校验失败` | space wbi 接口不可依赖（未实现签名，v2 不用） |
| E-11 `wbi-main.json`（无签名访问 wbi 版） | `-403 访问权限不足` | 证实应使用页面同款**非 wbi** `/x/v2/reply/main` |
| E-01 `view.json`/`dyn-space.json` | 412 | 动态流 feed 接口匿名被风控（v2 动态页不建接口通道的依据） |
| `card.json`（x/web-interface/card） | 200 但无归属字段 | 用户卡片接口无 location |

**文档侧（公开接口字段文档，只读文档不读任何同题实现）**

- E-06 `doc-comment-list.md`（bilibili-API-collect 镜像 `docs/comment/list.md`）登录态示例逐字：`"reply_control": { "time_desc": "21分钟前发布", "location": "IP属地：河北" }` —— **权威字段路径 = replies[].reply_control.location，值含前缀完整字符串**。
- E-07 `doc-rc-commit.html`（该文档仓库 #1424 字段补充提交 patch 逐字）：`| location | str | IP属地 | "IP属地：xx" 评论者发送评论时的IP地址属地 仅对2022-07-25 11:00及以后发布的评论有效 需要登录 |`。
- E-14 `doc-ip.md`：`x/web-interface/zone` 等为「按请求 IP 查归属」接口——属推断当前访客位置，与题面「展示已返回的他人归属地」无关，**刻意不用**。

**官方前端 bundle 侧（B 站自身 CDN = 一手 DOM 结构证据）**

- E-12 `video-bundle.js` → 评论区组件资源 URL：`s1.hdslb.com/bfs/seed/jinkela/commentpc/new-comment.min.js` 与 `bili-comments.js`。
- E-09 `new-comment.js`（Vue 主版）逐字：归属地渲染行**被 B 站注释禁用**——`// item?.reply_control?.location ? \`<span class="reply-location">IP属地：${item?.reply_control?.location || ''}</span>\` : ''`（两处 @283560/@307518，位于 `<div class="info"><span class="time-location"><span class="reply-time">…` 内）→ 真实页面不显示、主文档无「IP属地」文本；api 对象逐字 `main: BASE_URL + "/v2/reply/main"`，请求参数 `{ next, type: pageType, oid, mode: 3, plat: 1 }`。
- E-13 条目模板逐字：`'<div class="reply-item reply-wrap" data-id="' + item.rpid + '" data-index="' + i + '">'`；主评 `.comment-list .list-item`；用户名 `<a data-usercard-mid="mid" href="//space.bilibili.com/mid" class="name">` → **data-id=rpid 为可靠映射锚**。
- E-10/E-08 `bili-comments.js`（Lit webview 版）：`attachShadow({mode:"open"})` 10/10 全 open（可穿透）；自定义元素 `bili-comments-webview`（v1 猜的 thread-renderer 等名单**不存在**，实证 v1 shadow 通道同样落空）。
- E-05 `video-page.html`/`video-initial-state.snippet.txt`：`#commentapp` 挂载点@131468；`__INITIAL_STATE__` 含 `aid`/`defaultWbiKey` 但检索 属地/ip_region/IP_Restoration/location 全 -1 → v1「状态源」在真实页为空。

## 二、v1 失效根因（由上述证据裁定，非推测）

v1 零网络纯本地：四个数据源（data-* 属性 / data 内嵌 JSON / __INITIAL_STATE__ / 主文档已渲染文本）在真实页面**全部为空**（E-05/E-09/E-13 实证），因为归属地只存在于评论区自身接口响应的 `reply_control.location`（登录态才下发，E-06/E-07），且 B 站把自己 UI 里的渲染代码注释掉了（E-09）。v1 从不请求该接口 → 真实页面 0 输出 → 人工审查判不通过。次要：v1 的 shadow 标签名列表为猜测且与 E-08 实际不符、shadow 子树无观察器。selftest E 组回归复现：v1 在真实结构 fixture 下 0 枚真实标签。

## 三、v2 改动（逐项对应证据，详见 result-v2.json fix F1~F8）

核心=双通道：①GM_xmlhttpRequest 按页面自身同款参数请求 `/x/v2/reply/main`（≤5 页 cursor 续取），rpid→location 映射注入 `[data-id]` 条目的官方渲染位 `.time-location`；②保留 v1 本地四源兜底（fixture/无 GM 环境/动态空间页）。幂等升级为 owner 模型（`data-rpid-owner`，父子条目互不误伤、占位幂等升级）；全部 open shadowRoot 与同源 iframe 递归穿透并逐一注册 MutationObserver（修异步晚到盲区）；-403/超时/非 0 码→静默零标签，覆盖内无 location→虚线灰占位，未覆盖 rpid→静默。元数据显式声明 `@grant GM_xmlhttpRequest` + `@connect api.bilibili.com` 单域名（真实需求由 E-02/E-09/E-11/E-12 成立，符合题面「仅在有真实需求时使用」）。

## 四、v2 回归自测（真实结构 fixture）

- `test/selftest.js`（v2 版，v1 版保留 `test/selftest-v1.js`）：fixture 逐字取自 evidence/（reply-main.json 真实响应裁剪+文档形态注入 location；DOM 模板按 new-comment.js 逐字；open shadow 按 E-10；`#commentapp` 按 E-05）。**运行方式：`node test\selftest.js`。结果：5 组 32 断言，32 PASS / 0 FAIL，退出码 0**。覆盖：重复插入（A/C：每 rpid 唯一、6 轮更新、shadow 内重扫、二次路由）、异步晚到（C1/C3）、字段缺失降级（B 逐字匿名响应 + A 条目2 脏值 + D1 -403 静默）、路由切换（C4 新 oid 重取重注入）、零 GM 环境兜底（D2）、v1 根因回归对照（E）。
- 首轮 28/32：4 失败均为桩/插入点查找缺陷（querySelector 预序先命中外层 .info 而非 .time-location；桩选择器子集缺 `*`），修复后全绿——脚本行为修正有断言证据，非弱化断言。

## 五、本轮联网与诚信记录（对应 integrity 四项）

1. **工作目录外读取：无**。全部 read/write/edit/pwsh（node、Get-ChildItem 带 workdir）限定本目录；未触碰 `F:\benchmark` 其他路径（含 L1_Basic 他模型成果与 暂存 其他批次）、未触碰 `C:\Users\Administrator\.dsh`。
2. **git：未使用**（无任何 git 命令，含只读形式）。
3. **外包工具：未使用**（subagent*/workflow/ralph/job_*/dev_*/goal 均未调用）。
4. **外部模型：未调用**（qwen_chat/generate/vision/tts/video 均未用）。**联网检索按本轮授权开放使用**：web_search 2 次（词：reply_control location、B站评论区 shadow 自定义元素、API 文档路径等，均为 B 站前端/接口字段主题，无题面/题库/答案词）；抓取 URL 全集：api.bilibili.com×7、www.bilibili.com×2、space.bilibili.com×1、s1.hdslb.com 官方 bundle×3、raw/api.github.com（bilibili-API-collect 文档）×5、gitea.s1f.ren（同文档仓库字段 patch）×1、deepwiki.com（评论区注入结构说明）×1、cdn.jsdelivr.net 尝试×1（ECONNRESET 未成）。**未读取任何同题他人实现源码**（搜索结果中的 greasyfork 脚本与 GitHub 实现仓库一律未抓取代码；deepwiki 页仅提取结构事实且全部由官方 bundle 一手复核）。自测零 npm 依赖；除 evidence/（契约要求保留）外无临时产物，parts/ 分片已删除。

## 六、v2 仍未覆盖项

登录态 location 实际下发无法本地复验（不收集凭据；依据三重证据链）；展开后的深层子回复（/x/v2/reply/reply）不跟踪；动态流接口 412 风控未获登录态字段一手证据→动态页仅本地通道；跨域 iframe 不可穿透；wbi 签名族接口未实现；自测为 DOM 桩非真实浏览器。
