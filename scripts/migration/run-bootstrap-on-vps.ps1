#Requires -Version 5.1
<#
.SYNOPSIS
  Remote helper: run bootstrap-staging-windows.ps1 on the VPS via PuTTY plink.

.DESCRIPTION
  Reads VPS host key and credentials from environment (never commit).
  Deletes itself is NOT automatic — remove any one-off wrappers you create with embedded passwords.

.EXAMPLE
  $env:VPS_HOST = '95.217.137.18'
  $env:VPS_USER = 'Administrator'
  $env:VPS_PASSWORD = '...'
  $env:VPS_PLINK_HOSTKEY = 'SHA256:...'
  $env:POSTGRES_SUPERUSER_PASSWORD = '...'
  .\run-bootstrap-on-vps.ps1
#>
param(
  [string]$PlinkPath = 'C:\Program Files\PuTTY\plink.exe',
  [string]$RemoteRepo = 'C:\Artillery-ERP'
)

$ErrorActionPreference = 'Stop'

$required = @('VPS_HOST', 'VPS_USER', 'VPS_PASSWORD', 'VPS_PLINK_HOSTKEY', 'POSTGRES_SUPERUSER_PASSWORD')
foreach ($name in $required) {
  if (-not (Get-Item "Env:$name" -ErrorAction SilentlyContinue)) {
    Write-Host "Missing env var: $name" -ForegroundColor Red
    exit 1
  }
}

if (-not (Test-Path $PlinkPath)) {
  Write-Host "plink not found: $PlinkPath" -ForegroundColor Red
  exit 1
}

$remoteScript = "$RemoteRepo\scripts\migration\bootstrap-staging-windows.ps1"
$pgPass = $env:POSTGRES_SUPERUSER_PASSWORD -replace "'", "''"
$cmd = @"
`$env:POSTGRES_SUPERUSER_PASSWORD = '$pgPass'
Set-ExecutionPolicy Bypass -Scope Process -Force
& '$remoteScript'
"@

& $PlinkPath -batch -ssh "$($env:VPS_USER)@$($env:VPS_HOST)" -hostkey $env:VPS_PLINK_HOSTKEY -pw $env:VPS_PASSWORD $cmd
exit $LASTEXITCODE
