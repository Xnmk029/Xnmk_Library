# 油猴脚本 IP 显示失效诊断（对比 bilibili-查看IP和历史评论 2.0.1）

日期：2026-08-24
对象：`ws-userscript/answer.user.js`（qwen3.8-27b 交付物） vs `C:\Users\Administrator\Downloads\bilibili - 查看IP和历史评论-2.0.1.txt`（参考实现）

## 结论：为什么 "IP 显示不起作用"

`answer.user.js` 的 IP 数据获取有**两条路径，两条全部失效**，最终必然落入兜底分支，永远渲染灰色占位 `IP属地：—`。

### 失效路径 1：DOM 文本扫描进不了 shadow DOM（主路径，视频页必败）

```js
var IP_TEXT_RE = /IP属地[：:]\s*([^\s<，,。.；;]{2,12})/;
// ...
walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
```

- B 站视频页评论区的 `IP属地：xx` 文本位于 **Web Components 的 shadowRoot 内部**（`bili-comment-thread-renderer` → `bili-comment-renderer` → `#body`/`bili-comment-action-buttons-renderer`）。
- `document.createTreeWalker(document.body, SHOW_TEXT)` 只遍历 **light DOM**，**不进入任何 shadowRoot**（需要 `element.shadowRoot` 逐层深入，或用 `getRootNode()` 感知）。
- 因此视频页上"页面/公开接口已经返回的归属地信息"虽真实存在，但脚本一个都扫不到 → `found = null`。

参考实现正是靠打通 shadow DOM 才拿到数据的：
```js
customElements.whenDefined("bili-comment-action-buttons-renderer").then(() => {
  const proto = customElements.get("bili-comment-action-buttons-renderer").prototype;
  proto.update = function(...args) { ... getLocationFromAny(this) ... };
});
// getLocationFromAny 从 Vue 组件实例 props 读 reply_control.location：
//   source?.__vueParentComponent?.props?.reply?.reply_control?.location
// 注入位置：actionButtons.shadowRoot 内 #pubdate 之后 / #like 之前
```

### 失效路径 2：备用的公开接口根本不返回 ip_info（已实证）

```js
var API_VIEW = 'https://api.bilibili.com/x/web-interface/view?bvid=';
// ...
readIpInfo(d.ip_info) || readIpInfo(d.owner && d.owner.ip_info) || ...
```

2026-08-24 实测 `GET https://api.bilibili.com/x/web-interface/view?bvid=BV1GJ411x7h7`：

- `data` 键（截取）：`bvid,aid,videos,tid,...,owner,stat,...,pages,subtitle,...` —— **无 `ip_info`**
- `owner` 键：仅 `mid,name,face` —— **无 `ip_info`**（也没有 `ip_location`）

即：该接口**从未返回归属地字段**（归属地在评论区接口的 `reply_control.location`，如"广东"，且近期要求 wbi 签名），所以 `fetchUploaderIp()` 永远得到 `null`。

### 两条路径皆空 ⇒ 兜底分支

```js
} else {
  showEmptyState(b);   // 'IP属地：—' 灰色占位
}
```

表现为：脚本装上后，页面只有一个小灰条 `IP属地：—`，IP 永不显示。

## 参考实现的机制差异（为何它能显示 IP）

| 维度 | 参考 2.0.1 | answer.user.js |
|---|---|---|
| 数据位置 | 评论区每条评论的 `reply_control.location`（评论者的 IP 归属地） | 意图显示页面级/UP 主 IP |
| 获取方式 | hook `bili-comment-action-buttons-renderer.update()`，从组件实例 Vue props 读 `reply_control.location` | light DOM 正则扫描 + view 接口 ip_info |
| 是否进 shadow DOM | 是（`actionButtons.shadowRoot` 内注入） | 否 |
| 注入位置 | 每条评论的操作按钮行内（`#pubdate` 后 / `#like` 前） | 页面级徽章（UP 卡片内或右下角） |
| 权限 | `GM_xmlhttpRequest` + `GM_addStyle`（还要第三方 API 查历史评论，本题不涉及） | `@grant none` |

## 修复方向（任选其一/组合）

1. **（推荐）改走评论区真数据 + shadow DOM**：参考实现的机制本身完全符合题面"只展示页面或公开接口已经返回的归属地信息"——`reply_control.location` 正是页面已返回的数据。可 hook `bili-comment-action-buttons-renderer` 在每条评论注入该评论的 IP（最接近参考实现），或至少通过 `document.querySelector('bili-comment-thread-renderer')` → `shadowRoot` 遍历拿文本。
2. **改对接口**：若保留"徽章+接口补位"设计，应换用评论区接口（注意 `x/v2/reply/*` 现需 wbi 签名且 `ip_info`/`location` 在 `reply_control.location`），`x/web-interface/view` 无 IP 字段已实证不可用。
3. **降级兜底解释**：若维持"只展示页面已返回信息"的设计纯度，请至少把 UP 主 IP（空间页 `space.bilibili.com` 的 `IP属地` 恰在 light DOM 中时可取到）与评论区 IP 分开处理，并明确文档中"哪些页面能显示、哪些显示占位"的预期。

## 附：实证记录

- `view` 接口 code=0；`data.ip_info`=NO，`owner.ip_info`=NO（2026-08-24 实测）。
- 参考脚本源码：`initIpLocationFeature()` 段（hook + Vue props 提取 + shadowRoot 注入）。