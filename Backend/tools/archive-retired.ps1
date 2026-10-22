$ErrorActionPreference = 'Stop'
$pilotArchiveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
$pilotBankFile = Join-Path $pilotArchiveRoot 'Backend/BANK.json'
$pilotArchiveBank = Get-Content -LiteralPath $pilotBankFile -Raw -Encoding UTF8 | ConvertFrom-Json
$pilotRetiredRoot = [IO.Path]::GetFullPath((Join-Path $pilotArchiveRoot 'Backend/retired'))
$pilotUtf8 = New-Object Text.UTF8Encoding($false)
New-Item -ItemType Directory -Path $pilotRetiredRoot -Force | Out-Null
foreach ($pilotEntry in $pilotArchiveBank.history) {
    if ($pilotEntry.project -notmatch '^L[1-4]_(Basic|Intermediate|Advanced|Expert)/[A-Za-z0-9_-]+$') { throw 'Unexpected retired project path' }
    $pilotSourcePath = [IO.Path]::GetFullPath((Join-Path $pilotArchiveRoot $pilotEntry.project))
    $pilotTargetPath = [IO.Path]::GetFullPath((Join-Path $pilotRetiredRoot $pilotEntry.name))
    if (-not $pilotSourcePath.StartsWith($pilotArchiveRoot, [StringComparison]::OrdinalIgnoreCase) -or -not $pilotTargetPath.StartsWith(($pilotRetiredRoot + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes intended workspace' }
    if (Test-Path -LiteralPath $pilotSourcePath) {
        if (Test-Path -LiteralPath $pilotTargetPath) { throw 'Archive destination already exists' }
        Move-Item -LiteralPath $pilotSourcePath -Destination $pilotTargetPath
        Write-Output ('Archived ' + $pilotEntry.name)
    }
    if (-not (Test-Path -LiteralPath $pilotTargetPath)) { throw 'Retired question missing' }
    if (-not $pilotEntry.PSObject.Properties['originalPrompt']) { $pilotEntry | Add-Member -NotePropertyName originalPrompt -NotePropertyValue $pilotEntry.prompt }
    $pilotEntry | Add-Member -NotePropertyName archivedProject -NotePropertyValue ('Backend/retired/' + $pilotEntry.name) -Force
    $pilotEntry.prompt = $pilotEntry.archivedProject + '/PROJECT_PROMPT.md'
    $pilotReadmeFile = Join-Path $pilotTargetPath 'README.md'
    $pilotReadme = [IO.File]::ReadAllText($pilotReadmeFile).Replace('../../Backend/', '../../')
    if (-not $pilotReadme.StartsWith('> 已退役')) { $pilotReadme = "> 已退役：完整交付用时超过本轮筛选线；保留题面和证据供复核。当前有效题目见 [BANK.json](../../BANK.json)。`n`n" + $pilotReadme }
    [IO.File]::WriteAllText($pilotReadmeFile, $pilotReadme, $pilotUtf8)
}
[IO.File]::WriteAllText($pilotBankFile, (($pilotArchiveBank | ConvertTo-Json -Depth 30) + "`n"), $pilotUtf8)
