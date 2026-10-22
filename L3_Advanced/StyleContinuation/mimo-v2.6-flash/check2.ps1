$t = [System.IO.File]::ReadAllText('F:\bench-runs\mimo-v2.6-flash\20260922-054328-StyleContinuation\续写正文.md', [System.Text.Encoding]::UTF8) -replace "`r`n", "`n"
$p = @($t -split "`n`n" | Where-Object { $_.Trim() })
$lens = @($p | ForEach-Object { $_.Trim().Length })
$stats = $lens | Measure-Object -Minimum -Maximum
Write-Output ("MIN=" + $stats.Minimum + " MAX=" + $stats.Maximum + " OVER100=" + @($lens | Where-Object { $_ -gt 100 }).Count)
