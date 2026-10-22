# Webhook 签名与去重调试台

实现本地 Webhook 调试台：签名请求到达后，界面显示事件 ID、原始请求体、SHA-256 和去重状态；本题不实现向其他服务重放或自动重试。

额外参数 --source demo --secret demo-key。POST /hooks/demo 接收 JSON 原始字节，X-Event-Id 为字符串，X-Signature 格式 sha256=<小写十六进制>，签名为 HMAC-SHA256(secret,原始请求体)。验签必须早于 JSON 解析。无效签名 401；首个有效事件 201 {id}；同 ID 相同原始字节重复 200 {id} 且稳定复用 ID；同 ID 不同原始字节在正确重签后返回 409。最多接收 1 MiB。

GET /api/events 返回 {events:[{id,eventId,source,sha256}]}，GET /api/events/<id> 返回 {id,eventId,source,body}，body 为原始 UTF-8 请求体。并发重复请求只能新增一条。事件持久化，重启不丢；密钥不得出现在界面、API 和日志。交付一个本地签名发送示例供演示。

## 运行与交付

只使用 Node.js 24 原生模块，无第三方依赖。交付 server.js、原生网页和简短 README。启动 node server.js --port <端口> --data <数据目录>，只监听 127.0.0.1；GET /health 返回 {"ok":true}，GET / 提供操作界面。界面只需实用的表单、列表和状态，用户数据按纯文本展示。所有展示来自真实 API。错误返回非 2xx 与 {"error":"原因"}。数据目录不存在则创建，重启时复用；不能以浏览器缓存代替服务端状态。无需账号、外部服务或依赖安装。
