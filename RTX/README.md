# RTX：Web 路径追踪房间 GPU Benchmark



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: 3D Graphics, Physics & Shaders
- **Difficulty Level (难度等级)**: `L3 (Advanced)`
- **Primary Tech Stack (核心技术栈)**: WebGL2 / WebGPU / Path Tracing Shaders
- **Core Evaluation Focus (核心考核点)**: Monte Carlo ray tracing, BVH traversal, GPU workload benchmark reporter

## 任务定位

测试模型在浏览器中实现路径追踪展示、可控 GPU workload 和结构化性能报告的能力。

## 标准化提示词

使用 HTML 下合适的 Web 图形技术栈，生成一个展示路径追踪计算结果的小房间，并将其设计为可重复执行的显卡 benchmark。

### 核心要求

- 先给出简洁实施计划，再交付完整实现。
- 场景使用固定相机、固定几何、固定材质和固定光源。
- 支持渐进采样，并显示当前 sample count、帧率或每帧耗时。
- 提供至少三个固定 workload 档位，明确分辨率、反弹次数、每像素采样量和降噪设置。
- 提供开始、暂停、重置和运行 benchmark 控件。
- benchmark 采用固定预热与采样时长。
- 导出 JSON，记录 GPU/浏览器、workload、平均值、P50、P95 和有效样本数。
- 提供保存 PNG 功能，保留最终渲染证据。

## 自动化验收建议

- 禁止把软件渲染结果与硬件 GPU 结果混排。
- 验证渐进采样值持续增加且重置后归零。
- 每档 workload 至少重复三次。
- 固定浏览器、viewport、DPR、GPU 和后台节流策略。
- 报告资源加载错误、Shader 编译错误和 WebGL/WebGPU 上下文丢失。

## 补充独立任务

原文另有“使用 HTML 绘制彭罗斯阶梯并表现立体感和视错觉”的独立任务，已拆分到 `彭罗斯阶梯/README.md`，不与 GPU 路径追踪混测。
