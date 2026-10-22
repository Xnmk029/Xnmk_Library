# USP Match · Low-Poly / PS1 · Build Log

## 实现要点

### 模型（程序化 Three.js）
- **套筒 (Slide)**: 深色金属，平直着色，带前后防滑纹、顶部导轨、后照门座
- **枪管 (Barrel)**: 亮银色圆柱体，带光纤前准星基座
- **下机匣 (Frame)**: 聚合物材质，含握把、扳机护圈、扳机、击锤、弹匣释放钮
- **补偿器 (Compensator)**: 前部 Match 配重/补偿器，带顶部和侧面散热槽
- **弹匣 (Magazine)**: 分离式，含弹匣体、底板、托弹板、弹匣卡笋缺口
- **光纤准星**: 前准星亮绿色 (emissive)，后准星红色 (emissive)
- **复进簧导杆**: 可见于套筒内部

### 动画循环（8 秒）
1. **0-2s**: 弹匣向上滑入握把（smoothStep 缓入缓出）
2. **2-4s**: 套筒在裸露银色枪管上后拉复位（recoil 动画）
3. **4-6s**: 分解视图（各部件沿真实机械方向分离）
4. **6-8s**: 重新组装（reverse explode）

### 渲染
- 正交相机，近正交展示视角
- 三光源：主光 + 填充光 + 轮廓光
- 平直着色 (flatShading: true)
- 中性灰背景 (#3a3a3a)
- 60fps 目标，requestAnimationFrame 循环

## 自验
- 单文件 HTML，双击即可运行
- Three.js 通过 unpkg CDN 引入（ES module importmap）
- 无外部 3D 模型文件
- 无 TODO 或未完成占位符
- 仅读取 TASK.md 和 PROJECT_PROMPT.md
