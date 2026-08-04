# 任务背景

请构建一个 SketchUp MCP 桥接器（SketchUp-MCP-Bridge）：让 MCP 兼容的 AI 助手（如 Claude 等）能够**实时读取、查询、修改正在运行的 SketchUp 模型**。本项目的核心目标是实现跨进程桥接架构（Ruby 插件 ↔ Python MCP Server）、TCP/HTTP 通信、3D 几何操作与事务安全的能力。

# 需求范围

## 架构

```
┌─────────────────┐       stdio/SSE       ┌──────────────────┐      HTTP POST      ┌─────────────────────────┐
│   LLM / Agent   │ ◄──────────────────► │  MCP Server (Py) │ ◄─────────────────► │  Ruby Bridge (SketchUp) │
│  (Claude etc.)  │      MCP Protocol     │   server.py      │   127.0.0.1:18234   │  TCPServer + Timer调度   │
└─────────────────┘                       └──────────────────┘                     └─────────────────────────┘
```

## 目录结构

```
SketchUp-MCP-Bridge/
├── sketchup_plugin/
│   ├── sketchup_mcp_bridge.rb              # 扩展加载器 → 放入 Plugins/
│   └── sketchup_mcp_bridge/
│       └── main.rb                         # 核心: TCP Server + API 实现
├── mcp_server/
│   ├── server.py                           # MCP Server (Python, FastMCP)
│   └── requirements.txt
└── README.md
```

## 安装步骤

1. **SketchUp 插件**：将 `sketchup_plugin/` 下两项复制到 SketchUp Plugins 目录（如 `%AppData%\SketchUp\SketchUp 2024\SketchUp\Plugins\`），重启 SketchUp 后插件自动启动 HTTP 服务（端口 18234）；同时提供菜单 `Plugins > MCP Bridge > Start/Stop Server` 手动控制。
2. **Python MCP Server**：`cd mcp_server && pip install -r requirements.txt && python server.py`。
3. **接入 MCP 客户端**：README 提供 `claude_desktop_config.json` 配置示例。

## 可用工具（Tools）

| Tool | 功能 |
|------|------|
| `su_get_model_info` | 获取模型基本信息（单位、图元统计、选择集） |
| `su_query_dimensions` | 按名称/ID 查询物体包围盒尺寸 |
| `su_create_geometry` | 在指定坐标创建长方体并自动打组 |
| `su_set_camera_view` | 设置相机 eye/target/up 视角 |

## 关键设计要求

- Ruby Bridge 仅监听 `127.0.0.1`，不暴露到外网。
- 所有模型修改操作包裹在 `start_operation/commit_operation` 事务中，支持 Ctrl+Z 撤销。
- SketchUp API 调用强制在主线程执行（通过 `UI.start_timer` 调度），确保线程安全。
- 请求超时：Ruby 端 30s，Python 端 35s。
- 支持 stdio 与 SSE 两种 MCP 传输方式。

# 交付与限制要求

- 交付完整工程（Ruby 插件 + Python MCP Server + README 安装/配置文档）。
- 提供连通性测试方式（无 SketchUp 环境时能给出明确错误信息）。
- 所有工具参数有清晰 schema；错误响应可读、可诊断。
- 不得包含 TODO 或未完成占位符。
