param(
    [int]$Port = 8765,
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))

function Get-ContentType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".js"   { return "text/javascript; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".svg"  { return "image/svg+xml" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".json" { return "application/json; charset=utf-8" }
        ".md"   { return "text/markdown; charset=utf-8" }
        default  { return "application/octet-stream" }
    }
}

function Write-Response(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$Reason,
    [string]$ContentType,
    [byte[]]$Body,
    [bool]$HeadOnly = $false
) {
    if ($null -eq $Body) { $Body = [byte[]]::new(0) }
    $Headers = @(
        "HTTP/1.1 $Status $Reason",
        "Content-Type: $ContentType",
        "Content-Length: $($Body.Length)",
        "Cache-Control: no-store",
        "X-Content-Type-Options: nosniff",
        "Referrer-Policy: no-referrer",
        "Cross-Origin-Opener-Policy: same-origin",
        "Connection: close",
        "",
        ""
    ) -join "`r`n"
    $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Headers)
    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
    if (-not $HeadOnly -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
    $Stream.Flush()
}

function New-LoopbackListener([int]$PreferredPort) {
    for ($Candidate = $PreferredPort; $Candidate -lt ($PreferredPort + 40); $Candidate++) {
        $CandidateListener = $null
        try {
            $CandidateListener = New-Object System.Net.Sockets.TcpListener -ArgumentList @([System.Net.IPAddress]::Loopback, $Candidate)
            $CandidateListener.Start()
            return @($CandidateListener, $Candidate)
        }
        catch {
            if ($null -ne $CandidateListener) { $CandidateListener.Stop() }
        }
    }
    throw "未能在端口 $PreferredPort 至 $($PreferredPort + 39) 之间启动本地服务器。"
}

$Pair = New-LoopbackListener $Port
$Listener = $Pair[0]
$ActualPort = [int]$Pair[1]
$Url = "http://127.0.0.1:$ActualPort/"

Write-Host "===================================================================="
Write-Host " VT-4 装配与考证工作室"
Write-Host " 地址：$Url"
Write-Host " 关闭：在本窗口按 Ctrl+C"
Write-Host "===================================================================="

if (-not $NoOpen) {
    Start-Process $Url
}

try {
    while ($true) {
        $Client = $Listener.AcceptTcpClient()
        try {
            $Client.ReceiveTimeout = 5000
            $Client.SendTimeout = 15000
            $Stream = $Client.GetStream()
            $Reader = New-Object System.IO.StreamReader($Stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
            $RequestLine = $Reader.ReadLine()

            if ([string]::IsNullOrWhiteSpace($RequestLine)) {
                continue
            }

            do {
                $HeaderLine = $Reader.ReadLine()
            } while ($null -ne $HeaderLine -and $HeaderLine.Length -gt 0)

            $Parts = $RequestLine.Split(' ')
            if ($Parts.Length -lt 2) {
                $Body = [System.Text.Encoding]::UTF8.GetBytes("Bad Request")
                Write-Response $Stream 400 "Bad Request" "text/plain; charset=utf-8" $Body
                continue
            }

            $Method = $Parts[0].ToUpperInvariant()
            $HeadOnly = $Method -eq "HEAD"
            if ($Method -ne "GET" -and -not $HeadOnly) {
                $Body = [System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
                Write-Response $Stream 405 "Method Not Allowed" "text/plain; charset=utf-8" $Body
                continue
            }

            $RawPath = $Parts[1].Split('?')[0]
            try {
                $DecodedPath = [System.Uri]::UnescapeDataString($RawPath)
            }
            catch {
                $DecodedPath = "/"
            }
            $RelativePath = $DecodedPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar).TrimStart([char[]]@('/', '\'))
            if ([string]::IsNullOrWhiteSpace($RelativePath)) { $RelativePath = "index.html" }

            $CandidatePath = [System.IO.Path]::GetFullPath((Join-Path $Root $RelativePath))
            $RootPrefix = $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
            $InsideRoot = $CandidatePath.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or ($CandidatePath -eq $Root)

            if (-not $InsideRoot) {
                $Body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
                Write-Response $Stream 403 "Forbidden" "text/plain; charset=utf-8" $Body $HeadOnly
                continue
            }

            if ([System.IO.Directory]::Exists($CandidatePath)) {
                $CandidatePath = Join-Path $CandidatePath "index.html"
            }

            if (-not [System.IO.File]::Exists($CandidatePath)) {
                $Body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                Write-Response $Stream 404 "Not Found" "text/plain; charset=utf-8" $Body $HeadOnly
                continue
            }

            $Body = [System.IO.File]::ReadAllBytes($CandidatePath)
            Write-Response $Stream 200 "OK" (Get-ContentType $CandidatePath) $Body $HeadOnly
            Write-Host "[VT4] $Method $DecodedPath -> 200"
        }
        catch {
            try {
                if ($null -ne $Stream -and $Stream.CanWrite) {
                    $Body = [System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")
                    Write-Response $Stream 500 "Internal Server Error" "text/plain; charset=utf-8" $Body
                }
            }
            catch { }
            Write-Warning $_.Exception.Message
        }
        finally {
            if ($null -ne $Reader) { $Reader.Dispose() }
            if ($null -ne $Stream) { $Stream.Dispose() }
            $Client.Close()
        }
    }
}
finally {
    $Listener.Stop()
}
