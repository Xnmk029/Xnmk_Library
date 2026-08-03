# Cyberpunk Interactive Portfolio One-Shot Prompt

你可以将以下内容直接作为 Prompt 发送给其他大语言模型（如 Claude, GPT-4, Gemini 等），以实现一键生成（One-Shot）这个高质量的赛博朋克风多职业创客个人简历网页项目。

---

## 🚀 目标 Prompt 内容

你是一个顶尖的前端开发专家和 UI/UX 设计师。请帮我使用 React + Vite + CSS 编写一个极其炫酷、具有赛博朋克科幻 HUD（Heads-Up Display）风格的"复合型创客与系统管理员"多职业交互式个人简历网页。

### 🎨 设计美学要求
1. **视觉格调**：深邃的科技暗色背景 (`#050507`)，搭配全局环境暗角 (Vignette) 和半透明细网格背景线。
2. **色彩体系**：使用高饱和度、发光的霓虹渐变作为不同职业的主题色：
   - AI 提示词专家 (AI PROMPT ENGINEER)：绿光 (`#23ff00`)
   - 单车工程技师 (BICYCLE TECHNICIAN)：橙/黄光 (`#ffaa00`)
   - IT 系统管理员 (IT SYSTEMS ADMIN)：青/蓝光 (`#00f0ff`)
   - 3D 关卡设计师 (3D LEVEL DESIGNER)：粉红/玫红光 (`#ff0055`)
3. **微动效与氛围感**：
   - 鼠标悬停在各职业入口时，对应的导引线条延伸并亮起专属霓虹色。
   - 核心状态信息和标题带有黑客帝国/赛博朋克式的字符乱码滚动加载动效（Scramble Text）。
   - 页面背景是一张 Canvas，绘制了 250 条发光的贝塞尔曲线，它们会根据鼠标位置产生排斥扰动，并随滚轮滚动产生波浪振幅，且在悬停/选中不同职业时过渡变换对应的发光颜色和透明度。

### 🛠 技术栈
- **核心框架**：React
- **动画库**：Framer Motion (用于无缝过渡与弹簧 LayoutId 动画)
- **3D 渲染**：Three.js, `@react-three/fiber`, `@react-three/drei` (用于 3D 视窗展示)
- **样式**：原生 CSS (不使用 Tailwind，保持结构清晰与高自定义度)

### 📂 项目文件结构与代码实现

请帮我生成以下 4 个核心文件：

1. `src/index.css` (全局基础样式与暗色网格背景)
2. `src/App.css` (页面布局、赛博朋克转场框架、Bento Grid 技能库)
3. `src/components/CanvasBackground.jsx` (高性能交互式 Canvas 贝塞尔扰动背景线组件)
4. `src/App.jsx` (主应用入口，包含乱码滚动、不同职业的转场子页面、3D Live 视窗、以及滚动触发的 Bento 技能展示)

---

#### 📄 1. 全局样式 `src/index.css`

---

#### 📄 2. 页面布局与样式 `src/App.css`

---

#### 📄 3. 背景特效 `src/components/CanvasBackground.jsx`

---

#### 📄 4. 主入口逻辑 `src/App.jsx`
