# 彭罗斯阶梯：HTML 视错觉 Benchmark



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: 3D Graphics, Physics & Shaders
- **Difficulty Level (难度等级)**: `L2 (Intermediate)`
- **Primary Tech Stack (核心技术栈)**: HTML5 Canvas / Three.js Orthographic Camera
- **Core Evaluation Focus (核心考核点)**: Orthographic projection, impossible geometry illusion, infinite stair walk

## 任务定位

测试模型在网页中构建立体几何、相机投影和不可能结构视错觉的能力。

## 标准化提示词

使用 HTML 下合适的技术栈绘制一座彭罗斯阶梯，要求同时具有清晰立体感和稳定的视错觉闭环。

### 要求

- 阶梯在指定观察视角下形成看似连续上升或下降的闭环。
- 使用透视、遮挡、光照和色彩强化空间层级。
- 提供一键返回“最佳错觉视角”。
- 允许用户有限旋转，以揭示真实几何结构；离开最佳视角后不要求仍保持错觉。
- 页面适配常见桌面分辨率。
- 不使用一张预渲染图片冒充交互式几何。

## 自动化验收建议

- 在最佳视角采集标准截图。
- 操作相机后验证场景确实为可交互几何。
- 检查返回预设视角后相机矩阵可重复。
- 视错觉效果属于视觉主观项，由人工复核。
