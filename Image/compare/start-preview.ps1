$runtimePython = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path -LiteralPath $runtimePython)) { throw 'Bundled Python is unavailable.' }
if (Get-NetTCPConnection -LocalPort 8771 -State Listen -ErrorAction SilentlyContinue) {
    Write-Output 'Port 8771 is already in use. Existing recovery preview: http://127.0.0.1:8771/compare/'
    exit
}
& $runtimePython -m http.server 8771 --bind 127.0.0.1 --directory (Split-Path -Parent $PSScriptRoot)
