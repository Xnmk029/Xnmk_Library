# HARBOUR ATLAS · 香港维多利亚港

本地运行的真实地图体素沙盘。技术栈为 Three.js、React、TypeScript、Vinext / Vite。全部城市数据与渲染资源已存入本项目，运行时不需要地图密钥或外部数据服务。

## 运行

双击 `start.cmd`，或者在本目录执行：

```powershell
npm start
```

打开 http://localhost:3000 。修改源码时使用 `npm run dev`。重新生成发布版使用 `npm run build`；`HARBOUR_PORT` 可覆盖默认端口。

## 探索

- 鼠标拖动旋转，滚轮缩放，右键平移；触屏支持旋转与双指缩放。
- 四个观景位置、四个地标飞行导航、地图点击定位。
- 「进入城市」切换步行；WASD / 方向键移动，Shift 加速，Space 跳跃，Esc 释放鼠标。触屏提供方向按钮。
- 日光时间轴、昼夜播放、晴朗 / 薄雾 / 阴雨、海港空间环境音。
- G 切换网格，R 回到全景，H 显示说明；右侧可显示分块边界，全屏并保存当前画面。
- 底栏可在高品质（实时平面倒影、阴影）和流畅模式间切换。

## 网格与占用

- 坐标原点：114.1694° E、22.2900° N。X 向东、Y 向上、Z 向南；1 世界单位 = 1 米。
- 基础网格为 0.5 m。所有静态实体的六个边界必须为整数网格坐标；动态实体使用同样的局部网格，只有整个对象能平移和旋转。
- 范围约 5.36 × 5.20 km。城市轮廓在共原点的 4 m 网格上栅格化；高度以 0.5 m 量化。
- 建筑轮廓来自实测多边形，不随机放置高楼。原始数据中塔楼与基座的重叠部分先作列占用合并，再生成表面。
- `VoxelStore` 用互不相交的长方体段编码连续基础网格单元。`addUnion` 在凹角处执行精确的长方体差集，避免窗框、斜撑重复占用。
- 256 m 空间分块，表面合并，GPU 视锥剔除；近景按位置生成 0.5 m 实体窗框。近远景、碰撞与网格辅助线始终共享原点。
- 步行视高 1.70 m、速度 1.65 m/s、跑步 4.4 m/s、最大可跨台阶 0.5 m。分轴碰撞与受限时间步防止穿墙，水边不可跨出；跳跃使用重力回落。

## 数据来源与精度

1. [香港地政总署 CSDI 建筑](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-landsd-building/resource/e62b1e3f-c766-408f-a104-7848a775cbba)：9,709 个筛选后的建筑结构，其中 9,673 个具有顶部和基底高度。其余高度通过楼层或保守默认值估算。结构数包含基座、塔楼和附属体量，不等同于独立建筑栋数。
2. [地政总署道路中线](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-road-centreline/resource/dd229cd1-9ba2-4a93-b4f7-355320cfffa8)：3,903 段道路。隧道不被误绘为海面道路。
3. [香港公开行政区 GeoJSON](https://gist.github.com/howawong/487f3cfe98d8ec4b5df73aa8b73f4121)：2019 年发布的陆地岸线参考。保留原始文件；数据时点早于部分填海工程，因此局部新岸线与码头经过简化，不是现状测量模型。
4. [CEDD 地形图植被层](https://ginfo.cedd.gov.hk/server/rest/services/Basemap/MapServer/316)：林地参考。
5. 地标尺寸与形体参考：[IFC 412 m](https://www.skyscrapercenter.com/building/two-international-finance-centre/205)、[中银大厦 367.4 m](https://www.bochk.com/en/aboutus/corpprofile/boctower.html)、[环球贸易广场](https://www.shkp.com/en-US/our-business/hong-kong-properties/offices/international-commerce-centre-icc)、[会展中心](https://www.hkcec.com/en/location-transportation)。中银最高点按网格量化为 367.5 m。

建筑和道路抓取于 2026-09-05。原始参考数据在 `data/`，可用 `node scripts/prepare-map.mjs` 重建浏览器使用的 `public/city.json`。来源署名、版本与适用条款请随数据保留。

## 当前边界

这是艺术化、可交互的地理沙盘实现。城市高度比例、主要地标位置与两岸地理关系来自公开资料，山体仍为示意地形；建筑外形采样精度为 4 m，近处窗框和设施为 0.5 m。没有室内、完整交通仿真、实测地面高程、精确潮位或实时城市数据。船舶、行人和车辆是沿有效路径的模拟活动。海面为规则网格加动态波纹，倒影为平面反射，未声称采用路径追踪或工程级数字孪生。

## 验证

```powershell
npm run typecheck
npm test
npm run build
```

验证包括：整数网格边界、占用体积守恒、表面法线朝向、四处地标/海陆控制点、设施和近景细部无重叠、有效交通路径、60 秒水边碰撞模拟、视高/速度、跳跃回落与长方体并集。结果保存在 `data/grid-audit.json` 和 `data/interaction-audit.json`。实际帧率由界面实时显示，受设备、分辨率与画质设置影响。

本项目已执行代码与几何测试；未将自动浏览器截图或交互回放作为已完成的验证。
