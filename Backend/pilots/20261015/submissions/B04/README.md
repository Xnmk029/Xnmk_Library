# 本地短链接与访问统计

只需要 Node.js 24，无第三方依赖。在本目录运行：

```powershell
node server.js --port 3000 --data ./data
```

打开 http://127.0.0.1:3000 。表单预填本服务的 `/demo` 本地接收页，填写可选 slug 后创建，点击列表中的短链接，再返回或刷新查看访问次数。页面由服务端生成，无浏览器缓存存储。目标 URL 作为纯文本展示。服务只监听 `127.0.0.1`，不主动请求目标，也无需访问外网。

API：

- `GET /health` → `{"ok":true}`。
- `POST /api/links`：`Content-Type: application/json`，请求如 `{"url":"http://127.0.0.1:3000/demo?message=hello","slug":"demo_1"}`。新建返回 201；相同 slug 和规范化 URL 返回 200 与当前记录；同 slug 不同 URL 返回 409。
- URL 必须显式包含端口，仅允许 HTTP 和字面主机 `127.0.0.1`，禁止用户名、密码；以 `new URL(url).href` 保存。slug 区分大小写，须匹配 `[A-Za-z0-9_-]{3,24}`；省略时生成唯一随机值。非法 URL/slug 返回 422，不同 slug 可指向同一 URL。
- `GET /api/links` → `{links:[{slug,url,visits}]}`，按 slug 字典序排序。
- `GET /s/<slug>` → 302，保存一次访问后返回 Location；`HEAD` 返回相同跳转头但不计数。未知 slug 返回 404。
- `POST /create` 接受 URL 编码原生表单，成功后 303 返回首页。错误响应为非 2xx 和 `{"error":"原因"}`；请求体上限 16 KiB。

记录存入指定目录的 `links.json`。每次创建或计数串行执行：写入同目录临时文件、同步文件、原子替换后才响应；失败不发布内存修改。重启使用同一 `--data` 即可恢复；损坏的数据文件会导致启动失败，不会静默清空。一个数据目录仅供一个服务进程使用。默认端口为 3000、目录为 `./data`；`--port 0` 可分配空闲端口，实际地址输出在终端。

运行本地端到端验证（使用临时数据目录和本地接收服务）：

```powershell
node --test test.js
```
