param(
    [switch]$Yes
)

# ============================================================
#  记事本 - 在桌面创建快捷方式（Windows）
#  由 创建桌面快捷方式.bat 调用；也可直接：
#    powershell -NoProfile -ExecutionPolicy Bypass -File 创建桌面快捷方式.ps1
# ============================================================

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$APP_NAME  = '记事本'
$HTML_NAME = '电子记事本.html'

$dir = $PSScriptRoot
if ([string]::IsNullOrEmpty($dir)) { $dir = (Get-Location).Path }
$dir = (Resolve-Path -LiteralPath $dir).Path
$html = Join-Path $dir $HTML_NAME

Write-Host '=============================='
Write-Host "  $APP_NAME - 创建桌面快捷方式"
Write-Host '=============================='
Write-Host ''

if (-not (Test-Path -LiteralPath $html -PathType Leaf)) {
    Write-Host "[错误] 未找到主文件 $HTML_NAME" -ForegroundColor Red
    Write-Host "请把本文件与 $HTML_NAME 放在同一目录下。"
    Write-Host "当前目录：$dir"
    if (-not $Yes) { Read-Host '按回车键退出' | Out-Null }
    exit 1
}

$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop)) { $desktop = Join-Path $env:USERPROFILE 'Desktop' }
if (-not (Test-Path -LiteralPath $desktop -PathType Container)) {
    New-Item -ItemType Directory -Path $desktop -Force | Out-Null
}

$lnkPath = Join-Path $desktop "$APP_NAME.lnk"
try {
    $ws = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut($lnkPath)
    $lnk.TargetPath = $html
    $lnk.WorkingDirectory = $dir
    $lnk.Description = "$APP_NAME（浏览器打开）"
    $icon = Join-Path $dir 'data\logo.ico'
    if (Test-Path -LiteralPath $icon -PathType Leaf) { $lnk.IconLocation = "$icon,0" }
    $lnk.WindowStyle = 1
    $lnk.Save()
} catch {
    Write-Host "[错误] 创建快捷方式失败：$($_.Exception.Message)" -ForegroundColor Red
    if (-not $Yes) { Read-Host '按回车键退出' | Out-Null }
    exit 1
}

Write-Host "已创建桌面快捷方式：" -NoNewline
Write-Host $lnkPath -ForegroundColor Green
Write-Host ''
Write-Host "完成。双击桌面「$APP_NAME」图标即可使用。" -ForegroundColor Green
Write-Host ''
Write-Host '卸载：删除桌面上的「记事本」图标即可（不影响程序与数据）。'
if (-not $Yes) { Read-Host '按回车键退出' | Out-Null }
exit 0
