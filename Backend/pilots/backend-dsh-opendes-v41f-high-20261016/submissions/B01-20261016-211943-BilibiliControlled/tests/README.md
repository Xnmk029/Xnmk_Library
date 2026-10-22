# 验证说明

交付物是仓库根目录的 `answer.user.js`。本目录只放离线回放的验证工具，**不属于交付物**。

## 运行

```powershell
node tests/jsdom-runner.js     # 契约回放：三种形态 + 生命周期 + 布局结构（49 项）
node tests/edge-cases.js       # 边界加压：不可配置属性、深层组件树、清空/换值、原生让位、大整数 ID（21 项）
node tests/audit-refs.js       # 静态审计：被引用但未声明的标识符（防止静默 catch 掩盖缺陷）
node tests/audit-swallowed.js  # 运行时审计：把脚本内所有静默 catch 改为上报，确认无吞掉的异常
node tests/runner.js           # 真实 Chromium 像素级布局检查（需要可用的 CDP 调试通道）
```

前四个使用 `tests/harness/node_modules/jsdom`（已随目录提供，离线可跑）。
`tests/runner.js` 需要本机 Chromium 且允许 DevTools 调试命令通道与命名管道；
在受限沙箱中该通道不可用，因此以 `jsdom-runner.js` + 静态审计作为可重复的替代验证。

## 覆盖范围与题面要求的对应

| 题面要求 | 验证位置 |
| --- | --- |
| Lit / Open Shadow DOM 主评论与楼中楼 | `replay.html` 场景一（含「Shadow Root 稍后附加」「宿主先插入」） |
| Vue 3 主评论与 `subReply` 楼中楼 | `replay.html` 场景二；`edge-cases.js` 用例 2 |
| `bbComment` 旧形态 | `replay.html` 场景三；`edge-cases.js` 用例 1 |
| 只认 `reply_control.location` | 场景二「only reply_control.location」（`member.location`、正文、顶层 `location` 均被排除） |
| 完整 `rpid_str`、不做大整数 Number 化 | `edge-cases.js` 用例 5（相邻 ID `...992` / `...993` 不串味） |
| 异步加载 / 重复渲染 / DOM 复用 | 场景一 `update()` 复用、场景二列表项复用、`edge-cases.js` 用例 3 |
| SPA `pushState` / `replaceState` / `popstate` | 场景二（过程中仍正确） |
| 数据先于或后于节点出现 | 场景一「节点先于数据」、场景二「数据先于节点」 |
| 每条评论最多一个标签、原生标签优先 | 场景一 native 分支、`edge-cases.js` 用例 4；全局去重断言 |
| 字段缺失/清空/请求失败时的轻量状态 | 场景二、`replay.html` 场景四（500 响应）、`edge-cases.js` 用例 3 |
| 属地按纯文本处理（XSS） | 场景二「xss …」三项断言（`<img onerror>` 不生成元素、不执行） |
| 长文本截断、720/1280 下控件可见可点 | `jsdom-runner.js` 的 `layoutProblems`（结构 + CSS）；`runner.js` 做像素级复核 |
| 不主动发起网络请求、不写存储 | `answer.user.js` 中无 `fetch(` 调用 `XMLHttpRequest` / `sendBeacon` / `WebSocket` / `new Image`；无 `localStorage` 等写入 |

## 关键设计取舍（为什么需要轮询兜底）

组件的数据变化不一定伴随 DOM 变更：契约明确 `update()` 可多次调用、renderer 可复用展示另一条评论，
而 `.data` / `__data` 是普通属性，赋值不会触发 `MutationObserver`。因此脚本采用三层机制：

1. `attachShadow` / `connectedCallback` / Lit `update()` 等生命周期钩子（即时）；
2. `MutationObserver` 监听 `document` 与每个 Open Shadow Root（节点变化即时）；
3. 已跟踪条目的轻量周期刷新 + 自适应的深度兜底巡检（覆盖「只换数据」的场景）。

`jsdom-runner.js` 里凡是仅改数据、不动 DOM 的断言，都依赖第 3 层，这也是该层不可省略的原因。
