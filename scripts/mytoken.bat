@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "CLI_PATH=%SCRIPT_DIR%..\packages\cli\src\cli.ts"

bun "%CLI_PATH%" %*

endlocal
