# fork 修复说明（不替代原交付物）

位置：`ws-userscript/fork/`（原 `ws-userscript/answer.user.js` 保持原样，测试结果不受影响）

## 文件

| 文件 | 说明 |
|---|---|
| `answer-fixed.user.js` | 修复版脚本（v1.1.0-fork，@grant none，可独立安装） |
| `fork-verify.mjs` | DOM 桩验证（node fork-verify.mjs，7/7 通过） |
| `IP-DIAGNOSIS.md`（上一层级） | 失效根因诊断 |

## 修复内容（对照 IP-DIAGNOSIS.md 的两条失效路径）

1. **主路径新增 shadow DOM 就地显示（核心修复）**
   - 参照参考实现（bilibili-查看IP和历史评论 2.0.1）机制：`customElements.whenDefined('bili-comment-action-buttons-renderer')` 后包装其 `prototype.update()`；
   - 渲染完成后从组件实例读取页面已返回的归属地数据：`source.reply_control.location` / `data|reply|subReply.reply_control.location` / `__vueParentComponent.props` / `__vue__.vnode.props`（含遍历 props 兜底）——与参考实现同构；
   - 就地注入到每个评论组件自己的 `shadowRoot`：优先 `#pubdate` 之后、其次 `#like` 之前、最后 appendChild；每组件持有一个节点，值变化只更新文本、不重建，反复 update 不重复插入。
2. **移除失效的接口路径**：`x/web-interface/view` 已实测无 `ip_info` 字段（2026-08-24），不再依赖；视频页由评论区 hook 提供数据。
3. **兜底保留**：space/live/无评论区页面仍显示一个全局徽章，但扫描升级为**递归 shadow DOM 文本扫描**（`IP属地：xx`），不再只扫 light DOM；有 `bili-comments` 的页面隐藏全局徽章避免重复。

## 验证结果

- `node --check`：PASS（语法）
- `node fork-verify.mjs`：**7/7 PASS**
  1. hook 后 update 包装生效
  2. 评论1 就地显示 IP=广东
  3. 评论2 就地显示 IP=上海
  4. 注入位置在 pubdate 之后
  5. 每个评论组件各自持有一个节点（互不干扰）
  6. 反复 update 不重复插入
  7. 无 IP 数据评论不显示节点

## 诚实声明（本次修复的局限）

- DOM 桩是"最小忠实"模拟，**不能替代真实浏览器验证**：B 站实际 DOM 结构（选择器/组件层级/Vue 属性路径）可能随版本变化，`__vueParentComponent` 等内部属性路径需要实机确认。
- 修复版改动的是数据获取与注入机制；未改动交付物 `answer.user.js`。
- 建议实机验证步骤：Tampermonkey 安装 `fork/answer-fixed.user.js` → 打开任意 B 站视频页 → 评论区每条评论操作按钮行内应出现"IP属地：xx"。