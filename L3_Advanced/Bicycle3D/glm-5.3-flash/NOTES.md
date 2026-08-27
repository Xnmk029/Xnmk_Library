# NOTES.md —— BikeForge 3D 实现说明

## 1. 场景图（Scene Graph）

```
Scene
├─ Environment（buildStudio，静态一次性构建）
│   ├─ 地面 / 地毯 / 网格辅助线
│   ├─ 背墙 + 侧墙（接收阴影）
│   ├─ 货架组（木板/立柱/漆罐/纸箱/头盔）
│   ├─ 工作台（台面/桌腿/台钳/工具箱/水杯）
│   ├─ 挂墙洞洞板 + 5 组程序化工具（扳手/螺丝刀/尖嘴钳/锉刀/卡尺）
│   ├─ 吊灯 ×2（灯罩+自发光灯泡+PointLight）
│   ├─ 墙面海报框 ×2、盆栽、凳子
│   └─ outline 壳体（NPR 描边随件）
├─ bikeRoot（★ 每次参数变更整体重建的整车根节点）
│   ├─ frame：主三角(头管/上管/下管/座管)+后三角×2侧(链支/座支/勾爪)
│   │        +五通壳+碗组外杯+轴承环+走线孔+点缀装饰环与徽牌
│   ├─ fork：转向管/垫圈堆/顶盖/叉冠/贝塞尔弯腿×2/前勾爪
│   ├─ frontCaliper / rearCaliper（夹器+来令片+油管）
│   ├─ cockpit：把立(含前脸盖螺栓)/弯把(TubeGeometry 参数化曲线)
│   │          /手变头×2(壳体+杠杆)/把带×4段(内外两侧镜像曲线)
│   ├─ seatPostClamp…：seatUnit.postCl（座管+夹环+快拆杆）
│   │                  + sadCl（坐垫挤出体+双轨+喉锥）
│   ├─ crank（曲柄组，可旋转）：曲柄臂×2 / 中轴盖 / spider+5螺栓
│   │        / 牙盘1–3片(gearShape 挤出) / 脚踏×2(轴+本体+防滑钉)
│   ├─ bbR / bbL（中轴左右碗，独立分解件）
│   ├─ fd（前拨：座管夹环表带+导板+连接板，仅 2×/3× 可见）/ rd（后拨：拨臂板+上下导轮+弹簧）
│   ├─ wheelF / wheelR：rot 子组下 → 车圈(带气嘴孔的环形挤出)/内衬/
│   │   外胎(Torus)/气嘴(嘴体+锁母+气门帽)/花鼓壳+法兰盘+轴心/辐条 InstancedMesh(32)
│   │   /碟片(makeRotor 双圈镂空挤出+6螺栓)；后轮另有 cassette 飞轮子组
│   │   （7–12 片渐变齿盘+塔基锥筒+锁环）与塔基造型
│   └─ chain：链版 InstancedMesh + 滚子 InstancedMesh（弧长采样沿牙盘包角
│              → 下切线 → 飞轮包角 → 上切线闭环布点）
├─ Lights: HemisphereLight + DirectionalLight(主光,2048阴影) + DirectionalLight(补光) + 吊灯 PointLight×2
└─ 环境 IBL：RoomEnvironment → PMREMGenerator → scene.environment

全部轮廓描边以 BackSide ShaderMaterial 壳体网格作为子对象挂载在对应 mesh 上。
组件标签为 Sprite（CanvasTexture），挂载于各组件节点内随分解一起运动。
```

## 2. 依赖更新架构（参数 → 几何联动）

- **单一状态源** `P`（Frame Geometry / Drivetrain / Fit & Cockpit / Colors / Render Style 全部字段），
  所有 UI 控件只写 `P[key]` 并调用 `onParam(key)` 路由。
- **响应路由**分两类：
  - *重建类*（stack/reach/头管角/座管长/座管角/后下叉/紧凑度/droppedStay/齿比/速别/轮径/车宽/座高等）：
    `scheduleRebuild()` 合并 30ms 内的连续变更 → `rebuildAll()`；
  - *免重建类*（颜色、finish、outline、posterize、pixel 尺寸）：直接改材质/后处理开关，零几何开销。
- **几何求解器** `solveGeo(P)`：由 Stack/Reach 定出头管顶点，头管角给出转向轴向量 vDown/uUp 与法向 nPerp，
  反解前轴位置（含 rake）；座管角定出座管方向与顶点；BB 固定于轴距系原点附近，chainstay 与轮径约束反解后轴。
  五通落差按 70mm 经验值折算。紧凑度同时调制**头管长度**、**上管搭接高度比例**与座管延伸量——是组合形变而非整体缩放。
  Dropped stay 切换改变后上叉交汇锚点（TTseat ↔ STlow）并新增跨桥几何。
- **`rebuildAll()` 流程**：dispose 旧 bikeRoot 共享性安全释放 → 清空 EXPLODE 注册表 →
  依 solveGeo 结果重造 frame/fork/cockpit/seat/drivetrain/wheels/calipers/chain →
  按 `reg(obj,axis,dist)` 登记 15 组分解轴 → addLabels → 应用当前 explode 相位 → updateSpecs 刷新面板。
- **运行时动画层**不参与重建：车轮/曲柄旋转、脚踏水平配平（`pedal.rotation.z = -(arm.rotation.z + crank.rotation.z)`）、
  分解插值 `explodeCur → easeIO(explodeTarget)` 均只改 transform，保持每帧成本恒定。
- **相机安全**：rebuild 只动 bikeRoot 的子树，OrbitControls 的 target/camera 完全不被触碰（已用断言验证）。

## 3. 渲染管线（Render Pipeline）

```
场景渲染(ACESFilmic toneMapping, sRGB 输出)
  → [可选] RenderPixelatedPass（像素化，默认关）
  → ShaderPass(PostShader)：亮度十字采样勾边(edge>0.16 加浓墨线) + k 级色调分离( Posterize )
  → OutputPass（色彩空间输出）
```

- **赛璐璐着色**：主体部件使用 MeshToonMaterial + 自制 3/4/5 级硬阶梯度图（DataTexture + NearestFilter），
  明暗高对比色块；金属小五金保留 PBR Standard 材质以获得环境反射。
- **墨线轮廓**：BackSide 法向外扩壳体（三档粗细），加上后期 pass 的屏幕空间暗边增强，双重勾边保证细杆件也有清晰轮廓。
- **明亮基线保障**：米白仓库底色 + 高强度半球光/主光、fog 远景提亮；禁用 bloom；像素化默认关闭——避免阴影吞噬结构与轮廓糊化。
- **性能**：辐条与链条共 3 个 InstancedMesh；所有轮毂/齿轮曲线只建一次并复用实例矩阵；
  材质按 (zone,kind,color,finish) 缓存命中去重；贴图全局持久化防止重建期反复上传。

## 4. 已知局限

- 手变头变速拨杆、线管走向为示意级造型（真实互锁布线未模拟）。
- 分解动画中链条采用整体隐藏而非物理拖拽（真实链条需多体动力学或逐段约束）。
- 重量模型基于统计估算公式，非逐零件布尔求积。
