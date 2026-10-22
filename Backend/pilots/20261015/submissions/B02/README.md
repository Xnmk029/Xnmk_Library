# HTTP 健康探针

使用 Node.js 24 原生模块，无需安装依赖。

将以下内容保存为 `targets.json`（对应端口需要运行本地 HTTP 服务）：

```json
[
  { "id": "api", "url": "http://127.0.0.1:3000/health" },
  { "id": "web", "url": "http://127.0.0.1:8080/" }
]
```

运行：

```powershell
node probe.js --config targets.json --out report.html --timeout-ms 150 --concurrency 2
```

输出 `report.html` 和同目录的 `report.json`。直接用浏览器打开 HTML，即可查看红/绿状态表格，点击详情查看错误。报告不需要网络或 JavaScript，ID、URL、错误均作为转义后的纯文本展示。

`--config` 和 `--out` 必填；超时默认 150 毫秒，并发默认 2，均须为 1 到 2147483647 之间的整数。路径可为相对路径或绝对路径，带空格时请加引号。输出父目录须已存在；JSON 路径由输出路径替换扩展名为 `.json` 得到，无扩展名时追加 `.json`。`--out` 不能以 `.json` 为扩展名。

配置根结构必须是数组，每项需要非空且不全为空白的字符串 `id` 和字符串 `url`。允许重复 ID、空数组（返回全零汇总且退出 0）。URL 只接受显式端口 1–65535 的 `http://127.0.0.1:<端口>/...`，拒绝认证信息、其他主机/协议、替代 IP 写法及原始空白、控制字符、反斜杠；路径和查询中的空格请使用百分号编码。

探针发送 GET 请求，不跟随重定向。每个请求从开始到完整读取响应体都有独立的绝对超时；慢速响应持续传输也不会延长期限。响应体仅流式丢弃，不存入报告。最多有 `concurrency` 个请求同时在途，失败后继续检查其余目标，结果严格保持配置顺序。

JSON 格式示例：

```json
{
  "results": [
    { "id": "api", "url": "http://127.0.0.1:3000/health", "status": 200, "ok": true, "error": null },
    { "id": "web", "url": "http://127.0.0.1:8080/", "status": 503, "ok": false, "error": "HTTP 503" }
  ],
  "summary": { "total": 2, "healthy": 1, "failed": 1 }
}
```

- HTTP 2xx：健康，`error: null`。
- 非 2xx（包括 3xx）：失败，保留实际状态码，附非空错误。
- 连接失败、响应中断或超时：失败，`status: null`，附非空错误。
- 退出码 `0`：全部健康；`1`：报告已生成且存在失败；`2`：参数、配置、读取或报告写入错误，原因写入 stderr。

整份配置会在发送请求和写报告前完成验证。配置 JSON、ID 或 URL 不合法时，退出 2，已有报告保持不变。合法配置在全部检查完成后写入报告，覆盖同名文件；每个报告先写临时文件再替换，两个文件的替换不是跨文件事务。

运行集成测试：

```powershell
node --test probe.test.js
```
