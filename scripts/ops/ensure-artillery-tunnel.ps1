# Artillery ERP — ensure Cloudflare quick tunnel is healthy and push its URL into Vercel Edge Config.
# The Next.js middleware reads backendUrl from Edge Config at runtime, so a churned quick-tunnel URL
# propagates globally in seconds with NO redeploy (browser always talks to the same-origin /api-backend proxy).
# VPS path: C:\cloudflared\ensure-artillery-tunnel.ps1
# Secrets (NOT in git): C:\cloudflared\vercel-token.txt  OR  VERCEL_TOKEN= in C:\Temp\artillery-db-secrets.txt
# State file: C:\cloudflared\current-api-url.txt

$ErrorActionPreference = "Stop"
$LogFile = "C:\cloudflared\ensure-artillery-tunnel.log"
$StateFile = "C:\cloudflared\current-api-url.txt"
$TunnelLog = "C:\cloudflared\artillery-tunnel.log"
$QuickYml = "C:\cloudflared\artillery-quick.yml"
$Cloudflared = "C:\cloudflared\cloudflared.exe"
$TokenFile = "C:\cloudflared\vercel-token.txt"
$SecretsFile = "C:\Temp\artillery-db-secrets.txt"
$ProjectDir = "C:\Artillery-ERP"
$TeamId = "team_2IFtuuXSEcZGzUhW1VNyM0JE"
$ProjectId = "prj_B5KuC4O8W2uy16VJD8LvktKdjDJc"
$ProjectName = "artillery-erp-vps"
$EdgeConfigId = "ecfg_npkgxlllddf0eccn27fd7gx8pqbp"

function Write-Log([string]$msg) {
  $line = "$(Get-Date -Format o) $msg"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-VercelToken {
  if (Test-Path $TokenFile) {
    return (Get-Content $TokenFile -Raw).Trim()
  }
  if (Test-Path $SecretsFile) {
    $line = Get-Content $SecretsFile | Where-Object { $_ -match '^\s*VERCEL_TOKEN\s*=' } | Select-Object -First 1
    if ($line) { return ($line -replace '^\s*VERCEL_TOKEN\s*=\s*', '').Trim() }
  }
  return $null
}

function Ensure-QuickConfig {
  $expected = "url: http://localhost:4000"
  $current = ""
  if (Test-Path $QuickYml) { $current = (Get-Content $QuickYml -Raw).Trim() }
  if ($current -ne $expected) {
    Set-Content -Path $QuickYml -Value $expected -Encoding ASCII
    Write-Log "Wrote isolated artillery-quick.yml (localhost:4000 only)"
  }
}

function Ensure-Pm2Tunnel {
  # Prefer pid check; avoid fragile pm2 show table parsing and broken pm2 jlist JSON.
  $pidOut = (& pm2 pid cloudflared-tunnel 2>$null | Out-String).Trim()
  $ok = $pidOut -match '^\d+$' -and [int]$pidOut -gt 0
  if (-not $ok) {
    Write-Log "cloudflared-tunnel missing/offline (pid='$pidOut') - starting"
    Recreate-Tunnel
  }
}

function Get-TunnelUrlFromLog {
  if (-not (Test-Path $TunnelLog)) { return $null }
  $hits = Select-String -Path $TunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches
  if (-not $hits) { return $null }
  return $hits[-1].Matches[-1].Value.Trim()
}

function Test-ApiHealth([string]$url) {
  try {
    $r = Invoke-WebRequest -Uri ($url + "/health") -UseBasicParsing -TimeoutSec 20
    return ($r.StatusCode -eq 200 -and $r.Content -match '"status"\s*:\s*"ok"')
  } catch {
    return $false
  }
}

function Recreate-Tunnel {
  Write-Log "Recreating cloudflared-tunnel for a fresh quick URL"
  & pm2 delete cloudflared-tunnel 2>$null | Out-Null
  if (Test-Path $TunnelLog) { Remove-Item $TunnelLog -Force -ErrorAction SilentlyContinue }
  Ensure-QuickConfig
  # Dedicated cmd wrapper avoids PowerShell/PM2 arg mangling for --config.
  $starter = "C:\cloudflared\start-artillery-tunnel.cmd"
  if (-not (Test-Path $starter)) {
    @(
      "@echo off",
      "echo url: http://localhost:4000> C:\cloudflared\artillery-quick.yml",
      "if exist C:\cloudflared\artillery-tunnel.log del /Q C:\cloudflared\artillery-tunnel.log",
      "pm2 start C:\cloudflared\cloudflared.exe --name cloudflared-tunnel -- tunnel --config C:\cloudflared\artillery-quick.yml --logfile C:\cloudflared\artillery-tunnel.log --loglevel info",
      "pm2 save"
    ) | Set-Content -Path $starter -Encoding ASCII
  }
  cmd /c $starter | Out-Null
  Start-Sleep -Seconds 12
}

function Update-EdgeConfigBackendUrl([string]$newUrl, [string]$token) {
  # Push the new backend host into Vercel Edge Config. The Next.js middleware reads
  # this at runtime, so the change propagates globally in seconds — no redeploy.
  $headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  }
  $body = @{
    items = @(@{ operation = "upsert"; key = "backendUrl"; value = $newUrl })
  } | ConvertTo-Json -Depth 5

  $uri = "https://api.vercel.com/v1/edge-config/$EdgeConfigId/items?teamId=$TeamId"
  $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method PATCH -Body $body
  Write-Log "Edge Config backendUrl -> $newUrl (status=$($resp.status); no redeploy needed)"
}

Write-Log "=== ensure-artillery-tunnel start ==="
Ensure-QuickConfig
Ensure-Pm2Tunnel

$url = Get-TunnelUrlFromLog
if (-not $url -or -not (Test-ApiHealth $url)) {
  Write-Log "Current tunnel URL unhealthy or missing (url=$url) - recreating"
  Recreate-Tunnel
  $url = Get-TunnelUrlFromLog
  if (-not $url) { throw "No trycloudflare URL found in log after recreate" }
  if (-not (Test-ApiHealth $url)) { throw "Health check failed for $url" }
}

Write-Log "Healthy tunnel URL: $url"

$known = $null
if (Test-Path $StateFile) { $known = (Get-Content $StateFile -Raw).Trim() }

if ($known -eq $url) {
  Write-Log "URL unchanged vs state file - no Vercel update needed"
  Write-Log "=== ensure-artillery-tunnel done ==="
  exit 0
}

$token = Get-VercelToken
if (-not $token) {
  Write-Log "ERROR: Vercel token missing. Put it in $TokenFile or VERCEL_TOKEN= in $SecretsFile"
  Set-Content -Path $StateFile -Value $url -Encoding ASCII
  Write-Log "Saved state file anyway; manual Vercel update still required"
  exit 2
}

Write-Log "URL changed ($known -> $url) - updating Edge Config backendUrl (no redeploy)"
Update-EdgeConfigBackendUrl -newUrl $url -token $token
Set-Content -Path $StateFile -Value $url -Encoding ASCII
Write-Log "State updated"
Write-Log "=== ensure-artillery-tunnel done ==="
exit 0
