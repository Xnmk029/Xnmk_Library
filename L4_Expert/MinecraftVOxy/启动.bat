@echo off
chcp 65001 >nul
title VOXY CRAFT
cd /d "%~dp0"
echo [VOXY] 正在启动本地服务器...
where node >nul 2>nul
if %errorlevel%==0 (
    node serve.js
) else (
    echo [VOXY] 未检测到 node，尝试使用 Python 备用服务器...
    where python >nul 2>nul
    if %errorlevel%==0 (
        start "" "http://127.0.0.1:8765/"
        python -m http.server 8765 --bind 127.0.0.1
    ) else (
        echo [错误] 需要 Node.js 或 Python 之一来启动本地服务器。
        pause
    )
)
