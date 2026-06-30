#Requires -Version 5.1
<#
.SYNOPSIS
  Bootstrap Artillery ERP on Windows Server (Hetzner VPS).

.DESCRIPTION
  Installs WSL2 + Ubuntu (recommended) OR documents native PostgreSQL for Windows.
  Never embed passwords in this script — pass via environment variables at runtime.

.PARAMETER SkipWslInstall
  Skip WSL installation; only print manual PostgreSQL-on-Windows steps.

.EXAMPLE
  # After SSH login to the VPS (interactive password):
  $env:ARTILLERY_DB_PASSWORD = 'your-secure-password'
  $env:ARTILLERY_READONLY_PASSWORD = 'your-readonly-password'
  Set-ExecutionPolicy Bypass -Scope Process -Force
  .\scripts\migration\setup-vps-windows.ps1
#>
param(
  [switch]$SkipWslInstall
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

Write-Step 'Artillery ERP — Windows Server VPS bootstrap'
Write-Host 'Target: Windows Server with OpenSSH (Administrator@95.216.63.81)'
Write-Host 'Passwords must be set via env vars — never commit them.'

if (-not $env:ARTILLERY_DB_PASSWORD -or -not $env:ARTILLERY_READONLY_PASSWORD) {
  Write-Host @'

Required environment variables (set before running):
  $env:ARTILLERY_DB_PASSWORD       = '...'
  $env:ARTILLERY_READONLY_PASSWORD = '...'
  Optional:
  $env:ARTILLERY_DOMAIN            = 'api.yourdomain.com'
  $env:ARTILLERY_API_PORT          = '4001'

'@ -ForegroundColor Yellow
  if (-not $SkipWslInstall) { exit 1 }
}

# ── Option A: WSL2 + Ubuntu (matches setup-vps.sh / setup-wsl-postgres.sh) ──
if (-not $SkipWslInstall) {
  Write-Step 'Checking WSL status'
  $wslStatus = wsl --status 2>&1 | Out-String

  if ($LASTEXITCODE -ne 0 -or $wslStatus -match 'not installed') {
    Write-Host 'WSL not installed. Installing WSL2 with Ubuntu...'
    Write-Host 'A reboot may be required after this step.' -ForegroundColor Yellow
    wsl --install -d Ubuntu --no-launch
    Write-Host @'

WSL install initiated. If prompted, reboot the server, then SSH back in and run:

  wsl -d Ubuntu -e bash -c "cd /mnt/c/path/to/Artillery\ ERP && sudo -E bash scripts/migration/setup-wsl-postgres.sh"

Or copy setup-wsl-postgres.sh into WSL and run with exported passwords.

'@
  } else {
    Write-Host "WSL present: $wslStatus"
    Write-Step 'Running PostgreSQL bootstrap inside Ubuntu WSL'
    $scriptPath = Join-Path $PSScriptRoot 'setup-wsl-postgres.sh'
    $wslScript = (wsl wslpath -a $scriptPath 2>$null)
    if (-not $wslScript) {
      $wslScript = "/mnt/c/$(($scriptPath -replace '\\','/') -replace '^([A-Za-z]):','/mnt/$1'.ToLower())"
    }
    wsl -d Ubuntu -e bash -c @"
export ARTILLERY_DB_PASSWORD='$($env:ARTILLERY_DB_PASSWORD)'
export ARTILLERY_READONLY_PASSWORD='$($env:ARTILLERY_READONLY_PASSWORD)'
export ARTILLERY_DOMAIN='${env:ARTILLERY_DOMAIN}'
export ARTILLERY_API_PORT='${env:ARTILLERY_API_PORT}'
sudo -E bash '$wslScript'
"@
    if ($LASTEXITCODE -eq 0) {
      Write-Host 'WSL PostgreSQL bootstrap complete.' -ForegroundColor Green
    } else {
      Write-Host 'WSL bootstrap failed — see output above.' -ForegroundColor Red
      exit $LASTEXITCODE
    }
  }
}

# ── Option B: Native PostgreSQL on Windows ──
Write-Step 'Option B — Native PostgreSQL 16 on Windows (manual)'
Write-Host @'
If you prefer not to use WSL:

1. Download PostgreSQL 16 for Windows:
   https://www.postgresql.org/download/windows/

2. During setup, note the postgres superuser password.

3. Open "SQL Shell (psql)" or psql.exe and create roles/DBs:

   CREATE ROLE artillery_app LOGIN PASSWORD 'YOUR_APP_PASSWORD';
   CREATE ROLE artillery_readonly LOGIN PASSWORD 'YOUR_READONLY_PASSWORD';
   CREATE DATABASE artillery_erp OWNER artillery_app;
   CREATE DATABASE artillery_erp_staging OWNER artillery_app;
   GRANT CONNECT ON DATABASE artillery_erp TO artillery_readonly;
   GRANT CONNECT ON DATABASE artillery_erp_staging TO artillery_readonly;

4. Install Node.js 20 LTS: https://nodejs.org/
   npm install -g pm2

5. Deploy backend:
   cd backend
   copy .env.example .env
   # DATABASE_URL=postgresql://artillery_app:PASSWORD@localhost:5432/artillery_erp_staging
   npm ci && npm run build
   pm2 start dist/index.js --name artillery-api

6. Reverse proxy: use IIS URL Rewrite or Caddy for Windows to TLS-terminate api.yourdomain.com

'@

Write-Step 'Next steps'
Write-Host @'
1. Import data: scripts/migration/import-to-vps.sh (from WSL) or pg_restore on Windows
2. Verify: psql ... -f scripts/migration/verify-counts.sql
3. Smoke test: curl http://localhost:4001/health
4. Add SSH public keys; rotate Administrator password after first login
'@
