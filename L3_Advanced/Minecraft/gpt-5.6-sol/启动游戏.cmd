@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-game.ps1"

if errorlevel 1 (
  echo.
  echo Failed to start Fangjie. See the error above.
  pause
)
