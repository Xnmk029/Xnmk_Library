# 执行日志 — FPV 穿越机花飞模拟器（L3）

- 受测模型: qwen3.8-27b
- 工作区: `F:\benchmark\暂存\qwen3.8-27b-20260824\ws-fpv\`
- 日期: 2026-08-24
- 验证工具: node v24.15.0（仅在工作区内读写文件）

## 关键步骤

1. **读取试题**：确认工作区内 task.md 与试题消息文本一致；未读取工作区外任何文件。
2. **技术选型**：
   - 单文件 `answer.html`，**纯原生 WebGL1**（未用任何 CDN/渲染库/物理库，可离线开箱即用，天然满足"物理引擎零依赖"且规避 CDN 不可达风险）。
   - 物理（全手写）：
     - 姿态 = SO(3) 旋转矩阵（列 = 机体轴在世界系）；每个子步 `R ← R·exp([ω]×h)`，exp 用 so(3) 指数映射（Rodrigues 公式，小角 Taylor 分支），积分后 Gram-Schmidt 再正交化抑制漂移；**物理路径零欧拉角**。
     - 角速度：体帧刚体欧拉方程 `I·dω/dt = τ − ω×(Iω) − c·ω`。
     - 平动：`a = R·(0,0,T/m) + (0,0,−g) − (k/m)|v|v`（二次气体阻尼），半隐式欧拉，固定步长 1/240 s（帧内累加器，≤30 子步钳制）。
     - 控制：Acro 速率模式 摇杆→目标角速度；三轴 PID（微分在测量值、积分限幅抗饱和）→力矩限幅→4 电机混合（线性解 + 0..tMax 饱和 + 回算真实 T/τ）→回灌刚体（全闭环）；可选"辅助平飞"（世界系回正角速度叠加到目标角速度，菜单可关）。
     - 地面碰撞（恢复系数+摩擦+姿态阻尼）、软边界。
   - 输入：Gamepad API 主循环实时轮询，Pitch/Roll/Yaw/Throttle 四通道（死区、油门 (v+1)/2 归一），键盘后备（方向键/A-D/Q-E/W-S），HUD 显示手柄状态。
   - 渲染：场景 Pass（程序化地表纹理、渐变天空+太阳+程序化云、5 环形门、3 可穿越墙体废墟+碎块残柱、4 绕桩立柱、起点垫+旗杆、四轴无人机模型含旋转螺旋桨）→ FBO；VTX Pass 全屏后处理 GLSL（雪花噪点/横向撕裂+大跳变/滚动条纹/色散/扫描线/暗角/失联黑屏）。相机 = 机头 VTX 视角（渲染边界手性修正，见下）。
   - 信号模型：`signal = 1 − (d − dClear)/(dLoss − dClear)`（d = 与起点 3D 距离，低通平滑），≤0.02 触发 Failsafe（电机停机、黑屏、HUD 横幅、滞回 0.35 恢复、坠落 2.5s 自动复位）。
3. **坐标手性修正（重要 bug 修复）**：内部物理系取 x前/y右/z上（相对标准右手系为左手系），WebGL 裁剪空间为右手系。若直接映射，世界→相机变换含反射（det=−1）导致投影错误。修正：渲染边界统一加镜像 `M=diag(1,−1,1)`（模型矩阵、法线、相机旋转 `M·R·M_CAM`、相机位置），使所有绘制量处于右手渲染系；同时修正 M_CAM 为正交映射、机体 z/y 轴抽取（R 第 2/1 列而非第 2 行）、地面法线 (0,0,1)、竖直圆柱改用 cylinderZ 生成器、墙体尺寸/高度轴/绕 z 偏航等轴向错用。
4. **自验证**（全部在工作区内）：
   - `node --check script_extracted.js`（整段 <script> 语法检查）→ 通过（exit 0）。
   - `node test_math.js`（从 answer.html 提取纯数学层 + 渲染边界常量做数值测试）→ **26 passed, 0 failed**，覆盖：
     - SO(3)：exp(0)=I、exp(90°z)=Rz(90°)、小角 Taylor、正交性 R·Rᵀ=I、det=+1、同轴合成律、60s 随机角速度积分仍 ∈ SO(3)。
     - 电机混合：(T,τx,τy,τz) 线性恢复、饱和后电机 ∈ [0,tMax]、T 上限。
     - 受力：T=mg 悬停稳定无漂移、二次阻尼项 a=−(k/m)|v|v 精确、重力项精确、90° 右滚后推力沿机体 +z。
     - 相机：渲染边界映射正交、det=+1、R=I 时沿 +x 前向看、上方向 +z。
     - PID 闭环：10 rad/s 横滚阶杆跟踪（误差 <1.2）、3 rad/s 偏航阶杆跟踪（误差 <0.8）、回中收敛。
     - 鲁棒性：20s 随机输入混沌飞行状态全有限（无 NaN/发散）。

## 验证命令与结果

```
$ node --version
v24.15.0

