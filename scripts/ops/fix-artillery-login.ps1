# One-shot VPS recovery: free port 4000, start artillery-api, sync tunnel to Edge Config.
$ErrorActionPreference = "Stop"
$Log = "C:\cloudflared\fix-artillery-login.log"

function Log([string]$msg) {
  $line = "$(Get-Date -Format o) $msg"
  Add-Content -Path $Log -Value $line -Encoding UTF8
  Write-Host $line
}

Log "=== fix-artillery-login start ==="

# Move reelsaverdl off reserved port 4000
$envFile = "C:\ProgramData\reelsaverdl\api.env"
if (Test-Path $envFile) {
  $content = Get-Content $envFile -Raw
  if ($content -match "PORT=4000") {
    Set-Content -Path $envFile -Value ($content -replace "PORT=4000", "PORT=4002") -Encoding ASCII -NoNewline
    Log "Updated reelsaverdl PORT=4002"
  }
}

# Kill whatever owns :4000
$conn = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  $procId = $conn.OwningProcess
  Log "Stopping PID $procId on port 4000"
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

# Start artillery-api
Set-Location "C:\Artillery-ERP\backend-deploy"
$pidOut = (& pm2 pid artillery-api 2>$null | Out-String).Trim()
if ($pidOut -match "^\d+$" -and [int]$pidOut -gt 0) {
  pm2 restart artillery-api | Out-Null
  Log "Restarted artillery-api"
} else {
  pm2 start dist/index.js --name artillery-api | Out-Null
  Log "Started artillery-api"
}
Start-Sleep -Seconds 3

$health = (Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 15).Content
if ($health -match "reelsaverdl") { throw "Port 4000 still reelsaverdl-api" }
if ($health -notmatch '"status"\s*:\s*"ok"') { throw "Artillery /health failed: $($health.Substring(0, [Math]::Min(180, $health.Length)))" }
Log "Artillery local health OK"

# Restart reelsaverdl on 4002
if (Test-Path "C:\ReelSaverDL\start-reelsaverdl-api.bat") {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c C:\ReelSaverDL\start-reelsaverdl-api.bat" -WindowStyle Hidden
  Log "Restarted reelsaverdl on 4002"
}

# Tunnel + Edge Config sync
cmd /c "C:\cloudflared\ensure-artillery-tunnel.cmd"
pm2 save | Out-Null
Log "=== fix-artillery-login done ==="
pm2 list
