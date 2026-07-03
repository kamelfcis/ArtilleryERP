<#
.SYNOPSIS
  Register (or remove) the twice-daily Artillery ERP delta-sync scheduled task
  on the VPS.

.DESCRIPTION
  Creates ONE Windows Scheduled Task with TWO daily triggers that run
  run-sync.ps1 unattended (whether a user is logged on or not) as SYSTEM at
  highest privileges. SYSTEM has read access to the secured secrets + pgpass
  files and full DB rights, so no admin password is stored in the task.

  Uses schtasks.exe + a generated task XML (rather than the New-ScheduledTask*
  CIM cmdlets) so it works reliably over a non-interactive/remote session.

  IMPORTANT - TIMEZONE: Windows fires triggers at the VPS LOCAL wall-clock time.
  This VPS runs on Pacific time; the operator is UTC+3. The DEFAULT trigger
  times below (06:00 and 14:00 VPS-local) correspond to the operator's intended
  16:00 and 00:00 (UTC+3) *while Pacific is on PDT (UTC-7)*. When Pacific
  switches to PST (UTC-8, ~early Nov), the same VPS-local times map to 15:00 /
  23:00 UTC+3 - re-run this script with -Times '05:00','13:00' to re-align, or
  pass whatever VPS-local times you want.

.PARAMETER Times
  VPS-local HH:mm trigger times (default 06:00 and 14:00).

.PARAMETER Unregister
  Remove the task instead of creating it.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File register-tasks.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Times '05:00','13:00'
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Unregister
#>
[CmdletBinding()]
param(
  [string]   $TaskName   = 'Artillery-DeltaSync-TwiceDaily',
  [string[]] $Times      = @('06:00', '14:00'),
  [string]   $ScriptPath,
  [switch]   $Unregister
)

$ErrorActionPreference = 'Stop'

if ($Unregister) {
  & schtasks.exe /delete /tn $TaskName /f
  Write-Host "Removed scheduled task '$TaskName' (exit $LASTEXITCODE)."
  return
}

# Resolve run-sync.ps1 next to this script ($PSScriptRoot is not reliably
# populated inside param defaults on Windows PowerShell 5.1).
if (-not $ScriptPath) {
  $here = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { (Get-Location).Path }
  $ScriptPath = Join-Path $here 'run-sync.ps1'
}
if (-not (Test-Path $ScriptPath)) { throw "run-sync.ps1 not found at $ScriptPath" }
$ScriptPath = (Resolve-Path $ScriptPath).Path
$workDir = Split-Path -Parent $ScriptPath

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
$desc = "Artillery ERP: twice-daily Supabase->VPS delta-sync (compare/backup/generate/apply/verify). " +
        "Triggers (VPS-local): $($Times -join ', '). Disable this before the final cutover freeze."

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
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT10M</Interval>
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

$xmlFile = Join-Path $env:TEMP "artillery-deltasync-task.xml"
# Task Scheduler requires the XML file in Unicode (UTF-16).
Set-Content -Path $xmlFile -Value $xml -Encoding Unicode

& schtasks.exe /create /tn $TaskName /xml $xmlFile /f
$rc = $LASTEXITCODE
Remove-Item $xmlFile -Force -ErrorAction SilentlyContinue
if ($rc -ne 0) { throw "schtasks /create failed (exit $rc)." }

Write-Host "Registered '$TaskName' with triggers (VPS-local): $($Times -join ', ')"
Write-Host ''
& schtasks.exe /query /tn $TaskName /v /fo LIST |
  Select-String -Pattern 'TaskName:|Next Run Time:|Status:|Schedule Type:|Start Time:|Run As User:|Task To Run:|Last Run Time:|Last Result:'
