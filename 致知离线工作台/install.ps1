$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (![Environment]::Is64BitOperatingSystem) { throw '此包需要 64 位 Windows。' }
Write-Host '正在核对离线程序与模型文件…'
foreach ($line in Get-Content -LiteralPath 'SHA256SUMS.txt' -Encoding UTF8) {
    $expected,$relative = $line -split '  ',2
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot $relative)).Hash -ne $expected) { throw "校验失败，请重新解压：$relative" }
}
function CanRunEngine {
    try {
        $p = Start-Process (Join-Path $PSScriptRoot 'runtime\llama-server.exe') -ArgumentList '--version' -Wait -PassThru -WindowStyle Hidden
        return ($p.ExitCode -eq 0)
    } catch { return $false }
}
if (!(CanRunEngine)) {
    $p = Start-Process (Join-Path $PSScriptRoot 'runtime\VC_redist.x64.exe') -ArgumentList '/install','/passive','/norestart' -Wait -PassThru
    if ($p.ExitCode -eq 3010) { Write-Host '请重启 Windows 后重新运行 Install.cmd。'; exit 0 }
    if (!(CanRunEngine)) { throw '推理引擎启动失败。请检查系统版本、处理器及微软运行库。' }
}
$dir = [Environment]::GetFolderPath('DesktopDirectory')
$link = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $dir '致知离线工作台.lnk'))
$link.TargetPath = Join-Path $PSScriptRoot 'Start.cmd'
$link.IconLocation = Join-Path $PSScriptRoot '应用\办公助手\图标\办公助手.ico'
$link.WorkingDirectory = $PSScriptRoot
$link.Save()
Write-Host '已安装。请保留当前目录，双击桌面「致知离线工作台」启动。'
