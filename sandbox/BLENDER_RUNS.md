# 原生 Blender 组卷与验收

profile：`native-blender-v1`。首题为 `NativeWorkflowBench/BlenderMXMaster3S`，运行 Blender 4.0.1/build d0dd92834a08。

## 派发

```powershell
$env:PYTHONUTF8='1'
py -3.14 sandbox/scripts/prepare_run.py --project BlenderMXMaster3S --model gemini-4-argon
```

受测目录位于仓库外，仅含原题面 `PROMPT.md` 和登记的 `references/**`。首题输入为 11 张原图、规格 PDF、图册和来源清单，均锁定 SHA-256。环境探针、README、协议、主机状态、鼠标模型或其他模型答案不复制。

发给外部 Agent 的内容只使用 prepare 输出的两行。Agent 宿主选择 `gemini-4-argon` 并使用新会话，保存实际模型身份、工具轨迹、原始消息及可获得的 usage。没有这些证据时字段保持未知；组卷不等于模型已运行。

如果使用 MCP，宿主为每个 run 绑定独立 Blender 文件、GUI 进程、用户配置和端口，仅开放当前任务需要的原生操作。已安装插件的服务端要求 GUI 事件循环，不能把后台 CLI 当作同一 MCP 会话。CLI/Python 路径可独立用于建模和渲染。

## 验收与收卷

```powershell
py -3.14 sandbox/scripts/review_run.py --run <harness目录> --transcript <完整会话日志>
py -3.14 sandbox/scripts/collect_run.py --run <harness目录> --with-review
```

也可先运行原生验收：

```powershell
py -3.14 sandbox/scripts/blender_profile.py --run <harness目录>
```

验收只修改副本，使用独立用户配置和 TEMP；关闭嵌入脚本自动执行，打开根目录的 `MX_Master_3S.blend`，读取 `PRODUCT` Collection 的求值后包围盒、单位和资源，再以固定 Eevee/640×360/16 samples 渲染保存相机。报告包含原始渲染器和受控检查渲染器，不能把该预览当作作品的最终展示效果、性能基准或视觉评分。

主文件缺失、文件打不开、渲染失败、资源缺失或未打包且越出工程目录，记录失败。整体尺寸按 XYZ=84.3/124.9/51 mm、±3% 自动检查。曲面、细节、拓扑、材质和连续证据需要人工查看；视觉分为 null。

每次验收保存 `BLENDER_VALIDATION.json`、日志、结构 JSON 和原始截图。输入变更、链接/工具状态污染或会话泄漏使样本 INVALID。收卷再次核对输入、提交快照、运行报告哈希和会话日志，保持全部相对目录与二进制资源；既有归档不覆盖，force 不绕过闸门。完整性有效但运行/结构失败的样本可作为 FAIL 留档。

归档位置：`NativeWorkflowBench/BlenderMXMaster3S/results/<model>/<run_id>/submission/`。

## 验证范围

当前提供锁定题包、独立配置和原生工程副本验收。OS/MCP 读取权限未经独立验证，`isolation_verification` 保持 `unverified`。正式比较需补工具/宿主边界证据；路径和哈希检查不能证明访问控制。

工程 fixtures 使用测试立方体，不调用受测模型、不构成鼠标参考答案或模型成绩。

```powershell
py -3.14 -m unittest discover -s sandbox/scripts -p test_blender_profile.py -v
```
