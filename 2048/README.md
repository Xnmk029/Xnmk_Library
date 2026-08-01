# 2048：Roguelike 融合游戏 Benchmark



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: Web Games & Interactive Logic
- **Difficulty Level (难度等级)**: `L2 (Intermediate)`
- **Primary Tech Stack (核心技术栈)**: HTML5 / CSS3 / JavaScript / Canvas
- **Core Evaluation Focus (核心考核点)**: Game state machine, animation touch & physical feel, Roguelike mechanics

## 任务定位

测试模型的前端动效能力与对 Roguelike 单局闭环的理解，各占 50%。

## 标准化提示词

发挥创意上限，使用合适的 Web 技术栈设计一个“2048 融合机制 + Roguelike 元素”的网页游戏。主题、世界观和视觉风格可自由决定。

### 动效与手感

- 方块/卡牌的滑动、碰撞和合并必须连续、稳定，无闪烁和瞬移。
- 合并时应有弹性缩放、轻微震动、粒子或其他克制的反馈。
- 用户输入必须产生即时、符合物理直觉的响应。
- 可使用 CSS 3D、Canvas、Three.js、PixiJS 或 GSAP。

### Roguelike 闭环

- 合并或达成条件后获得遗物、被动、卡牌强化或流派构筑。
- 强化必须实际改变操作、生成或结算逻辑。
- 随层数/关卡动态生成差异化敌人或障碍，难度合理递增。
- 包含明确的生命、资源消耗或失败机制。
- 失败后有结算和重新开始流程。
- 每局存在可验证的随机差异。

## 输出要求

- 所有 HTML、CSS 和 JavaScript 写入一个完整 HTML。
- 不得包含 TODO 或未完成占位符。
- 外部库只通过有效公共 CDN 引入。

## 自动化验收建议

- 注入固定随机种子并执行确定性移动序列。
- 验证滑动前后棋盘状态、合并结果和分数。
- 触发至少一次强化选择、关卡递增、失败和重新开始。
- 记录动画帧间位移，检测瞬移、重复输入和状态丢失。
