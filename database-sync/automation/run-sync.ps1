<#
.SYNOPSIS
  Non-interactive, scheduled Supabase -> VPS delta-sync runner for Artillery ERP.

.DESCRIPTION
  Runs the delta-sync pipeline end to end and is safe to schedule unattended:

    compare -> backup (pg_dump -Fc) -> generate -> apply (resilient) -> verify

  Design points:
    * Credentials are read at runtime from the VPS-only secrets file
      (default C:\Temp\artillery-db-secrets.txt). NOTHING is hardcoded here.
    * The APPLY step runs as the `postgres` superuser (required for the delta's
      `DISABLE TRIGGER USER`) using a secured PGPASSFILE + the standing
      scram-sha-256 pg_hba rule for 127.0.0.1. No pg_hba is modified per run.
    * RESILIENT apply: psql -v ON_ERROR_ROLLBACK=on, so rows that collide with
      VPS-only live data (the known booking conflicts) are skipped per-savepoint
      and everything else still commits. Expected conflict skips do NOT fail.
    * Supabase = source of truth. The delta only INSERTs missing + UPDATEs
      changed rows (ON CONFLICT-safe); it never deletes/overwrites VPS-only rows.
    * verify's own exit code is non-zero on the KNOWN conflicts; this script
      instead parses reports/verify_report.json and only FAILS on *unexpected*
      table divergence.
    * Overlap guard via a lock file; backup/log retention prunes old files.

  Exit code: 0 on success (including expected conflict skips or a skipped
  overlapping run); non-zero only on a real failure.

.NOTES
  Secrets and generated artifacts (logs, backups, delta_sync.sql, reports) are
  gitignored. See automation/README.md.
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
  [int]     $StaleLockHours      = 4,
  # Tables whose verify divergence is EXPECTED (the known live booking conflicts
  # and any child rows blocked by them). Logged, never alerted.
  [string[]]$KnownConflictTables = @('public.reservations', 'public.reservation_attachments'),
  # On a LIVE source, high-churn tables (e.g. audit_logs) routinely show a few
  # rows "missing" simply because they were written to Supabase DURING the run;
  # they catch up next run. So verify divergence only escalates to a REAL FAILURE
  # when a non-known table diverges by MORE than this many rows (a sign of a real
  # sync bug rather than normal live churn). Set 0 to fail on ANY divergence.
  [int]     $DivergenceAlertThreshold = 500
)

$ErrorActionPreference = 'Stop'

# --- Paths (relative to this script's location, so the durable install moves cleanly) ---
$AutomationDir = $PSScriptRoot
$SyncRoot      = Split-Path -Parent $AutomationDir      # ...\database-sync
$LogDir        = Join-Path $SyncRoot 'logs'
$BackupDir     = Join-Path $SyncRoot 'backups'
$ReportDir     = Join-Path $SyncRoot 'reports'
$DeltaFile     = Join-Path $SyncRoot 'delta_sync.sql'
New-Item -ItemType Directory -Force -Path $LogDir, $BackupDir | Out-Null

$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile = Join-Path $LogDir "sync_$stamp.log"
$LockFile = Join-Path $LogDir 'run-sync.lock'

# Make sure node/npm + postgres tools resolve regardless of the run-as PATH.
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
    # Native-command stderr comes through as ErrorRecords; render just the plain
    # text (the tools use stderr for normal progress) so logs aren't polluted
    # with PowerShell "NativeCommandError" noise on successful runs.
    if ($o -is [System.Management.Automation.ErrorRecord]) { $s = $o.ToString() }
    else { $s = ($o | Out-String).TrimEnd() }
    if ($s.Length) { Add-Content -Path $LogFile -Value $s }
  }
}

# Run a native command (node/npm/psql/pg_dump) capturing stdout+stderr WITHOUT
# letting its normal stderr progress output raise a terminating error. Sets
# $LASTEXITCODE as usual. Cmdlet errors elsewhere still honour 'Stop'.
function Invoke-Native {
  param([Parameter(Mandatory)][scriptblock]$Script)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Script 2>&1 } finally { $ErrorActionPreference = $prev }
}

$overallExit = 0
$summary = [ordered]@{ inserts = 0; updates = 0; applySkips = 0; conflictsMissing = 0; backup = ''; }

Write-Log '=================================================================='
Write-Log "Artillery ERP delta-sync run starting (host time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))"
Write-Log "SyncRoot=$SyncRoot"