$ node test_math.js
== SO(3) 指数映射 ==
  PASS  exp(0)=I
  PASS  exp(90°z)=Rz(90°)（Rodrigues 一致性）
  PASS  小角 Taylor: R≈I+[w]×
  PASS  正交性 R·Rᵀ=I
  PASS  det=+1（真旋转，SO(3)）
  PASS  同轴合成 exp(a)exp(b)=exp(a+b)
  PASS  60s 随机角速度积分后仍 ∈ SO(3)（无漂移）
== 电机混合（线性解 + 饱和回算） ==
  PASS  混合恢复 T
  PASS  混合恢复 τx
  PASS  混合恢复 τy
  PASS  混合恢复 τz
  PASS  混合饱和后各电机 ∈ [0,tMax]
  PASS  混合饱和后 T 不超 4·tMax
== 受力模型 ==
  PASS  悬停：T=mg 时高度稳定
  PASS  悬停：无水平漂移
  PASS  二次气体阻尼 a=−(k/m)|v|v 精确
  PASS  重力项 a=−g 精确
  PASS  90°右滚后推力沿机体+z（世界+y）
== 相机映射（渲染边界手性修正，从 answer.html 提取实际常量） ==
  PASS  相机旋转正交 R·Rᵀ=I
  PASS  相机旋转 det=+1（真旋转）
  PASS  R=I 时相机沿 +x 前向看
  PASS  R=I 时相机上方向 = +z
== Acro 三轴 PID 闭环（体帧欧拉方程 + 混合回灌） ==
  PASS  PID 横滚: 阶杆 → ωx 跟踪 −10 rad/s
  PASS  PID 偏航: 阶杆 → ωz 跟踪 +3 rad/s
  PASS  PID 回中：角速度收敛
== 鲁棒性：20s 随机输入混沌飞行 ==
  PASS  20s 混沌飞行：状态全有限（无 NaN/发散）

RESULT: 26 passed, 0 failed

$ node --check script_extracted.js
（无输出，退出码 0 —— 语法检查通过）
```

## 遗留说明

- 浏览器内的 WebGL 上下文行为（着色器编译、FBO 完整性）无法在无浏览器环境执行，已用 GLSL 规范保守写法（精度 #ifdef、无 fwidth、smoothstep 边序合法、RGBA8/DEPTH_COMPONENT16 核心内建）并做运行时 error 兜底显示；数学层与渲染边界矩阵已数值验证。
- 验证副产物：`test_math.js`、`math_extracted.js`、`script_extracted.js`（均在本工作区内）。

## 诚信声明

1. **只读取了试题文本**：唯一输入为本任务消息内的试题原文（含评分参考）与工作区 task.md（二者一致）；未读取工作区外任何文件或目录。
2. **未联网检索本题答案/参考实现**：全程未使用 web_search 或任何联网工具；全部实现基于既有知识。
3. **未创建子代理**：未使用 subagent / subagent_fork / workflow / ralph，未派生任何子代理。
4. **全部文件操作均在试题工作区内**：创建/修改/读取仅发生于 `F:\benchmark\暂存\qwen3.8-27b-20260824\ws-fpv\` 内（answer.html、result.json、log.md、test_math.js、math_extracted.js、script_extracted.js）；task.md 未修改、未删除；未在评测流程之外做任何工作。
