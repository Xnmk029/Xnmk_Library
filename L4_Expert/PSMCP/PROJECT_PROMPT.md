```markdown
# 任务背景

请基于 **Model Context Protocol (MCP)** 和 **Windows COM / ExtendScript** 接口，构建一个 Adobe Photoshop 自动化控制服务端（PSMCP）。通过该 MCP 服务端，AI 助手（如 Claude、Cursor、Antigravity 等）可以对 Adobe Photoshop 进行高度灵活的自动化操作，涵盖文档创建、图层管理、文本填充、色彩绘制、图像导出以及运行自定义 ExtendScript 脚本。

# 需求范围

## 架构要求

```
PSMCP/
├── photoshop_controller.py  # 核心控制器（基于 COM 接口与 ExtendScript 封装）
├── server.py                # MCP 服务端主程序（基于 FastMCP 注册标准工具）
├── test_photoshop.py        # 诊断与连通性测试脚本
├── requirements.txt         # 项目依赖列表
├── run_server.bat           # Stdio 启动批处理脚本
└── README.md                # 使用说明文档
```

## 环境要求

- **操作系统**：Windows 10 / 11
- **软件**：Adobe Photoshop（CC 2018 / 2020 / 2024 / 2025 等支持 COM 自动化版本的 PS）
- **Python 环境**：Python 3.10+
- **依赖库**：`mcp`、`pywin32`、`pillow`

## 提供的 MCP 工具列表（Tools）

| 工具名称 | 功能描述 |
| :--- | :--- |
| `ps_get_status` | 获取 Photoshop 当前连接状态、版本、打开文档数及活动文档名 |
| `ps_create_document` | 创建新文档（宽度、高度、分辨率、名称和背景填充类型） |
| `ps_open_document` | 打开现有图像或 PSD 文件 |
| `ps_save_document` | 保存/导出当前文档（PSD、PNG、JPEG 格式） |
| `ps_get_active_doc_info` | 获取活动文档尺寸、分辨率、图层树结构与当前选中图层 |
| `ps_add_art_layer` | 新建空白像素图层 |
| `ps_add_layer_group` | 新建图层组 (Folder) |
| `ps_add_text_layer` | 添加格式化文本图层（文字、字体、字号、颜色、位置及对齐方式） |
| `ps_fill_active_layer` | 用指定 HEX 颜色填充当前图层或选区 |
| `ps_set_layer_visibility` | 设置指定图层显示/隐藏 |
| `ps_set_layer_opacity` | 修改图层不透明度 (0.0–100.0) |
| `ps_duplicate_layer` | 复制指定图层 |
| `ps_delete_layer` | 删除指定图层 |
| `ps_export_preview` | 快速导出当前画布视图为 PNG 预览图像供 AI 分析 |
| `ps_execute_extendscript` | 执行任意 ExtendScript (JS) 代码段，支持 100% 内部 DOM 与 ActionManager |

## ExtendScript 进阶控制

`ps_execute_extendscript` 须支持直接在 Photoshop 内部运行 ExtendScript 脚本，例如：

```javascript
// 获取画布所有图层名称
var layers = app.activeDocument.layers;
var names = [];
for (var i = 0; i < layers.length; i++) {
    names.push(layers[i].name);
}
names.join(", ");
```

# 交付与限制要求

- 交付完整工程（上述目录结构）+ `requirements.txt` + 启动脚本 + 说明文档。
- 提供连通性/诊断测试脚本 `test_photoshop.py`（无 PS 时可输出明确错误引导）。
- README 中给出 MCP 客户端配置示例（`claude_desktop_config.json` 等）。
- 所有工具参数须有清晰 schema（名称、类型、描述、必填项）。
- 不得包含 TODO 或未完成占位符。

```
