param(
  [switch]$Cached
)

$workspaceRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $workspaceRoot

$command = @("app/run.js")
if ($Cached) {
  $command += "--cached"
}

node @command
if ($LASTEXITCODE -ne 0) {
  throw "Job search batch failed."
}
