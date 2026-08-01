# SVG：纯矢量《蒙娜丽莎》笔触复刻 Benchmark



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: Visual Arts & Modern UI
- **Difficulty Level (难度等级)**: `L1 (Basic)`
- **Primary Tech Stack (核心技术栈)**: Pure SVG / Vector Paths & Gradients
- **Core Evaluation Focus (核心考核点)**: Vector stroke composition, color layering, depth & perspective grouping

## 任务定位

测试模型使用纯 SVG 组织大量矢量笔触、构图、色彩分层和远近层次的能力。

## 标准化提示词

使用纯 SVG 创作一幅对达·芬奇《蒙娜丽莎》的研究性复刻，目标尺寸约 1200×1600，竖幅。

### 视觉要求

- 使用数千条短弧线或锥形描边模拟罩染与晕涂，不使用大面积平涂替代主要形体。
- 笔触沿面部轮廓和体积方向组织。
- 构图包含居中半身像、四分之三侧身、交叠双手、深色长发和薄纱。
- 背景包含左右不对称山水、路径、河流/桥梁和雾状远山。
- 色板以赭褐、暗金、橄榄绿、深棕和蓝绿色空气透视为主。
- 笔触颜色具有邻近色抖动与明暗分层，远看成画、近看可见笔触。

### 参考与合规

- 使用博物馆或公共领域高清原作作为构图参考。
- 不把参考位图嵌入 SVG 后伪装为矢量复刻。
- 在 README 中记录参考图来源和许可状态。

## 输出要求

- 交付可独立打开的 SVG。
- 不使用外链位图作为主体。
- 文件结构应可解析，不得仅包含一个 base64 图片节点。

## 自动化验收建议

- 检查画布尺寸、SVG 有效性、路径/描边数量和外链资源。
- 渲染固定尺寸 PNG，检查是否为空白、越界或缺失字体。
- 构图与审美评分保留人工复核。
