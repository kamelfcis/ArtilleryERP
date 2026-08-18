# Artillery ERP - health keeper for the STABLE named-tunnel era.
# Use ONLY after https://api-artillery.abdelrhmanabdelkhalek.com/health returns Artillery JSON and
# Edge Config backendUrl is https://api-artillery.abdelrhmanabdelkhalek.com.
#
# Port layout on shared VPS:
#   :4000  port-4000-mux (PM2) — public face; routes Host api-artillery -> :4001, else -> ReelSaver :4002
#   :4001  artillery-api (PM2)
#   :4002  ReelSaverDL-API (NSSM, internal)
# Cloudflare tunnel remote ingress stays localhost:4000 (mux handles Host routing).
#
# Unlike ensure-artillery-tunnel.ps1, this script:
#   - Keeps artillery-api online on :4001
#   - Warns if ReelSaverDL is on :4000 (expected; do not stop it)
#   - Does NOT start/chase *.trycloudflare.com quick tunnels
#   - Only PATCHes Edge Config if backendUrl is missing or not the canonical host
#
# VPS install (after Phase B+C):
#   copy to C:\cloudflared\ensure-artillery-health.ps1
#   replace scheduled task Artillery-Ensure-Tunnel action with this script
#   stop/delete PM2 process cloudflared-tunnel (Artillery quick tunnel only)

$ErrorActionPreference = "Stop"
$ArtilleryPort = 4001
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

function Warn-ReelSaverOn4000 {
  try {
    $probe = (Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 5 -Headers @{ Host = "api-artillery.abdelrhmanabdelkhalek.com" }).Content
    if ($probe -match "reelsaverdl") {
      Write-Log "WARN: Host-routed :4000 health looks like ReelSaver (mux misconfigured?)"
    }
  } catch {
    Write-Log "INFO: mux/artillery host probe on :4000 failed"
  }
  try {
    $rs = (Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 5).Content
    if ($rs -match "reelsaverdl") { Write-Log "INFO: ReelSaver reachable via :4000 mux (expected)" }
  } catch { }
}

function Ensure-Mux4000 {
  $muxPid = (& pm2 pid port-4000-mux 2>$null | Out-String).Trim()
  if ($muxPid -match '^\d+$' -and [int]$muxPid -gt 0) { return }
  $muxScript = "C:\cloudflared\port-4000-mux.js"
  if (-not (Test-Path $muxScript)) {
    Write-Log "WARN: $muxScript missing; skipping mux start"
    return
  }
  pm2 start $muxScript --name port-4000-mux | Out-Null
  Write-Log "Started port-4000-mux"
  pm2 save | Out-Null
}

function Ensure-Port4001Artillery {
  try {
    $probe = (Invoke-WebRequest -Uri "http://127.0.0.1:$ArtilleryPort/health" -UseBasicParsing -TimeoutSec 8).Content
    if ($probe -match '"status"\s*:\s*"ok"' -and $probe -notmatch "reelsaverdl") {
      Write-Log "artillery-api healthy on :$ArtilleryPort"
      return
    }
  } catch {
    # nothing listening or unhealthy - start artillery below
  }

  Set-Location "C:\Artillery-ERP\backend-deploy"
  $env:PORT = "$ArtilleryPort"
  $artPid = (& pm2 pid artillery-api 2>$null | Out-String).Trim()
  if ($artPid -match '^\d+$' -and [int]$artPid -gt 0) {
    $healthy = $false
    for ($attempt = 1; $attempt -le 3; $attempt++) {
      try {
        $h = (Invoke-WebRequest -Uri "http://127.0.0.1:$ArtilleryPort/health" -UseBasicParsing -TimeoutSec 8).Content
        if ($h -match '"status"\s*:\s*"ok"' -and $h -notmatch "reelsaverdl") {
          Write-Log "artillery-api healthy on :$ArtilleryPort"
          $healthy = $true
          break
        }
      } catch { }
      if ($attempt -lt 3) { Start-Sleep -Seconds 2 }
    }
    if ($healthy) { return }
    pm2 restart artillery-api --update-env | Out-Null
    Write-Log "Restarted artillery-api (health probe failed after retries)"
  } else {
    pm2 start dist/index.js --name artillery-api --update-env | Out-Null
    Write-Log "Started artillery-api on :$ArtilleryPort"
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
    Write-Log "WARN: could not read Edge Config backendUrl: $($_.Exception.Message) - skipping Edge Config update"
    return
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
  try {
    $patchResp = Invoke-RestMethod -Uri $patchUri -Headers $patchHeaders -Method PATCH -Body $body
    Write-Log "Edge Config upsert status=$($patchResp.status)"
  } catch {
    Write-Log "WARN: Edge Config PATCH failed: $($_.Exception.Message)"
  }
}

Write-Log "=== ensure-artillery-health start ==="
Warn-ReelSaverOn4000
Ensure-Mux4000
Ensure-Port4001Artillery

try {
  $local = (Invoke-WebRequest -Uri "http://127.0.0.1:$ArtilleryPort/health" -UseBasicParsing -TimeoutSec 10).Content
  if ($local -match "reelsaverdl") { throw "localhost:$ArtilleryPort is reelsaverdl-api (wrong port)" }
  if ($local -notmatch '"status"\s*:\s*"ok"') { throw "Artillery /health not ok: $local" }
  Write-Log "Local health OK on :$ArtilleryPort"
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
