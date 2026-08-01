$sh = New-Object -ComObject WScript.Shell
$recent = 'C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\Recent'
$eq = [string][char]0x4E8C + [char]0x671F  # 二期
$dg = [string][char]0x5927 + [char]0x7EB2  # 大纲
$dx = [string][char]0x52A8 + [char]0x6548  # 动效
$jb = [string][char]0x811A + [char]0x672C  # 脚本
$x = [string][char]0x7EC6 + [char]0x8282  # 细节
$v = '_V4'
$out = foreach ($f in (Get-ChildItem -Path $recent -Filter '*.lnk' -Force | Where-Object { $_.Name -match $eq })) {
  $s = $sh.CreateShortcut($f.FullName)
  $s.TargetPath
}
$out | Out-File -FilePath '.\_lnk.txt' -Encoding utf8
