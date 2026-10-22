# 限流与熔断代理工作台

仅使用 Node.js 24 原生模块，无需安装依赖。

```powershell
node server.js --port 3000 --data ./data --upstream http://127.0.0.1:9000 --limit 3 --window-ms 1000 --timeout-ms 150 --failure-threshold 2 --open-ms 500
```

先启动自己的本地 HTTP 上游，再启动代理，访问 http://127.0.0.1:3000。代理仅监听 `127.0.0.1`。以上参数值也是默认值；`--data` 不存在时自动创建，重启复用目录。**所有计数、窗口和熔断状态仅保存在服务内存中，重启清零，状态恢复 CLOSED；不持久化。** 网页不以浏览器缓存保存服务状态。

- `GET /health`：`{"ok":true}`。
- `GET /`：操作界面，可输入路径、查看响应和最近 30 次页面操作；每秒从真实 API 刷新状态。
- `GET /api/stats`：`{state,requests,upstreamCalls,rateRejected,circuitRejected}`。
- `GET /relay?path=%2Fexample`：转发到固定上游 `/example`，保留真实状态码与响应原始字节。路径含查询参数时应整体 URL 编码；浏览器表单自动处理。不会跟随上游重定向，也不会透传客户端的 Cookie、Authorization 或 Host。

上游地址只接受 `http://localhost:端口`、`http://127.x.x.x:端口` 或 `http://[::1]:端口`，不接受路径、查询、片段或凭据。relay 拒绝绝对 URL、`//host`、反斜杠及协议切换；请求主机和端口始终取自启动配置。

所有 GET relay 请求（包括无效路径）先计入 requests 并执行限流。固定窗口从首个 relay 起算，每隔 window-ms 重置；超额返回 429。获得配额后检查熔断，OPEN 或已有 HALF_OPEN 探测时返回 503，并消耗本窗口配额。通过上述检查的非法路径返回 400，不调用上游、不改变故障计数。

网络失败和响应中断返回 502；从发起到收完整响应超过 timeout-ms 返回 504。网络失败、超时和上游 5xx 累计连续故障；2xx/3xx 清零，4xx 不增加也不清零。达到阈值进入 OPEN。等待 open-ms 后进入 HALF_OPEN，仅一个请求能探测；探测遇网络失败、超时或 5xx 重新 OPEN 并重新计时，否则（包括非故障的 4xx）恢复 CLOSED。旧一轮在途请求的完成不会覆盖新一轮熔断状态。

upstreamCalls 统计实际发起的上游请求尝试（包括连接失败）；两个 rejected 字段仅计对应拒绝。代理自身错误均返回非 2xx 与 `{"error":"原因"}`；上游错误响应仍保持其原始状态码和字节。仅保留内容类型、内容编码和内容语言响应头，不透传重定向位置、Cookie 或逐跳头。页面把所有响应和路径当纯文本显示；二进制响应应通过 HTTP 客户端读取。

验证：`node --test test.js`，测试使用本机临时上游，无外部服务。
