# 版本化配置发布与回滚台

实现配置发布服务，页面显示当前版本、配置、版本历史和冲突提示，支持编辑发布与回滚。重点是并发条件更新、原子持久化和崩溃后恢复；本题为单服务，不要求共识或通用文本协同引擎。

配置固定为 {label:string,enabled:boolean,endpoints:[{name:string,url:string}]}，label 非空，endpoint 名称非空且唯一，url 必须是合法 http/https URL。初始配置 {label:"initial",enabled:false,endpoints:[]}，初始 revision 为 0。GET /api/config 返回 {revision,config,sha256}，sha256 按配置的 JSON.stringify 字节（字段固定按 label,enabled,endpoints，endpoint 按 name,url；数组保留顺序）计算。GET /api/history 返回 {versions:[{revision,config,sha256}]}，含初始版本。

PUT /api/config 使用 If-Match:<期望revision>，JSON {requestId,config}；原子比较版本并提交，成功 200 返回新快照，版本不匹配 409，配置非法 422。POST /api/rollback 使用同样 If-Match，JSON {requestId,targetRevision}；回滚创建递增的新 revision，不能倒退版本号或删除历史。所有修改按 requestId 幂等：相同路径和载荷重试返回原结果，重复 ID 不同载荷 409，已成功请求的重试即便 If-Match 旧了也返回其原结果。错误请求不能改变当前配置与历史。

成功响应前须持久提交整个快照、历史与幂等结果；进程被强制终止再启动，不丢已经确认的版本，不返回拼接的半份配置。并发读写只允许看到完整旧快照或完整新快照。可使用 Node 原生 SQLite 事务。演示开两个窗口读同一版本，一个先提交，另一个因旧版本冲突，再回滚并刷新。

## 运行与交付

只使用 Node.js 24 原生模块，无第三方依赖。交付 server.js、原生网页和简短 README。启动 node server.js --port <端口> --data <数据目录>，只监听 127.0.0.1；GET /health 返回 {"ok":true}，GET / 提供操作界面。界面只需实用的表单、列表和状态，用户数据按纯文本展示。所有展示来自真实 API。错误返回非 2xx 与 {"error":"原因"}。数据目录不存在则创建，重启时复用；不能以浏览器缓存代替服务端状态。无需账号、外部服务或依赖安装。
