#!/bin/bash
# 构建单文件：我的世界.html（内嵌 three.js，双击即可打开）
cd "$(dirname "$0")"
cat head.html three.min.js > 我的世界.html
echo '</script>' >> 我的世界.html
echo '<script>' >> 我的世界.html
cat game.js >> 我的世界.html
cat tail.html >> 我的世界.html
echo "OK -> $(wc -c < 我的世界.html) bytes"
