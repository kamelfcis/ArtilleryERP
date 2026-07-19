<#
.SYNOPSIS
  Register (or remove) the 10-minute Artillery ERP mirror scheduled task on the VPS.

.DESCRIPTION
  Creates Windows Scheduled Task Artillery-DeltaSync-Mirror that runs
  run-mirror.ps1 every 10 minutes unattended (whether a user is logged on or not)
  as SYSTEM at highest privileges.

  The mirror job is a full one-way sync (INSERT + UPDATE + DELETE VPS-only rows).
  It calls run-reconcile-nightly.ps1 -SkipBackup each run. On register, the nightly
  purge reconcile task (Artillery-DeltaSync-Nightly) is DISABLED because the mirror
  now includes purge on every 10-minute run.

  Uses schtasks.exe + a generated task XML (same pattern as register-tasks.ps1).

.PARAMETER IntervalMinutes
  Recurrence interval in minutes. Default: 10.

.PARAMETER Unregister
  Remove the mirror task instead of creating it. Does not re-enable the nightly task.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File register-mirror-task.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File register-mirror-task.ps1 -Unregister
#>
[CmdletBinding()]
param(
  [string] $TaskName           = 'Artillery-DeltaSync-Mirror',
  [string] $NightlyTaskName    = 'Artillery-DeltaSync-Nightly',
  [int]    $IntervalMinutes    = 10,
  [string] $ScriptPath,
  [switch] $Unregister,
  [switch] $KeepNightlyEnabled
)

$ErrorActionPreference = 'Stop'

if ($Unregister) {
  & schtasks.exe /delete /tn $TaskName /f 2>$null
  Write-Host "Removed scheduled task '$TaskName' (exit $LASTEXITCODE)."
  return
}

if ($IntervalMinutes -lt 1 -or $IntervalMinutes -gt 1439) {
  throw "IntervalMinutes must be between 1 and 1439 (got $IntervalMinutes)."
}

# Resolve run-mirror.ps1 next to this script.
if (-not $ScriptPath) {
  $here = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { (Get-Location).Path }
  $ScriptPath = Join-Path $here 'run-mirror.ps1'
}
if (-not (Test-Path $ScriptPath)) { throw "run-mirror.ps1 not found at $ScriptPath" }
$ScriptPath = (Resolve-Path $ScriptPath).Path
$workDir = Split-Path -Parent $ScriptPath

$taskArgs = "-NoProfile -ExecutionPolicy Bypass -NonInteractive -File `"$ScriptPath`""
$desc = "Artillery ERP: every-${IntervalMinutes}m Supabase->VPS full sync " +
        "(INSERT/UPDATE/DELETE VPS-only; no pg_dump). Disable before final cutover freeze."

# ISO-8601 duration for repetition interval (e.g. PT10M).
$repInterval = "PT${IntervalMinutes}M"

# S-1-5-18 = LocalSystem: runs whether logged on or not, no stored password.
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>$desc</Description>
  </RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <Repetition>
        <Interval>$repInterval</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>2020-01-01T00:00:00</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
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
    <ExecutionTimeLimit>PT45M</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT10M</Interval>
      <Count>1</Count>
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

$xmlFile = Join-Path $env:TEMP "artillery-mirror-task.xml"
Set-Content -Path $xmlFile -Value $xml -Encoding Unicode

& schtasks.exe /create /tn $TaskName /xml $xmlFile /f
$rc = $LASTEXITCODE
Remove-Item $xmlFile -Force -ErrorAction SilentlyContinue
if ($rc -ne 0) { throw "schtasks /create failed (exit $rc)." }

Write-Host "Registered '$TaskName' every $IntervalMinutes minute(s)."
Write-Host "Script: $ScriptPath"
Write-Host ''

# Disable nightly purge reconcile while the 10-min mirror is active.
if (-not $KeepNightlyEnabled) {
  $nightlyQuery = & schtasks.exe /query /tn $NightlyTaskName 2>&1
  if ($LASTEXITCODE -eq 0) {
    & schtasks.exe /change /tn $NightlyTaskName /disable
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Disabled nightly purge task '$NightlyTaskName' (re-enable for a final equality pass if needed)."
    }
    else {
      Write-Warning "Could not disable '$NightlyTaskName' (exit $LASTEXITCODE). Disable manually before overnight."
    }
  }
  else {
    Write-Host "Nightly task '$NightlyTaskName' not found (nothing to disable)."
  }
  Write-Host ''
}

& schtasks.exe /query /tn $TaskName /v /fo LIST |
  Select-String -Pattern 'TaskName:|Next Run Time:|Status:|Schedule Type:|Start Time:|Repeat:|Run As User:|Task To Run:|Last Run Time:|Last Result:|Repeat Every:'
