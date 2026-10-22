# 来源与许可

- [BiliReveal 发布 v2.3.0](https://github.com/maxchang3/BiliReveal/releases/tag/v2.3.0)：冻结的功能参考及 Lite 脚本，作者 MaxChang3，MIT。
- [Lite 下载](https://github.com/maxchang3/BiliReveal/releases/download/v2.3.0/bilireveal.lite.user.js)：按原始字节保存，SHA 见 gold/provenance.json。
- [Greasy Fork 原版脚本](https://greasyfork.org/zh-CN/scripts/466815/code)：标准版快照来源，保存于 gold/upstream。
- [Lit 适配](https://github.com/maxchang3/BiliReveal/blob/main/src/injection/lit-component.ts)：操作栏 data、注册及 update 钩子。
- [Vue3 适配](https://github.com/maxchang3/BiliReveal/blob/main/src/injection/vue3.ts)：reply/subReply 与 vnode 路径。
- [Vue2 适配](https://github.com/maxchang3/BiliReveal/blob/main/src/injection/vue-legacy.ts)：bbComment 的模板函数。
- [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext)：新上下文、初始化注入与路由。

结构契约是根据公开行为制作的合成回放，不复制 B 站生产 bundle 或真实评论数据。用于参考的 README/许可证来自已下载的开源 checkout；运行金标严格使用发布 Lite 快照。修订版保留来源说明和 MIT 许可证。

本文中的 main 链接用于解释源码；冻结执行文件及哈希才是本版本实际评测输入。上游后续改动不会自动更新本 Bench。
