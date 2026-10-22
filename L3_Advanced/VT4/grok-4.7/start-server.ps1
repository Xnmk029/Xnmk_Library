$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
if (-not $root.EndsWith("\")) { $root += "\" }
$port = 8765
$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".png"  = "image/png"
  ".svg"  = "image/svg+xml"
  ".json" = "application/json"
  ".webp" = "image/webp"
}
$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$port/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not listen on $prefix"
  Write-Host $_.Exception.Message
  exit 1
}
Write-Host "Serving $root"
Write-Host $prefix
Start-Process $prefix
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.LocalPath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $rel = $rel -replace "/", "\"
    $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    $ok = $path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $path -PathType Leaf)
    if (-not $ok) {
      $ctx.Response.StatusCode = 404
      $buf = [System.Text.Encoding]::UTF8.GetBytes("404")
    } else {
      $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
      $type = $mime[$ext]
      if (-not $type) { $type = "application/octet-stream" }
      $ctx.Response.ContentType = $type
      $buf = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.StatusCode = 200
    }
    $ctx.Response.ContentLength64 = $buf.Length
    $ctx.Response.OutputStream.Write($buf, 0, $buf.Length)
    $ctx.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
