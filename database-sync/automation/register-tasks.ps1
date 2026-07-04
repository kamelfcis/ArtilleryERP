<#
.SYNOPSIS
  Register (or remove) the nightly Artillery ERP reconcile scheduled task on the VPS.

.DESCRIPTION
  Creates ONE Windows Scheduled Task with ONE daily trigger that runs
  run-reconcile-nightly.ps1 unattended (whether a user is logged on or not) as
  SYSTEM at highest privileges.

  The reconcile job purges VPS-only rows then delta-syncs from Supabase so both
  databases are equal (Supabase = source of truth).

  Uses schtasks.exe + a generated task XML (rather than the New-ScheduledTask*
  CIM cmdlets) so it works reliably over a non-interactive/remote session.

  IMPORTANT - TIMEZONE: Windows fires triggers at the VPS LOCAL wall-clock time.
  This VPS runs on Pacific time; the operator is UTC+3. The DEFAULT trigger
  time below (06:00 VPS-local) corresponds to the operator's 00:00 (midnight,
  UTC+3) *while Pacific is on PDT (UTC-7)*. When Pacific switches to PST
  (UTC-8, ~early Nov), re-run with -Times '05:00' to re-align to midnight UTC+3.

  On register, the legacy twice-daily safe-sync task (Artillery-DeltaSync-TwiceDaily)
  is removed if present.

.PARAMETER Times
  VPS-local HH:mm trigger time(s). Default: single run at 06:00 (= 00:00 UTC+3 during PDT).

.PARAMETER Unregister
  Remove the nightly task instead of creating it.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File register-tasks.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Times '05:00'
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Unregister
#>
[CmdletBinding()]
param(
  [string]   $TaskName      = 'Artillery-DeltaSync-Nightly',
  [string[]] $Times         = @('06:00'),
  [string]   $ScriptPath,
  [string]   $LegacyTaskName = 'Artillery-DeltaSync-TwiceDaily',
  [switch]   $Unregister
)

$ErrorActionPreference = 'Stop'

if ($Unregister) {
  & schtasks.exe /delete /tn $TaskName /f 2>$null
  Write-Host "Removed scheduled task '$TaskName' (exit $LASTEXITCODE)."
  return
}

# Resolve run-reconcile-nightly.ps1 next to this script.
if (-not $ScriptPath) {
  $here = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { (Get-Location).Path }
  $ScriptPath = Join-Path $here 'run-reconcile-nightly.ps1'
}
if (-not (Test-Path $ScriptPath)) { throw "run-reconcile-nightly.ps1 not found at $ScriptPath" }
$ScriptPath = (Resolve-Path $ScriptPath).Path
$workDir = Split-Path -Parent $ScriptPath

# Remove legacy twice-daily task if it still exists.
$legacyQuery = & schtasks.exe /query /tn $LegacyTaskName 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "Removing legacy task '$LegacyTaskName' ..."
  & schtasks.exe /delete /tn $LegacyTaskName /f
  if ($LASTEXITCODE -ne 0) { Write-Warning "Could not remove legacy task (exit $LASTEXITCODE)." }
}

# Validate + normalize the trigger times to HH:mm:00.
$triggersXml = ''
foreach ($t in $Times) {
  if ($t -notmatch '^\s*([01]?\d|2[0-3]):([0-5]\d)\s*$') { throw "Invalid time '$t' (expected HH:mm, 24h)." }
  $hhmm = ('{0:00}:{1:00}' -f [int]$matches[1], [int]$matches[2])
  $triggersXml += @"
    <CalendarTrigger>
      <StartBoundary>2020-01-01T$hhmm`:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
"@
}

$taskArgs = "-NoProfile -ExecutionPolicy Bypass -NonInteractive -File `"$ScriptPath`""
$desc = "Artillery ERP: nightly Supabase->VPS reconcile (purge VPS-only + delta sync). " +
        "Trigger (VPS-local): $($Times -join ', '). Disable before final cutover freeze."

# S-1-5-18 = LocalSystem: runs whether logged on or not, no stored password.
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>$desc</Description>
  </RegistrationInfo>
  <Triggers>
$triggersXml  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT3H</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT15M</Interval>
      <Count>2</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>$taskArgs</Arguments>
      <WorkingDirectory>$workDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

$xmlFile = Join-Path $env:TEMP "artillery-reconcile-nightly-task.xml"
Set-Content -Path $xmlFile -Value $xml -Encoding Unicode

& schtasks.exe /create /tn $TaskName /xml $xmlFile /f
$rc = $LASTEXITCODE
Remove-Item $xmlFile -Force -ErrorAction SilentlyContinue
if ($rc -ne 0) { throw "schtasks /create failed (exit $rc)." }

Write-Host "Registered '$TaskName' with trigger(s) (VPS-local): $($Times -join ', ')"
Write-Host "Script: $ScriptPath"
Write-Host ''
& schtasks.exe /query /tn $TaskName /v /fo LIST |
  Select-String -Pattern 'TaskName:|Next Run Time:|Status:|Schedule Type:|Start Time:|Run As User:|Task To Run:|Last Run Time:|Last Result:'
