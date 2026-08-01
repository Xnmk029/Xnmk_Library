# MAKER-OS // 赛博朋克多职业交互式简历

根据 `one_shot_prompt.md` 搭建的 React + Vite 单页项目。

## 特性

- 深色赛博朋克 HUD 视觉：环境暗角、半透明细网格、扫描线
- 4 个职业模块：AI 提示词专家 / 单车工程技师 / IT 系统管理员 / 3D 关卡设计师
- Canvas 250 条发光贝塞尔曲线背景：鼠标排斥扰动、滚轮波浪振幅、职业主题色过渡
- Scramble Text 乱码滚动加载动效（标题与核心状态信息）
- Framer Motion 转场与 LayoutId 共享元素动画
- Three.js / R3F 3D 视窗（每个职业独立模型）
- 滚动触发的 Bento Grid 技能库

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```
