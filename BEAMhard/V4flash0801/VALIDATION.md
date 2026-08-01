# BEAMGL 验证报告 / VALIDATION REPORT

> 生成方式：`node tools/smoke_test.js`（无头 Chrome 集成测试）+ `node tools/phys_test.js`（物理单元测试）
> 运行环境：Node 24 / Headless Chrome (SwiftShader) / 1440×860

## 1. 物理单元测试（phys_test.js）

| 场景 | 结果 | 通过 |
|---|---|---|
| 静止驻车（3s，无输入） | 速度 0.00 m/s，车身高度 0.071m（悬挂静载压缩 ~5cm） | ✅ |
| 全油门起步（5s） | 0 → 8.84 m/s（含离合器滑差、1档） | ✅ |
| 巡航 | 9.24 m/s，引擎 8400 RPM 限速器工作 | ✅ |
| 全力制动（5s） | 速度 → 0.00 m/s（无反向溜车） | ✅ |
| 转向（0.4 rad，5s） | 位移 Δx=13.7m / Δz=60.7m（阿克曼转向生效） | ✅ |
| 颠簸路面（正弦起伏） | 稳定行驶 7.50 m/s，悬挂持续作动 | ✅ |
| 涉水（2.1m 深水池） | 浮力生效，水深 1.09m，车体浸没 | ✅ |

## 2. 浏览器集成测试（smoke_test.js）

### 2.1 启动时序
```
导航加载    2.1 s
资源就绪   18.0 s   （无头软渲染；真实 GPU 显著更快）
```

### 2.2 模拟时钟（真实时性验证）
```
2.0 秒墙钟内模拟推进 2.13 s   → 物理以实时率运行（固定步长 1/120s 追赶）
```

### 2.3 车辆状态
```
质量          1219 kg（JBeam 节点加权）
质心          (-0.006, 0.532, 0.219) 车辆坐标系
静止状态      速度 0.00 m/s @ (0.00, 0.07, 16.00)   ← 悬挂静载正确
起步 3s       6.53 m/s (23.5 km/h)，引擎 7930 RPM，1 档
行驶距离      50 m（起点至比利时石路段入口）
绑定网格      106 个车身部件网格 + 4 轮 + 4 胎
```

### 2.4 矢量瓦片流式加载
```
初始视域加载  8 个瓦片块（道路/建筑/路灯实例化合并网格）
全图特征切片  686 条矢量特征 → 126 个 home tile
```

### 2.5 校验矩阵（VALIDATION MATRIX，按键 V 生成）
```
start.avgSuspTravel   89.5 mm   pass=true
start.maxSuspTravel  111.4 mm   pass=true
start.maxDamperVel     0.00 m/s
start.avgSpeed         7.4 km/h
cobble.avgSuspTravel  88.6 mm   pass=true
cobble.maxSuspTravel 120.3 mm   pass=true
cobble.maxDamperVel    1.03 m/s
cobble.avgSpeed        3.1 km/h
```

### 2.6 渲染像素统计（截图分析）
```
非黑像素    93.7 %
彩色像素    52.7 %
平均亮度    164 / 255
```
场景、车辆、天空与后期合成管线均正常输出。

### 2.7 错误审计
```
控制台错误       0
页面异常         0
资源加载失败     0
```

## 3. 资产管线统计
```
DDS 纹理转换    108 张（BC7/BC5/BC4/未压缩，491 MB → 38 MB PNG，≤2048px）
DAE 修补        10 个（<init_from> 纹理引用 → 相对 PNG 路径）
JBeam 解析      115 个文件全部通过容错解析器
柔性体索引      677 条 mesh→dae 映射
```
