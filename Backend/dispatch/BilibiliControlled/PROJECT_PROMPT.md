# Bilibili 评论 IP 属地 Userscript：受控回放题面 v2

编写一个可直接安装的 `answer.user.js`，在 B 站电脑端**每条主评论和每条楼中楼评论的发布时间旁**展示该条评论已返回的公开 IP 属地。评测环境是现代 Chromium、Tampermonkey 等效的页面上下文；脚本在 `document-start` 注入。无需真实账号、签名接口或外部访问。

本题在下文给出 `CONTRACT.md` 全文，它是公开的页面与组件数据契约。可以阅读这份文件；其他项目文件不属于输入。使用任意满足行为要求的实现，不要求采用特定框架钩子或特定 DOM 标签作为输出。

## 必须实现

1. 支持契约中的 Lit / Open Shadow DOM、Vue 3 和 `bbComment` 旧评论三种形态，以及各自主评论和楼中楼。Vue 3 的楼中楼数据是 `subReply`，不能拿 `rootReply` 代替。
2. 只使用该条评论的 `reply_control.location`。它是评论发布时的属地；同一 UID 的不同评论可以不同。若需要关联响应缓存，使用完整 `rpid_str`；不要把超出安全整数范围的 ID 转成 Number。
3. 不从用户名、UID、资料城市、评论正文或通用 `location` 字段推断属地。不显示完整 IP 地址、经纬度或实时位置。
4. 页面异步加载、重复渲染、SPA 的 `pushState` / `replaceState` / `popstate`、评论容器替换和 DOM 复用后，展示仍然正确。SPA 可以从 Lit 视频评论切换到 Vue 3 活动页评论，不能只根据初始 URL 安装某一种策略。数据可先于或后于节点出现；Open Shadow Root 可稍后附加。
5. 每条评论最多一个属地标签。已有可见的原生属地标签时保留它，避免重复。评论变更后更新标签，属地字段被清空时移除旧值。
6. 字段缺失、为空或页面请求失败时，不报未处理异常，不弹窗；在该条评论的时间栏提供可识别的轻量状态，如灰色“IP属地：未获取”或“—”。不得把提取失败表述为已经确定的用户位置。
7. 属地字符串必须作为纯文本处理，即使包含 `<`、`>` 等字符，也不能生成可执行 HTML。标签贴合时间栏，长文字可截断；720px 与 1280px 宽窗口下，回复/更多控件保持可见、可点击，无重叠和浮动遮挡。

## 交付与限制

- 仅交付一个 `answer.user.js`，原生 JavaScript，无第三方库、`@require`、远程资源或模块导入；没有 TODO / 未完成分支。
- 标准 Userscript 元数据至少包含 `@name`、`@namespace`、`@match`、`@grant`，声明实际运行域名和权限。匹配仅限 Bilibili；`unsafeWindow` 可按需要使用，不能机械要求 `@grant none`。本环境支持 `none`、`unsafeWindow`、`GM_addStyle`/`GM.addStyle`、`GM_registerMenuCommand`/`GM.registerMenuCommand`；请求、持久化、剪贴板等额外授权不属于本题必要权限。
- 本回放题**禁止脚本主动发起任何网络请求**；允许被动观察页面自身的既有 GET 响应。请在元数据注释中声明没有额外请求。`@connect` 不会替代普通 fetch 的 CORS 规则。
- 不上传、不写 cookie/localStorage/sessionStorage/IndexedDB/GM 存储，不记录任何用户隐私数据，不请求剪贴板等无关权限。
- 脚本安装后无需修改核心代码。可以观察 DOM、组件数据、生命周期和页面现有请求；保留页面原方法的返回值、异常语义和现有控件行为。

## 可重复评测边界

通过公开契约的离线浏览器回放验证行为，使用变化的评论 ID、顺序和属地值。评测不要求逐字复刻某个开源项目，也不以源码相似度计分。真实 B 站环境、完整用户脚本管理器兼容性以及未列出的页面形态另做实站验收，不计入离线总分。

本题为新版本，不能与使用旧 `PROJECT_PROMPT.md` 的历史模型成绩直接混排。


