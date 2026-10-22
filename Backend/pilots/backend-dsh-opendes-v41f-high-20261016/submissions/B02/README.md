# HTTP 健康探针（HttpHealthProbe）

Node.js 24 命令行健康探针：读取 JSON 目标清单，访问本地 HTTP 目标，输出 **JSON 结果** 与 **可直接打开的 HTML 报告**。

- 仅使用 Node 原生模块（`node:fs/promises`、`node:http`、`node:path`），无任何依赖，无需 `npm install`。
- 每个目标独立超时；失败的请求不会影响其他目标。
- 同一时刻在途请求数不超过 `--concurrency`。
- 不跟随重定向：3xx 同样判为失败，并保留真实 HTTP 状态码。
- HTML 中的 id、URL、错误信息全部按纯文本转义展示，输入携带的标记不会被执行。
- 判定只依赖响应状态行，**不读取也不等待响应体**：`Transfer-Encoding: chunked`（无 `Content-Length`）的响应，以及永远不发送结束块的流式响应，都能立即得出结果。

## 环境要求

- Node.js 24（开发与验证使用 `node v24.15.0`）
- 仅允许 `http://127.0.0.1:<端口>/...` 目标；不接受含用户名/密码的 URL、其他主机或其他协议

## 命令

```bash
node probe.js --config <JSON路径> --out <HTML路径> --timeout-ms 150 --concurrency 2
```

| 参数 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--config`, `-c` | 是 | — | 目标配置 JSON 文件路径 |
| `--out`, `-o` | 是 | — | HTML 报告输出路径 |
| `--timeout-ms` | 否 | `2000` | 单个目标的超时毫秒数（正整数） |
| `--concurrency` | 否 | `4` | 最大在途请求数（正整数） |
| `--help`, `-h` | 否 | — | 打印帮助 |

支持 `--flag value` 与 `--flag=value` 两种写法。

### 输出文件

| 产物 | 路径 |
| --- | --- |
| JSON 结果 | 与 `--out` 同路径，扩展名换成 `.json`（若 `--out` 无扩展名则在其后追加 `.json`） |
| HTML 报告 | `--out` 指定的路径 |

例如 `--out report.html` 会同时生成 `report.json` 与 `report.html`。

## 配置示例

`config.example.json`：

```json
[
  { "id": "health", "url": "http://127.0.0.1:8099/health" },
  { "id": "api", "url": "http://127.0.0.1:8099/api/items?limit=5" },
  { "id": "admin", "url": "http://127.0.0.1:8099/admin" },
  { "id": "old-endpoint", "url": "http://127.0.0.1:8099/redirect" },
  { "id": "offline", "url": "http://127.0.0.1:9/health" }
]
```

- 根结构必须是数组，每项为 `{ "id": string, "url": string }`。
- `id` 必须是非空字符串；`url` 必须是合法的 `http://127.0.0.1:<端口>/...`。
- `results` 严格按输入顺序输出，与请求完成先后无关。
- 上面的示例只是演示用：请把端口和路径换成你自己本地服务上真实存在的目标。

## 运行示例

```bash
# 1) 先启动任意本地 HTTP 服务（示例端口 8099），然后：
node probe.js --config config.example.json --out report.html --timeout-ms 150 --concurrency 2
```

控制台输出示例：

```
probe: 5 个目标，健康 2，失败 3
probe: JSON -> report.json
probe: HTML -> report.html
```

退出码：

| 退出码 | 含义 |
| --- | --- |
| `0` | 输入合法且全部目标健康 |
| `1` | 输入合法但存在失败目标（报告与 JSON 仍然完整写出） |
| `2` | 输入非法（配置不可读/非法 JSON/结构或 URL 不合规/参数错误/写文件失败），**不写出任何输出文件，已有输出文件保持不变** |

在 Windows PowerShell 中查看退出码：

```powershell
node probe.js --config config.example.json --out report.html
$LASTEXITCODE
```

## 结果结构

`report.json`：

```json
{
  "results": [
    { "id": "health", "url": "http://127.0.0.1:8099/health", "status": 200, "ok": true, "error": null },
    { "id": "admin", "url": "http://127.0.0.1:8099/admin", "status": 404, "ok": false, "error": "HTTP 404" },
    { "id": "offline", "url": "http://127.0.0.1:9/health", "status": null, "ok": false, "error": "连接失败 (ECONNREFUSED): connect ECONNREFUSED 127.0.0.1:9" }
  ],
  "summary": { "total": 3, "healthy": 1, "failed": 2 }
}
```

判定规则：

- HTTP `2xx`：`ok: true`，`error: null`，保留真实 `status`。
- 非 `2xx`（含 3xx 重定向）：`ok: false`，保留真实 `status`，`error` 为非空字符串（如 `HTTP 301`）。
- 连接失败或超时：`status: null`，`ok: false`，`error` 为非空字符串（`连接失败 (错误码): 描述` 或 `请求超时 (timeout after N ms)`）。

### chunked / 无 Content-Length 响应

结果只由 HTTP 状态行决定，程序在收到响应头后立即销毁该连接，不读取响应体。因此：

- `Transfer-Encoding: chunked`（没有 `Content-Length`）的响应与普通响应完全一致，2xx 即 `ok: true`。
- 服务端迟迟不发送结束块、甚至长期持续推送数据的流式响应，**不会**把探针拖到超时——拿到状态码就结束该目标。
- 只有「响应头本身」超出 `--timeout-ms` 才算超时（`status: null`）。
- 响应中途被 RST 复位、分块帧畸形、或未发送完响应头就断开等异常流，会被记为失败并给出非空 `error`，不会导致进程崩溃。

## HTML 报告

报告为单文件、内联样式，双击即可在浏览器打开，包含：

- 汇总卡片：总计 / 健康 / 失败（绿、红配色）；
- 结果表格：绿/红状态徽标、id、URL、HTTP 状态码；
- 原生 `<details>` 折叠展示每个失败目标的错误详情；
- 页尾原生 `<details>` 折叠展示完整原始 JSON。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `probe.js` | 探针主程序（交付物） |
| `README.md` | 本文档（交付物） |
| `config.example.json` | 配置示例 |
| `report.json` / `report.html` | 运行程序后生成的产物 |
