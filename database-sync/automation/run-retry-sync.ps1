$ErrorActionPreference = 'Stop'
$SyncRoot = 'C:\Artillery-ERP\database-sync'
$env:PATH = "C:\Program Files\nodejs;C:\Program Files\PostgreSQL\18\bin;$env:PATH"
$env:PGCLIENTENCODING = 'UTF8'
$env:PGPASSFILE = 'C:\Temp\artillery-pgpass.conf'
$env:INSERT_BATCH = '1'
foreach ($ln in Get-Content 'C:\Temp\artillery-db-secrets.txt') {
  if ($ln -match '^\s*#') { continue }
  $i = $ln.IndexOf('=')
  if ($i -lt 1) { continue }
  Set-Item -Path "env:$($ln.Substring(0,$i).Trim())" -Value $ln.Substring($i+1).Trim()
}
$env:TARGET_DATABASE_URL = $env:DATABASE_URL_STAGING
Set-Location $SyncRoot

Write-Output '--- RETRY generate ---'
npm run generate
Write-Output '--- RETRY apply ---'
psql -w -U postgres -h 127.0.0.1 -d artillery_erp_staging -v ON_ERROR_ROLLBACK=on -f delta_sync.sql
Write-Output '--- RETRY verify ---'
npm run verify
Write-Output '--- RETRY compare ---'
npm run compare