---

# 被测脚本可见的页面数据契约

所有样例数据均为合成数据。字段名和生命周期形态来自冻结的公开组件行为；回放不是 B 站生产 bundle 的完整副本。候选只依据本契约实现，不要求访问外部网站。

## 共同数据

```js
const main = {
  rpid_str: '9007199254740992', rpid: 9007199254740992,
  reply_control: { location: 'IP属地：广东' },
  member: { mid: '10001', uname: '测试用户', location: '资料城市：北京' },
  content: { message: '我来自上海' }
};
const sub = {
  ...main, rpid_str: '9007199254740993',
  root_str: main.rpid_str, parent_str: main.rpid_str,
  reply_control: { location: 'IP属地：湖北' }
};
```

`rpid` 在大 ID 下可能已经舍入，`rpid_str` 才是完整标识。`reply_control.location` 可缺失、空字符串、变化或清空。同一个 UID / 用户名可以在不同评论中出现不同属地。`member.location`、正文中的属地字样和评论顶层通用 `location` 均不是属地证据。

## Lit / Open Shadow DOM

```text
bili-comments #shadow-root(open)
  bili-comment-thread-renderer #shadow-root(open)
    bili-comment-renderer #shadow-root(open)
      bili-comment-action-buttons-renderer #shadow-root(open)
        #footer > #pubdate + 回复/更多按钮
    bili-comment-reply-renderer #shadow-root(open)
      bili-comment-action-buttons-renderer #shadow-root(open)
        #footer > #pubdate + 回复/更多按钮
```

主/子评论 renderer 常带 `.__data = reply`；操作栏组件提供 `.data = reply` 和 `update()` 生命周期。也存在只保留操作栏 `.data` 的变体。组件由 `customElements.define` 注册，脚本注入早于组件注册。Open Shadow Root 可以在宿主插入后才附加。`update()` 可多次调用，renderer 可复用来展示另一条评论。

若时间栏已含可见的原生 `#location`，保留原节点与文字，不再增加第二份属地。

## Vue 3

```html
<div class="reply-list">
  <div class="reply-item">
    <div class="comment-body"></div>
    <div class="reply-info"><span class="reply-time">发布时间</span><button>回复</button><button>更多</button></div>
  </div>
  <div class="sub-reply-item">
    <div class="comment-body"></div>
    <div class="sub-reply-info"><span class="sub-reply-time">发布时间</span><button>回复</button><button>更多</button></div>
  </div>
</div>
```

元素的 `.__vueParentComponent.props` 包含 `{reply}` 或 `{subReply, rootReply}`；实例 `vnode.props` 也携带对应数据。兼容钩子可能把实例挂到 `element.__vue__`。回放会模拟 Vue 使用 `new Proxy({ _: component }, {})` 创建代理及后续 `vnode.el` 绑定。`__vue__` 不是浏览器原生属性，不应假设总是天然可用。

## bbComment 旧形态

页面在脚本注入后赋值 `window.bbComment`；原型的 `_createListCon(item, i, pos)` 与 `_createSubReplyItem(item, i)` 返回主评论/楼中楼 HTML。主节点是 `.reply-wrap[data-id=rpid_str]`，子节点是 `.sub-reply-item[data-id=rpid_str]`，时间栏是 `.info > .reply-time`，包含回复/更多控件。渲染函数参数 `item` 是该条评论数据。

## 页面请求与路由

页面自身可能调用 `GET https://api.bilibili.com/x/v2/reply/main?...`，返回 `{code:0,data:{replies:[...]}}`；失败时可返回非零 `code`。回放本地提供真实浏览器 fetch / Response，脚本可被动读取克隆响应，不能吞掉页面响应或自己请求。抓取接口不是完成任务的必要条件。

页面路径使用 `/video/*`、`/blackboard/replay.html` 和 `/blackboard/feed-topic.html`；路由切换仍在 `www.bilibili.com`，可从 Lit 视频页切到 Vue 3 活动页。控件布局和语义不依赖回放器的验证标识，输出可以使用任意类名/属性。
