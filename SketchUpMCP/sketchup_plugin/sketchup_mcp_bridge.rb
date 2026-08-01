# frozen_string_literal: true

# SketchUp-MCP-Bridge — 插件加载器
# 放置于: %AppData%/SketchUp/SketchUp 2024/SketchUp/Plugins/sketchup_mcp_bridge.rb
# (或对应版本的 Plugins 目录)
#
# 职责: 注册扩展程序入口, 延迟加载核心逻辑至模型就绪后。

require 'sketchup'
require 'extensions'

module MCPBridge
  PLUGIN_NAME    = 'SketchUp MCP Bridge'
  PLUGIN_VERSION = '1.0.0'
  PLUGIN_DESC    = 'Local HTTP bridge exposing SketchUp model to MCP-compatible AI agents.'

  ext = SketchupExtension.new(PLUGIN_NAME, File.join(File.dirname(__FILE__), 'sketchup_mcp_bridge', 'main.rb'))
  ext.version     = PLUGIN_VERSION
  ext.description = PLUGIN_DESC
  ext.creator     = 'SketchUp-MCP-Bridge'
  ext.copyright   = '2026'

  Sketchup.register_extension(ext, true)
end
