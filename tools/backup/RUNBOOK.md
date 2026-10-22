# 空闲心跳执行说明

本聊天 ID：`01a12ab3-8f2e-7b00-8b31-597a3d19188c`；已存在的心跳 ID：`automation`。当前周期 15 分钟，不新建重复心跳。第一次初始化已经完成；不要重复 Initialize，不要主动运行全量扫描检查工作区。

1. 读取 `backup_plan.json` 和它的 `state_directory/status.json`。所有路径和已登记卷 ID 必须继续使用保存的值。若状态 complete，核对版本 COMPLETE.json、manifest SHA-256 和恢复记录，停用本次心跳；不要再启动新版本。若 failed，先检查 events.jsonl 与各次 worker stderr 日志并处理具体原因；不得把失败改成完成。
2. 调用 `list_threads(limit=50)`，取 pinnedThreads 和 threads。保留每条 id、status、cwd、projectId、title 及 unavailableHosts/unavailableSources，排除本聊天在 Python 中处理。用实际工具结果生成 `state_directory/threads_snapshot.json`，结构为 `{"observed_unix": 当前 Unix 秒数, "result": 工具 JSON 结果}`。缺失或不可用的来源按未通过处理；不要臆造聊天状态。快照不可早于运行 Tick 前 45 秒。只做轻量检查，不搜索全部源文件。
3. 执行 `& 'F:\benchmark\tools\backup\backup_control.ps1' -Action Tick -ThreadsSnapshot '<state_directory>\threads_snapshot.json'`。它再次核对四个源、根目录身份、目标卷、Godot 完成报告，再调用 check_idle.ps1。只有 15 分钟无键鼠、两次 CPU 均 ≤15%、可读 GPU ≤10%、无其他 benchmark 运行聊天/进程/Godot 验收时才授权隐藏后台工作。防重复启动由文件锁保证。未满足时保持安静结束本次检查。
4. 后台开始后，在同一心跳运行期间用最多约 20 秒的非阻塞等待间隔，持续重复步骤 2–3（相邻 list_threads 检查不超过约 30 秒）。不要只启动后退出。若用户插入新输入、聊天忙、电脑忙或工具状态不可确认，执行 `backup_control.ps1 -Action Pause` 撤销许可，并结束当前监控；后台自身还每 10 秒检查 CPU/GPU/jobs、每个数据块检查键鼠、每 0.5 秒检查许可。75 秒许可超时自动停下，源扫描与复制/散列检查点保留到下一次空闲。
5. 用 `backup_control.ps1 -Action Status` 读取状态；不要写入源目录中的静态 status.json。无需逐步播报文件进度。失败时日志包含 operation、attempt、错误和 worker PID；复制/散列失败最多即时重试 3 次，仍失败则停止并报告。源变化会记录 source_changed，返回 waiting_for_idle 并在下一次空闲重新扫描。不可忽略失败或遗漏。
6. 真正完成后检查 status.json 的 version_directory，对照 COMPLETE.json 的文件数、总字节数、manifest_sha256、all_regular_files_verified、unresolved_omissions 和 recovery_readback。日志中出现过失败但后续已解决可以完成；未解决问题不得完成。只在新完成、新失败或需要用户处理时通知一次，记录通知结果到控制目录，不能因无变化重复通知。
7. 用 automation_update 更新 ID `automation`，保留原 name、prompt、kind、rrule、destination、targetThreadId、notificationPolicy 等字段，只把 status 改成 PAUSED。通过工具停用，不能直接修改 automation.toml。仅本次完整备份的心跳需要停用。

后台脚本没有绕过空闲条件的正式运行参数。小型测试在 `test_backup.py` 中，通过依赖注入只使用 F:/benchmark-backup-state/tests 下隔离的微型目录；这些测试不读取四个正式源。测试证据另存，正式首次状态必须一直是 waiting_for_idle、phase=not_started、version_directory=null，直到之后的心跳实际满足条件。

状态目录保留的旧 worker 进程 ID 不能单独当作运行证据；查询具体进程命令行或锁。各次 worker stdout/stderr 使用独立时间戳文件，不覆盖前次失败记录。完成版本永不覆盖；恢复到一个尚不存在的新目录，按 RESTORE.md 操作。
