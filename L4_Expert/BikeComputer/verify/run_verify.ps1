# run_verify.ps1 — BikeComputer 题目自动验收管线
# 用法:
#   .\run_verify.ps1 -TargetDir <模型交付目录> [-FreeCADCmd <freecadcmd路径>]
# 输出: <TargetDir>\verify_report.json + 控制台摘要
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TargetDir,
    [string]$FreeCADCmd = "G:\FreeCAD\bin\freecadcmd.exe"
)

$ErrorActionPreference = "Continue"
$TargetDir = (Resolve-Path $TargetDir).Path
$report = [ordered]@{
    target  = $TargetDir
    time    = (Get-Date -Format "o")
    checks  = @()
    metrics = [ordered]@{}
}
$script:checkId = 0

function Add-Check([string]$name, [string]$status, [string]$detail = "") {
    $script:checkId++
    $report.checks += [ordered]@{ id = $script:checkId; name = $name; status = $status; detail = $detail }
    $mark = @{ PASS = "[PASS]"; FAIL = "[FAIL]"; WARN = "[WARN]" }[$status]
    Write-Host ("{0} {1}: {2}" -f $mark, $name, $detail)
}

function Test-FileNonEmpty([string]$path, [int]$minBytes = 400) {
    return (Test-Path $path) -and ((Get-Item $path).Length -ge $minBytes)
}

Write-Host "== BikeComputer verify: $TargetDir =="

