@echo off
setlocal
cd /d "%~dp0"
title VT-4 WebGPU Studio

where powershell >nul 2>nul
if %errorlevel%==0 (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve_windows.ps1"
  goto :done
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 serve.py
  goto :done
)

where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py
  goto :done
)

echo.
echo [ERROR] PowerShell and Python 3 were not found.
echo Run the project through any local static HTTP server, then open it in Chrome or Edge.
echo.
pause
:done
endlocal
