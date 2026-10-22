param(
    [ValidateSet('Initialize','Tick','Status','Pause')][string]$Action = 'Status',
    [string]$ThreadsSnapshot,
    [string]$PlanPath = "$PSScriptRoot\backup_plan.json"
)
$ErrorActionPreference = 'Stop'
$plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
$arguments = @('-B', "$PSScriptRoot\backup_worker.py", $Action.ToLower(), '--plan', $PlanPath)
if ($ThreadsSnapshot) { $arguments += @('--threads-snapshot', $ThreadsSnapshot) }
$resultText = & $plan.python_executable @arguments
if ($LASTEXITCODE -ne 0) { throw "Backup control failed with exit code $LASTEXITCODE" }
$result = $resultText | ConvertFrom-Json
if ($Action -eq 'Tick' -and $result.launch_allowed) {
    # A byte-range OS lock in the worker is authoritative and crash-safe.
    $running = @(Get-CimInstance Win32_Process | Where-Object {
        $_.Name -match '^pythonw?\.exe$' -and
        $_.CommandLine -like "*$PSScriptRoot\backup_worker.py* run *"
    })
    if ($running.Count -eq 0) {
        $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
        $stdout = Join-Path $plan.state_directory "worker-$stamp.stdout.log"
        $stderr = Join-Path $plan.state_directory "worker-$stamp.stderr.log"
        # Paths come from the saved plan, and Windows quoting is explicit.
        $workerArgs = '-B "{0}" run --plan "{1}"' -f "$PSScriptRoot\backup_worker.py", $PlanPath
        $process = Start-Process -FilePath $plan.python_executable -ArgumentList $workerArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        $result | Add-Member -NotePropertyName launched_pid -NotePropertyValue $process.Id
    }
}
$result | ConvertTo-Json -Depth 15
