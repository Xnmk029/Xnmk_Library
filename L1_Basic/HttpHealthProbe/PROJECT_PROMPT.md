# HTTP 健康探针与可视化报告

编写 Node.js 24 命令行健康探针。用户提供 JSON 文件，根结构为 [{id:string,url:string},...]，访问本地 HTTP 目标，输出 JSON 结果和可直接打开的 HTML 报告。HTML 用表格和原生 details 展示绿/红状态、HTTP 状态与错误，使用简洁默认样式即可。

命令 node probe.js --config <JSON路径> --out <HTML路径> --timeout-ms 150 --concurrency 2。JSON 产物与 HTML 同路径但扩展名为 .json，结构 {results:[{id,url,status,ok,error}],summary:{total,healthy,failed}}。results 严格保留输入顺序。HTTP 2xx 为 ok:true、error:null；非 2xx 为失败且保留真实 status；连接失败或超时的 status:null，error 为非空字符串。每个目标独立超时，失败不影响其他目标；最多 concurrency 个请求同时在途。重定向不跟随，3xx 也视为失败。

本题只允许 http://127.0.0.1:<端口>/... 目标，拒绝含用户名/密码、其他主机或其他协议的 URL；id 必须是非空字符串，URL 不合法或配置 JSON 错误时退出 2，并保持已有输出文件不变。输入合法时完成全部检查并写报告；全健康退出 0，有失败退出 1。HTML 中的 id、URL 和错误必须按纯文本展示，不能执行输入携带的标记。交付 probe.js 和 README.md，全部使用原生模块，报告由程序运行生成；README 给出配置与命令示例。
