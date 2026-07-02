#Requires -Version 5.1
<#
.SYNOPSIS
  Prepare artillery_erp_staging and import Supabase dumps on Windows PostgreSQL.

.DESCRIPTION
  Fixes missing extensions schema (Supabase pg_restore failure as artillery_app).
  Run on the VPS after export files are present. Passwords via environment only.

.PARAMETER PublicDump
  Path to public_schema.dump (custom format).

.PARAMETER AuthSql
  Path to auth_users.sql.

.PARAMETER Database
  Target database name (default: artillery_erp_staging).

.PARAMETER PgBin
  PostgreSQL bin directory (default: PG 18 on Windows).

.EXAMPLE
  $env:POSTGRES_SUPERUSER_PASSWORD = 'postgres-superuser-password'
  .\bootstrap-staging-windows.ps1 `
    -PublicDump 'C:\Temp\migration-dumps\public_schema.dump' `
    -AuthSql 'C:\Temp\migration-dumps\auth_users.sql'
#>
param(
  [string]$PublicDump = 'C:\Temp\migration-dumps\public_schema.dump',
  [string]$AuthSql = 'C:\Temp\migration-dumps\auth_users.sql',
  [string]$Database = 'artillery_erp_staging',
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if (-not $env:POSTGRES_SUPERUSER_PASSWORD) {
  Write-Host 'Set POSTGRES_SUPERUSER_PASSWORD (postgres superuser) before running.' -ForegroundColor Red
  exit 1
}

$pgRestore = Join-Path $PgBin 'pg_restore.exe'
$psql = Join-Path $PgBin 'psql.exe'
foreach ($tool in @($pgRestore, $psql)) {
  if (-not (Test-Path $tool)) {
    Write-Host "PostgreSQL tool not found: $tool" -ForegroundColor Red
    exit 1
  }
}

Write-Step 'Ensure PostgreSQL 18 service is running'
$svc = Get-Service -Name 'postgresql-x64-18' -ErrorAction SilentlyContinue
if ($svc) {
  if ($svc.StartType -ne 'Automatic') {
    Set-Service -Name 'postgresql-x64-18' -StartupType Automatic
  }
  if ($svc.Status -ne 'Running') {
    Start-Service -Name 'postgresql-x64-18'
  }
} else {
  Write-Host 'WARN: postgresql-x64-18 service not found; continuing if psql works.' -ForegroundColor Yellow
}

$env:PGPASSWORD = $env:POSTGRES_SUPERUSER_PASSWORD
$bootstrapSql = Join-Path $PSScriptRoot 'bootstrap-staging-pre-restore.sql'

Write-Step "Bootstrap extensions/auth in $Database"
& $psql -U postgres -d $Database -v ON_ERROR_STOP=1 -f $bootstrapSql

if (-not (Test-Path $PublicDump)) {
  Write-Host "Public dump not found: $PublicDump" -ForegroundColor Red
  exit 1
}

Write-Step "pg_restore public schema (as postgres) into $Database"
& $pgRestore --no-owner --no-acl --clean --if-exists -U postgres -d $Database $PublicDump
if ($LASTEXITCODE -ne 0) {
  Write-Host "pg_restore exited $LASTEXITCODE (some warnings are normal for Supabase ACLs)." -ForegroundColor Yellow
}

if (Test-Path $AuthSql) {
  Write-Step 'Import auth.users SQL'
  & $psql -U postgres -d $Database -v ON_ERROR_STOP=1 -f $AuthSql
} else {
  Write-Host "WARN: auth SQL not found: $AuthSql" -ForegroundColor Yellow
}

Write-Step 'Row counts (verify-counts.sql)'
$verifySql = Join-Path $PSScriptRoot 'verify-counts.sql'
& $psql -U postgres -d $Database -f $verifySql

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
Write-Host "`nBootstrap + import finished." -ForegroundColor Green
