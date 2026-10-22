# NEXUS.04 — 复合型创客 HUD 简历

赛博朋克科幻 HUD 风格的多职业交互式个人简历。独立 Vite + React 工程，不依赖也不修改仓库根目录 `package.json`。

## 启动

```bat
cd /d F:\benchmark\L2_Intermediate\FrontendShowcase\grok-4.6
npm install --no-workspaces
npm run dev
```

浏览器打开终端提示的本地地址（默认 `http://localhost:5173`）。

## 交互

- 悬停 / 点击左侧四职业入口：导引线延伸并亮起专属霓虹色，Canvas 场线颜色与透明度过渡
- 滚轮：背景 250 条发光贝塞尔曲线的波浪振幅变化
- 鼠标移动：场线产生排斥扰动
- 标题与状态信息：Scramble Text 乱码加载
- 右侧 3D Live 视窗随职业切换
- 向下滚动：Bento 技能库入场，当前职业相关卡片高亮
- 键盘 `1` `2` `3` `4` 快速切换职业
