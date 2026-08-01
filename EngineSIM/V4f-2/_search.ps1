$dg = [string][char]0x5927 + [char]0x7EB2  # 大纲
$dx = [string][char]0x52A8 + [char]0x6548  # 动效
$pb = [string][char]0x65C1 + [char]0x767D  # 旁白
$paths = @('G:\' , 'C:\Users\Administrator')
foreach ($p in $paths) {
  if (Test-Path $p) {
    Get-ChildItem -Path $p -Recurse -Depth 6 -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match $dg -or $_.Name -match $dx -or $_.Name -match $pb } |
      ForEach-Object { $_.FullName } | Out-File -FilePath '.\_found.txt' -Encoding utf8 -Append
  }
}
