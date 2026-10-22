$ErrorActionPreference='Stop'
$harbourRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$harbourUrl='http://localhost:3000/'
$harbourAlreadyRunning=$false
try { $harbourResponse=Invoke-WebRequest -Uri $harbourUrl -TimeoutSec 2; $harbourAlreadyRunning=$harbourResponse.Headers['X-Application'] -eq 'Harbour-Atlas' } catch {}
if(-not $harbourAlreadyRunning) {
  if(-not (Test-Path -LiteralPath (Join-Path $harbourRoot 'dist/client/index.html'))) { throw '请先在项目文件夹中运行 npm run build。' }
  $harbourNode=(Get-Command node.exe).Source
  Start-Process -FilePath $harbourNode -ArgumentList 'scripts/serve.mjs' -WorkingDirectory $harbourRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $harbourRoot '.server-output.log') -RedirectStandardError (Join-Path $harbourRoot '.server-error.log')
  Start-Sleep -Milliseconds 1200
}
Start-Process $harbourUrl
