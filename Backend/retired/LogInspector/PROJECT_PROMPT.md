# JSONL 日志筛选台

实现小型日志筛选工具：在页面粘贴或选择 UTF-8 JSONL 日志，点击分析，展示级别统计、坏行、筛选后记录和原始行号。允许一次处理到内存，输入上限 2 MiB；不要求独立 CLI、超大文件或流式索引。

POST /api/analyze 接收原始 UTF-8 请求体，响应 {total,invalid,counts,records,errors}。每行字段 timestamp（带时区 RFC3339）、level（DEBUG/INFO/WARN/ERROR）、service、message（字符串），request_id 可选字符串。空行忽略；坏 JSON、非法字段或时间记录在 errors:[{line,reason}]，不影响其他行；行号从 1 开始。total/invalid/counts 为筛选前计数，counts 包含四种级别；records:[{line,timestamp,level,service,message,request_id}] 按 UTC 时间排序，同毫秒按原行号排序；缺 request_id 用 null，重复日志保留。

可选查询参数 level、request_id、from、to 取交集；时间范围左闭右开。不要求支持毫秒以下的排序精度。筛选后仍保留原行号。网页可筛选和导出当前 JSON 结果。

## 运行与交付

只使用 Node.js 24 原生模块，无第三方依赖。交付 server.js、原生网页和简短 README。启动 node server.js --port <端口> --data <数据目录>，只监听 127.0.0.1；GET /health 返回 {"ok":true}，GET / 提供操作界面。界面只需实用的表单、列表和状态，用户数据按纯文本展示。所有展示来自真实 API。错误返回非 2xx 与 {"error":"原因"}。数据目录不存在则创建，重启时复用；不能以浏览器缓存代替服务端状态。无需账号、外部服务或依赖安装。
