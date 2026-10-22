$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try { node demo.mjs; if ($LASTEXITCODE -ne 0) { throw 'Regression failed; inspect artifacts/latest.json' } }
finally { Pop-Location }
