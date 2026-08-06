param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$startPort = 4173
$lastPort = 4183

function Get-GameResponse {
    param([int]$Port)

    try {
        return Invoke-WebRequest `
            -UseBasicParsing `
            -Uri "http://127.0.0.1:$Port/" `
            -TimeoutSec 1
    }
    catch {
        return $null
    }
}

function Test-GameServer {
    param([int]$Port)

    $response = Get-GameResponse -Port $Port
    return $null -ne $response -and $response.Content -match 'id="game-shell"'
}

function Test-PortInUse {
    param([int]$Port)

    $listener = Get-NetTCPConnection `
        -State Listen `
        -LocalPort $Port `
        -ErrorAction SilentlyContinue
    return $null -ne $listener
}

function Open-Game {
    param([int]$Port)

    $url = "http://127.0.0.1:$Port/"
    Write-Host "Fangjie is running at $url"
    if (-not $NoBrowser) {
        Start-Process $url
    }
}

for ($port = $startPort; $port -le $lastPort; $port++) {
    if (Test-GameServer -Port $port) {
        Open-Game -Port $port
        exit 0
    }

    if (Test-PortInUse -Port $port) {
        continue
    }

    $python = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($null -eq $python) {
        $python = Get-Command python.exe -ErrorAction SilentlyContinue
    }
    if ($null -eq $python) {
        throw "Python was not found. Install Python or add py.exe to PATH."
    }

    $arguments = @(
        "-m",
        "http.server",
        "$port",
        "--bind",
        "127.0.0.1"
    )

    $server = Start-Process `
        -FilePath $python.Source `
        -ArgumentList $arguments `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -PassThru

    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 125
        if (Test-GameServer -Port $port) {
            Open-Game -Port $port
            exit 0
        }
        if ($server.HasExited) {
            throw "The local server exited before the game was ready."
        }
    }

    if (-not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
    throw "The local server did not become ready in time."
}

throw "No available port was found between $startPort and $lastPort."
