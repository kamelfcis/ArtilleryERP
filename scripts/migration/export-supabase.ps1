# Export public + auth schema from Supabase Postgres (Windows).
# Requires: $env:SUPABASE_DB_URL
#
# Usage:
#   $env:SUPABASE_DB_URL = "postgresql://..."
#   .\scripts\migration\export-supabase.ps1

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_DB_URL) {
    Write-Error "Set SUPABASE_DB_URL to your Supabase connection string."
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Error "pg_dump not found. Install PostgreSQL client tools and add to PATH."
}

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$outDir = if ($env:OUT_DIR) { $env:OUT_DIR } else { Join-Path $repoRoot "migration-dumps" }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = Join-Path $outDir "artillery_erp_$stamp.sql"

Write-Host "Exporting to $outFile ..."

& pg_dump $env:SUPABASE_DB_URL `
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
    -f $outFile

$size = (Get-Item $outFile).Length / 1MB
Write-Host ("Done: {0} ({1:N2} MB)" -f $outFile, $size)
