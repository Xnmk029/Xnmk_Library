# FPV 穿越机花飞 3D 模拟器 · 作答过程记录（L3）

受测模型自报：`qwen3.8-flash`（运行时系统提示原文 "You are a coding agent powered by the qwen3.8-flash model."）
工作目录：`F:\benchmark\暂存\qwen-3.8-flash-next-20260827\ws-fpv`
题面唯一来源：本目录 `task.md`（已完整读取并以其为唯一标准）

---

## 一、需求拆解与总体设计

按题面四大块拆成可独立验证的子系统，全部写进一个 `<script>`（保证跨模块函数声明提升可用）：

| 子系统 | 文件位置（最终单文件内） | 要点 |
|---|---|---|
| 线性代数/李群 | `/* 0. 线性代数 / 李群工具 */` | `V3/M3/m4` 手写；`hat3`、`so3_exp`（Rodrigues 闭式）、`so3_log`、`so3_project` |
| 程序化几何与场地 | `/* 1. 网格生成…花飞场地布局 */` | box/cyl/torus/plane/wallMesh(带方洞) + 8 环门、3 废墟墙、15 立柱、5 斜板、烟囱、参照塔 |
| WebGL2 渲染 | `/* 2. WebGL2 渲染器 */` | 物体/天空/拖尾/后处理 4 个 program，FBO 离屏 + 全屏三角形 |
| 刚体与 PID | `/* 3-4. 默认参数 / 刚体动力学 + 三轴 PID */` | `defaultCFG`、`pidTorque`、`angleRateSetpoint`、`stepBody`、`resolveCollisions`、`vtxSignal` |
| 硬件输入 | `/* 5. 硬件输入 */` | Gamepad 轮询 + 事件、轴/键/键盘双键对、死区-expo-反向、Failsafe 覆盖 |
| 设置菜单/HUD | `/* 6. 设置菜单 */` | 数据驱动生成 ①~⑥ 分组、预设持久化、离线 PID 阶跃自测 |
| 主循环 | `/* 7. 主程序 */` | 定步长子步进、相机、渲染、图传、HUD、门通过检测 |
| 启动 | `/* 8. 碰撞体线框 + 启动引导 */` | boot()、错误兜底、`window.__FPV` 调试导出 |

## 二、关键实现决定（与题面核心约束对应）

1. **SO(3)/so(3) 指数映射积分**：状态里的姿态是 3×3 矩阵 `R`，角速度 `ω` 以**机体系**表达，
   演化写成 `R ← R · exp([ω Δt]×)`（`M3.mul(S.R, so3_exp(phi))`），即右乘李群一步，
   与欧拉方程 `I ω̇ = τ − ω×(Iω)` 的机体系表述自洽。θ→0 用 Taylor 展开避免 0/0；
   每 16 步做一次 Gram–Schmidt 重正交化抑制浮点漂移。**全程没有欧拉角参与积分**，
   `displayEuler()` 只从 R 反解 roll/pitch/yaw 给 HUD 用。
2. **受力模型**：`m v̇ = R·(0,0,Σf_i) + m·g − k|v|v`；四电机推力带一阶滞后（`motorTau`），
   推力分配用 X 型解析伪逆 + 幅值饱和后的**收缩迭代**（保持总推力贴合指令、避免小 kQ 时集体推力暴涨）。
3. **Acro 三轴 PID**：目标=杆量×满杆 rate；P 对误差、I 带限幅与同向饱和冻结（anti-windup）、
   D 对**测量**角速度微分并一阶低通（`dHz` 可调）。输出力矩经限幅后进入分配矩阵。
   额外做了 ANGLE 串级外环（姿态误差 `log(R_des·Rᵀ)` → 角速度目标），仍然只用 SO(3)/so(3) 运算。
4. **遥控器**：`navigator.getGamepads()` 每帧轮询；通道源支持 `ax:N / btn:N / pair:A|B`，
   带「学习」绑定、一键 Mode2、逐通道反向（反向只作用于设备源，键盘回退不二次反向）。
5. **VTX**：信号 = 与起飞点三维距离的 smoothstep 衰减 + 多径抖动；场景渲到 RGBA8 FBO，
   后处理 shader 依次叠加滚动条纹（与刷新不同步下滚）、按行块随机水平撕裂（含整块 glitch）、
   hash 雪花、随衰弱加剧的模糊、色度串扰、扫描线、饱和塌陷、暗角；`s≤0.001` → 底噪黑屏，
   并锁存 FAILSAFE（目标角速度归零 + 强制油门 `fsThrottle`，或 `fsMode:'drop'` 断油；返航驻留 1.2s 恢复）。

## 三、写作预算纪律与拼装过程

按要求采用「分片写入 → 拼装 → 校验 → 删分片」：
`parts/p01_head.html … parts/p10_tail.html` 共 10 个分片（题面说九个，我实际把 HUD/主循环拆成
`p08_main.js` 与 `p09_boot.js` 两片，加头尾 HTML 共 10），用自写的 `assemble.mjs` 按序拼装为
`answer.html`，拼装时静态检查：不得含 `<script>` 标签/ES module 语句、无外链 script、
无物理引擎名、无 TODO/FIXME、script 标签配对、含 doctype。最终 **102330 字节 / 1913 行**，
`<script>` 1 开 1 闭、以 `</html>` 结尾、TODO 计数 0（已用 `node -e` 复核）。

