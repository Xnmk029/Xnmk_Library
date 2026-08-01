# EngineSIM — V8 引擎声音与驾驶模拟（V4f-2）

参考 [ange-yaghi/engine-sim](https://github.com/ange-yaghi/engine-sim) 的公开建模思路，
实现**精简、低 CPU、带混响优化**的浏览器引擎声音驱动 + Three.js 驾驶模拟。

首款车型：**前中置引擎、等长芭蕉（equal-length headers）、十字曲轴 V8**，
6.4L 自然吸气、真双出排气 + X-pipe 的美式现代肌肉车。

## 快速开始

```bash
npm install          # 构建依赖（three / esbuild）
npm test             # 38 项自动化测试（DSP 14 + 车辆 12 + 转向 7 + 渲染 5）
npm run build        # 打包 sim.bundle.js（经典脚本，零 ES module）
npm start            # 服务器：http://localhost:8080/ → 驾驶场景 sim.html
```

- 驾驶场景：`http://localhost:8080/`（或 `/sim.html`）
- 音频实验室：`http://localhost:8080/audio-lab.html`
- 离线试音：`node tools/render-wav.mjs all` → `out/*.wav`
- 外部模拟器桥：`node tools/udp-bridge.mjs`（UDP 4001 → WebSocket 8081）

## 功能一览

| 模块 | 内容 |
|---|---|
| 引擎声音 | 真实点火顺序（1-8-4-3-6-5-7-2）驱动的每缸排气脉冲；等长芭蕉 = 每侧四分之一波谐振延迟线（164.9 Hz 奇次模）；X-pipe 部分合并 → 煮水声自然涌现（半阶/4 阶 ≈ 0.09，平轴 ≈ 0.006，差 15 倍）；8×8 FDN 混响（Hadamard 正交反馈 + 互质延迟线 + 预延迟 + 早反射 + 立体声去相关），8 组空间预设零点击切换；断油/限速器火花切断/回火/进气嘶吼/气门机械声 |
| 车辆物理 | 四轮双轨 + Pacejka 魔术公式（复合滑移摩擦椭圆、载荷敏感性、侧向/纵向一阶松弛）；开式差速器（等扭矩锁定轴近似）；半隐式离合器；6 速 + 倒挡 + 终传 3.09；TC/ABS（默认开）；车身系积分保留科里奥利耦合项；限速器火花切断 |
| 转向辅助 | 防推头限幅（R=v²/μg → θ=atan(L/R)，峰值滑移自学习）；自回正/漂移反打（前轴速度方向当主销后倾）；电控横摆阻尼；甩尾反打放宽限幅；<15km/h 淡出；空中禁用 |
| 场景 | Three.js：闭合样条赛道（柏油程序化贴图 + 红白双色路肩 + 草地/砾石不同 μ）、程序化天空 4 时段（环境 PMREM，金属/漆面不发黑）、ACES 色调映射、动态阴影 |
| 车辆模型 | Kenney Car Kit（CC0）肌肉跑车 GLB + 赛车轮胎，前轮转向+滚动 pivot、后轮滚动 pivot；加速翘头/刹车点头/转向外侧倾；尾灯随刹车发光；加载失败回退程序化车身 |
| 相机 | 5 视角（追尾/引擎盖/座舱/轮毂/环绕）；后追参考 Enhanced Driver 思路：转向预判、G 力姿态（非线性平滑+阈值去噪+速度淡入）、速度 FOV、动态前瞻点、抖动反馈；**角度回绕修复**：统一包装域 + velAngle = yaw + bodySlip，多圈累计无跳变 |
| 输入 | 键盘全套 + XInput/标准手柄（左摇杆转向、RT/LT、A 手刹、B 离合、RB/LB 换挡、打滑震动预留）+ 触屏虚拟按键 |
| 工程 | 浏览器零运行时依赖（classic 脚本单文件 bundle）；AudioWorklet 优先 + ScriptProcessor 兜底；Node 离线渲染与 38 项自动化测试；UDP/HTTP 外部模拟器桥 |

## 目录结构

```
src/
  engine-config.mjs     # 发动机/混响/音质配置（纯数据）
  engine-dsp.mjs        # DSP 核心（自包含，Worklet/ScriptProcessor/Node 三用）
  engine-driver.mjs     # 音频图构建（工作集/兜底）、参数映射、离线渲染入口
  main-sim.mjs          # 驾驶模拟主入口（打包为 sim.bundle.js）
  sim/                  # 纯 JS 物理（Node 可测，不依赖 three）
    tires.mjs           # Pacejka 魔术公式轮胎
    drivetrain.mjs      # 引擎曲线/离合器/6MT/限速器
    steering.mjs        # 转向辅助（防推头/自回正/横摆阻尼）
    vehicle.mjs         # 四轮双轨刚体
  render/               # Three.js 场景（track/sky/car/effects/scene）
  ui/                   # input（键盘+手柄）/ hud
tools/
  serve.mjs             # 8080 → sim.html
  bundle-sim.mjs        # esbuild 打包 + 冒烟检查
  render-wav.mjs        # 离线渲染 out/*.wav
  udp-bridge.mjs        # UDP 4001 → WebSocket 8081
test/                   # 38 项自动化测试
vendor/three/           # three.classic.js（本地化，零 CDN 依赖）
assets/models/          # Kenney Car Kit（CC0）GLB
```

## 参考与许可

- [ange-yaghi/engine-sim](https://github.com/ange-yaghi/engine-sim)：引擎发声建模思路（许可 Apache-2.0，本项目为独立实现，仅参考公开原理）。
- Kenney Car Kit（[kenney.nl](https://kenney.nl/assets/car-kit)）：车辆/轮胎模型，CC0。
- 车辆模型与音频采样分离；DSP 与车辆动力学与渲染层解耦，全部可离线测试。

## 文档

- [操作指南](docs/操作指南.md)
- [音频 DSP 设计](docs/DSP.md)
- [车辆物理设计](docs/VEHICLE.md)
- [集成与外部模拟器桥](docs/INTEGRATION.md)
