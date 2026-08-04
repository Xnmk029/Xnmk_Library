# 集成指南：把 deepseek-v4-flash 接到驾驶模拟器

deepseek-v4-flash 是一个**声音驱动模块**：模拟器负责物理和渲染，每帧把发动机状态喂给
deepseek-v4-flash，deepseek-v4-flash 输出一对立体声。DSP 全部跑在 AudioWorklet 里，主线程每帧只需
一次 `update()` 调用。

## 1. 快速开始

```bash
npm test            # 验证 DSP
npm run serve       # 入口页 http://localhost:8080（驾驶模拟 / 音频实验室）
npm run render      # 离线 WAV（out/sweep.wav 等，可直接听）
npm run analyze     # 半阶/芭蕉共振分析
```

## 2. JS 集成（嵌入式 UI / 游戏内 HUD）

```html
<script type="module">
  import { EngineSoundDriver } from './src/engine-driver.mjs';
  import { CROSSPLANE_V8, REVERB_PRESETS } from './src/engine-config.mjs';

  const driver = new EngineSoundDriver(CROSSPLANE_V8, {
    quality: 'lite',      // 'lite'（默认，精简）或 'high'（完整管道）
    preset: 'garage',     // 初始空间
    masterGain: 0.85,
  });

  // 必须在用户手势里调用（浏览器自动播放策略）
  document.querySelector('#start').onclick = async () => {
    await driver.start();
  };

  // 每帧调用一次即可
  function onSimFrame(sim) {
    driver.update({
      rpm: sim.engineRpm,        // 必填
      throttle: sim.throttle,    // 0..1
      load: sim.load,            // 0..1.4（归一化输出扭矩）
      cut: sim.limiterActive,    // 断油
      pop: sim.overrunPop,       // 0..1 回火强度
      running: sim.engineOn,     // 熄火/启动状态
      cabin: sim.listener,       // 0 车外 / 1 车内
    });
  }
</script>
```

### 运行时控制

```js
driver.setPreset('tunnel');                       // 空间预设
driver.setReverb({ decay: 0.8, damp: 2800, mix: 0.4 }); // 精细混响
driver.setMasterGain(0.7);
driver.swap(FLATPLANE_V8, 'high');                // 换引擎/质量（A/B）
driver.resetReverb();                             // 清空混响尾音
driver.getStats(); // { cpu, cpuSource, peak, ready }
```

`REVERB_PRESETS` 键：`open, cabin, pitlane, garage, tunnel, canyon, hall, studio`。
每个预设 = `{ size, decay, damp, mix, early, predelay }`，`setReverb` 可只改
其中任意字段。

## 3. UDP 桥（外部模拟器进程）

适合模拟器本体不是网页、但可以发送 UDP 的情况（如自研模拟器、Replay 工具）。

```bash
npm run udp
# UDP 4001 收状态，HTTP 8081 提供最新状态
```

打开 `http://localhost:8080/index.html?udp=1`，实验室页面会自动以 20 Hz
轮询桥接状态并驱动音频。

### 数据包协议

每个 UDP 数据报一个 UTF-8 JSON 对象，缺失字段保留上次值，非法数据包忽略：

```json
{
  "rpm": 4200,
  "throttle": 0.6,
  "load": 0.7,
  "cut": false,
  "pop": 0.2,
  "running": true,
  "cabin": 0.8
}
```

字段会被 DSP 侧二次钳制（rpm 0-20000、throttle 0-1、load 0-1.4、pop 0-1），
即使模拟器发出越界值也不会爆音。

端口可用环境变量覆盖：`UDP_PORT=4002 HTTP_PORT=8082 npm run udp`。

## 4. 性能预算

## 手柄（XInput）

场景页完整支持 XInput 标准映射（Xbox 360 / One / Series 无线与有线均按
标准 Gamepad API 暴露）：

| 输入 | 功能 |
|---|---|
| 左摇杆 | 转向（8% 死区，随速度衰减由物理层处理） |
| RT / LT | 油门 / 刹车（4% 死区 + 指数平滑） |
| A / B | 手刹 / 离合 |
| RB / LB | 升档 / 降档 |
| X / Y | 倒挡切换 / 切换视角 |
| 十字键上 / 下 | 混响空间 / 天空时段 |
| 左摇杆按下 | 点火 |
| 右摇杆按下 | TC 开关 |
| Back / Start | 复位 / 暂停 |

连接手柄时 HUD 会显示输入源 `PAD` 与手柄型号；轮胎滑移超过抓地力峰值时
会触发轻微震动（依赖浏览器的 Gamepad vibration API，不支持时自动跳过）。

目标设备是把 DSP 压在 **单核 3% 以下（lite）**，Node 实测约 4%
（含 JS 解释开销，浏览器 AudioWorklet 会不同；见 docs/DSP.md 的成本核算）。
这意味着 60 fps 模拟器每帧（16.7 ms）只需要不到 1 ms 的音频预算。

建议：

- 默认 `lite`；`high` 留给物理/渲染有空闲的场合；
- `update()` 复用同一个对象，避免每帧分配；
- 混响预设切换零成本，可以随场景（进隧道/进维修区）随时切；
- 若主线程压力大，可把 `update()` 降到 30 Hz：DSP 内部按块平滑，
  30 Hz 的控制率仍无台阶噪声（测试覆盖 800→6000 rpm 阶跃）。

## 5. 离线工作流

```bash
node tools/render-wav.mjs presets          # 8 个空间各一段
node tools/render-wav.mjs --rpm 3000 --throttle 0.4 --seconds 8 --out out/cruise.wav
node tools/render-wav.mjs --bench          # CPU 核算
node tools/spectrogram.mjs out/sweep.wav out/spectrogram-sweep.png
```

所有离线路径与浏览器 Worklet 使用同一份 `src/engine-dsp.js`，不存在
"离线能听、实时不同"的两套实现。

## 6. 下一步

- 轮胎滚噪/风噪/路缘石撞击（独立 ambience 节点，参考 claude-opus-5 的 VehicleAmbience）；
- 换挡机构声、传动啸叫；
- 更多引擎定义（I6、水平对置、涡轮泄压阀）；
- 多监听点（车外追焦、直升机视角）与多普勒。
