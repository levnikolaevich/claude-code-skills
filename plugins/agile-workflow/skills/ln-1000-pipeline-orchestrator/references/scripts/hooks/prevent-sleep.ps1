# Prevent Windows sleep while any pipeline run is active
# Uses SetThreadExecutionState (kernel32.dll)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class SleepPreventer {
    [DllImport("kernel32.dll")]
    public static extern uint SetThreadExecutionState(uint esFlags);
    public const uint ES_CONTINUOUS = 0x80000000;
    public const uint ES_SYSTEM_REQUIRED = 0x00000001;
}
"@

[SleepPreventer]::SetThreadExecutionState(
    [SleepPreventer]::ES_CONTINUOUS -bor [SleepPreventer]::ES_SYSTEM_REQUIRED
) | Out-Null

$activeDir = ".hex-skills/pipeline/runtime/active/ln-1000"

while ($true) {
    Start-Sleep -Seconds 30
    if (-not (Test-Path $activeDir)) { break }

    $activeFiles = Get-ChildItem -Path $activeDir -Filter *.json -ErrorAction SilentlyContinue
    if (-not $activeFiles -or $activeFiles.Count -eq 0) { break }

    $hasRunning = $false
    foreach ($activeFile in $activeFiles) {
        try {
            $active = Get-Content $activeFile.FullName -Raw | ConvertFrom-Json
            $stateFile = ".hex-skills/pipeline/runtime/runs/$($active.run_id)/state.json"
            if (-not (Test-Path $stateFile)) { continue }
            $state = Get-Content $stateFile -Raw | ConvertFrom-Json
            if ($state.complete -ne $true) {
                $hasRunning = $true
                break
            }
        } catch {
            $hasRunning = $true
            break
        }
    }

    if (-not $hasRunning) { break }
}

[SleepPreventer]::SetThreadExecutionState(
    [SleepPreventer]::ES_CONTINUOUS
) | Out-Null
