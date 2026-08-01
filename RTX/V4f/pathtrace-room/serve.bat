@echo off
cd /d "%~dp0"
echo 路径追踪小房间: http://localhost:8080
start "" http://localhost:8080
where python >nul 2>nul && (python -m http.server 8080) || (py -m http.server 8080)
