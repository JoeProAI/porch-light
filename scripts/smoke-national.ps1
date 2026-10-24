$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$python = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } else { "python" }
& $python (Join-Path $PSScriptRoot "smoke-national.py")
exit $LASTEXITCODE
