# Webhook 收件箱与重放工具

实现本地 Webhook 调试服务。接收事件，显示原始请求、验签结果、去重状态；通过界面将已接收事件重放到受控的本地接收端，保留每次投递的状态码、耗时和错误。

## 数据与行为契约

`POST /hooks/{source}`；事件 ID 为 `X-Event-Id` 字符串，签名为 `X-Signature: sha256=<小写十六进制>`，按预置 source 密钥对原始请求体计算 HMAC-SHA256。验签通过后才解析 JSON。首次合法事件返回 201；同 source、同 ID、相同原始字节重试返回 200 且不新增事件；同 ID 不同字节返回 409；验签失败返回 401。重放只发送到启动时配置的本地夹具 URL，不接收任意目标 URL。请求体限制 1 MiB。

## 交付要求

服务、事件列表和详情界面、重放入口、持久化数据库、签名请求发送示例。重放保留原始请求体和事件 ID；投递尝试有独立 ID，不重新创建收件事件。

## 运行与交付契约

使用 Node.js 24 原生模块，不安装第三方依赖，不生成 node_modules。交付 server.js、界面和 README；可拆分普通文件。启动为 node server.js --port <端口> --data <数据目录>，额外参数见各题。所有服务仅监听 127.0.0.1；GET /health 返回 JSON {"ok":true}，GET / 提供可操作界面。数据目录不存在时创建；重启指使用同一目录重新启动。JSON 响应 Content-Type 正确，错误返回非 2xx 与 {"error":"原因"}；响应不能假装成功。界面从真实 API 获取结果，能完成题述演示，不能用随机数或固定样例模拟后端状态。用户提供的文本按纯文本展示。

交付不包含 TODO、未实现分支或需用户补充的核心逻辑。README 写明启动方式和操作流程。用到的样例数据由程序或用户在本地生成，不依赖账号、网络服务或其他项目文件。

## HTTP/CLI 接口

额外启动参数 --source demo --secret demo-key --target <本地HTTP接收地址>。POST /hooks/demo 按题内签名和状态码接收，201/200 返回 {id}，id 为该收件事件的稳定内部标识。GET /api/events 返回 {events:[{id,eventId,source,sha256}]}；GET /api/events/<id> 返回 {id,eventId,source,body,attempts:[{status,error}]}，body 为原始 UTF-8 字符串，status 为 HTTP 状态码，连接/超时错误用 null。POST /api/events/<id>/replay 等本次请求结束后返回这次 attempt，HTTP 超时 1 秒，重放不自动重试。向目标发送原始请求体和原 X-Event-Id。
