# 限流与熔断代理工作台

实现本地 HTTP 代理与状态界面，展示请求次数、真正的上游调用数、限流拒绝、熔断状态和请求结果。额外启动参数 --upstream <本地HTTP地址> --limit 3 --window-ms 1000 --timeout-ms 150 --failure-threshold 2 --open-ms 500。本题只代理 GET，不做任务队列、持久化租约或多进程调度。

GET /relay?path=<以/开头的路径> 将请求实际发送到固定 upstream 的该路径，返回上游真实状态码和原始字节；拒绝绝对 URL、//host 与协议变换，不能让调用者换掉目标主机。单次上游超过 timeout-ms 返回 504。

所有 relay 请求先执行固定窗口限流：窗口从该服务收到首个 relay 请求起算，每 window-ms 重置，最多放行 limit 个，超限 429，不能访问上游。通过限流后再检查熔断。连续 failure-threshold 次网络失败、超时或 HTTP 5xx 使 CLOSED 转 OPEN；HTTP 4xx 不算故障，成功 2xx/3xx 重置连续故障计数。OPEN 内请求返回 503，不能访问上游；open-ms 后进入 HALF_OPEN，只允许一个探测，其余并发请求 503。探测成功回 CLOSED，失败重新 OPEN 并重计等待时间。

GET /api/stats 返回 {state,requests,upstreamCalls,rateRejected,circuitRejected}；requests 计所有 relay 请求，upstreamCalls 仅计真实发出的请求，其余字段计相应拒绝。重启清零计数与状态，必须在 README 明示；无持久化要求。网页可输入路径发送真实请求、显示返回内容并刷新 stats。

## 运行与交付

只使用 Node.js 24 原生模块，无第三方依赖。交付 server.js、原生网页和简短 README。启动 node server.js --port <端口> --data <数据目录>，只监听 127.0.0.1；GET /health 返回 {"ok":true}，GET / 提供操作界面。界面只需实用的表单、列表和状态，用户数据按纯文本展示。所有展示来自真实 API。错误返回非 2xx 与 {"error":"原因"}。数据目录不存在则创建，重启时复用；不能以浏览器缓存代替服务端状态。无需账号、外部服务或依赖安装。
