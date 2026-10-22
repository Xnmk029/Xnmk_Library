# 限流与熔断代理工作台

一个只用 **Node.js 24 原生模块**（无第三方依赖、无需安装步骤）实现的本地 HTTP 代理服务：
对 `GET /relay` 施加**固定窗口限流**与**熔断器**，把请求真实转发到启动参数指定的固定 upstream，
并原样返回上游的状态码与字节。附带的网页界面显示请求次数、真实上游调用数、限流拒绝、熔断拒绝、
熔断状态与最近请求结果，所有数字都来自服务端 API。

---

## 快速开始

```bash
# 1) 启动一个本地 upstream（任意 HTTP 服务均可；下面的示例用 Node 原生起一个）
node -e "require('http').createServer((q,s)=>{s.writeHead(200,{'Content-Type':'text/plain'});s.end('ok '+q.url)}).listen(8080,'127.0.0.1')"

# 2) 启动代理
node server.js --port 3000 --data ./data --upstream http://127.0.0.1:8080 \
               --limit 3 --window-ms 1000 --timeout-ms 150 \
               --failure-threshold 2 --open-ms 500
```

打开 <http://127.0.0.1:3000/> 即为操作界面。

## 启动参数

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `--port <端口>` | 是 | — | 监听端口，**只监听 127.0.0.1** |
| `--data <目录>` | 是 | — | 数据目录；不存在则创建，重启时复用 |
| `--upstream <本地HTTP地址>` | 是 | — | 固定上游，如 `http://127.0.0.1:8080` |
| `--limit <N>` | 否 | `3` | 每个窗口最多放行的 relay 请求数 |
| `--window-ms <MS>` | 否 | `1000` | 固定窗口长度（毫秒） |
| `--timeout-ms <MS>` | 否 | `150` | 单次上游调用的超时（毫秒） |
| `--failure-threshold <N>` | 否 | `2` | 连续故障多少次后 CLOSED → OPEN |
| `--open-ms <MS>` | 否 | `500` | OPEN 持续多久后进入 HALF_OPEN |

`--help` 打印用法；参数缺失或非法时进程以非 0 退出并在 stderr 说明原因。

## HTTP 接口

| 路由 | 说明 |
| --- | --- |
| `GET /health` | 返回 `{"ok":true}` |
| `GET /` | 操作界面（原生 HTML/CSS/JS，无构建步骤、无外部资源） |
| `GET /api/stats` | 返回 `{state, requests, upstreamCalls, rateRejected, circuitRejected}` |
| `GET /api/events` | 界面用的辅助接口：最近 50 条 relay 结果（仅内存） |
| `GET /api/config` | 界面用的辅助接口：当前生效的启动参数 |
| `GET /relay?path=<以/开头的路径>` | 真正转发到固定 upstream 的该路径 |

所有错误都返回**非 2xx** 状态码与 `{"error":"原因"}`。

### 计数口径

- `requests`：所有 `/relay` 请求，包括路径非法、被限流、被熔断拒绝的请求。
- `upstreamCalls`：真正向 upstream 发出的请求（只有通过校验、限流、熔断三道关卡的请求才会计入）。
- `rateRejected`：因超出固定窗口配额而返回 `429` 的请求数。
- `circuitRejected`：因熔断器 OPEN 或 HALF_OPEN 探测位被占用而返回 `503` 的请求数。

三者关系：`requests = upstreamCalls + rateRejected + circuitRejected + 路径非法数`。
（`/api/stats` 自身、静态页面与 `/health` 都**不**计入任何计数。）

## 行为约定

### 目标主机不可被替换

`path` 必须以 `/` 开头，并且只能是**固定 upstream** 上的路径。以下输入一律返回
`400 {"error":...}`，并且在任何情况下都不会发出上游请求：

- 绝对 URL（`http://...`、`https://...`、`file://...`、`ftp://...` 等任何 `scheme:` 前缀）；
- 网络路径引用 / 协议相对地址（`//host/path`、`/\host/path`）；
- 反斜杠（可能被某些实现规范化为 `/`）；
- 控制字符（含 CR/LF，防止请求头注入）；
- 不以 `/` 开头的相对路径与空路径。

转发时使用配置里的 `scheme://host:port` 作为固定 origin，转义后的 `path` 作为路径，
并显式设置 `redirect: "manual"`，因此上游返回的 3xx **不会**被自动跟随、调用者也无法借重定向换主机。
`..` 之类的点段只会在同一个固定 origin 内被规范化（`/a/../../secret` → `/secret`），不能逃出该主机。

