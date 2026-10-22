# Godot 原生 Bench run

profile：native-godot-v1；与 protocol 2.0 bare 流程兼容。当前登记题为 NativeWorkflowBench/GodotShader 的 v2 提示词。

## 发题

```powershell
$env:PYTHONUTF8 = '1'
py -3.14 sandbox/scripts/prepare_run.py --project GodotShader --model my-model
```

受测目录仍在仓库外，每次仅复制原始 PROMPT.md，不复制参考解、旧预览、评分器或 harness 信息。BENCH_PROFILE.json 是编排侧登记，不进入受测目录。每题使用独立模型会话和明确的工具权限。

项目自动进入 dispatch API 的题目列表。使用仓库版发题 UI：

```powershell
py -3.14 sandbox/scripts/dispatch_api.py --port 8787 --open
```

已安装的 AgentBench Desktop 是独立打包程序；修改仓库脚本不会自动替换其已冻结的后端二进制。当前接入通过上述仓库 CLI/API 使用。

## 验收

完成后，调用常规审阅入口即可自动执行首次 Godot 验收；也可先手工运行宿主验收：

```powershell
py -3.14 sandbox/scripts/godot_profile.py --run <harness目录>
py -3.14 sandbox/scripts/review_run.py --run <harness目录> --strict
py -3.14 sandbox/scripts/collect_run.py --run <harness目录> --with-review
```

Godot 默认定位 F:/bench-probes/godot-4.5.1/Godot_v4.5.1-stable_win64_console.exe。其他机器使用 GODOT4_EXE 或验收命令的 --godot。版本严格检查为 4.5.1 stable；正式 3D 验收使用 Forward+。

宿主先检查题面/登记哈希、外部目录与链接，然后将提交的完整文件树复制到 harness 下的独立验收目录。生成缓存不复制。验收只修改副本的 override.cfg，覆盖 user:// 为每个 model/run/validation 唯一的 BenchRuns 子目录，并使用独立 TEMP/TMP；平台 feature tag 同时覆盖。原始提交保持不变。

流程为：headless 编辑器导入 → 实际 GPU 启动主场景 → 原始截图、引擎报告和日志。每个 Godot 进程独立，超时终止其进程树；验收目录和失败日志保留。headless 导入成功不等于 GPU/Shader 运行成功，GPU 启动成功也不等于满足全部题目。

GODOT_VALIDATION.json 记录引擎、后端、显卡、实际用户数据路径、启动结果、帧间隔、提交哈希及验收目录。REVIEW.md 记录完整性与运行检查；六组预览、交互、像素稳定性和风格质量继续人工审阅，视觉分保持 null。

## 完整工程归档

交付归档路径：NativeWorkflowBench/GodotShader/results/<model>/<run_id>/。submission/ 保留全部普通文件、二进制依赖和相对目录，不按文本扩展名筛选，不压平文件名；.godot 和 __pycache__ 生成缓存排除，.import 和 .uid 等源资源元信息保留。

归档同时包含题面、SHA-256 清单、运行报告、日志与截图。归档前再次核对原始题面、登记、审阅快照、运行快照和 transcript。修改过的交付、链接越界、未审阅或陈旧证据拒收，--force 不可绕过。既有归档不覆盖。

完整性通过而引擎运行失败的样本也可归档，保存 FAIL 和错误证据；不会转为成功成绩。缺失实现、失败模式和视觉缺陷不能从比较中丢弃。

## 隔离边界

当前提供目录、进程、临时文件、用户数据和验收副本的轻量隔离；isolation_verification 保持 unverified。它不证明全盘权限 Agent 或独立 MCP 服务无权读取仓库、参考解或其他 run。正式测评需要宿主/工具路径权限和 canary 探针的独立证据。

Godot MCP 若后续接入，应每 run 绑定唯一项目、进程和端口；其脚本执行进程的权限也必须纳入宿主边界。当前 profile 不声称已提供 Godot MCP 服务。

## 工程检查

```powershell
py -3.14 -m unittest discover -s sandbox/scripts -p test_godot_profile.py -v
```

这些是工程 fixtures，不调用受测模型，不产生排行榜分数。现有 v1 草地预览可以作为复杂资源导入的工程样本；它不满足 v2 全部视觉需求，不能据此标记 v2 基准完成。
# 续作输入扩展（2026-10-16）

`NativeWorkflowBench/GodotGameDemo` 使用 `prompt_and_locked_archives`。正式题面与两个 ZIP 在 prepare 时复制至外部目录；ZIP 的 SHA-256/字节数冻结在 `BENCH_PROFILE.json.locked_inputs`，来源与文件清单只存宿主 `RELEASE.json`。候选可修改解压后的源码，不能修改输入 ZIP；初始快照不能夹带其他文件。旧 GodotShader 的 `prompt_only` 不变。

本轮是模型复用自身上一轮代码的续作条件，与从零开发分列。SQLite 固定官方 v4.6 Windows x86_64 二进制，已通过 Godot 4.5.1 的绑定参数、提交、回滚、关闭重开探针。自动验收仍仅证明导入/GPU 启动；双维度通关、持久化、UI、草地与水面要求需独立证据评分，未评保持 null。目录与输入哈希不证明宿主读取隔离。
