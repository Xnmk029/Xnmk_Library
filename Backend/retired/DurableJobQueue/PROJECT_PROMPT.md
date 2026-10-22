# 后台任务队列与失败恢复看板

实现一个持久化任务队列，至少支持两个独立 worker。任务对指定夹具文本文件计算 SHA-256 并发布结果文件；界面显示排队、执行、重试、成功、永久失败及每次尝试。支持延迟任务和任务去重，worker 被强制终止后由其他 worker 恢复执行。

## 数据与行为契约

任务用字符串 job_id 和幂等键识别。重复提交相同键和相同参数返回原任务，不同参数返回 409。采用至少一次执行语义；领取带租约和递增 fencing token，结果提交必须持有当前 token。允许重复计算，但最终结果和成功记录只能有一份。可重试失败最多执行 3 次，等待 1 秒、2 秒；参数错误直接永久失败。测试时钟可控，执行时限与租约参数公开。

## 交付要求

API、持久存储、可单独启动的 worker、看板和重启演示命令。可用数据库实现队列；不可直接套用成熟队列框架完成核心调度状态机。结果内容必须来自实际文件计算。

## 运行与交付契约

使用 Node.js 24 原生模块，不安装第三方依赖，不生成 node_modules。交付 server.js、界面和 README；可拆分普通文件。启动为 node server.js --port <端口> --data <数据目录>，额外参数见各题。所有服务仅监听 127.0.0.1；GET /health 返回 JSON {"ok":true}，GET / 提供可操作界面。数据目录不存在时创建；重启指使用同一目录重新启动。JSON 响应 Content-Type 正确，错误返回非 2xx 与 {"error":"原因"}；响应不能假装成功。界面从真实 API 获取结果，能完成题述演示，不能用随机数或固定样例模拟后端状态。用户提供的文本按纯文本展示。

交付不包含 TODO、未实现分支或需用户补充的核心逻辑。README 写明启动方式和操作流程。用到的样例数据由程序或用户在本地生成，不依赖账号、网络服务或其他项目文件。

## HTTP/CLI 接口

额外启动参数 --lease-ms 1200。提交 POST /api/jobs 接收 {idempotencyKey,text,failUntil,delayMs}：对 text 的 UTF-8 字节计算 SHA-256 为任务产物，failUntil 为前若干次尝试模拟暂时失败，delayMs 为执行延迟；首次 201 {id}，重复 200，相同键不同参数 409。GET /api/jobs 返回 {jobs:[...]}，GET /api/jobs/<id> 返回 {id,status,attempt,result,token}，状态为 queued/running/retry/succeeded/failed。POST /api/claim 接收 {workerId}，无任务为 {job:null}，有任务为 {job:{id,text,attempt,token,failUntil,delayMs}}。POST /api/jobs/<id>/finish 接收 {token,result}；POST /api/jobs/<id>/fail 接收 {token,error,retryable}。过期/旧 token 返回 409，租约过期任务可重领，attempt 递增。额外交付 worker.js，node worker.js --server <URL> --id w1，真实独立进程轮询领取；试次不超过 3，等待 1 秒再 2 秒。永久失败由 retryable:false 表达。
