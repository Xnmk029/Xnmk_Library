# 脚本：B 站 IP 归属地油猴脚本



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: System Integration & MCP Protocol
- **Difficulty Level (难度等级)**: `L1 (Basic)`
- **Primary Tech Stack (核心技术栈)**: JavaScript Userscript / DOM Parsing
- **Core Evaluation Focus (核心考核点)**: DOM tree traversal, dynamic page observation, Userscript header metadata

## 任务定位

测试模型快速理解网页结构、编写用户脚本和处理动态页面的能力。

## 标准化提示词

编写一个浏览器油猴脚本，在 B 站电脑端页面显示可从公开页面数据获得的 IP 归属地信息。

### 功能要求

- 使用标准 userscript 元数据块。
- 支持 B 站单页应用的动态路由与异步内容加载。
- 只展示页面或公开接口已经返回的归属地信息，不推断精确位置。
- 不收集、上传或持久化用户隐私数据。
- 注入内容应尽量贴合原页面布局，并避免遮挡原控件。
- 多次路由或 DOM 更新不得重复插入。
- 网络或字段缺失时静默降级，并提供可识别但不打扰用户的状态。

## 输出要求

- 交付一个可直接安装的 `.user.js`。
- 清晰声明适用域名、权限和外部请求。
- 不要求用户手动修改核心代码。

## 自动化验收建议

- 使用本地 fixture 模拟有归属地、无归属地和动态加载三种页面。
- 验证脚本只插入一次、路由后仍生效、缺失字段不报错。
- 静态审计 userscript 权限，禁止无关的广域访问。
