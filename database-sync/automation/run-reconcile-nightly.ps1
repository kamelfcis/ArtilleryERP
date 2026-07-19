<#
.SYNOPSIS
  Non-interactive nightly reconciliation: purge VPS-only rows, then delta-sync from Supabase.

.DESCRIPTION
  Runs the full equality pipeline unattended (Supabase = source of truth):

    compare -> backup (pg_dump -Fc) -> purge -> generate -> apply (resilient)
    -> [retry generate+apply if FK skips] -> verify

  Unlike run-sync.ps1 (safe one-way sync), this DELETES rows on the VPS whose primary
  keys are absent from Supabase, then applies the delta so both databases match.

  Credentials are read at runtime from the VPS-only secrets file
  (default C:\Temp\artillery-db-secrets.txt). Nothing is hardcoded here.

  Exit code: 0 on success; non-zero on a real failure.

.NOTES
  Scheduled by register-tasks.ps1 as Artillery-DeltaSync-Nightly.
  Disable before the final cutover freeze. See automation/README.md.
#>
[CmdletBinding()]
param(
  [string]  $SecretsFile         = 'C:\Temp\artillery-db-secrets.txt',
  [string]  $PgBin               = 'C:\Program Files\PostgreSQL\18\bin',
  [string]  $NodeDir             = 'C:\Program Files\nodejs',
  [string]  $PgPassFile          = 'C:\Temp\artillery-pgpass.conf',
  [string]  $TargetDb            = 'artillery_erp_staging',
  [string]  $SuperUser           = 'postgres',
  [string]  $SuperHost           = '127.0.0.1',
  [int]     $KeepBackups         = 14,
  [int]     $KeepLogs            = 30,
  [int]     $StaleLockHours      = 6,
  # Live-source churn during a long run: allow this many missing rows total before failing verify.
  [int]     $LiveChurnTolerance  = 50,
  # When set (e.g. by the 10-min mirror wrapper), skip pg_dump to avoid filling
  # disk / loading the DB on frequent runs. Manual/nightly runs keep backups.
  [switch]  $SkipBackup
)

$ErrorActionPreference = 'Stop'

$AutomationDir = $PSScriptRoot
$SyncRoot      = Split-Path -Parent $AutomationDir
$LogDir        = Join-Path $SyncRoot 'logs'
$BackupDir     = Join-Path $SyncRoot 'backups'
$ReportDir     = Join-Path $SyncRoot 'reports'
$DeltaFile     = Join-Path $SyncRoot 'delta_sync.sql'
New-Item -ItemType Directory -Force -Path $LogDir, $BackupDir | Out-Null

$stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile  = Join-Path $LogDir "reconcile_$stamp.log"
$LockFile = Join-Path $LogDir 'run-reconcile.lock'

$env:PATH = "$NodeDir;$PgBin;$env:PATH"
$env:PGCLIENTENCODING = 'UTF8'

