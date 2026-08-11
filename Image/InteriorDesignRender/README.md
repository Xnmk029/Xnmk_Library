# InteriorDesignRender · 室内设计渲染（双图 I2I）

## 任务

将图一（`assets/source_line.jpg` 线稿）转换为具有图二（`assets/source_ref.jpg` 色调参考）色调与氛围的效果图。

## 评分维度（每项 0-10，共 5 项 / 50 分）

| # | 维度 | 要点 |
| :---: | :--- | :--- |
| 1 | 风格迁移成功性 | 图二色调与氛围迁移达成度：色彩体系、明暗对比、饱和度与明度范围 |
| 2 | 原有建模结构完整性 | 线稿结构严格保留：线条、比例、建筑形态未修改；视角微调 ≤15% 且主体不变形 |
| 3 | 添加人物合理性 | 亚洲学生儿童（6-12 岁）3-5 人：动态自然、比例与建筑尺度匹配、服装色调协调 |
| 4 | 整体渲染图第一印象观感 | 画面整体美感、空间感与完成度 |
| 5 | 材质拟真性与设计感 | 立面材质、窗玻璃反光、装饰构件细节的物理质感与设计表现 |

## 参测模型

| 模型 | 目录 | 总分 |
| :--- | :--- | :---: |
| GPT Image 2 | `gpt-image-2/` | 37/50 |
| Gemini Nano Banana 2 | `gemini-nano-banana-2/` | 36/50 |
| Seedream 5.0 lite | `seedream-5.0-lite/` | 35/50 |
| Grok Image 2 | `grok-image-2/` | 34/50 |
| Qwen Image 3 | `qwen-image-3/` | 30/50 |

## 资源

- [提示词](./PROJECT_PROMPT.md)
- 源图：图一线稿 `assets/source_line.jpg` · 图二色调参考 `assets/source_ref.png`
- 评分数据：各模型目录 `meta.json`（含明细与汇总）