## 四、踩到并修掉的问题（如实记录）

* 位置积分漏乘 `Δt`（`pos += v` 写成一步 240 倍速）——被自测的悬停/落体断言抓到后修正。
* 油门通道的「反向」标记原先未生效（直接 `(raw+1)/2`），且反向会二次作用于键盘双键对——
  改为仅设备源应用反向，油门先反向再映射 0..1。
* Yaw 方向语义：机体系 `+ω_z` 是机头向左，故 Mode2 默认 `yaw.rev = true`（右杆=右偏）。
* PID 量纲初版取归一化增益（P≈0.058）导致响应被力矩限幅拖死；重标为物理力矩单位
  （P≈1.2、τlim 0.90/0.30 N·m、iLim 0.20/0.10），并调 `armD/kQ/Iz/maxThrust` 使 TWR≈2.94。
* 电池模型原先用瞬时负载压降反推推力上限，形成自指耦合使悬停缓慢下坠；改成
  「容量→开路电压→上限」+「负载→显示电压」两段式。
* 天空全屏三角形 `z=1.0` 与清屏深度 1.0 在 LESS 下会被剔除 → 改 `z=0.9999`（真实浏览器才会暴露的坑，提前修）。
* ANGLE 外环首版把倾斜旋转作用在「当前 up」上 → 期望姿态恒等于当前姿态、永不回平；
  改为作用于世界天向 `[0,0,1]`（该 bug 由新加的断言 21 抓到）。
* 环面（穿环）碰撞在「正好落在管截面圆心」时退化无解 → 增加退化分支的法向兜底。

## 五、自测：`node verify.mjs`

运行方式（零依赖、零网络，只读同目录 `answer.html`）：

```
cd F:\benchmark\暂存\qwen-3.8-flash-next-20260827\ws-fpv
node verify.mjs          # 退出码 0=全通过；同时写 verify-result.json
```

做法：用 `new Function` 注入自写的 DOM/`navigator`/`performance`/`localStorage`/WebGL2 桩件，
**真实执行页面脚本**并 `requestAnimationFrame` 驱动主循环，再对动力学做数值断言。
当前 **23 条断言全部 PASS**（明细与实测数值见 `verify-result.json`，`result.json` 的 evidence 直接引用）：
指数映射正交性/det、与一阶欧拉对照、83s 剧烈翻滚漂移、pitch=90° 无死锁、落体 a≈g、
终端速度=√(mg/k)、悬停力平衡、推力矢量随 R 旋转、三轴 t90/超调/稳态误差、力矩符号右手系、
四类碰撞、信号单调衰减、420 帧随机花飞无异常、越限 Failsafe 与返航恢复、
Gamepad+键盘四通道与反向、源码核查（无欧拉积分/无物理引擎/无外链）、后处理 uniform 齐备、
菜单构建+预设存取、PID/气动参数真实接入、场地统计、HUD 输出、ANGLE 回平与模式对比、全程 0 console.error。

清理：`parts/`、`assemble.mjs`、`probe.mjs` 已删除；保留 `verify.mjs` + `verify-result.json` 作为可复跑的自测证据。

## 六、诚信声明（逐条对应 result.json 的 integrity 四项）

1. **`read_files_outside_workspace = false`**：本次所有 read/write/edit/glob/grep/pwsh 目标均在本工作目录内
   （`task.md`、`parts/*`、`answer.html`、`verify.mjs`、`assemble.mjs`、`probe.mjs`），
   唯一的列目录操作是 `Get-ChildItem -Recurse` 且 cwd 为本工作目录。
   未读取、未列举、未搜索 `F:\benchmark` 其他路径，尤其没有打开 `L3_Advanced` 下的既有参考实现
   `fpv_simulator.html`、`hy-3-0822.zip`、任何模型成果目录、`tools/`、`index.html`、`.git`、`.pi`
   以及 `C:\Users\Administrator\.dsh\sessions`。全部物理/图形/着色器代码为本轮从零手写，未复制任何既有实现。
2. **`used_git_history = false`**：未执行任何 git 子命令（含只读 log/show/diff/ls-files/cat-file/stash/worktree），
   也未通过文件历史、版本库、压缩包提取等任何途径窥探既有答案。
3. **`created_subagents_or_workflows = false`**：未调用 subagent / subagent_fork / subagent_next /
   workflow / ralph / list_agents / send_message / interrupt_agent / job_* / dev_* / create_goal / update_goal；
   我是本任务唯一作答者，全部实现与自测均在本会话顺序完成。
4. **`used_external_model_or_web = false`**：未调用 qwen_chat / qwen_generate / qwen_vision / qwen_tts /
   qwen_video / web_search，未向任何外部服务发送题目或其片段，未安装或下载任何 npm 依赖
   （自测仅用 Node 内置模块 fs/path/url），全程离线。

补充如实说明：中途曾被网关 429 打断两次（非本题相关，恢复后继续按题面作答）；
本文件与 `result.json` 中的数值均来自 `verify-result.json` 的实测输出，未做修饰。
