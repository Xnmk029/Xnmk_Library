# 实站和用户脚本管理器验收

与离线分数分开，状态为 NOT_RUN / BLOCKED / PASS / FAIL。未执行时不能宣称真实 B 站全部适配。

记录日期（Asia/Shanghai）、OS、浏览器/脚本管理器版本、候选哈希、登录状态、页面 URL、当前组件类型。

- 视频：主/子评论、展开/翻页、按时间排序、加载更多。
- 动态/个人空间动态：进入、返回、SPA 切换、重复展开。
- 仍可访问的 Vue3/bbComment 活动页：记录实际形态，不捏造已经不存在的页面。
- 逐条与公开返回字段核对，区分评论发布时属地和账号实时位置。
- 缺字段、风控、登录限制：区分服务状态和脚本适配失败。
- 原生标签不重复；回复、更多、编辑/举报弹层可用；1280px/720px/125% 缩放检查。
- 真正的油猴沙箱、CSP、页面组件访问和被动请求观察行为检查。

```json
{"schemaVersion":1,"status":"NOT_RUN","candidateSha256":null,"checkedAt":null,"timezone":"Asia/Shanghai","browserVersion":null,"manager":null,"managerVersion":null,"pages":[],"evidencePaths":[],"blockedReason":null}
```

实站截图和响应在授权账户环境留存，公开前移除真实用户名、UID、Cookie 和正文等数据。站点改变时先保存脱敏失效记录，再新建回放版本，不覆写冻结版本。