# ------------------------------------------------------------------ overlap guard
if (Test-Path $LockFile) {
  $age = (Get-Date) - (Get-Item $LockFile).LastWriteTime
  if ($age.TotalHours -lt $StaleLockHours) {
    Write-Log ("Another sync run is in progress (lock age {0} min). Skipping this run." -f [int]$age.TotalMinutes) 'WARN'
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
  $env:TARGET_DATABASE_URL = $tgt   # toolkit reads TARGET_DATABASE_URL (= staging, app role)
  $env:INSERT_BATCH = '1'           # one stmt/row so resilient apply skips per row
  # postgres superuser auth for pg_dump + psql apply (prefer the secured pgpass file).
  if (Test-Path $PgPassFile) { $env:PGPASSFILE = $PgPassFile } else { $env:PGPASSWORD = $superPw }
  Write-Log 'Secrets loaded (SOURCE + TARGET + superuser auth).'

  Set-Location $SyncRoot
  $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
  if (-not $npm) { $npm = (Get-Command npm -ErrorAction SilentlyContinue).Source }
  if (-not $npm) { $npm = Join-Path $NodeDir 'npm.cmd' }

  # ---------------------------------------------------------------- 1) COMPARE
  Write-Log '----- STEP 1/5: compare -----'
  $out = Invoke-Native { & $npm run --silent compare }; $rc = $LASTEXITCODE
  Add-CommandOutput $out
  if ($rc -ne 0) { Write-Log "compare exited $rc (continuing; downstream steps will surface real connectivity failures)" 'WARN' }
  else { Write-Log 'compare complete (see reports/compare_report.md).' }

  # ---------------------------------------------------------------- 2) BACKUP
  Write-Log '----- STEP 2/5: backup (pg_dump -Fc) -----'
  $backupFile = Join-Path $BackupDir "pre-sync_$stamp.dump"
  $out = Invoke-Native { & (Join-Path $PgBin 'pg_dump.exe') -Fc -w -U $SuperUser -h $SuperHost -d $TargetDb -f $backupFile }
  $rc = $LASTEXITCODE
  Add-CommandOutput $out
  if ($rc -ne 0 -or -not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
    throw "pg_dump backup FAILED (exit $rc). Aborting before apply."
  }
  $summary.backup = $backupFile
  Write-Log ("backup OK: {0} ({1:N1} KB)" -f $backupFile, ((Get-Item $backupFile).Length / 1KB))

  # ---------------------------------------------------------------- 3) GENERATE
  Write-Log '----- STEP 3/5: generate delta -----'
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

  # ---------------------------------------------------------------- 4) APPLY (resilient)
  Write-Log '----- STEP 4/5: apply (psql, ON_ERROR_ROLLBACK=on) -----'
  $applyOut = Invoke-Native { & (Join-Path $PgBin 'psql.exe') -w -U $SuperUser -h $SuperHost -d $TargetDb `
      -v ON_ERROR_ROLLBACK=on -f $DeltaFile }
  $applyRc = $LASTEXITCODE
  Add-CommandOutput $applyOut
  # Per-statement errors (skipped conflict rows) are logged by psql but do NOT
  # set a non-zero exit under ON_ERROR_ROLLBACK. A non-zero exit here = a real
  # failure (bad connection, file error, etc.).
  $summary.applySkips = @($applyOut | Select-String -Pattern 'ERROR:' -SimpleMatch).Count
  if ($applyRc -ne 0) { throw "apply FAILED (psql exit $applyRc)." }
  Write-Log ("apply committed. Rows skipped as conflicts this run: {0}" -f $summary.applySkips)

  # ---------------------------------------------------------------- 5) VERIFY
  Write-Log '----- STEP 5/5: verify -----'
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
  $summary.conflictsMissing = ($failed | Where-Object { $_.missingInTarget -gt 0 } | Measure-Object -Property missingInTarget -Sum).Sum
  # verify_report table names are quoted (e.g. "public"."reservations"); normalize
  # before comparing against the (unquoted) known-conflict allowlist.
  $knownNorm = $KnownConflictTables | ForEach-Object { $_ -replace '"', '' }
  $nonKnown = @($failed | Where-Object { $knownNorm -notcontains ($_.table -replace '"', '') })
  $severe = @($nonKnown | Where-Object { $_.missingInTarget -gt $DivergenceAlertThreshold })
  if ($severe.Count -gt 0) {
    Write-Log ('SEVERE unexpected divergence (real problem - investigate): ' +
      (($severe | ForEach-Object { "$($_.table)=$($_.missingInTarget)" }) -join ', ')) 'ERROR'
    $overallExit = 1
  }
  elseif ($nonKnown.Count -gt 0) {
    Write-Log ("Minor divergence in non-conflict table(s) - likely live-source rows written during the run; will catch up next run: " +
      (($nonKnown | ForEach-Object { "$($_.table)=$($_.missingInTarget)" }) -join ', ')) 'WARN'
    Write-Log ("verify OK for scheduled run: {0} known-conflict table(s), {1} minor-churn table(s), all within tolerance ({2} row(s) total)." -f `
      ($failed.Count - $nonKnown.Count), $nonKnown.Count, [int]$summary.conflictsMissing)
  }
  else {
    Write-Log ("verify PASS except known live-booking conflicts ({0} table(s), {1} row(s) skipped by decision)." -f `
        $failed.Count, ([int]$summary.conflictsMissing))
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
  $oldBackups = Get-ChildItem $BackupDir -Filter 'pre-sync_*.dump' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -Skip $KeepBackups
  foreach ($b in $oldBackups) { Remove-Item $b.FullName -Force -ErrorAction SilentlyContinue }
  if ($oldBackups) { Write-Log ("retention: pruned {0} old backup(s), keeping last {1}." -f @($oldBackups).Count, $KeepBackups) }

  $oldLogs = Get-ChildItem $LogDir -Filter 'sync_*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $LogFile } |
    Sort-Object LastWriteTime -Descending | Select-Object -Skip ($KeepLogs - 1)
  foreach ($l in $oldLogs) { Remove-Item $l.FullName -Force -ErrorAction SilentlyContinue }
  if ($oldLogs) { Write-Log ("retention: pruned {0} old log(s), keeping last {1}." -f @($oldLogs).Count, $KeepLogs) }
}
catch { Write-Log ("retention warning: {0}" -f $_.Exception.Message) 'WARN' }

Write-Log ("SUMMARY: inserts={0} updates={1} apply-skips={2} conflicts-missing={3} backup={4}" -f `
    $summary.inserts, $summary.updates, $summary.applySkips, [int]$summary.conflictsMissing, $summary.backup)
Write-Log ("=== RUN COMPLETE exit={0} ===" -f $overallExit)
exit $overallExit
