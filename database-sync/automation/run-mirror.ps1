<#
.SYNOPSIS
  10-minute Supabase → VPS full-sync mirror wrapper for Artillery ERP.

.DESCRIPTION
  Thin wrapper around run-reconcile-nightly.ps1 for frequent one-way catch-up:

    lock -> run-reconcile-nightly.ps1 -SkipBackup
      (compare → purge VPS-only → generate → apply → verify) -> retention

  Design points:
    * Full sync: INSERT missing + UPDATE changed + DELETE VPS-only rows.
      Supabase is the source of truth; VPS is brought into equality every run.
    * Skips pg_dump every run (disk/load); rely on manual/nightly backups.
    * Own lock file with a short stale window (~25 min) so a hung run does not
      block the rest of the day; overlapping runs exit 0 (IgnoreNew).
    * Logs to logs/mirror_<stamp>.log; keeps ~288 (~2 days at 10-min) or 48h.

  Exit code: mirrors run-reconcile-nightly.ps1 (0 on success / skipped overlap; non-zero on failure).

.NOTES
  Scheduled by register-mirror-task.ps1 as Artillery-DeltaSync-Mirror.
  Disable before the final cutover freeze. See automation/README.md.
#>
[CmdletBinding()]
param(
  [string] $SecretsFile    = 'C:\Temp\artillery-db-secrets.txt',
  [string] $PgBin          = 'C:\Program Files\PostgreSQL\18\bin',
  [string] $NodeDir        = 'C:\Program Files\nodejs',
  [string] $PgPassFile     = 'C:\Temp\artillery-pgpass.conf',
  [string] $TargetDb       = 'artillery_erp_staging',
  [string] $SuperUser      = 'postgres',
  [string] $SuperHost      = '127.0.0.1',
  [int]    $KeepLogs       = 288,
  [int]    $LogMaxAgeHours = 48,
  [int]    $StaleLockMinutes = 25,
  [int]    $LiveChurnTolerance = 50
)

$ErrorActionPreference = 'Stop'

$AutomationDir = $PSScriptRoot
$SyncRoot      = Split-Path -Parent $AutomationDir
$LogDir        = Join-Path $SyncRoot 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile  = Join-Path $LogDir "mirror_$stamp.log"
$LockFile = Join-Path $LogDir 'run-mirror.lock'
$ReconcileScript = Join-Path $AutomationDir 'run-reconcile-nightly.ps1'

function Write-Log {
  param([string]$Message, [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO')
  $line = ('{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message)
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

if (-not (Test-Path $ReconcileScript)) { throw "run-reconcile-nightly.ps1 not found at $ReconcileScript" }

Write-Log '=================================================================='
Write-Log "Artillery ERP 10-min full-sync mirror starting (host time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))"
Write-Log "SyncRoot=$SyncRoot"

# ------------------------------------------------------------------ overlap guard
if (Test-Path $LockFile) {
  $age = (Get-Date) - (Get-Item $LockFile).LastWriteTime
  if ($age.TotalMinutes -lt $StaleLockMinutes) {
    Write-Log ("Another mirror run is in progress (lock age {0} min). Skipping this run." -f [int]$age.TotalMinutes) 'WARN'
    exit 0
  }
  Write-Log ("Found STALE lock (age {0} min); overriding." -f [math]::Round($age.TotalMinutes, 1)) 'WARN'
  Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}
"pid=$PID started=$(Get-Date -Format o)" | Set-Content -Path $LockFile -Encoding ascii

$overallExit = 0
try {
  Write-Log 'Invoking run-reconcile-nightly.ps1 -SkipBackup (compare -> purge -> generate -> apply -> verify).'
  # Run in a child powershell process so its `exit` does not kill this wrapper.
  $argList = @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NonInteractive',
    '-File', $ReconcileScript,
    '-SecretsFile', $SecretsFile,
    '-PgBin', $PgBin,
    '-NodeDir', $NodeDir,
    '-PgPassFile', $PgPassFile,
    '-TargetDb', $TargetDb,
    '-SuperUser', $SuperUser,
    '-SuperHost', $SuperHost,
    '-SkipBackup',
    '-LiveChurnTolerance', "$LiveChurnTolerance",
    '-KeepLogs', '30'
  )
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $childOut = & powershell.exe @argList 2>&1
    $overallExit = $LASTEXITCODE
  }
  finally { $ErrorActionPreference = $prevEap }

  if ($null -ne $childOut) {
    foreach ($o in @($childOut)) {
      $s = if ($o -is [System.Management.Automation.ErrorRecord]) { $o.ToString() } else { ($o | Out-String).TrimEnd() }
      if ($s.Length) { Add-Content -Path $LogFile -Value $s }
    }
  }
  if ($overallExit -ne 0) {
    Write-Log ("run-reconcile-nightly.ps1 exited $overallExit") 'ERROR'
  }
  else {
    Write-Log 'run-reconcile-nightly.ps1 completed successfully.'
  }
}
catch {
  Write-Log ("FATAL: {0}" -f $_.Exception.Message) 'ERROR'
  Add-Content -Path $LogFile -Value $_.ScriptStackTrace
  $overallExit = 1
}
finally {
  Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------------ retention (mirror logs)
try {
  $cutoff = (Get-Date).AddHours(-$LogMaxAgeHours)
  $mirrorLogs = @(Get-ChildItem $LogDir -Filter 'mirror_*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $LogFile })
  $prunePaths = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($l in ($mirrorLogs | Where-Object { $_.LastWriteTime -lt $cutoff })) {
    [void]$prunePaths.Add($l.FullName)
  }
  $byCount = @($mirrorLogs | Where-Object { -not $prunePaths.Contains($_.FullName) } |
    Sort-Object LastWriteTime -Descending | Select-Object -Skip ($KeepLogs - 1))
  foreach ($l in $byCount) { [void]$prunePaths.Add($l.FullName) }
  foreach ($p in $prunePaths) { Remove-Item $p -Force -ErrorAction SilentlyContinue }
  if ($prunePaths.Count -gt 0) {
    Write-Log ("retention: pruned {0} old mirror log(s) (keep last {1} or {2}h)." -f `
        $prunePaths.Count, $KeepLogs, $LogMaxAgeHours)
  }
}
catch { Write-Log ("retention warning: {0}" -f $_.Exception.Message) 'WARN' }

Write-Log ("=== MIRROR RUN COMPLETE exit={0} ===" -f $overallExit)
exit $overallExit
