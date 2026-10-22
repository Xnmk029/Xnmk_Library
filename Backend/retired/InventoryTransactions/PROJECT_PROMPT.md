# 库存预占与结算事务台

实现库存预占与结算服务，页面显示可用、预占、已售数量和订单列表，支持预占、支付、取消。重点是并发下不超卖、原子状态转换、过期与支付竞争、跨重启幂等；本题是单服务，不要求分布式共识。

额外参数 --capacity 10 --ttl-ms 1200。初始 capacity 个同类单位，订单 quantity 为正整数。POST /api/orders 接收 {requestId,quantity}：容量足够时原子预占，201 {id,status:"reserved",quantity,expiresAt}，不足 409；数量非法 422。POST /api/orders/<id>/pay 接收 {requestId}：尚未过期的 reserved 转 paid，200 返回订单；已 paid 可幂等返回；expired/cancelled 返回 409。POST /api/orders/<id>/cancel 接收 {requestId}：reserved 转 cancelled 并释放，重复取消可返回同结果，paid/expired 返回 409。到期以服务器持久化的 expiresAt 为准，超时 reserved 转 expired 并释放，读取/支付/预占前要处理到期；支付和到期只能有一个结果。

GET /api/inventory 返回 {capacity,available,reserved,sold}，必须始终 available+reserved+sold=capacity 且均非负。GET /api/orders 返回 {orders:[...]}；GET /api/orders/<id> 返回订单。所有修改按 requestId 幂等：相同路径与载荷重试返回原状态码和订单，不再扣库存；同 ID 不同路径/载荷 409。成功响应前持久化订单、库存和幂等结果，原生 SQLite 事务可用。原子状态必须跨重启保留。

演示用并发请求争抢最后库存，观察成功数量和不足提示；让预占过期释放；支付后重启，库存和订单仍一致。网页显示真实到期状态，不仅在前端倒计时。

## 运行与交付

只使用 Node.js 24 原生模块，无第三方依赖。交付 server.js、原生网页和简短 README。启动 node server.js --port <端口> --data <数据目录>，只监听 127.0.0.1；GET /health 返回 {"ok":true}，GET / 提供操作界面。界面只需实用的表单、列表和状态，用户数据按纯文本展示。所有展示来自真实 API。错误返回非 2xx 与 {"error":"原因"}。数据目录不存在则创建，重启时复用；不能以浏览器缓存代替服务端状态。无需账号、外部服务或依赖安装。
