# 目录重复文件检测器

只读的重复文件检测服务：扫描指定目录下的普通文件，按**真实 SHA-256** 找出字节完全相同的文件，并在网页上展示分组、进度和最近一次结果。
不做删除、移动或任何自动清理；不会跟随符号链接与 junction。

## 运行

需要 Node.js 24+（仅使用原生模块，无第三方依赖，无需安装任何东西）。

```bash
node server.js --root <工作目录> --port <端口> --data <数据目录>
```

示例：

```bash
node server.js --root ./demo --port 8080 --data ./data
# 打开 http://127.0.0.1:8080
```

| 参数     | 说明                                                             |
| -------- | ---------------------------------------------------------------- |
| `--root` | 要扫描的工作目录，默认当前目录                                   |
| `--port` | 监听端口，必填                                                   |
| `--data` | 服务端状态目录，默认 `./data`；不存在会创建，重启时复用          |
| `--host` | 仅接受 `127.0.0.1`（默认）或 `localhost`；其它地址会直接拒绝启动  |
| `--help` | 显示用法                                                         |

服务只监听回环地址 `127.0.0.1`。数据目录不存在会自动创建；`data/last-result.json` 保存最近一次完整扫描结果，因此**服务重启后仍可查看上次结果**。

## HTTP 接口

| 方法与路径      | 说明                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| `GET /health`   | 返回 `{"ok":true}`                                                                          |
| `GET /`         | 操作界面                                                                                    |
| `POST /api/scan`| 启动扫描并等待完成，返回 `{groups,scanned,skipped}`                                          |
| `GET /api/result`| 返回最近一次**完整**扫描结果；若从未扫描过则 `404`                                           |
| `GET /api/progress`| 当前进度快照（`state`,`seen`,`done`,`scanned`,`skipped`,`oversize`,`unreadable`,`elapsedMs`） |
| `GET /api/files?path=<相对路径>`| 读取根目录内某个文件用于预览；根外路径一律拒绝                              |

`POST /api/scan` 返回体：

```json
{
  "groups": [
    { "sha256": "…64 位十六进制…", "size": 31, "paths": ["c/copy1.bin", "d/copy2.bin", "中文目录/副本.bin"] }
  ],
  "scanned": 9,
  "skipped": 1
}
```

约定：

- `paths` 是**相对扫描根目录**的路径数组，按字符串字典序排序；`groups` 按各组的首个路径排序。
- 只有**字节完全相同且至少两份**的文件才成组；大小相同或文件名相同都不算重复。
- 零字节文件同样可以成为重复组。
- `scanned` 为成功读取的文件数；`skipped` 为无法读取或超过单文件上限（8 MiB）的文件数。
- 并发扫描请求会合并到同一次运行（都拿到同一份完整结果），不会并行扫描第二次，也不会发布半份结果。
- 所有错误返回非 2xx 与 `{"error":"原因"}`（如 `405`、`404`、`413`、`400`）。

`GET /api/result` 在扫描字段之外还附带 `generatedAt`、`durationMs`、`root`、`groupCount`、`duplicateFileCount`、`skippedReasons` 和 `errors`（跳过明细，最多 200 条），供界面展示真实状态。

## 网页界面

- **开始扫描**按钮触发 `POST /api/scan`，扫描期间轮询 `GET /api/progress` 显示进度条与计数。
- **重复文件分组**以可展开列表呈现：每组显示 SHA-256（悬停可见完整值）、大小、副本数量与各相对路径；每个文件可点“预览”通过 `GET /api/files` 读取真实内容（纯文本直接展示，二进制以 base64 展示）。
- **整体信息**显示根目录、完成时间、用时、`scanned` / `skipped`、分组数与跳过明细。
- 页面加载时自动调用 `GET /api/result` 展示上次结果；所有展示值都来自真实 API，不使用浏览器缓存代替服务端状态。

## 扫描规则

- 只扫描根目录内的**普通文件**；符号链接、junction、目录、套接字等一律跳过（junction 在 Windows 上被 `readdir` 标记为符号链接，因此不会被跟随）。
- 单文件上限 **8 MiB**：超过上限的文件记为 `skipped`（原因见 `errors`），文件在读取过程中增长到超过上限也会被跳过。
- 扫描是只读的：只执行 `open(..., 'r')` 与读取，不改动、不删除、不移动任何被检查的文件。

## 演示数据

`demo/` 提供一组固定的演示文件，覆盖题目要求的场景：

| 场景                     | 文件                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| 同名不同内容（**不**成组） | `demo/a/report.txt` 与 `demo/b/report.txt`                       |
| 不同名相同内容（成组）    | `demo/c/copy1.bin`、`demo/d/copy2.bin`、`demo/中文目录/副本.bin` |
| 空文件（成组）            | `demo/empty1.txt` 与 `demo/sub/empty2.txt`                       |
| 中文文件名（成组）        | `demo/中文名字.txt` 与 `demo/中文目录/中文名字.txt`              |
| 超过 8 MiB（计入 skipped）| `demo/big.bin`                                                   |
| junction（不跟随）        | `demo/linkdir` → 仓库外的 `outside/`                             |

用 `--root demo` 启动后点“开始扫描”，应得到 3 组重复、`scanned=9`、`skipped=1`。
修改任意文件的字节后再次扫描，相关分组的 SHA-256 与成员会随之变化。

## 简单自检

```bash
node server.js --root demo --port 8080 --data ./data   # 终端 1
node tools/smoke.mjs http://127.0.0.1:8080             # 终端 2
```

`tools/smoke.mjs` 只做只读检查：健康检查、界面可达、扫描返回结构、排序规则、根外路径拒绝、错误响应格式。

## 文件

```
server.js            HTTP 服务、扫描引擎、路径安全与持久化
public/index.html    操作界面
public/app.js        界面逻辑（全部数据来自 API）
public/styles.css    样式
tools/smoke.mjs      只读冒烟检查脚本
demo/                演示用固定数据（含 junction）
data/                运行期自动创建，保存最近一次结果
```
