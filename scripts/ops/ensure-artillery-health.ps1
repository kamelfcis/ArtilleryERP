# Artillery ERP - health keeper for the STABLE named-tunnel era.
# Use ONLY after https://api-artillery.abdelrhmanabdelkhalek.com/health returns Artillery JSON and
# Edge Config backendUrl is https://api-artillery.abdelrhmanabdelkhalek.com.
#
# Unlike ensure-artillery-tunnel.ps1, this script:
#   - Keeps artillery-api online on :4000
#   - Reclaims :4000 if ReelSaverDL binds it
#   - Does NOT start/chase *.trycloudflare.com quick tunnels
#   - Only PATCHes Edge Config if backendUrl is missing or not the canonical host
#
# VPS install (after Phase B+C):
#   copy to C:\cloudflared\ensure-artillery-health.ps1
#   replace scheduled task Artillery-Ensure-Tunnel action with this script
#   stop/delete PM2 process cloudflared-tunnel (Artillery quick tunnel only)

$ErrorActionPreference = "Stop"
$LogFile = "C:\cloudflared\ensure-artillery-health.log"
$TokenFile = "C:\cloudflared\vercel-token.txt"
$SecretsFile = "C:\Temp\artillery-db-secrets.txt"
$TeamId = "team_2IFtuuXSEcZGzUhW1VNyM0JE"
$EdgeConfigId = "ecfg_npkgxlllddf0eccn27fd7gx8pqbp"
$CanonicalBackendUrl = "https://api-artillery.abdelrhmanabdelkhalek.com"

function Write-Log([string]$msg) {
  $line = "$(Get-Date -Format o) $msg"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-VercelToken {
  if (Test-Path $TokenFile) { return (Get-Content $TokenFile -Raw).Trim() }
  if (Test-Path $SecretsFile) {
    $line = Get-Content $SecretsFile | Where-Object { $_ -match '^\s*VERCEL_TOKEN\s*=' } | Select-Object -First 1
    if ($line) { return ($line -replace '^\s*VERCEL_TOKEN\s*=\s*', '').Trim() }
  }
  return $null
}

function Ensure-Port4000Artillery {
  $looksLikeReelsaver = $false
  try {
    $probe = (Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 8).Content
    if ($probe -match "reelsaverdl") { $looksLikeReelsaver = $true }
    elseif ($probe -match '"status"\s*:\s*"ok"') { return }
  } catch {
    # nothing listening or unhealthy - start artillery below
  }

  if ($looksLikeReelsaver) {
    Write-Log "WARN: Port 4000 is reelsaverdl-api - reclaiming for artillery-api"
    & sc.exe stop ReelSaverDL-API 2>$null | Out-Null
    & sc.exe config ReelSaverDL-API start= disabled 2>$null | Out-Null
    schtasks /Change /TN \ReelSaverDL-API /DISABLE 2>$null | Out-Null
    Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
  }

  Set-Location "C:\Artillery-ERP\backend-deploy"
  $artPid = (& pm2 pid artillery-api 2>$null | Out-String).Trim()
  if ($artPid -match '^\d+$' -and [int]$artPid -gt 0) {
    try {
      $h = (Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 8).Content
      if ($h -match '"status"\s*:\s*"ok"' -and $h -notmatch "reelsaverdl") {
        Write-Log "artillery-api healthy on :4000"
        return
      }
    } catch { }
    pm2 restart artillery-api | Out-Null
    Write-Log "Restarted artillery-api"
  } else {
    pm2 start dist/index.js --name artillery-api | Out-Null
    Write-Log "Started artillery-api"
  }
  Start-Sleep -Seconds 3
  pm2 save | Out-Null
}

function Ensure-EdgeConfigCanonical([string]$token) {
  $headers = @{ Authorization = "Bearer $token" }
  $getUri = "https://api.vercel.com/v1/edge-config/$EdgeConfigId/item/backendUrl?teamId=$TeamId"
  $current = $null
  try {
    $resp = Invoke-RestMethod -Uri $getUri -Headers $headers -Method GET
    $current = [string]$resp.value
  } catch {
    Write-Log "WARN: could not read Edge Config backendUrl: $($_.Exception.Message)"
  }

  if ($current -eq $CanonicalBackendUrl) {
    Write-Log "Edge Config backendUrl already canonical"
    return
  }

  Write-Log "Edge Config backendUrl was '$current' - setting canonical $CanonicalBackendUrl"
  $body = @{
    items = @(@{ operation = "upsert"; key = "backendUrl"; value = $CanonicalBackendUrl })
  } | ConvertTo-Json -Depth 5
  $patchHeaders = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  }
  $patchUri = "https://api.vercel.com/v1/edge-config/$EdgeConfigId/items?teamId=$TeamId"
  $patchResp = Invoke-RestMethod -Uri $patchUri -Headers $patchHeaders -Method PATCH -Body $body
  Write-Log "Edge Config upsert status=$($patchResp.status)"
}

Write-Log "=== ensure-artillery-health start ==="
Ensure-Port4000Artillery

try {
  $local = (Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 10).Content
  if ($local -match "reelsaverdl") { throw "localhost:4000 is still reelsaverdl-api" }
  if ($local -notmatch '"status"\s*:\s*"ok"') { throw "Artillery /health not ok: $local" }
  Write-Log "Local health OK"
} catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  throw
}

$token = Get-VercelToken
if ($token) {
  Ensure-EdgeConfigCanonical -token $token
} else {
  Write-Log "WARN: no Vercel token; skipped Edge Config check"
}

Write-Log "=== ensure-artillery-health done ==="
exit 0
