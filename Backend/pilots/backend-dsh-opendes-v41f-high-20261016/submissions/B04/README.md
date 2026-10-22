# 本地短链接与访问统计台

单机短链接服务：创建短链接、302 跳转、访问计数、重启保持。只使用 Node.js 24 原生模块，无第三方依赖、无外部服务、无需安装步骤。页面由服务端直接生成（原生表单 + 链接表格），所有展示都来自真实 API 与真实存储。

## 运行

```bash
node server.js --port 8787 --data ./data
```

- `--port, -p` 监听端口（也可写成 `--port=8787`；`0` 表示由系统分配空闲端口并打印出来）。
- `--data, -d` 数据目录，不存在会自动创建，重启时复用其中的数据。
- `--help, -h` 显示帮助。

服务只绑定 `127.0.0.1`，启动后访问 <http://127.0.0.1:8787/> 打开操作界面。

## 接口

| 方法与路径 | 说明 |
| --- | --- |
| `GET /` | 操作界面：创建表单 + 链接表格（每次请求按当前数据重新渲染） |
| `POST /create` | 接收 `application/x-www-form-urlencoded` 表单，成功后 `302` 跳回 `/`（失败也跳回并带错误提示） |
| `POST /api/links` | 创建短链接，JSON 请求体 `{url, slug?}` |
| `GET /api/links` | `{"links":[{slug,url,visits}]}`，按 slug 字典序 |
| `GET /s/<slug>` | `302` 跳转到已保存 URL，并把该链接 `visits` 原子加 1 |
| `HEAD /s/<slug>` | 相同的跳转头，但不计访问 |
| `GET /health` | `{"ok":true}` |
| `GET /demo` | 内置本地接收页（演示用跳转目标，不请求任何外部站点） |

错误一律返回非 2xx 与 `{"error":"原因"}`。

### 创建规则

`POST /api/links` 请求体 `{url, slug?}`：

- **url**：仅允许 `http://127.0.0.1:<端口>/...`。主机必须**字面**等于 `127.0.0.1`（`localhost`、`[::1]` 等均按“其他主机”拒绝），协议必须是 `http:`，且不得携带用户名/密码；保存前按 `new URL(url).href` 规范化。
- **slug**：可选。提供时必须匹配 `[A-Za-z0-9_-]{3,24}`，且**区分大小写**；未提供则生成独立唯一的 slug（字母数字，默认 10 位）。
- 状态码：
  - `201` 新建成功，返回 `{slug,url,visits:0}`；
  - `200` 相同 slug 且相同 URL（幂等），返回当前记录；
  - `409` 相同 slug 但不同 URL，不覆盖原记录；
  - `422` url 或 slug 非法。
- 不同 slug 可以指向同一个 URL。

示例：

```bash
curl -s -X POST http://127.0.0.1:8787/api/links \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://127.0.0.1:8787/demo","slug":"demo-link"}'

curl -si http://127.0.0.1:8787/s/demo-link   # 302 + Location，计数 +1
curl -s  http://127.0.0.1:8787/api/links     # 查看当前列表与计数
```

## 计数与持久化

- 创建记录与访问计数都会在响应之前落盘：写入进程内 `Map` 后，先把 `links.json` 写到同目录临时文件再原子 `rename`，因此并发请求不会看到半截文件。
- 所有状态变更（创建、计数）在进程内通过一条串行队列执行，既保证“查重 + 写入”原子，也保证并发计数不丢失（20 次并发 `GET /s/<slug>` 会计满 20 次）。
- 重启后从 `<data>/links.json` 载入，计数与链接照旧。缓存策略为 `Cache-Control: no-store`，不使用浏览器缓存代替服务端状态。

## 手工验证清单

1. `node server.js --port 8787 --data ./data`，打开 <http://127.0.0.1:8787/>。
2. 在表单里填入 `http://127.0.0.1:8787/demo` 与 slug `demo-link`，创建成功并跳回根页面。
3. 点击表格中的 `/s/demo-link`，到达本地接收页；刷新根页面，访问次数 +1。
4. `curl -I http://127.0.0.1:8787/s/demo-link` 只返回跳转头，计数不变。
5. `curl -s http://127.0.0.1:8787/health` 得到 `{"ok":true}`。
6. `Ctrl+C` 停止后重新启动，链接与计数保持不变。

## 文件

- `server.js`：服务实现（CLI、存储、路由、服务端渲染页面）。
- `README.md`：本文件。
- `<data>/links.json`：运行时生成的数据文件（纯文本 JSON）。
