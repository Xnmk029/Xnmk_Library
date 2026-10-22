@echo off
cd /d "%~dp0"
echo VT-4 workstation: http://127.0.0.1:8765/
echo Close this window to stop the server.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
