@echo off
rem ============================================================
rem  Liminal Poolcore - server launcher
rem  Usage: server.bat [port]   (default 5177)
rem  Runs the static server in its own window.
rem ============================================================
chcp 65001 >nul 2>&1
setlocal

set "LP_PORT=%~1"
if "%LP_PORT%"=="" set "LP_PORT=5177"

set "LP_NODE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined LP_NODE set "LP_NODE=%%i"
if not defined LP_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "LP_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined LP_NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "LP_NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined LP_NODE (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

echo  Liminal Poolcore server (port %LP_PORT%) - close this window to stop.
echo.
"%LP_NODE%" "%~dp0tools\serve.mjs" %LP_PORT%
pause
