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
    if ($r.StatusCode -ne 200) { return $false }
    $body = $r.Content
    # Refuse to treat a foreign process on :4000 as healthy (prevents Edge Config pointing at the wrong API).
    if ($body -match 'reelsaverdl') {
      Write-Log "ERROR: /health looks like reelsaverdl-api (not Artillery). Refusing to update Edge Config. Port 4000 is reserved for artillery-api."
      return $false
    }
    # Artillery-shaped: {"status":"ok",...,"database":"connected"} (or at least status ok without foreign service markers)
    if ($body -match '"status"\s*:\s*"ok"' -and ($body -match '"database"' -or $body -notmatch '"service"\s*:')) {
      return $true
    }
    Write-Log "ERROR: /health is not Artillery-shaped: $($body.Substring(0, [Math]::Min(180, $body.Length)))"
    return $false
  } catch {
    return $false
  }
}

function Recreate-Tunnel {
  Write-Log "Recreating cloudflared-tunnel for a fresh quick URL"
  # pm2 delete throws NativeCommandError when the process is already gone; do not abort recreate.
  try { & pm2 delete cloudflared-tunnel 2>$null | Out-Null } catch { }
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

function Ensure-Port4000Artillery {
  # ReelSaverDL runs as Windows service ReelSaverDL-API and can respawn on :4000 even when
  # api.env says PORT=4002. Reclaim the port before health checks / Edge Config sync.
  $looksLikeReelsaver = $false
  try {
    $probe = (Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 8).Content
    $looksLikeReelsaver = $probe -match "reelsaverdl"
  } catch {
    return
  }
  if (-not $looksLikeReelsaver) { return }

  Write-Log "WARN: Port 4000 is reelsaverdl-api — stopping service and reclaiming for artillery-api"
  & sc.exe stop ReelSaverDL-API 2>$null | Out-Null
  & sc.exe config ReelSaverDL-API start= disabled 2>$null | Out-Null
  schtasks /Change /TN \ReelSaverDL-API /DISABLE 2>$null | Out-Null

  $envFile = "C:\ProgramData\reelsaverdl\api.env"
  if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    if ($content -match "PORT=4000") {
      Set-Content -Path $envFile -Value ($content -replace "PORT=4000", "PORT=4002") -Encoding ASCII -NoNewline
      Write-Log "Updated reelsaverdl PORT=4002 in api.env"
    }
  }

  $artPid = (& pm2 pid artillery-api 2>$null | Out-String).Trim()
  Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    if ($artPid -notmatch "^\d+$" -or $_.OwningProcess -ne [int]$artPid) {
      Write-Log "Stopping PID $($_.OwningProcess) listening on port 4000"
      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }

  Set-Location "C:\Artillery-ERP\backend-deploy"
  if ($artPid -match "^\d+$" -and [int]$artPid -gt 0) {
    pm2 restart artillery-api | Out-Null
  } else {
    pm2 start dist/index.js --name artillery-api | Out-Null
  }
  Start-Sleep -Seconds 3
  pm2 save | Out-Null
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
Ensure-Port4000Artillery
Ensure-Pm2Tunnel

# Guard: never push Edge Config while localhost:4000 is the wrong process.
try {
  $localHealth = (Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 8).Content
  if ($localHealth -match 'reelsaverdl') {
    throw "localhost:4000 is reelsaverdl-api. Port 4000 is reserved for artillery-api; move reelsaverdl (e.g. PORT=4002) before syncing Edge Config."
  }
  if ($localHealth -notmatch '"status"\s*:\s*"ok"') {
    throw "localhost:4000 /health is not Artillery-shaped: $($localHealth.Substring(0, [Math]::Min(180, $localHealth.Length)))"
  }
} catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  throw
}

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
