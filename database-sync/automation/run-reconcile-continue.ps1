<#
.SYNOPSIS
  Continue reconciliation from purge step (backup already taken).
#>
[CmdletBinding()]
param(
  [string]$SecretsFile = 'C:\Temp\artillery-db-secrets.txt',
  [string]$PgBin       = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$NodeDir     = 'C:\Program Files\nodejs',
  [string]$PgPassFile  = 'C:\Temp\artillery-pgpass.conf',
  [string]$TargetDb    = 'artillery_erp_staging',
  [string]$SuperUser   = 'postgres',
  [string]$SuperHost   = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'
$SyncRoot = Split-Path -Parent $PSScriptRoot
$DeltaFile = Join-Path $SyncRoot 'delta_sync.sql'
$LogDir = Join-Path $SyncRoot 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile = Join-Path $LogDir "reconcile_continue_$stamp.log"

$env:PATH = "$NodeDir;$PgBin;$env:PATH"
$env:PGCLIENTENCODING = 'UTF8'

function Write-Log { param([string]$Message)
  $line = ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
  Add-Content -Path $LogFile -Value $line
  Write-Output $line
}

function Invoke-Native {
  param([Parameter(Mandatory)][scriptblock]$Script)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Script 2>&1 } finally { $ErrorActionPreference = $prev }
}

Write-Log '=== RECONCILE CONTINUE (purge -> sync -> verify) ==='

$secretMap = @{}
foreach ($ln in Get-Content $SecretsFile) {
  if ($ln -match '^\s*#') { continue }
  $i = $ln.IndexOf('=')
  if ($i -lt 1) { continue }
  $secretMap[$ln.Substring(0, $i).Trim()] = $ln.Substring($i + 1).Trim()
}
$env:SOURCE_DATABASE_URL = $secretMap['SOURCE_DATABASE_URL']
$env:TARGET_DATABASE_URL = $secretMap['DATABASE_URL_STAGING']
$env:INSERT_BATCH = '1'
if (Test-Path $PgPassFile) { $env:PGPASSFILE = $PgPassFile }
else { $env:PGPASSWORD = $secretMap['POSTGRES_SUPERUSER_PASSWORD'] }

Set-Location $SyncRoot
$npm = Join-Path $NodeDir 'npm.cmd'

Write-Log '--- STEP 3: purge VPS-only rows ---'
$out = Invoke-Native { & $npm run --silent purge }
$out | ForEach-Object { Add-Content -Path $LogFile -Value $_; Write-Output $_ }
if ($LASTEXITCODE -ne 0) { throw "purge FAILED exit=$LASTEXITCODE" }

Write-Log '--- STEP 4: generate delta ---'
Remove-Item $DeltaFile -Force -ErrorAction SilentlyContinue
$out = Invoke-Native { & $npm run --silent generate }
$out | ForEach-Object { Add-Content -Path $LogFile -Value $_; Write-Output $_ }
if ($LASTEXITCODE -ne 0) { throw "generate FAILED exit=$LASTEXITCODE" }

Write-Log '--- STEP 5: apply delta ---'
$applyOut = Invoke-Native { & (Join-Path $PgBin 'psql.exe') -w -U $SuperUser -h $SuperHost -d $TargetDb -v ON_ERROR_ROLLBACK=on -f $DeltaFile }
$applyOut | ForEach-Object { Add-Content -Path $LogFile -Value $_; Write-Output $_ }
$applySkips = @($applyOut | Select-String -Pattern 'ERROR:' -SimpleMatch).Count
Write-Log "APPLY_SKIPS=$applySkips"

Write-Log '--- STEP 6: verify ---'
$out = Invoke-Native { & $npm run --silent verify }
$out | ForEach-Object { Add-Content -Path $LogFile -Value $_; Write-Output $_ }

Write-Log '--- STEP 7: final compare ---'
$out = Invoke-Native { & $npm run --silent compare }
$out | ForEach-Object { Add-Content -Path $LogFile -Value $_; Write-Output $_ }

Write-Log "=== RECONCILE COMPLETE log=$LogFile ==="
