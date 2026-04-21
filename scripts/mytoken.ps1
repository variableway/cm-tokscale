$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CliPath = Join-Path (Resolve-Path "$ScriptDir\..") "packages\cli\src\cli.ts"

$StartTime = Get-Date
& bun $CliPath @args
$ExitCode = $LASTEXITCODE
$EndTime = Get-Date
$Duration = [math]::Round(($EndTime - $StartTime).TotalMilliseconds)

Write-Host ""
Write-Host "Done in ${Duration}ms"

exit $ExitCode
