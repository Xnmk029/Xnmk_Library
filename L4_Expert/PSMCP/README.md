# Photoshop MCP Server (Adobe Photoshop MCP 服务端)

基于 **Model Context Protocol (MCP)** 和 **Windows COM / ExtendScript** 接口构建的 Adobe Photoshop 自动化控制服务端。

通过本 MCP 服务端，AI 助手（如 Claude, Cursor, Antigravity 等）可以对 Adobe Photoshop 进行高度灵活的自动化操作，涵盖文档创建、图层管理、文本填充、色彩绘制、图像导出以及运行自定义 ExtendScript 脚本。

---

## 目录结构

```
PSMCP/
├── photoshop_controller.py  # 核心控制器 (基于 COM 接口与 ExtendScript 封装)
├── server.py                # MCP 服务端主程序 (基于 FastMCP 注册标准工具)
├── test_photoshop.py        # 诊断与连通性测试脚本
├── requirements.txt         # 项目依赖列表
├── run_server.bat           # Stdio 启动批处理脚本
└── README.md                # 使用说明文档
```

---

## 环境要求

- **操作系统**: Windows 10 / 11
- **软件**: Adobe Photoshop (CC 2018 / 2020 / 2024 / 2025 等支持 COM 自动化版本的 PS)
- **Python 环境**: Python 3.10+
- **依赖库**: `mcp`, `pywin32`, `pillow`

---

## 快速安装与配置

1. **安装 Python 依赖库**：
   ```bash
   pip install -r requirements.txt
   ```

2. **测试与 PS 的连接**：
   ```bash
   python test_photoshop.py
   ```

3. **配置 MCP 客户端** (如在 `claude_desktop_config.json` 或 IDE 的 MCP 配置中添加)：

   ```json
   {
     "mcpServers": {
       "photoshop": {
         "command": "python",
         "args": [
           "g:/产品/新benchmark/PSMCP/server.py"
         ]
       }
     }
   }
   ```

---

## 提供的 MCP 工具列表 (Tools)

| 工具名称 | 功能描述 |
| :--- | :--- |
| `ps_get_status` | 获取 Photoshop 当前连接状态、版本、打开文档数及活动文档名 |
| `ps_create_document` | 创建新文档（支持设置宽度、高度、分辨率、名称和背景填充类型） |
| `ps_open_document` | 打开现有图像或 PSD 文件 |
| `ps_save_document` | 保存/导出当前文档（支持 PSD、PNG、JPEG 格式） |
| `ps_get_active_doc_info` | 获取当前活动文档的尺寸、分辨率、图层树结构与当前选中图层 |
| `ps_add_art_layer` | 在当前文档新建空白像素图层 |
| `ps_add_layer_group` | 新建图层组 (Folder) |
| `ps_add_text_layer` | 添加格式化文本图层（可指定文字、字体、字号、颜色、位置及对齐方式） |
| `ps_fill_active_layer` | 用指定 HEX 颜色填充当前图层或选区 |
| `ps_set_layer_visibility` | 设置指定图层的显示或隐藏状态 |
| `ps_set_layer_opacity` | 修改指定图层的不透明度 (0.0 - 100.0) |
| `ps_duplicate_layer` | 复制指定图层 |
| `ps_delete_layer` | 删除指定图层 |
| `ps_export_preview` | 快速导出当前画布视图为 PNG 预览图像供 AI 分析 |
| `ps_execute_extendscript` | 执行任意 ExtendScript (JS) 代码段，支持 100% 内部 DOM 与 ActionManager |

---

## ExtendScript 进阶控制示例

`ps_execute_extendscript` 支持直接在 Photoshop 内部运行 ExtendScript 脚本，例如：

```javascript
// 获取画布所有图层名称
var layers = app.activeDocument.layers;
var names = [];
for (var i = 0; i < layers.length; i++) {
    names.push(layers[i].name);
}
names.join(", ");
```

---

## 许可证

MIT License

## 分类元数据

- **测试领域**: 系统集成与 MCP 协议
- **难度等级**: `L4`（专家级）
- **核心技术栈**: Python / Photoshop COM API / MCP Protocol
- **核心考核点**: MCP JSON-RPC 服务端、Photoshop COM 自动化、图层与文档查询
