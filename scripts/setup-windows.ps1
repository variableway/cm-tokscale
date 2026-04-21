$ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptsDir = Resolve-Path $ScriptsDir
$CurrentPath = [Environment]::GetEnvironmentVariable("PATH", "User")

if ($CurrentPath -notlike "*$ScriptsDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$CurrentPath;$ScriptsDir", "User")
    Write-Host "Added $ScriptsDir to your user PATH." -ForegroundColor Green
    Write-Host "Please restart your terminal for changes to take effect." -ForegroundColor Yellow
} else {
    Write-Host "Scripts directory is already in your PATH." -ForegroundColor Cyan
}

Write-Host "You can now run 'mytoken' from anywhere." -ForegroundColor Green
