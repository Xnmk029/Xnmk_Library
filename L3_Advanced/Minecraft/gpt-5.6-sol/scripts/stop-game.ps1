$ErrorActionPreference = "Stop"

$startPort = 4173
$lastPort = 4183
$stoppedPorts = [System.Collections.Generic.List[int]]::new()

for ($port = $startPort; $port -le $lastPort; $port++) {
    try {
        $response = Invoke-WebRequest `
            -UseBasicParsing `
            -Uri "http://127.0.0.1:$port/" `
            -TimeoutSec 1
    }
    catch {
        continue
    }

    if ($response.Content -notmatch 'id="game-shell"') {
        continue
    }

    $processIds = Get-NetTCPConnection `
        -State Listen `
        -LocalPort $port `
        -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($processId in $processIds) {
        Stop-Process -Id $processId -Force -ErrorAction Stop
    }

    if ($processIds) {
        $stoppedPorts.Add($port)
    }
}

if ($stoppedPorts.Count -eq 0) {
    Write-Host "Fangjie server is not running."
    exit 0
}

$ports = $stoppedPorts -join ", "
Write-Host "Fangjie server stopped (port: $ports)."
