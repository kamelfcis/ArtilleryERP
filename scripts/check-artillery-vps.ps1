# Artillery ERP — VPS health check + optional auto-fix
# Run on the VPS (RDP as Administrator):
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Artillery-ERP\scripts\check-artillery-vps.ps1"
# Optional fix (restart PM2, run ensure-artillery-health):
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Artillery-ERP\scripts\check-artillery-vps.ps1" -Fix
#
# Port layout: :4000 mux (ReelSaver default / Artillery via Host), Artillery :4001, ReelSaver internal :4002

param(
  [switch]$Fix
)

$ErrorActionPreference = "Continue"
$ArtilleryPort = 4001
$CanonicalBackend = "https://api-artillery.abdelrhmanabdelkhalek.com"
$VercelProxy = "https://artillery-erp-vps.vercel.app/api-backend"
$DeployDir = "C:\Artillery-ERP\backend-deploy"
$EnsureScript = "C:\cloudflared\ensure-artillery-health.ps1"
$LogFile = "C:\cloudflared\check-artillery-vps.log"

function Write-Log([string]$msg) {
  $line = "$(Get-Date -Format o) $msg"
  Write-Host $line
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch { }
}

function Test-HttpStatus([string]$Url, [string]$Method = "GET") {
  try {
    if ($Method -eq "POST") {
      $r = Invoke-WebRequest -Uri $Url -Method POST -UseBasicParsing -TimeoutSec 15
    } else {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
    }
    return @{ Code = [int]$r.StatusCode; Body = $r.Content.Substring(0, [Math]::Min(120, $r.Content.Length)) }
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if (-not $code) { $code = 0 }
    $body = ""
    try { $body = $_.ErrorDetails.Message } catch { }
    return @{ Code = [int]$code; Body = $body }
  }
}

Write-Log "=== Artillery VPS check (Fix=$Fix) ==="
Write-Log "Hostname: $env:COMPUTERNAME"

# 1) PM2
Write-Log "--- PM2 ---"
try {
  pm2 list
} catch {
  Write-Log "ERROR: pm2 not available — $($_.Exception.Message)"
}

# 2) Local APIs
Write-Log "--- Local :4000 mux (ReelSaver default) ---"
$reelsaver = Test-HttpStatus "http://127.0.0.1:4000/health"
Write-Log "mux_default_health: HTTP $($reelsaver.Code) $($reelsaver.Body)"

Write-Log "--- Local :4000 mux (Artillery Host header) ---"
try {
  $artHost = Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -Headers @{ Host = "api-artillery.abdelrhmanabdelkhalek.com" } -UseBasicParsing -TimeoutSec 10
  Write-Log "mux_artillery_host: HTTP $($artHost.StatusCode) $($artHost.Content.Substring(0, [Math]::Min(120, $artHost.Content.Length)))"
} catch {
  Write-Log "mux_artillery_host: FAIL"
}

Write-Log "--- Local :4002 (ReelSaver internal) ---"
$rsInternal = Test-HttpStatus "http://127.0.0.1:4002/health"
Write-Log "reelsaver_internal: HTTP $($rsInternal.Code) $($rsInternal.Body)"
$local = Test-HttpStatus "http://127.0.0.1:$ArtilleryPort/health"
Write-Log "artillery_health: HTTP $($local.Code) $($local.Body)"

if ($local.Body -match "reelsaverdl") {
  Write-Log "WARN: Port $ArtilleryPort is ReelSaverDL, not Artillery!"
}

# 3) Scheduled tasks
Write-Log "--- Scheduled tasks ---"
foreach ($task in @("Artillery-PM2-Resurrect", "Artillery-Ensure-Tunnel")) {
  try {
    $t = Get-ScheduledTask -TaskName $task -ErrorAction Stop
    Write-Log "$task : $($t.State)"
  } catch {
    Write-Log "$task : MISSING"
  }
}

# 4) Public endpoints
Write-Log "--- Public endpoints ---"
foreach ($item in @(
  @{ N = "tunnel_health"; U = "$CanonicalBackend/health" },
  @{ N = "vercel_health"; U = "$VercelProxy/health" },
  @{ N = "vercel_notifications"; U = "$VercelProxy/notifications?rocketUserId=test" },
  @{ N = "tunnel_notifications"; U = "$CanonicalBackend/notifications?rocketUserId=test" }
)) {
  $r = Test-HttpStatus $item.U
  Write-Log "$($item.N): HTTP $($r.Code) (401=OK without login, 502=backend down)"
}

# 5) Admin route (expect 401 without cookie)
$admin = Test-HttpStatus "$VercelProxy/admin/update-unit-statuses" "POST"
Write-Log "vercel_update_unit_statuses: HTTP $($admin.Code) (401=no session, 403=wrong role, 502=backend down)"

# 6) Optional fix
if ($Fix) {
  Write-Log "--- Fix mode ---"
  if (Test-Path $EnsureScript) {
    Write-Log "Running $EnsureScript"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $EnsureScript
  } elseif (Test-Path $DeployDir) {
    Write-Log "ensure script missing; restarting artillery-api manually"
    Set-Location $DeployDir
    $env:PORT = "$ArtilleryPort"
    $pid = (& pm2 pid artillery-api 2>$null | Out-String).Trim()
    if ($pid -match '^\d+$') { pm2 restart artillery-api --update-env } else { pm2 start dist/index.js --name artillery-api --update-env }
    pm2 save
    Start-Sleep -Seconds 3
  } else {
    Write-Log "ERROR: Neither $EnsureScript nor $DeployDir found"
  }

  $after = Test-HttpStatus "http://127.0.0.1:$ArtilleryPort/health"
  Write-Log "artillery_health after fix: HTTP $($after.Code) $($after.Body)"
}

Write-Log "=== Done ==="
Write-Log "502 on /notifications = artillery-api down or wrong app on :$ArtilleryPort. Run with -Fix or: C:\cloudflared\ensure-artillery-health.cmd"
Write-Log "403 on /admin/update-unit-statuses = logged in but user lacks SuperAdmin or Receptionist role. Re-login after role change."
