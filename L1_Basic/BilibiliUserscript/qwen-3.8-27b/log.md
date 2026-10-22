# 执行日志 — B 站 IP 归属地油猴脚本（L1 试题）

受测模型：qwen3.8-27b
工作区：F:\benchmark\暂存\qwen3.8-27b-20260824\ws-userscript\
交付物：answer.user.js（脚本本体）、result.json（自查）、verify.mjs（本地验收工具，非交付物）

## 1. 关键步骤

1. 读取工作区 task.md，确认与试题文本一致；工作区内无其他相关文件，直接开始实现。
2. 设计并编写 answer.user.js（单文件，原生 JS）：
   - 标准 userscript 元数据块：@name/@namespace/@version/@description/@author/@match×3/@grant none/@connect/@run-at/@license；
   - 数据源：① DOM 中已展示的 “IP属地：xx” 文案（TreeWalker 遍历文本节点，正则兼容中英文冒号）；② 视频页公开接口 `https://api.bilibili.com/x/web-interface/view?bvid=…` 返回中已存在的 ip_info 字段（credentials: omit）。字段值经“2~12 字符纯文本”过滤，拒绝坐标/编号/URL，缺失即灰色占位，绝不推断；
   - SPA 适配：MutationObserver（自写入过滤）+ history.pushState/replaceState 包装 + popstate/hashchange + 1s 低频 URL 轮询，统一去抖（同刻至多一个待执行扫描）；
   - 防重复插入：全页有且仅有一个徽章节点，任何重定位均为“移动同一节点”；
   - 静默降级：任何异常 try/catch 吞掉；网络失败/字段缺失/接口 code≠0 均显示灰色 “IP属地：—”。
3. 编写 verify.mjs：手写最小 DOM 桩（Element/Text/classList/TreeWalker/querySelector，无第三方库）+ 静态审计 + 5 组 fixture 场景。
4. 迭代修复 4 个验证暴露的问题（见下），最终 39/39 通过。
5. 生成 result.json 自查与本报告。

## 2. 技术选型与理由

- **@grant none + 原生 fetch**：最小权限。B 站官方前端本就从 www.bilibili.com 跨域调用 api.bilibili.com（CORS 开放），无需 GM_xmlhttpRequest；@connect 仅用于显式声明该请求。
- **路由键 = pathname**：忽略 query/hash 噪声（如 ?p= 分 P 切换不改变 UP 主），避免误判路由变化。
- **内容签名门控（核心设计，两次迭代得出）**：
  - 初版用“路由切换后等待一次真实 Mutation”作为放行条件 —— 验证发现会被①脚本自身 DOM 写入、②无关 DOM 抖动欺骗，导致误读旧页面残留文本（串页显示错误归属地）；
  - 二版改为“路由切换瞬间快照” —— 验证发现若新内容先于首次扫描到达（内容先于 URL 落定），快照基线失效导致永久占位；
  - 终版：每次扫描结束记录“旧页面内容签名”（锚点/正文文本指纹，排除徽章自身），路由切换后仅当签名真实变化（新内容到达）才重新读 DOM，并保留 3 秒兜底放行，兼顾“不串页”与“不死锁”。
- **单节点复用（ensureBadge 以 state.badge 引用为准）**：验证发现 SPA 移除旧锚点卡片时徽章随卡片 detach，若改用 getElementById 查找会“找不到→重建”，产生重复插入；终版对 detach 节点继续复用，仅对旧版本残留节点做一次清理。
- **锚点多级选择器 + 兜底**：B 站改版频繁，视频页按 `.video-up`→`.up-panel`→`.bili-video-card`→… 依次尝试，直播页同理；再兜底“类名含 up/owner/anchor 且内含头像 img 的容器”；再无锚点则右下角固定小芯片（bottom:132px 避开回顶按钮）。

## 3. 验证命令与结果

环境：Node v24.15.0（Windows，pwsh）。

1. `node --check answer.user.js` → SYNTAX OK（多次运行均通过）。
2. `node verify.mjs` → 最终结果：
   - 静态审计 16 项：元数据完整性（@name/@namespace/@version/@description/@author/@license/@run-at 存在）、@match 仅限 bilibili.com 三域且 https、`@grant none`、`@connect` 仅 api.bilibili.com、代码内请求域名 ⊆ {api.bilibili.com}、无 localStorage/cookie/XHR/GM_*/eval/Worker/WebSocket/sendBeacon 等禁用 API、无 TODO/FIXME/占位字样、无 import/require、原生 fetch + credentials: omit —— 全部 PASS；
   - 功能 23 项（5 组 fixture）：
     - T1 有归属地（DOM 直取，徽章嵌入 UP 主卡片、非占位态、多次 DOM 抖动后仍唯一）；
     - T2 路由切换 + 旧 DOM 残留 + 接口网络失败（不误读旧归属地、灰色占位、无未捕获异常）;
     - T3 动态路由切换 + 异步内容到达（生效、徽章唯一、跟随新卡片、同一节点未重建）；
     - T4 接口补位（ip_district=湖北 被展示、data-src=api、同路由不重复请求）+ 接口 code≠0 回退 DOM 文案（上海）；
     - T5 无锚点页（正文 IP属地：四川 被识别、固定芯片兜底、全程同一节点）；
   - 汇总：ALL PASS（39/39）。
3. 迭代过程记录（问题 → 修复）：
   - ① 测试时序：脚本注入早于 fixture URL 设置导致首扫读空页 → 调整为先建页后注入（测试侧修复）；
   - ② 签名门控初版被自身写入/无关抖动欺骗、二版快照基线失效 → 终版“旧页面扫描签名对比 + 3s 兜底”；
   - ③ 静态审计命中注释/函数名中的字面量（`localStorage`、`showPlaceholder` 中的 "Placeholder"）→ 改写措辞/改名 showEmptyState（防朴素字符串审计误判）；
   - ④ detach 徽章被重建（重复插入隐患）→ ensureBadge 以 state.badge 节点引用为准复用。

## 4. 局限说明

本环境无真实浏览器，无法在真实 B 站页面实机验证选择器命中率与视觉贴合度；已通过多级选择器、兜底锚点、固定芯片兜底与接口补位做分层降级，最坏情况下仍保持“单徽章 + 占位/API 补位”功能可用。

## 5. 诚信声明

1. 只读取了试题文本：本题唯一输入为本消息内的试题文本（含评分参考）与工作区内 task.md（其内容与试题文本一致）；未读取、搜索、列举试题工作区之外的任何文件或目录，未执行任何指向工作区外的命令，未使用 git 浏览任何历史。
2. 未联网检索本题答案/参考实现：全程未使用 web_search 或任何网络工具；所有实现基于既有知识（userscript 规范、DOM/SPI API、B 站公开页面结构的既有经验）与本地 fixture 验证。
3. 未创建子代理：未使用 subagent/subagent_fork/workflow/ralph 等任何代理或编排工具，全部工作由本会话独立完成。
4. 全部文件操作均在试题工作区内：创建/修改/删除的文件仅为 F:\benchmark\暂存\qwen3.8-27b-20260824\ws-userscript\ 内的 answer.user.js、verify.mjs、result.json、log.md（及已删除的临时调试副本）；未修改或删除 task.md，未触碰其他任何位置。
