# 实际运行验证

环境：Windows amd64，Go 1.23.12；竞态检查使用 MSYS2 mingw64 GCC 16.1.0。

- `go build -o rafttxn .`：成功；另提供 Windows `rafttxn.exe`。
- `go test ./... -count=1 -timeout 90s`：11 个测试通过，包括 7 个原始测试。见 [日志](regression-go.log)。
- `go vet ./...`：成功，无诊断。见 [日志](vet.log)。
- `go mod verify`：all modules verified。见 [日志](modules-verify.log)。
- `go test -race ./... -count=1 -timeout 90s`：通过。见 [日志](race-test.log)。
- 用 `go build -race` 构建的二进制执行 `node demo.mjs`：20 项真实三进程断言通过，节点日志中的数据竞争报告为 []。见 [演练控制台](demo-race.log)。

## 最新完整故障演练

运行时间：2026-10-16T11:16:02.192Z 至 2026-10-16T11:16:11.850Z。

- 275 次实际 HTTP 请求。
- 6 次少数派/无 quorum 读写拒绝，最大响应耗时 1501ms，小于 1500ms + 1000ms。
- 成功写入响应记录到第一次强杀记录间隔 1ms；三个节点全部强杀后复用原目录恢复。
- 远端快照安装、旧成功/失败 ID 重试、本地快照恢复均由脚本断言验证；具体节点、索引和原始响应见历史。

[打开 HTML 工作台](artifacts/2026-10-16T11-16-02-191Z/report.html) · [完整 JSON 历史](artifacts/2026-10-16T11-16-02-191Z/history.json) · [浏览器渲染预览](artifacts/2026-10-16T11-16-02-191Z/report-preview.png)

[节点 1 日志](artifacts/2026-10-16T11-16-02-191Z/node-1.log) · [节点 2 日志](artifacts/2026-10-16T11-16-02-191Z/node-2.log) · [节点 3 日志](artifacts/2026-10-16T11-16-02-191Z/node-3.log)

原 `kvstore_test.go`、`raftexample_test.go` 和 LICENSE 的 SHA-256 与 UPSTREAM.json 一致。当前源文件、依赖锁文件和可执行文件的 SHA-256 记录在 [validation-manifest.json](validation-manifest.json)。

报告经 Chrome headless 1440×1100 渲染并检查。结果来自实际执行；HTML 仅筛选/展示记录，不做一致性推断。
