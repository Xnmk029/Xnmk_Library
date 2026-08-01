# start_server.ps1 — 分离启动 BEAMGL 服务器（不随终端退出）
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$out = Join-Path $root 'server_run.log'
$err = Join-Path $root 'server_err.log'
# 若已在运行则直接复用
$existing = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host 'BEAMGL server already running on http://localhost:8080'
    exit 0
}
Start-Process -FilePath 'node' -ArgumentList 'server.js', '8080' `
    -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput $out -RedirectStandardError $err
Write-Host 'BEAMGL server started -> http://localhost:8080'
