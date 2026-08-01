$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Test-Path 'vehicles')) { New-Item -ItemType Directory -Path 'vehicles' | Out-Null }
Get-ChildItem -Filter 'thw_ccf2_part*.zip' | ForEach-Object {
    Write-Host ("Extracting " + $_.Name + " ...")
    Expand-Archive -Path $_.FullName -DestinationPath 'vehicles' -Force
}
Write-Host 'Extraction complete.'
