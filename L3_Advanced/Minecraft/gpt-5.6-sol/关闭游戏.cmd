@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-game.ps1"

if errorlevel 1 (
  echo.
  echo Failed to stop Fangjie. See the error above.
  pause
  exit /b 1
)

timeout /t 2 /nobreak >nul
