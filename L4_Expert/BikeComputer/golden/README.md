# BikeComputer（golden 最小样例）

GPS 自行车码表产品设计样例——用于验证题目交付结构与 `verify/` 管线，非满分答案。

## 目录

```
golden/
├── docs/            # product_spec / hardware_design / firmware_arch（压缩版）
├── firmware/        # 分层源码骨架（真实实现，非占位）
├── ui_demo/         # index.html — 240×240 四页演示，键盘模拟编码器
├── cad/
│   ├── build_model.py      # freecadcmd 无头构建 → out/BikeComputer.{FCStd,step,stl}
│   ├── render_preview.py   # 零依赖 STL→SVG 三视图渲染
│   └── out/               # 生成物
└── render/          # view_top/front/iso.svg
```

## 验证

```powershell
cd golden/cad && freecadcmd build_model.py          # 建模
python render_preview.py                            # 生成 render/*.svg
..\..\verify\run_verify.ps1 -TargetDir ..\          # 端到端验收
```
