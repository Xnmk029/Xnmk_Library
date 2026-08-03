# V4f 引擎声音驱动

一个**精简、低 CPU 占用**的程序化引擎声音驱动模块，参考
[ange-yaghi/engine-sim](https://github.com/ange-yaghi/engine-sim) 的身份感来源，
但面向"驾驶模拟软件声音驱动"场景：渲染和物理由模拟器负责，本模块只负责
**把 RPM / 油门 / 负载变成一对立体声**。

首个音色目标：**前中置引擎、等长芭蕉（equal-length headers）、十字曲轴 V8**
项目车，6.4L 自然吸气，真双出排气 + X-pipe。

配套场景：`sim.html` —— 基于 Three.js 的驾驶模拟，四轮双轨底盘 +
魔术公式轮胎，开式差速器、Ackermann 转向、断油/回火全部接入同一套音频。

## 特性

- 十字曲轴 V8 特有的"煮水声"（burble）由**真实点火顺序 + 单侧排气歧管**
  自然涌现，没有任何 burble 参数。
- 等长芭蕉退化为**每侧一根延迟线**（LTI 恒等变换），精确且极省。
- 混响是 **8×8 反馈延迟网络（FDN）**，Hadamard 正交反馈、8 条互质延迟线、
  早期反射 + 预延迟 + 立体声去相关；8 组空间预设，切换零延迟零分配。
- 断油/回火/进气嘶声/气门机械声全部保留，但都控制在极低预算内。
- 浏览器 AudioWorklet + Node 离线渲染同一份 DSP 代码；提供 UDP 桥接，
  外部驾驶模拟器可以直接把状态推进来。
- 无任何第三方运行时依赖。

## 实测（Node 离线，48 kHz）

```
煮水声（半阶/4 阶幅度比，2400 rpm）
  cross-plane   0.0929
  flat-plane    0.0061        ← 约 15 倍差异，只改点火顺序

等长芭蕉共振          164.6 Hz（理论 c/4L = 164.6 Hz，偶数模被抑制）
CPU（20 s 渲染，best of 3）
                      lite ≈ 4% 单核 / high ≈ 7–10% 单核（随负载波动）
30 s 参数滥用测试      0 个 NaN/Inf，峰值 0.595
```

## 快速开始

```bash
npm test          # DSP 单元测试 + 性能核算
npm run serve     # http://localhost:8080 入口页（驾驶模拟 / 音频实验室）
npm run sim       # http://localhost:8080/sim.html 驾驶模拟
npm run bundle    # 重新生成 sim.bundle.js（经典脚本单文件）
npm run render    # 离线渲染 WAV 到 out/（可先听音色）
npm run analyze   # 频谱分析：半阶能量、芭蕉共振
npm run udp       # UDP(4001) + HTTP(8081) 桥，供外部模拟器驱动
```

驾驶操作：`W/S` 油门/刹车，`A/D` 转向，`Space` 手刹，`Shift` 离合，
`Q/E` 换挡，`M` 自动/手动，`I` 点火，`V` 十字/平轴 A/B（音频同步切换），
`N` 混响空间，`K` 天空时段，`T/B` TC/ABS，`C` 视角，`R` 复位，`P` 暂停。
`Y` 转向辅助（防推头限幅 + 漂移自回正/反打 + 横摆阻尼，默认开启）。
支持 XInput 手柄：左摇杆转向、RT/LT 油门/刹车（带死区与平滑）、A 手刹、
B 离合、RB/LB 换挡、X 倒挡、Y 视角、十字键上下切换混响/天空、摇杆按下
点火/TC，打滑时有震动反馈（浏览器支持时）。

## 结构

```
src/engine-config.mjs   纯数据：V8 几何/点火表/混响预设
src/engine-dsp.js       自包含 DSP（Worklet 与 Node 共用同一份）
src/engine-driver.mjs   浏览器宿主 API：start/update/预设
src/audio-lab.mjs       音频实验室（无 3D，纯听感 + 频谱）
src/main-sim.mjs        驾驶模拟主接线（物理→渲染→音频单向流动）
src/sim/vehicle.mjs     四轮双轨底盘（Ackermann、开式差速器、载荷转移）
src/sim/tires.mjs       每轮魔术公式 + 复合滑移摩擦椭圆
src/sim/steering.mjs    转向辅助（防推头限幅、自回正/漂移反打、横摆阻尼）
src/sim/engine.mjs      曲轴动力学（限速器/怠速/回火信号）
src/sim/drivetrain.mjs  离合器（半隐式）/ 6 速箱 / 终传
src/render/             低多边形肌肉车、外部 OBJ 车身、程序化天空、场景/光照
src/track/              赛道样条、柏油/双色路肩/路缘纹理、景物
src/ui/                 输入（键盘+手柄）、HUD
src/fft.mjs             小型 FFT 工具
tools/render-wav.mjs    离线渲染 / 频谱分析 / CPU 核算
tools/udp-bridge.mjs    外部模拟器 UDP → 浏览器音频桥
tools/serve.mjs         零依赖静态服务器
tools/bundle-sim.mjs    打包器：把 sim 模块图打成单个经典脚本
tools/spectrogram.mjs   零依赖频谱图 PNG（验证阶次结构）
test/dsp.test.mjs       node:test 自动化验证
test/vehicle.test.mjs   底盘自动化验证（加速/制动/弯道/滥用）
docs/DSP.md             数学模型与成本核算
docs/INTEGRATION.md     模拟器集成指南（JS API / UDP 协议）
docs/VEHICLE.md         四轮双轨车辆模型说明
```

离线试听：`out/sweep.wav`（怠速→扫频→断油→回火）、`out/preset-*.wav`
（8 个空间对比）、`out/launch.wav`、`out/limiter.wav`。

页面入口：`http://localhost:8080/` 是驾驶模拟与音频实验室的导航页；
`sim.html` 为 Three.js 驾驶场景，`audio-lab.html` 为音频调参台。

车辆实测（自动化测试）：0-100 km/h 5.34 s（TC 开），100-1 km/h 制动
37.5 m，稳态弯道峰值 1.02g，30 s 随机输入滥用 0 个 NaN。

> 驾驶模拟页面使用 `sim.bundle.js`（经典脚本单文件，含 three.js 包装版本），
> 不依赖 importmap 与 ES module 机制——内嵌浏览器（如 Codex 应用内浏览器）
> 即使模块加载受限也能运行。修改 `src/` 后执行 `npm run bundle` 重新生成。

详细听感与集成说明见 [docs/DSP.md](docs/DSP.md) 与
[docs/INTEGRATION.md](docs/INTEGRATION.md)。

## 外部车模

驾驶场景默认加载 Quaternius「Realistic Car Pack - Nov 2018」中的
SportsCar2（CC0 1.0，低模肌肉跑车造型），文件位于
`assets/models/quaternius-cars/`（OBJ + MTL，纯色材质、无外部贴图）。

- 来源：https://quaternius.com/packs/cars.html （Google Drive 下载）
- 许可：CC0 1.0 Public Domain，见 `assets/models/quaternius-cars/License.txt`
- 接线：`src/render/external-car.js` 把 OBJ 按物理参数（MUSCLE_CAR 的轴距/
  轮距/轮径）缩放并对齐四轮，前轮挂入转向+滚动 pivot，后轮合并网格挂入
  单轴滚动组；MTL 材质升级为 MeshStandardMaterial，尾灯接入刹车信号。
- 加载失败时自动回退到内置程序化车身（`src/render/car.js`），不影响驾驶。
