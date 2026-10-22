$ErrorActionPreference = 'Stop'
$path = 'F:\bench-runs\mimo-v2.6-pro\20260922-045725-QinBearSVG\polar-bear-riding-qin-shi-huang.svg'
$x = [xml](Get-Content -Raw -Encoding utf8 $path)
Write-Output ('root=' + $x.DocumentElement.Name + ' ns=' + $x.DocumentElement.NamespaceURI)
Write-Output ('viewBox=' + $x.svg.viewBox)
Write-Output ('elements=' + $x.SelectNodes('//*').Count)
Write-Output ('paths=' + $x.SelectNodes('//*[local-name()="path"]').Count)
Write-Output ('circles=' + $x.SelectNodes('//*[local-name()="circle"]').Count)
Write-Output ('ellipses=' + $x.SelectNodes('//*[local-name()="ellipse"]').Count)
Write-Output ('rects=' + $x.SelectNodes('//*[local-name()="rect"]').Count)
$texts = $x.SelectNodes('//*[local-name()="text"]') | ForEach-Object { $_.InnerText }
Write-Output ('texts=' + $x.SelectNodes('//*[local-name()="text"]').Count + ' content=[' + ($texts -join '|') + ']')
# every path 'd' must only contain path grammar characters
$bad = 0
foreach ($p in $x.SelectNodes('//*[local-name()="path"]')) {
    if ($p.GetAttribute('d') -notmatch '^[MmLlHhVvCcSsQqTtAaZz0-9eE\.\,\+\-\ \t\r\n]+$') { $bad++ }
}
Write-Output ('pathDataCharsetViolations=' + $bad)
Write-Output 'XML-WELLFORMED: PASS'
