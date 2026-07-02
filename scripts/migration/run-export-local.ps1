# Export Supabase database locally using SUPABASE_DB_URL.
# Produces migration-dumps/artillery_erp_YYYYMMDD_HHMMSS.sql (plain SQL, public + auth).
#
# Usage:
#   $env:SUPABASE_DB_URL = "postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
#   .\scripts\migration\run-export-local.ps1

$ErrorActionPreference = 'Stop'

function Set-SupabasePgEnvFromUrl {
    param([string]$Uri)
    if ($Uri -match '^postgresql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)
if (-not $env:SUPABASE_DB_URL) {
    Write-Error @"
SUPABASE_DB_URL is not set.

Example (Session pooler, from Supabase Dashboard â†’ Database â†’ Connection string):
  `$env:SUPABASE_DB_URL = "postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
  .\scripts\migration\run-export-local.ps1
"@
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Error "pg_dump not found. Install PostgreSQL client tools and add to PATH."
}

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$outDir = if ($env:OUT_DIR) { $env:OUT_DIR } else { Join-Path $repoRoot "migration-dumps" }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlFile = Join-Path $outDir "artillery_erp_$stamp.sql"
$customFile = Join-Path $outDir "public_schema_$stamp.dump"

Write-Host "==> Exporting plain SQL to $sqlFile"
& Invoke-ArtilleryPgDump `
    --no-owner `
    --no-acl `
    --schema=public `
    --schema=auth `
    --exclude-schema=storage `
    --exclude-schema=realtime `
    --exclude-schema=supabase_functions `
    --exclude-schema=graphql `
    --exclude-schema=graphql_public `
    --exclude-schema=extensions `
    --exclude-schema=pgsodium `
    --exclude-schema=vault `
    --exclude-schema=supabase_migrations `
    -F p `
    -f $sqlFile

Write-Host "==> Exporting custom-format public schema to $customFile"
& Invoke-ArtilleryPgDump `
    --no-owner `
    --no-acl `
    --schema=public `
    -F c `
    -f $customFile

# Auth users-only SQL for import-to-vps.sh compatibility
$authFile = Join-Path $outDir "auth_users_$stamp.sql"
Write-Host "==> Exporting auth.users to $authFile"
& Invoke-ArtilleryPgDump `
    --no-owner `
    --no-acl `
    --schema=auth `
    --table=auth.users `
    --table=auth.identities `
    -F p `
    -f $authFile

$sqlMb = (Get-Item $sqlFile).Length / 1MB
$dumpMb = (Get-Item $customFile).Length / 1MB
Write-Host ""
Write-Host "Export complete:" -ForegroundColor Green
Write-Host "  Full SQL:     $sqlFile ($('{0:N2}' -f $sqlMb) MB)"
Write-Host "  Public dump:  $customFile ($('{0:N2}' -f $dumpMb) MB)"
Write-Host "  Auth users:   $authFile"
Write-Host ""
Write-Host "Copy to VPS (interactive password):"
Write-Host "  scp `"$customFile`" Administrator@95.217.137.18:C:/Temp/public_schema.dump"
Write-Host "  scp `"$authFile`" Administrator@95.217.137.18:C:/Temp/auth_users.sql"
Write-Host ""
Write-Host "Import on VPS (WSL):"
Write-Host '  export VPS_DB_URL="postgresql://artillery_app:YOUR_PASSWORD@localhost:5432/artillery_erp_staging"'
Write-Host "  bash scripts/migration/import-to-vps.sh /mnt/c/Temp/public_schema.dump /mnt/c/Temp/auth_users.sql"
) {
        $env:PGUSER = $Matches[1]
        $env:PGPASSWORD = [uri]::UnescapeDataString($Matches[2])
        $env:PGHOST = $Matches[3]
        if ($Matches[4]) { $env:PGPORT = $Matches[4] } else { Remove-Item Env:PGPORT -ErrorAction SilentlyContinue }
        $env:PGDATABASE = $Matches[5]
    } else {
        Write-Error "SUPABASE_DB_URL format not recognized."
    }
}

function Invoke-ArtilleryPgDump {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$DumpArgs)
    if ($env:SUPABASE_DB_URL) { Set-SupabasePgEnvFromUrl -Uri $env:SUPABASE_DB_URL }
    if (-not $env:PGHOST) { Write-Error "Set SUPABASE_DB_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE." }
    & pg_dump @DumpArgs
}

if (-not $env:SUPABASE_DB_URL) {
    Write-Error @"
SUPABASE_DB_URL is not set.

Example (Session pooler, from Supabase Dashboard â†’ Database â†’ Connection string):
  `$env:SUPABASE_DB_URL = "postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
  .\scripts\migration\run-export-local.ps1
"@
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Error "pg_dump not found. Install PostgreSQL client tools and add to PATH."
}

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$outDir = if ($env:OUT_DIR) { $env:OUT_DIR } else { Join-Path $repoRoot "migration-dumps" }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlFile = Join-Path $outDir "artillery_erp_$stamp.sql"
$customFile = Join-Path $outDir "public_schema_$stamp.dump"

Write-Host "==> Exporting plain SQL to $sqlFile"
& Invoke-ArtilleryPgDump `
    --no-owner `
    --no-acl `
    --schema=public `
    --schema=auth `
    --exclude-schema=storage `
    --exclude-schema=realtime `
    --exclude-schema=supabase_functions `
    --exclude-schema=graphql `
    --exclude-schema=graphql_public `
    --exclude-schema=extensions `
    --exclude-schema=pgsodium `
    --exclude-schema=vault `
    --exclude-schema=supabase_migrations `
    -F p `
    -f $sqlFile

Write-Host "==> Exporting custom-format public schema to $customFile"
& Invoke-ArtilleryPgDump `
    --no-owner `
    --no-acl `
    --schema=public `
    -F c `
    -f $customFile

# Auth users-only SQL for import-to-vps.sh compatibility
$authFile = Join-Path $outDir "auth_users_$stamp.sql"
Write-Host "==> Exporting auth.users to $authFile"
& Invoke-ArtilleryPgDump `
    --no-owner `
    --no-acl `
    --schema=auth `
    --table=auth.users `
    --table=auth.identities `
    -F p `
    -f $authFile

$sqlMb = (Get-Item $sqlFile).Length / 1MB
$dumpMb = (Get-Item $customFile).Length / 1MB
Write-Host ""
Write-Host "Export complete:" -ForegroundColor Green
Write-Host "  Full SQL:     $sqlFile ($('{0:N2}' -f $sqlMb) MB)"
Write-Host "  Public dump:  $customFile ($('{0:N2}' -f $dumpMb) MB)"
Write-Host "  Auth users:   $authFile"
Write-Host ""
Write-Host "Copy to VPS (interactive password):"
Write-Host "  scp `"$customFile`" Administrator@95.217.137.18:C:/Temp/public_schema.dump"
Write-Host "  scp `"$authFile`" Administrator@95.217.137.18:C:/Temp/auth_users.sql"
Write-Host ""
Write-Host "Import on VPS (WSL):"
Write-Host '  export VPS_DB_URL="postgresql://artillery_app:YOUR_PASSWORD@localhost:5432/artillery_erp_staging"'
Write-Host "  bash scripts/migration/import-to-vps.sh /mnt/c/Temp/public_schema.dump /mnt/c/Temp/auth_users.sql"
