# QA 验证记录

验证日期：2026-09-04  
浏览器：Chromium 144  
测试后端：Vulkan / SwiftShader 软件 WebGPU（用于兼容性和 WGSL 严格验证）

## 已通过

- JavaScript 语法检查：`node --check app.js`
- Python 本地服务器语法检查：`python -m py_compile serve.py`
- Windows 启动脚本包含 PowerShell TCP 静态服务器回退（无需 npm/CDN）
- 原生 WebGPU Adapter / Device 创建
- 所有 WGSL Shader Module 和 Render/Compute Pipeline 验证
- 首帧提交和 GPU Queue 完成
- 标准构型：628 可见实例，42 绘制调用
- VT-4A1 + X-Ray：655 可见实例，43 绘制调用
- VT-4P / Haider + 左舷剖开：445 可见实例，42 绘制调用
- 三个独立标签页及其状态隔离
- 四帧静止累积 Ping-Pong Buffer
- GPU Compute 粒子
- 256 × 144 代理分辨率走完整“分块累积 → Capture Texture → GPU Readback → PNG”生产导出路径
- 导出 PNG 非黑帧、通道顺序正确、文件可解码
- 运行时无 uncaptured WebGPU validation error

## 说明

软件 WebGPU 的实时帧率不能代表用户独立显卡性能；它主要用于发现 WGSL 保留字、非一致控制流采样、资源同步域冲突、RenderPass 描述错误和交换链读回问题。

4K / 8K 使用与代理测试相同的代码路径，只是分块数、GPU 时间和 PNG 内存占用更高。自动化环境未执行完整 8K 编码，以避免不必要的资源消耗。
