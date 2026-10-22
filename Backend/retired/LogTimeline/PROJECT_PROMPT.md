# 日志时间线与错误定位器

实现一个本地日志分析工具。用户在网页或桌面窗口中选择 UTF-8 JSONL 日志，程序逐行解析，展示时间线、级别统计、错误列表和原始行定位。解析与统计必须由独立处理模块完成，另提供 CLI 输出相同结构的 JSON；不能只有页面内写死的数据。

## 数据与行为契约

每行包含 `timestamp`、`level`、`service`、`message`，可选字符串 `request_id`。时间采用带时区的 RFC 3339，比较时转换为 UTC；合法级别为 DEBUG/INFO/WARN/ERROR。坏 JSON、缺必要字段、非法时间单独列为坏行，不计入合法记录统计。原始行号从 1 开始，重复日志保留，时间相同按行号稳定排序。筛选时间采用左闭右开区间。

## 交付要求

一个启动入口、可操作界面、CLI、依赖声明和 README。允许 Python、Node.js、Go、C# 等；处理模块不得依赖界面才能运行。界面可用分页，不要求一次渲染全量文本。

## 运行与交付契约

使用 Node.js 24 原生模块，不安装第三方依赖，不生成 node_modules。交付 server.js、界面和 README；可拆分普通文件。启动为 node server.js --port <端口> --data <数据目录>，额外参数见各题。所有服务仅监听 127.0.0.1；GET /health 返回 JSON {"ok":true}，GET / 提供可操作界面。数据目录不存在时创建；重启指使用同一目录重新启动。JSON 响应 Content-Type 正确，错误返回非 2xx 与 {"error":"原因"}；响应不能假装成功。界面从真实 API 获取结果，能完成题述演示，不能用随机数或固定样例模拟后端状态。用户提供的文本按纯文本展示。

交付不包含 TODO、未实现分支或需用户补充的核心逻辑。README 写明启动方式和操作流程。用到的样例数据由程序或用户在本地生成，不依赖账号、网络服务或其他项目文件。

## HTTP/CLI 接口

额外交付 analyze.js。命令 node analyze.js <文件> [--level ERROR] [--request-id id] [--from RFC3339] [--to RFC3339] 输出单一 JSON，结构为 {total,invalid,counts,records,errors}；total 为筛选前合法行数，invalid 为坏行数，counts 包含四种级别的筛选前计数，records 为筛选后按时间/行号排序的记录，每项保留 line、timestamp、level、service、message、request_id（缺失用 null）；errors 每项含 line 和 reason。同时筛选时取交集。服务 POST /api/analyze 接收同样日志的原始 UTF-8 请求体，查询参数 level/request_id/from/to，与 CLI 相同。界面含文件选择、上传、筛选、原文和导出。
