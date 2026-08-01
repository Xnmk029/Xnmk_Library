$settingsPath = "C:\Users\Administrator\AppData\Roaming\QoderCN\User\settings.json"
$content = Get-Content $settingsPath -Raw
$content = $content.Replace("Qoder Light", "Qoder Dark")
Set-Content $settingsPath -Value $content -NoNewline
Write-Host "Theme changed to Qoder Dark"
