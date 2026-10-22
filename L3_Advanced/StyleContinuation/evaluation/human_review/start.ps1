param([int]$Port = 8765, [string]$Batch = 'main')
$ErrorActionPreference = 'Stop'
$reviewPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
if (-not (Test-Path -LiteralPath $reviewPython)) { $reviewPython = (Get-Command python).Source }
Write-Host "Review page: http://127.0.0.1:$Port  (Ctrl+C to stop)"
& $reviewPython -X utf8 (Join-Path $PSScriptRoot 'app/server.py') --port $Port --batch $Batch
