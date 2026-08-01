# 池核：3D Poolrooms 步行模拟器 Benchmark



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: 3D Graphics, Physics & Shaders
- **Difficulty Level (难度等级)**: `L3 (Advanced)`
- **Primary Tech Stack (核心技术栈)**: Three.js / WebGPU / Water Shaders / Post-processing
- **Core Evaluation Focus (核心考核点)**: Procedural pool geometry generation, PBR water caustics, post-processing stack

## 任务定位

测试模型进行程序化建筑生成、室内 PBR、水体、后处理、第一人称交互和性能优化的综合能力。

## 标准化提示词

创建一个网页版 3D Poolrooms 步行模拟器，使用 Three.js/WebGPU 或 Babylon.js。在 Web 端尽可能接近高品质室内建筑可视化，同时准确表达潮湿、孤独、压抑和轻微 Lo-Fi 失真的池核氛围。

### 空间生成

- 使用正交几何构成走廊、立柱、平台、楼梯、浅水区和深水区。
- 使用网格迷宫、WFC 或等价方法动态加载/卸载区块，形成无尽探索感。
- 场景中不出现植物、家具或具有明显生命气息的道具。

### 光照与后处理

- 使用封闭室内光照逻辑，不依赖可见室外天空。
- 天花板/墙面面光源或发光材质提供冷白、冷青或微绿光。
- 使用环境遮蔽，并在可行时加入 SSGI 或光照探针近似多次反弹。
- 使用青绿色体积雾限制视野。
- 后处理包含克制的 bloom、轻微色差和动态颗粒；所有效果应可关闭以便性能对比。

### 材质与水体

- 瓷砖、混凝土和墙面使用 Albedo、Normal、Roughness、AO 等 PBR 信息。
- 瓷砖粗糙度应表现水渍和不均匀反光。
- 水体支持反射、折射、深度吸收、缓慢微涟漪和焦散。
- 不要求在不支持的设备上伪装 SSR/SSGI 成功；应提供能力检测和降级路径。

### 交互

- 第一人称视界高度约 1.7m。
- 移动缓慢，支持轻微 head bob 和空间化脚步回声。
- 不设置任务、HUD 或背景音乐。
- 限制不合理跳跃和高速奔跑。

### 性能

- 目标为主流设备 60fps，但报告必须记录实际硬件与画质档。
- 重复瓷砖使用实例化或合并网格。
- 动态区块具有明确的加载、卸载和资源释放机制。

## 自动化验收建议

- 固定生成种子，记录区块拓扑摘要。
- 执行固定步行路径，验证区块加载/卸载和碰撞。
- 分别在全效果与降级效果下采样帧时间。
- 记录 draw calls、三角形、纹理内存、上下文错误和水体/后处理能力检测。
