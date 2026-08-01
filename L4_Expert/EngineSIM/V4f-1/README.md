# V4f — 程序化 V8 引擎声音 + 驾驶模拟（自包含重建）

本仓库按 `PROJECT_PROMPT.md` 在 `G:\产品\新benchmark\EngineSIM\V4f-1` 内从零重建。
实现路线：**不访问 OPUS 外部项目、不联网、不引入工作区外依赖**；浏览器端零运行时
依赖，Three.js 场景将由 `vendor/three/three.classic.js`（自研 THREE 兼容精简层）
提供。

## 阶段进度

- ✅ 一阶段：引擎声学 DSP（10/10 测试全绿）
  - 十字曲轴 V8 真实点火顺序 → burble 自然涌现（无 burble 参数）
  - 等长芭蕉单侧延迟线（164.6Hz，奇次模）
  - 8×8 Hadamard FDN 混响 + 8 组空间预设 + 零点击切换
  - 断油/回火/进气嘶吼/气门机械声；lite/high 质量档
  - 30s 参数滥用 0 NaN/Inf；浏览器/Node 共用同一份 DSP
  - 离线渲染工具 + UDP(4001)/HTTP(8081) 桥
- ✅ 二阶段：车辆物理与转向辅助（12/12 测试全绿）
  - 四轮双轨 Pacejka + 摩擦椭圆 + 开式差速器 + 半隐式离合 + TC/ABS
  - 转向辅助：防推头限幅（自适应 ±35%）、自回正/反打、电控横摆阻尼
  - 实测：0-100 5.49s（TC 开）、制动 36.8m、弯道 0.91g、滥用横摆率 24.3°/s
- ✅ 二阶段：自研 THREE 兼容渲染层 + 场景/车模/相机/HUD/输入
  - 闭合样条赛道（柏油/双色路肩/砾石/草地，不同 μ）、4 时段程序化天空、
    动态阴影跟随、ACES 色调映射
  - 程序化 SportsCar2 车模（OBJ/MTL 自建，车轮转向+滚动 pivot，尾灯随刹车发光）
  - 相机 5 模式（含 yaw 连续域修复）、HUD、键盘/手柄/触屏
- ✅ 打包与服务器：`npm run check` 冒烟通过、`npm run serve`（obj/mtl/glb MIME）
- ✅ 文档：README、docs/DSP.md、docs/VEHICLE.md、docs/INTEGRATION.md、docs/操作指南.md

## 实测验收摘要

- `npm test`：22/22（DSP 10 + 车辆 6 + 转向 6）
- `npm run check`：`smoke: bundle booted, Sim constructed, 12 frames ran OK`
- 车辆关键指标见 `docs/VEHICLE.md`；实现取舍与已知简化见 `docs/INTEGRATION.md`

## 常用命令

```bash
npm test          # 全量测试 22/22
node tools/render-offline.mjs 20 high engine-high.wav
node tools/bridge-server.mjs
npm run check     # bundle 冒烟
npm run serve     # http://localhost:8080/
```

## 目录

```
src/engine-dsp.js        通用 DSP（经典脚本/Worklet/Node 三端共用）
src/engine-config.mjs    配置与扭矩曲线（二阶段物理复用）
src/engine-driver.mjs    浏览器音频驱动（Worklet 主、ScriptProcessor 兜底）
src/sim/                 纯 JS 物理（轮胎/底盘/动力总成/转向辅助）
src/render/              场景/车模/相机/HUD/天空
src/track/               闭合样条赛道与路面 μ
src/ui/                  键盘/手柄/触屏输入
vendor/three/            THREE 兼容精简层 + OBJ/MTL 加载器（自研）
tools/                   离线渲染 / 桥接 / 打包 / 服务器 / 数值实验
test/                    零依赖测试框架与用例
docs/                    设计文档
```

## 自建模型与许可

车模由 `tools/gen-car-model.mjs` 程序化生成（`assets/models/sports-car2/`），
按物理参数直接建模（轴距 2.946m、轮距 1.62m、轮径 0.352m、车头 +Z），
不依赖 Quaternius 资源包；来源为项目自建，无需许可。轨道与纹理同样程序化生成。

## 边界与审计

全部读写均在本工作区 `V4f-1` 内；未访问
`G:\产品\新benchmark\EngineSIM\OPUS\...`、`C:\Users\Administrator\...`（可视化
输出目录除外）；无网络调用；无工作区外引用。每轮改动后按 AGENTS.md 执行
边界自检。
