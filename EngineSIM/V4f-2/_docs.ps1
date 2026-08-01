Get-ChildItem -Path 'D:\视频\Gemini3.6flash\Opus' -Recurse -Depth 3 -Force -ErrorAction SilentlyContinue |
  Where-Object { -not $_.PSIsContainer } |
  ForEach-Object { '{0:yyyy-MM-dd HH:mm} | {1,10} | {2}' -f $_.LastWriteTime, $_.Length, $_.FullName } |
  Out-File -FilePath '.\_docs.txt' -Encoding utf8
