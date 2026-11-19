$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$py = Join-Path $PSScriptRoot '应用\办公助手\python\python.exe'
& $py -B (Join-Path $PSScriptRoot 'suite.py')
exit $LASTEXITCODE
