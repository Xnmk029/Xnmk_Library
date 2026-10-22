# BiliReveal 金标来源与修订边界

基础参考固定为 BiliReveal **v2.3.0 Lite**；原始文件、标准版、MIT 许可证保存在 `upstream/`。原版是成熟度和适配策略的参考，不预设为满分。运行 Lite 及构建输入、输出的来源和哈希见 `provenance.json`。

`bilireveal-bench.user.js` 是明确标注的 Benchmark 衍生版本，使用 `node tools/build-gold.mjs` 从原始 Lite 文件生成。构建脚本不访问网络；输入变化导致定位失败时停止，禁止悄悄取新版本。

保留上游 `customElements.define` / Lit `update()` 钩子、`bbComment` 主/子评论渲染钩子、Vue Proxy/实例发现钩子。以下改动用于满足公开回放题面的约束：

1. 启动时对已声明域名统一安装三种组件钩子，避免初始 URL 分派限制后续 SPA 组件；增加一次安装标记。
2. 排除专栏作者定位与对应主动接口请求。这里评测逐条评论，专栏作者与个人主页定位不是本题范围。
3. 缺失属地显示轻量状态；数据清空时去除旧值。保留原生可见属地节点，不复用或删除它。
4. Lit 标签从 `.data` 获取该条评论；Vue 3 补齐 `props`、`vnode.props`、`subReply` 路径及多实例记录读取。
5. Vue DOM 观察补充容器替换与数据更新，使用去重标签；时间栏内长文本可截断。
6. 旧模板对插入文字转义；Vue/Lit 用 `textContent`，避免属地字符串变成 HTML。
7. 删除远程图标；声明没有主动请求。版权标识与 MIT 许可证保留。

`patches/runtime.js` 保存新增逻辑，`build-gold.mjs` 保存逐段替换操作。不要把修订后的行为描述成上游项目原本全部具备。上游与修订版都跑相同回放器，结果进入校准报告。

金标不是唯一可接受实现。判分来自独立 fixture 数据与可见行为，不要求候选源码复制上游、使用特定插入节点、或命中金标私有 CSS 属性。
