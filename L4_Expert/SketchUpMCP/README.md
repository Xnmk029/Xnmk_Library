# SketchUp-MCP-Bridge

让 MCP 兼容的 AI 助手实时读取、查询、修改正在运行的 SketchUp 模型。

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

### 1. SketchUp 插件

将 `sketchup_plugin/` 下的两项复制到 SketchUp Plugins 目录:

```
%AppData%\SketchUp\SketchUp 2024\SketchUp\Plugins\
├── sketchup_mcp_bridge.rb
└── sketchup_mcp_bridge\
    └── main.rb
```

重启 SketchUp 后, 插件自动启动 HTTP 服务 (端口 18234)。
也可通过菜单 `Plugins > MCP Bridge > Start/Stop Server` 手动控制。

### 2. Python MCP Server

```bash
cd mcp_server
pip install -r requirements.txt
python server.py
```

### 3. 接入 Claude Desktop

在 `claude_desktop_config.json` 中添加:

```json
{
  "mcpServers": {
    "sketchup": {
      "command": "python",
      "args": ["G:/产品/新benchmark/草图大师MCP/mcp_server/server.py"],
      "env": {}
    }
  }
}
```

## 可用工具

| Tool | 功能 |
|------|------|
| `su_get_model_info` | 获取模型基本信息 (单位、图元统计、选择集) |
| `su_query_dimensions` | 按名称/ID 查询物体包围盒尺寸 |
| `su_create_geometry` | 在指定坐标创建长方体并自动打组 |
| `su_set_camera_view` | 设置相机 eye/target/up 视角 |

## 注意事项

- Ruby Bridge 仅监听 `127.0.0.1`, 不暴露到外网。
- 所有模型修改操作包裹在 `start_operation/commit_operation` 事务中, 支持 Ctrl+Z 撤销。
- SketchUp API 调用强制在主线程执行 (通过 UI.start_timer 调度), 确保线程安全。
- 请求超时: Ruby 端 30s, Python 端 35s。

## 分类元数据

- **测试领域**: 系统集成与 MCP 协议
- **难度等级**: `L4`（专家级）
- **核心技术栈**: Ruby / Python / MCP Protocol / SSE Transport
- **核心考核点**: 实时 CAD 模型查询、SSE/stdio 传输、3D 几何操作