function Write-Log {
  param([string]$Message, [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO')
  $line = ('{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message)
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

function Add-CommandOutput {
  param([object[]]$Output)
  if ($null -eq $Output) { return }
  foreach ($o in $Output) {
    if ($o -is [System.Management.Automation.ErrorRecord]) { $s = $o.ToString() }
    else { $s = ($o | Out-String).TrimEnd() }
    if ($s.Length) { Add-Content -Path $LogFile -Value $s }
  }
}

function Invoke-Native {
  param([Parameter(Mandatory)][scriptblock]$Script)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Script 2>&1 } finally { $ErrorActionPreference = $prev }
}

function Invoke-ApplyDelta {
  Write-Log 'apply (psql, ON_ERROR_ROLLBACK=on)'
  $applyOut = Invoke-Native { & (Join-Path $PgBin 'psql.exe') -w -U $SuperUser -h $SuperHost -d $TargetDb `
      -v ON_ERROR_ROLLBACK=on -f $DeltaFile }
  Add-CommandOutput $applyOut
  $skips = @($applyOut | Select-String -Pattern 'ERROR:' -SimpleMatch).Count
  if ($LASTEXITCODE -ne 0) { throw "apply FAILED (psql exit $LASTEXITCODE)." }
  return $skips
}

$overallExit = 0
$summary = [ordered]@{
  purged = 0; inserts = 0; updates = 0; applySkips = 0; verifyMissing = 0; backup = ''
}

Write-Log '=================================================================='
Write-Log "Artillery ERP nightly reconcile starting (host time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))"
Write-Log "SyncRoot=$SyncRoot"

# ------------------------------------------------------------------ overlap guard
if (Test-Path $LockFile) {
  $age = (Get-Date) - (Get-Item $LockFile).LastWriteTime
  if ($age.TotalHours -lt $StaleLockHours) {
    Write-Log ("Another reconcile run is in progress (lock age {0} min). Skipping." -f [int]$age.TotalMinutes) 'WARN'
    exit 0
  }
  Write-Log ("Found STALE lock (age {0}h); overriding." -f [math]::Round($age.TotalHours, 1)) 'WARN'
  Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}
"pid=$PID started=$(Get-Date -Format o)" | Set-Content -Path $LockFile -Encoding ascii

try {
  # ---------------------------------------------------------------- load secrets
  if (-not (Test-Path $SecretsFile)) { throw "Secrets file not found: $SecretsFile" }
  $secretMap = @{}
  foreach ($ln in Get-Content $SecretsFile) {
    if ($ln -match '^\s*#') { continue }
    $i = $ln.IndexOf('=')
    if ($i -lt 1) { continue }
    $secretMap[$ln.Substring(0, $i).Trim()] = $ln.Substring($i + 1).Trim()
  }
  $src = $secretMap['SOURCE_DATABASE_URL']
  $tgt = $secretMap['DATABASE_URL_STAGING']
  $superPw = $secretMap['POSTGRES_SUPERUSER_PASSWORD']
  if (-not $src) { throw 'SOURCE_DATABASE_URL missing from secrets file' }
  if (-not $tgt) { throw 'DATABASE_URL_STAGING missing from secrets file' }
  if (-not (Test-Path $PgPassFile) -and -not $superPw) {
    throw 'No postgres superuser auth available (need PGPASSFILE or POSTGRES_SUPERUSER_PASSWORD)'
  }
  $env:SOURCE_DATABASE_URL = $src
  $env:TARGET_DATABASE_URL = $tgt
  $env:INSERT_BATCH = '1'
  if (Test-Path $PgPassFile) { $env:PGPASSFILE = $PgPassFile } else { $env:PGPASSWORD = $superPw }
  Write-Log 'Secrets loaded (SOURCE + TARGET + superuser auth).'

  Set-Location $SyncRoot
  $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
  if (-not $npm) { $npm = (Get-Command npm -ErrorAction SilentlyContinue).Source }
  if (-not $npm) { $npm = Join-Path $NodeDir 'npm.cmd' }

  # ---------------------------------------------------------------- 1) COMPARE
  Write-Log '----- STEP 1/6: compare (before purge) -----'
  $out = Invoke-Native { & $npm run --silent compare }; $rc = $LASTEXITCODE
  Add-CommandOutput $out
  if ($rc -ne 0) { Write-Log "compare exited $rc (continuing)" 'WARN' }
  else { Write-Log 'compare complete (see reports/compare_report.md).' }

  # ---------------------------------------------------------------- 2) BACKUP
  if ($SkipBackup) {
    Write-Log '----- STEP 2/6: backup SKIPPED (-SkipBackup) -----'
    $summary.backup = '(skipped)'
  }
  else {
    Write-Log '----- STEP 2/6: backup (pg_dump -Fc) -----'
    $backupFile = Join-Path $BackupDir "pre-reconcile_$stamp.dump"
    $out = Invoke-Native { & (Join-Path $PgBin 'pg_dump.exe') -Fc -w -U $SuperUser -h $SuperHost -d $TargetDb -f $backupFile }
    $rc = $LASTEXITCODE
    Add-CommandOutput $out
    if ($rc -ne 0 -or -not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
      throw "pg_dump backup FAILED (exit $rc). Aborting before purge/apply."
    }
    $summary.backup = $backupFile
    Write-Log ("backup OK: {0} ({1:N1} KB)" -f $backupFile, ((Get-Item $backupFile).Length / 1KB))
  }

  # ---------------------------------------------------------------- 3) PURGE
  Write-Log '----- STEP 3/6: purge VPS-only rows -----'
  $purgeReport = Join-Path $ReportDir 'purge_report.json'
  Remove-Item $purgeReport -Force -ErrorAction SilentlyContinue
  $out = Invoke-Native { & $npm run --silent purge }; $rc = $LASTEXITCODE
  Add-CommandOutput $out
  if ($rc -ne 0) { throw "purge FAILED (exit $rc)." }
  if (Test-Path $purgeReport) {
    $pr = Get-Content $purgeReport -Raw | ConvertFrom-Json
    $summary.purged = [int]$pr.totalDeleted
    Write-Log ("purge OK: {0} VPS-only row(s) deleted." -f $summary.purged)
  }
  else { Write-Log 'purge complete (no purge_report.json; zero deletes?).' }

  # ---------------------------------------------------------------- 4) GENERATE
  Write-Log '----- STEP 4/6: generate delta -----'
  Remove-Item $DeltaFile, (Join-Path $ReportDir 'delta_summary.json') -Force -ErrorAction SilentlyContinue
  $out = Invoke-Native { & $npm run --silent generate }; $rc = $LASTEXITCODE
  Add-CommandOutput $out
  if ($rc -ne 0) { throw "generate FAILED (exit $rc)." }
  if (-not (Test-Path $DeltaFile)) { throw 'generate did not produce delta_sync.sql.' }
  $deltaSummaryPath = Join-Path $ReportDir 'delta_summary.json'
  if (Test-Path $deltaSummaryPath) {
    $ds = Get-Content $deltaSummaryPath -Raw | ConvertFrom-Json
    $summary.inserts = [int]$ds.totalInserts
    $summary.updates = [int]$ds.totalUpdates
    Write-Log ("generate OK: {0} inserts, {1} updates planned." -f $summary.inserts, $summary.updates)
  }

  # ---------------------------------------------------------------- 5) APPLY (+ optional retry)
  Write-Log '----- STEP 5/6: apply delta -----'
  $summary.applySkips = Invoke-ApplyDelta
  Write-Log ("apply committed. Rows skipped this run: {0}" -f $summary.applySkips)

  if ($summary.applySkips -gt 0) {
    Write-Log 'apply had skips (likely FK child rows after parent purge) - retrying generate+apply once.' 'WARN'
    Remove-Item $DeltaFile, (Join-Path $ReportDir 'delta_summary.json') -Force -ErrorAction SilentlyContinue
    $out = Invoke-Native { & $npm run --silent generate }; $rc = $LASTEXITCODE
    Add-CommandOutput $out
    if ($rc -ne 0) { throw "retry generate FAILED (exit $rc)." }
    $retrySkips = Invoke-ApplyDelta
    $summary.applySkips += $retrySkips
    Write-Log ("retry apply committed. Additional skips: {0} (total {1})." -f $retrySkips, $summary.applySkips)
  }

  # ---------------------------------------------------------------- 6) VERIFY (strict - databases should be equal)
  Write-Log '----- STEP 6/6: verify (strict equality) -----'
  $verifyReport = Join-Path $ReportDir 'verify_report.json'
  Remove-Item $verifyReport -Force -ErrorAction SilentlyContinue
  $out = Invoke-Native { & $npm run --silent verify }; $rc = $LASTEXITCODE
  Add-CommandOutput $out
  if (-not (Test-Path $verifyReport)) {
    throw "verify did not produce verify_report.json (exit $rc) - treat as failure."
  }
  $vr = Get-Content $verifyReport -Raw | ConvertFrom-Json
  $failed = @($vr.results | Where-Object { -not $_.pass })
  foreach ($f in $failed) {
    Write-Log ("verify divergence: {0} missingInTarget={1} (src={2} vps={3})" -f `
        $f.table, $f.missingInTarget, $f.rowsSource, $f.rowsTarget) 'WARN'
  }
  $summary.verifyMissing = ($failed | Where-Object { $_.missingInTarget -gt 0 } |
    Measure-Object -Property missingInTarget -Sum).Sum
  if ($null -eq $summary.verifyMissing) { $summary.verifyMissing = 0 }

  if ($failed.Count -gt 0 -and [int]$summary.verifyMissing -gt $LiveChurnTolerance) {
    Write-Log ("verify FAILED: {0} table(s) diverge, {1} row(s) missing (tolerance {2})." -f `
        $failed.Count, [int]$summary.verifyMissing, $LiveChurnTolerance) 'ERROR'
    $overallExit = 1
  }
  elseif ($failed.Count -gt 0) {
    Write-Log ("verify minor divergence ({0} row(s) missing, within live-churn tolerance {1}) - will catch up next run." -f `
        [int]$summary.verifyMissing, $LiveChurnTolerance) 'WARN'
  }
  else {
    Write-Log 'verify PASS - Supabase and VPS are equal.'
  }
}
catch {
  Write-Log ("FATAL: {0}" -f $_.Exception.Message) 'ERROR'
  Add-CommandOutput @($_.ScriptStackTrace)
  $overallExit = 1
}
finally {
  Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------------ retention
try {
  $oldBackups = Get-ChildItem $BackupDir -Filter 'pre-reconcile_*.dump' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -Skip $KeepBackups
  foreach ($b in $oldBackups) { Remove-Item $b.FullName -Force -ErrorAction SilentlyContinue }
  if ($oldBackups) { Write-Log ("retention: pruned {0} old backup(s), keeping last {1}." -f @($oldBackups).Count, $KeepBackups) }

  $oldLogs = Get-ChildItem $LogDir -Filter 'reconcile_*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $LogFile } |
    Sort-Object LastWriteTime -Descending | Select-Object -Skip ($KeepLogs - 1)
  foreach ($l in $oldLogs) { Remove-Item $l.FullName -Force -ErrorAction SilentlyContinue }
  if ($oldLogs) { Write-Log ("retention: pruned {0} old log(s), keeping last {1}." -f @($oldLogs).Count, $KeepLogs) }
}
catch { Write-Log ("retention warning: {0}" -f $_.Exception.Message) 'WARN' }

Write-Log ("SUMMARY: purged={0} inserts={1} updates={2} apply-skips={3} verify-missing={4} backup={5}" -f `
    $summary.purged, $summary.inserts, $summary.updates, $summary.applySkips, `
    [int]$summary.verifyMissing, $summary.backup)
Write-Log ("=== RUN COMPLETE exit={0} ===" -f $overallExit)
exit $overallExit
