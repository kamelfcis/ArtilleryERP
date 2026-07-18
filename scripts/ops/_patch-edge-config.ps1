$ErrorActionPreference = "Stop"
$TokenFile = "C:\cloudflared\vercel-token.txt"
$SecretsFile = "C:\Temp\artillery-db-secrets.txt"
$TeamId = "team_2IFtuuXSEcZGzUhW1VNyM0JE"
$EdgeConfigId = "ecfg_npkgxlllddf0eccn27fd7gx8pqbp"
$Canonical = "https://api-artillery.abdelrhmanabdelkhalek.com"

$token = $null
if (Test-Path $TokenFile) { $token = (Get-Content $TokenFile -Raw).Trim() }
if (-not $token -and (Test-Path $SecretsFile)) {
  $line = Get-Content $SecretsFile | Where-Object { $_ -match '^\s*VERCEL_TOKEN\s*=' } | Select-Object -First 1
  if ($line) { $token = ($line -replace '^\s*VERCEL_TOKEN\s*=\s*', '').Trim() }
}
if (-not $token) { throw "Vercel token not found" }

$headers = @{ Authorization = "Bearer $token" }
$getUri = "https://api.vercel.com/v1/edge-config/$EdgeConfigId/item/backendUrl?teamId=$TeamId"
$current = [string](Invoke-RestMethod -Uri $getUri -Headers $headers -Method GET).value
Write-Host "current=$current"
if ($current -eq $Canonical) {
  Write-Host "already canonical"
  exit 0
}

$body = @{ items = @(@{ operation = "upsert"; key = "backendUrl"; value = $Canonical }) } | ConvertTo-Json -Depth 5
$patchUri = "https://api.vercel.com/v1/edge-config/$EdgeConfigId/items?teamId=$TeamId"
$patchHeaders = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$resp = Invoke-RestMethod -Uri $patchUri -Headers $patchHeaders -Method PATCH -Body $body
Write-Host "patch status=$($resp.status)"
