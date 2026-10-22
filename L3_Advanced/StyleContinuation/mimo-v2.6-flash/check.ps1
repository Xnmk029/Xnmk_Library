$ErrorActionPreference = 'Stop'
$path = 'F:\bench-runs\mimo-v2.6-flash\20260922-054328-StyleContinuation\续写正文.md'
$t = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$t = $t -replace "`r`n", "`n"
$paras = @($t -split "`n`n" | Where-Object { $_.Trim() -ne '' })
$total = (($paras -join '') -replace "\s", '').Length
Write-Output "TOTAL_CHARS_NO_WS=$total"
Write-Output "PARA_COUNT=$($paras.Count)"
$i = 0
foreach ($p in $paras) {
  $i++
  $l = $p.Trim().Length
  if ($l -lt 30 -or $l -gt 150) {
    $preview = $p.Substring(0, [Math]::Min(40, $p.Length))
    Write-Output "PARA_${i}_len=$l :: $preview"
  }
}
Write-Output "DASH_COUNT=$(([regex]::Matches($t, '——')).Count)"
Write-Output "BU_SHI_ER_SHI=$(([regex]::Matches($t, '不是[^。？！”]{0,20}而是')).Count)"
Write-Output "RU_HE_DAN=$(([regex]::Matches($t, '如何[^。？！”]{0,20}但')).Count)"
$neg = 0
foreach ($p in $paras) {
  $s = $p.TrimStart()
  if ($s -match '^(没有|这不是|这绝非|不是|并非)') {
    $neg++
    Write-Output ("NEG_START :: " + $s.Substring(0, [Math]::Min(30, $s.Length)))
  }
}
Write-Output "NEG_START_COUNT=$neg"
Write-Output "ZHI_JIE_FA_BAI=$(([regex]::Matches($t, '指节发白')).Count)"
Write-Output "PAI_BI_MARKERS=$(([regex]::Matches($t, '一个接一个|接连不断')).Count)"
# log.md length
$log = [System.IO.File]::ReadAllText('F:\bench-runs\mimo-v2.6-flash\20260922-054328-StyleContinuation\log.md', [System.Text.Encoding]::UTF8)
Write-Output "LOG_CHARS=$((($log -replace '\s','')).Length)"
