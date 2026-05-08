param(
  [string]$TaskName = "BasicJobSearch",
  [string]$WorkingDirectory = (Resolve-Path "$PSScriptRoot\..").Path
)

$scriptPath = Join-Path $WorkingDirectory "scripts\run-job-search.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force
Write-Output "Scheduled task '$TaskName' registered."
