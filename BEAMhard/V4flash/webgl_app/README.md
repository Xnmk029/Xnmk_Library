# CCF2 WebGL — JBeam Physics · Engine Audio · NPR Stylized City

## 运行

直接双击 `ccf2_webgl_standalone.html`（单文件、离线、无依赖），或通过本地服务器打开 `index.html`。

## 操作

- WASD / 方向键：油门 / 刹车 / 转向；空格：手刹
- C：追尾 / 环绕 / 地图相机；滚轮：透视↔正交无缝缩放
- V：验证矩阵；M：静音；R：复位；G：自动/手动挡；Shift/Ctrl：升/降挡
- CSV 按钮导出遥测

## 目录

- `js/`：math / jbeam（解析器）/ physics（求解器）/ audio / renderer（WebGL2 NPR）/ provingground / city（矢量瓦片）/ camera / ui / main
- `data/`：由 `tools/convert_assets.js` 生成的车辆/网格/贴图数据
- `tests/`：Node 物理冒烟测试与遥测样例
- `build_standalone.js`：合并为单文件
