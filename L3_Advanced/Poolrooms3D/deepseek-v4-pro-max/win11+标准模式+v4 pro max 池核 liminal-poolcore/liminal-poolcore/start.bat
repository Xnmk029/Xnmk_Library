@echo off
rem ============================================================
rem  Infinite Liminal Poolcore - one-click launcher
rem  ASCII-only; CRLF line endings required (cmd batch parser).
rem
rem  cmd gotcha: NEVER put `goto` inside a parenthesized if-block
rem  whose echo text contains a dot ("..." or similar) - cmd's
rem  parser then throws "'.' was unexpected at this time".
rem  Style used here: plain `if ... goto label` lines instead.
rem ============================================================
setlocal

set "LP_PORT=5177"
set "LP_URL=http://127.0.0.1:%LP_PORT%/"

echo.
echo  ==========================================================
echo   Infinite Liminal Poolcore
echo  ==========================================================
echo.

rem ---------- 1. locate Node.js ----------
set "LP_NODE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined LP_NODE set "LP_NODE=%%i"
if not defined LP_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "LP_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined LP_NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "LP_NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined LP_NODE goto LP_NO_NODE
for /f "usebackq delims=" %%v in (`"%LP_NODE%" --version 2^>nul`) do set "LP_NODE_VER=%%v"
echo  [OK] Node.js found: %LP_NODE_VER%
goto LP_NODE_OK

:LP_NO_NODE
echo  [ERROR] Node.js was not found.
echo  Please install Node.js 18+ from https://nodejs.org/
echo  then double-click this file again.
echo.
pause
exit /b 1

:LP_NODE_OK

rem ---------- 2. is the port already in use? ----------
netstat -ano | findstr /C:":%LP_PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto LP_OPEN

rem ---------- 3. start server in a new minimized window ----------
echo  [START] Launching local server...
start "Liminal Poolcore Server" /min call "%~dp0server.bat" %LP_PORT%

rem ---------- 4. wait until the server answers (max 25s) ----------
echo  [WAIT] Waiting for the server...
set /a LP_TRIES=0
:LP_WAIT
set /a LP_TRIES+=1
if %LP_TRIES% gtr 25 goto LP_TIMEOUT
powershell -NoProfile -Command "try{$r=Invoke-WebRequest -Uri '%LP_URL%' -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -eq 200){exit 0}else{exit 1}}catch{exit 1}" >nul 2>&1
if errorlevel 1 goto LP_RETRY
goto LP_OPEN

:LP_RETRY
ping -n 2 127.0.0.1 >nul
goto LP_WAIT

:LP_TIMEOUT
echo  [ERROR] Server did not start in time. Check the server window.
pause
exit /b 1

:LP_OPEN
echo  [OK] Server is ready!
echo.
echo  Game URL: %LP_URL%
echo  The minimized server window can be closed to stop the game.
echo.
start "" "%LP_URL%"
echo  Opening browser. You may close this window now.
ping -n 5 127.0.0.1 >nul
exit /b 0
