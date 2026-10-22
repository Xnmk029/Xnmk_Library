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