# ---------- 1. 文档交付物 ----------
foreach ($doc in @("docs\product_spec.md", "docs\hardware_design.md", "docs\firmware_arch.md", "README.md")) {
    $p = Join-Path $TargetDir $doc
    Add-Check "doc:$doc" ($(if (Test-FileNonEmpty $p) { "PASS" } else { "FAIL" })) `
        $(if (Test-Path $p) { "{0} bytes" -f (Get-Item $p).Length } else { "missing" })
}

# ---------- 2. ui_demo 入口 ----------
$uiDir = Join-Path $TargetDir "ui_demo"
$uiEntry = $null
if (Test-Path $uiDir) {
    $uiEntry = Get-ChildItem $uiDir -Recurse -File |
        Where-Object { $_.Name -match '^(index|demo|main|app)\.(html?|py)$' -or $_.Extension -in '.html', '.htm' } |
        Select-Object -First 1
}
Add-Check "ui_demo:entry" $(if ($uiEntry) { "PASS" } else { "FAIL" }) `
    $(if ($uiEntry) { $uiEntry.FullName.Replace($TargetDir, "") } else { "no .html/.py entry found" })

# ---------- 3. firmware 源码扫描 ----------
$fwDir = Join-Path $TargetDir "firmware"
$fwFiles = @()
if (Test-Path $fwDir) {
    $fwFiles = Get-ChildItem $fwDir -Recurse -File -Include *.c, *.h, *.cpp, *.hpp
}
$report.metrics.firmware_source_files = $fwFiles.Count
Add-Check "firmware:sources" $(if ($fwFiles.Count -ge 8) { "PASS" } elseif ($fwFiles.Count -ge 3) { "WARN" } else { "FAIL" }) `
    "$($fwFiles.Count) source files"

$todoHits = @()
if ($fwFiles.Count -gt 0) {
    $todoHits = $fwFiles | Select-String -Pattern 'TODO|FIXME' -SimpleMatch:$false |
        Select-Object -First 10
}
Add-Check "firmware:no_todo" $(if ($fwFiles.Count -eq 0) { "FAIL" } elseif ($todoHits.Count -eq 0) { "PASS" } else { "FAIL" }) `
    $(if ($fwFiles.Count -eq 0) { "no sources" } elseif ($todoHits.Count) { "$($todoHits.Count) TODO/FIXME hit(s)" } else { "clean" })

$fwText = ($fwFiles | ForEach-Object { $_.FullName.ToLower() }) -join " "
$fwKeys = "st7789|lcd|disp", "nmea|gps|gnss", "encoder|rotary", "lvgl|lv_port|lv_porting", "page", "gpx|track|record", "fatfs|_sd\.|sd_|sdcard|ff\.|storage", "power|battery|pm"
$fwMiss = @($fwKeys | Where-Object { $fwText -notmatch $_ })
Add-Check "firmware:coverage" $(if ($fwMiss.Count -eq 0) { "PASS" } elseif ($fwMiss.Count -le 3) { "WARN" } else { "FAIL" }) `
    $(if ($fwMiss.Count) { "missing modules: $($fwMiss -join '; ')" } else { "all 8 module groups present" })

# ---------- 4. FreeCAD 构建 ----------
$cadDir = Join-Path $TargetDir "cad"
$buildPy = Join-Path $cadDir "build_model.py"
$outDir = Join-Path $cadDir "out"
$fcStd = $null

if (-not (Test-Path $buildPy)) {
    Add-Check "cad:build_script" "FAIL" "cad/build_model.py missing"
}
elseif (-not (Test-Path $FreeCADCmd)) {
    Add-Check "cad:build_script" "WARN" "freecadcmd not found at $FreeCADCmd — skipped execution"
}
else {
    if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
    $fcLog = Join-Path $outDir "_freecadcmd.log"
    Push-Location $cadDir
    try {
        $proc = Start-Process -FilePath $FreeCADCmd -ArgumentList '"build_model.py"' `
            -WorkingDirectory $cadDir -NoNewWindow -Wait -PassThru `
            -RedirectStandardOutput $fcLog -RedirectStandardError "$fcLog.err"
        $fcExit = $proc.ExitCode
    }
    finally { Pop-Location }
    $fcOut = ""
    if (Test-Path $fcLog) { $fcOut = Get-Content $fcLog -Raw -ErrorAction SilentlyContinue }
    if (Test-Path "$fcLog.err") { $fcOut += "`n" + (Get-Content "$fcLog.err" -Raw -ErrorAction SilentlyContinue) }
    $report.metrics.freecad_exit = $fcExit
    $crash = ($fcExit -ne 0) -or ($fcOut -match "Traceback \(most recent call last\)")
    Add-Check "cad:freecadcmd" $(if ($crash) { "FAIL" } else { "PASS" }) `
        "exit=$fcExit log=$([Math]::Min($fcOut.Length, 4000)) bytes$(if ($fcOut -match 'Traceback') { ' (traceback found)' })"

    # 产物检查
    $fcStd = Get-ChildItem $outDir -Filter *.FCStd -ErrorAction SilentlyContinue | Select-Object -First 1
    $step = Get-ChildItem $outDir -Include *.step, *.stp -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    $stl = Get-ChildItem $outDir -Filter *.stl -ErrorAction SilentlyContinue | Select-Object -First 1
    Add-Check "cad:out_fcstd" $(if ($fcStd) { "PASS" } else { "FAIL" }) $(if ($fcStd) { $fcStd.Name } else { "no .FCStd in cad/out" })
    Add-Check "cad:out_step" $(if ($step) { "PASS" } else { "WARN" }) $(if ($step) { $step.Name } else { "no .step/.stp exported" })
    Add-Check "cad:out_stl" $(if ($stl) { "PASS" } else { "WARN" }) $(if ($stl) { $stl.Name } else { "no .stl exported" })
}

# ---------- 5. FCStd 结构检查 ----------
if ($fcStd -and (Test-Path $FreeCADCmd)) {
    $inspectJson = Join-Path $env:TEMP ("fcinspect_{0}.json" -f [guid]::NewGuid().ToString("N"))
    $env:VERIFY_FCSTD = $fcStd.FullName
    $env:VERIFY_OUT = $inspectJson
    Push-Location $PSScriptRoot
    try {
        $null = & $FreeCADCmd (Join-Path $PSScriptRoot "inspect_fcstd.py") 2>&1
    }
    finally { Pop-Location; Remove-Item Env:\VERIFY_FCSTD, Env:\VERIFY_OUT -ErrorAction SilentlyContinue }
    if (Test-Path $inspectJson) {
        $insp = Get-Content $inspectJson -Raw | ConvertFrom-Json
        foreach ($c in $insp.checks) {
            Add-Check ("cad:" + $c.name) $c.status $c.detail
        }
        if ($insp.bbox_mm) { $report.metrics.bbox_mm = $insp.bbox_mm }
        $report.metrics.object_count = $insp.objects.Count
        Remove-Item $inspectJson -ErrorAction SilentlyContinue
    }
    else {
        Add-Check "cad:inspect" "WARN" "inspect_fcstd produced no json"
    }
}

# ---------- 6. render 预览图 ----------
$renderDir = Join-Path $TargetDir "render"
$imgs = @()
if (Test-Path $renderDir) {
    $imgs = Get-ChildItem $renderDir -Recurse -File -Include *.png, *.jpg, *.svg, *.webp
}
Add-Check "render:previews" $(if ($imgs.Count -ge 3) { "PASS" } elseif ($imgs.Count -ge 1) { "WARN" } else { "FAIL" }) `
    "$($imgs.Count) preview image(s)"

# ---------- 汇总 ----------
$fail = @($report.checks | Where-Object status -eq "FAIL").Count
$warn = @($report.checks | Where-Object status -eq "WARN").Count
$pass = @($report.checks | Where-Object status -eq "PASS").Count
$report.summary = [ordered]@{ pass = $pass; warn = $warn; fail = $fail }

$reportPath = Join-Path $TargetDir "verify_report.json"
$report | ConvertTo-Json -Depth 6 | Set-Content $reportPath -Encoding UTF8
Write-Host ""
Write-Host ("== Summary: {0} PASS / {1} WARN / {2} FAIL -> {3}" -f $pass, $warn, $fail, $reportPath)
exit $(if ($fail -gt 0) { 1 } else { 0 })
