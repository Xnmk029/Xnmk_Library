# 风格化草地 · Stylized Grass Field (Three.js)

移植 Dylearn《How I made grass better than 99% of games | Stylized grass 3D pixel art》
视频方案到 Three.js 的完整场景，包含：

## 场景元素
1. **HDRI 环境贴图** — Poly Haven `kloofendal_48d_partly_cloudy_puresky`（2k，放于 `public/hdri/`），
   PMREM 生成环境反射；**自动采样 HDRI 地平线上方天空色作为雾色**（加载失败时回退程序化天空）。
2. **园林级树木摆放** — 低多边形 + 卡通渐变贴图（flatShading + gradientMap），按园林构图布置：
   入口对植 → 道路林荫列植（隔株留空）→ 弯道孤植树 → 水畔点景孤植树 → 山坡树丛 →
   山丘松林 → 远景林带（隐入迷雾）→ 路边灌木；每棵树脚下一枚 Blob 软阴影。
3. **土路** — CatmullRom 曲线沿地形起伏铺设的 ribbon，程序化泥土贴图（泥斑/车辙/碎石/软边）。
4. **迷雾** — `THREE.Fog`（95–330），雾色取自 HDRI，远景林带与地形边缘融入雾中。
5. **自然地形起伏** — 三层 fbm 值噪声叠加（大丘陵/中起伏/细碎），池塘洼地挖槽，法线重算。

## 草地 Shader（核心，`src/shaders.js` + `src/grass.js`）
- `THREE.InstancedMesh` 单 Draw Call 渲染 45,000 根草叶，法线强制朝上获得统一柔和卡通受光；
- **世界空间风力旋转**：绕垂直于风向的水平轴旋转，草尖位移最大，两层噪波相乘 + 无理数破周期；
- **定格动画**：按实例位置哈希错开刷新相位，12 FPS 低帧率（面板可调 4–30）；
- **多角色交互位移**：玩家/NPC 位置写入 `uCharacters[64]` uniform，草被从角色身边推开（可 WASD 穿过草海）；
- **Y 轴 Billboard**：始终竖直面向相机；
- **伪透视补偿**：风/位移压扁草叶时沿 UV.x 拉伸（与相机朝向点积加权）；
- **混合卡通光影**：3 阶平滑过渡带（`getHybridToonShadow`），避免像素突变闪烁；
- **云影**：程序化无缝云纹理沿世界坐标滚动投影，可开关；
- 地形/花朵使用同族卡通光影 + 云影 + 雾，风格统一。

## 操作
- `WASD / 方向键` 移动角色（草会散开）
- 鼠标拖拽环绕视角、滚轮缩放（相机平滑跟随角色）
- `P` 像素风模式开关（低分辨率渲染 + nearest 上采样，复古 3D 像素质感）
- `R` 重置视角
- 面板：风力强度 / 定格动画 FPS / 伪透视强度 / 云影开关

## 运行
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 生产构建到 dist/
```

调试参数（URL 查询）：`?wind=1.5&fps=6&persp=0.5&clouds=0&x=..&y=..&z=..&tx=..&ty=..&tz=..&follow=0`
（`follow=0` 关闭相机跟随，便于取景截图）

## 文件结构
```
public/hdri/          HDRI 环境贴图（Poly Haven 2k）
src/
  main.js             场景组装 / HDRI / 雾 / 灯光 / 主循环 / UI
  shaders.js          草地 / 地形 / 花朵 GLSL
  grass.js            实例化草 + 花朵散布与每帧 uniform 更新
  world.js            地形高度场 / 土路 / 池塘
  trees.js            园林树木系统
  characters.js       玩家 + NPC（推开草地）
  textures.js         全部程序化贴图（Canvas 生成）
  noise.js            种子值噪声 / fbm / 无缝采样
  debug.js            ?debug=1 诊断探针（无头验证用）
```

> 已知实现要点：Three.js 的 ShaderMaterial 启用 `fog: true` 时，
> 必须同时在 uniforms 中声明 `fogColor / fogNear / fogFar`（渲染器每帧写入），
> 且 `scene.fog` 需在首次渲染前设置，否则 program 缓存不会重新编译。
