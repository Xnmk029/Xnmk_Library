param(
    [int]$MinimumIdleMinutes = 15,
    [double]$MaxCpuPercent = 15,
    [double]$MaxGpuPercent = 10,
    [string]$HarnessRoot = 'F:\benchmark\sandbox\runs'
)
$ErrorActionPreference = 'Stop'
if (-not ('BenchmarkIdleNative' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BenchmarkIdleNative {
    [StructLayout(LayoutKind.Sequential)] private struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    [DllImport("user32.dll")] private static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
    [DllImport("kernel32.dll")] private static extern ulong GetTickCount64();
    public static double IdleSeconds() {
        var info = new LASTINPUTINFO(); info.cbSize = (uint)Marshal.SizeOf(info);
        if (!GetLastInputInfo(ref info)) throw new InvalidOperationException("GetLastInputInfo failed");
        uint ticks = (uint)(GetTickCount64() & 0xffffffffUL);
        return unchecked(ticks - info.dwTime) / 1000.0;
    }
}
'@
}
$idleSeconds = [BenchmarkIdleNative]::IdleSeconds()
$cpuSamples = @()
for ($sample = 0; $sample -lt 2; $sample++) {
    $processor = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'"
    if ($null -eq $processor -or $null -eq $processor.PercentProcessorTime) { throw 'CPU idle measurement unavailable' }
    $cpuSamples += [double]$processor.PercentProcessorTime
    if ($sample -eq 0) { Start-Sleep -Seconds 2 }
}
$cpuPercent = ($cpuSamples | Measure-Object -Maximum).Maximum
$gpuPercent = $null
$nvidiaCommand = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
if ($nvidiaCommand) {
    $gpuValues = & $nvidiaCommand.Source --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>$null
    if ($LASTEXITCODE -eq 0) {
        $gpuNumbers = @($gpuValues | ForEach-Object { $parsedGpu = 0.0; if ([double]::TryParse($_.Trim(),[ref]$parsedGpu)) { $parsedGpu } })
        if ($gpuNumbers.Count -gt 0) { $gpuPercent = ($gpuNumbers | Measure-Object -Maximum).Maximum }
    }
}
$activeValidationPids = @()
$validationCheckErrors = @()
if (Test-Path -LiteralPath $HarnessRoot) {
    $validationPattern = Join-Path $HarnessRoot '*\*\godot-validation\*\active-process.json'
    Get-ChildItem -Path $validationPattern -File -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $validation = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
            if (-not $validation.finished -and $validation.pid) {
                $validationProcess = Get-Process -Id ([int]$validation.pid) -ErrorAction SilentlyContinue
                if ($validationProcess -and $validation.started_at) {
                    $recordedStart = [DateTimeOffset]::Parse($validation.started_at)
                    if ([Math]::Abs(($validationProcess.StartTime.ToUniversalTime() - $recordedStart.UtcDateTime).TotalSeconds) -lt 20) {
                        $activeValidationPids += [int]$validation.pid
                    }
                }
            }
        } catch { $validationCheckErrors += $_.Exception.Message }
    }
}
# Observe independent Bench jobs as well as harness markers. Never log command
# lines: they may contain credentials. The backup's own processes are excluded.
$activeBenchJobs = @()
Get-CimInstance Win32_Process | ForEach-Object {
    $cmd = [string]$_.CommandLine
    if ($_.ProcessId -ne $PID -and $cmd -notmatch '(?i)tools[\\/]backup[\\/]|backup_worker\.py|backup_control\.ps1|check_idle\.ps1') {
        if ($_.Name -match '(?i)^Godot.*\.exe$' -or
            ($_.Name -match '(?i)^(pythonw?|node|blender|freecad).*\.exe$' -and
             $cmd -match '(?i)F:[\\/](benchmark|bench-runs|bench-probes)[\\/]|bench_cli|run_batch|godot.validation|cli_suite\.py|vision_suite\.py|iteration_cli\.py')) {
            $activeBenchJobs += [ordered]@{ pid = $_.ProcessId; name = $_.Name }
        }
    }
}
$reasons = @()
if ($idleSeconds -lt $MinimumIdleMinutes * 60) { $reasons += 'recent_user_input' }
if ($cpuPercent -gt $MaxCpuPercent) { $reasons += 'cpu_busy' }
if ($null -ne $gpuPercent -and $gpuPercent -gt $MaxGpuPercent) { $reasons += 'gpu_busy' }
if ($activeValidationPids.Count -gt 0) { $reasons += 'godot_validation_running' }
if ($activeBenchJobs.Count -gt 0) { $reasons += 'bench_job_running' }
if ($validationCheckErrors.Count -gt 0) { $reasons += 'validation_marker_unreadable' }
[ordered]@{
    schema_version = 1
    observed_at_utc = [DateTime]::UtcNow.ToString('o')
    ready = $reasons.Count -eq 0
    idle_seconds = [Math]::Round($idleSeconds,1)
    minimum_idle_minutes = $MinimumIdleMinutes
    cpu_percent = $cpuPercent
    gpu_percent = $gpuPercent
    gpu_measurement_available = $null -ne $gpuPercent
    active_validation_pids = @($activeValidationPids | Sort-Object -Unique)
    active_bench_jobs = $activeBenchJobs
    validation_check_errors = $validationCheckErrors
    reasons = $reasons
    note = 'Also check other running benchmark chats/jobs and source quiescence before backup. This checks the current Windows session, not every remote session.'
} | ConvertTo-Json -Depth 4 -Compress
