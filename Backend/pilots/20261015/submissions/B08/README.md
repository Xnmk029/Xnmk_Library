# 库存预占与结算事务台

只需 Node.js 24，无第三方依赖。在本目录运行：

```powershell
node server.js --port 3000 --data ./data --capacity 10 --ttl-ms 1200
```

打开 http://127.0.0.1:3000 。仅监听 `127.0.0.1`。`GET /health` 返回 `{"ok":true}`。默认端口 3000、容量 10、预占时长 1200 毫秒，默认数据目录为程序目录下的 `data`。Node.js 可能输出原生 SQLite 的实验性提示，不影响运行。

页面提供数量预占、支付、取消、订单状态、库存统计和并发争抢。初始状态下点击“开始争抢”，20 笔请求竞争 10 件库存，通常得到 10 笔成功与 10 笔库存不足；到期后观察库存恢复。页面每 500 毫秒拉取 API，状态以服务端为准。默认 TTL 较短，手动支付演示可用 `--ttl-ms 15000` 启动。

支付后关闭进程，以同一 `--data` 目录重启，即可看到订单和已售库存保留。容量在数据目录首次创建时固定；后续显式传入不同容量会拒绝启动。重启不传 `--ttl-ms` 时沿用已有设置；显式修改 TTL 只影响新订单，旧订单始终使用已保存的到期时间。重新演示空库存状态请指定新的数据目录。

API：

| 方法与路径 | 载荷 / 结果 |
| --- | --- |
| `POST /api/orders` | `{requestId,quantity}`；201 订单、409 库存不足、422 数量非法 |
| `POST /api/orders/<id>/pay` | `{requestId}`；200 已支付订单，过期或取消则 409 |
| `POST /api/orders/<id>/cancel` | `{requestId}`；200 已取消订单，已支付或过期则 409 |
| `GET /api/inventory` | `{capacity,available,reserved,sold}` |
| `GET /api/orders` | `{orders:[...]}` |
| `GET /api/orders/<id>` | 单个订单；不存在则 404 |

订单包含 `id,status,quantity,expiresAt,createdAt,updatedAt`，时间为 Unix 毫秒。所有错误均为非 2xx 和 `{"error":"原因"}`。JSON 请求体上限 16 KiB，数量必须是 JavaScript 安全范围内的正整数；requestId 为不全是空白的 1–256 字符字符串。

所有修改接口共用全局 requestId。相同路径和相同完整 JSON 载荷（忽略对象键顺序）重试，返回最初的状态码及响应，包括业务失败；不同路径或载荷复用 ID 返回 409。缺少有效 requestId、无法解析的 JSON、未知接口等协议错误不会保存幂等记录。ID 应为每个新操作生成的 UUID；网络错误时保留 ID 和载荷重试。预占到期或后来支付后，重试创建仍返回原始 `reserved` 响应，当前状态请 GET 查询。页面中的“生成新 ID”用于开始下一笔预占。

数据库为数据目录中的 `inventory.sqlite`。库存计数、订单转换、到期释放和幂等响应在同一个 SQLite `BEGIN IMMEDIATE` 事务内提交，使用 WAL 和 `synchronous=FULL`；成功提交后才回复客户端。数据库约束确保三项库存均非负且和等于总容量。每次读取、预占、支付、取消前，以及后台每 100 毫秒和启动时处理到期。事务内获取服务器时间，`expiresAt <= 当前时间` 即过期；支付与到期由同一写锁串行决定，因此只有一个结果。备份运行中的数据库需包含 WAL 文件，建议停机后复制整个数据目录。

运行集成验证：

```powershell
node --test server.test.js
```

测试使用独立临时目录并自动清理，覆盖并发抢库存、并发重复请求、失败幂等、支付/取消竞争、到期边界、停机期间到期、进程重启后恢复，以及健康检查和页面资源。
