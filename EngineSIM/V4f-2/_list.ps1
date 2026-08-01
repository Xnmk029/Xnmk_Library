$root = Get-Location
Get-ChildItem -Path $root -Recurse -Depth 5 -Force | ForEach-Object { $_.FullName } | Out-File -FilePath '.\_listing.txt' -Encoding utf8
