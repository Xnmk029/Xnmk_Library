@echo off
cd /d %~dp0
echo VT-4 WebGPU 工作站 @ http://localhost:8080
python -m http.server 8080
pause