### 固定窗口限流（先于熔断）

- 窗口从**本服务收到第一个 relay 请求**的时刻起算（不是墙钟整点），持续 `window-ms`；
- 窗口内最多放行 `limit` 个请求；
- 超出的请求返回 `429 {"error":...}`，且**不访问上游**；
- 窗口到期后自然重置。窗口跨进程重启同样重置。

校验失败（400）的请求不消耗窗口配额。

### 熔断器（通过限流后检查）

计数对象是**连续故障**：

| 上游结果 | 影响 |
| --- | --- |
| 网络失败（连接被拒/断开等） | 计为故障 → `502` |
| 超过 `timeout-ms` | 计为故障 → `504` |
| HTTP `5xx` | 计为故障（状态码与内容原样返回） |
| HTTP `4xx` | **不算故障**，原样返回 |
| HTTP `2xx` / `3xx` | 成功，连续故障计数**清零**，原样返回 |

状态机：

- `CLOSED`：正常放行。连续故障达到 `failure-threshold` 时转为 `OPEN`。
- `OPEN`：请求返回 `503 {"error":...}`，**不访问上游**；持续 `open-ms` 后进入 `HALF_OPEN`
  （OPEN → HALF_OPEN 的转换按时间自动生效，因此仅查询 `/api/stats` 也能看到 `HALF_OPEN`）。
- `HALF_OPEN`：**只允许一个探测请求**通过，其余并发请求返回 `503`。
  探测成功 → 回到 `CLOSED` 并清零计数；探测失败（网络失败/超时/5xx）→ 重新 `OPEN`，
  并以该次失败的时刻重新计算 `open-ms` 等待时间。
- `HALF_OPEN` 期间探测返回 4xx 时，既不判成功也不判失败：不关闭熔断，但会释放探测位，
  以便后续请求继续探测，避免状态机卡死。

**顺序**：先校验路径 → 再限流（`429`）→ 再熔断（`503`）→ 最后才真正访问上游。
因此当限流窗口已耗尽时，即使熔断器处于 OPEN，也会先得到 `429`。

### 透传

通过所有检查后，代理以 `GET` 请求固定 upstream，并返回**上游真实状态码与原始字节**
（二进制内容按字节原样转发，不解析、不改写正文）。上游的 `Content-Type` 与 `Location`
会一并透传，另加 `X-Upstream-Status`、`X-Circuit-State` 两个便于观察的响应头。

## 重启即清零（重要，无持久化）

**所有计数与熔断状态都只保存在内存中。重启进程后 `requests`、`upstreamCalls`、
`rateRejected`、`circuitRejected` 全部归零，熔断状态回到 `CLOSED`，限流窗口重新从
第一个请求起算。**

`--data` 目录会被创建（若不存在）并在重启时复用；本服务只在其中写入一份
`instance.json` 启动信息，**不**写入任何计数器或熔断状态。界面上的数字始终取自
服务端 API（并带 `Cache-Control: no-store`），因此不存在“用浏览器缓存冒充服务端状态”的情况。

## 网页界面

- 输入路径后点「发送」即发出真实的 `/relay` 请求，显示 HTTP 状态、耗时、响应体字节数与
  **纯文本**响应内容（用 `textContent` 渲染，不会被当作 HTML 解释）；
- 「并发发送」按指定次数同时发起请求，便于观察固定窗口限流与 HALF_OPEN 探测位；
- 顶部实时显示 `requests / upstreamCalls / rateRejected / circuitRejected` 与熔断状态
  （每秒自动刷新，可关闭）；
- 下方表格显示服务端记录的最近请求（时间、路径、状态码、判定结果）；
- 另有上游 `404/403`、`/err`、`/slow` 等快捷按钮，方便手动验证。

## 边界与取舍

- 只代理 `GET`；其它方法返回 `405 {"error":...}`。
- 不做任务队列、不做持久化租约、不做多进程调度；计数为单进程内存状态。
- 上游响应的 hop-by-hop 头（如 `Transfer-Encoding`、`Connection`）不透传；正文长度按实际
  读取字节数重新计算后再设置 `Content-Length`。
- 上游超时 / 网络失败统一映射为 JSON 错误体（`504` / `502`），上游自身的 4xx/5xx 则保持原样透传。
