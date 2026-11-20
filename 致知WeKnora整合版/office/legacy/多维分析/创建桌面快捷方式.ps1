param([switch]$Yes)

# ============================================================
#  多维分析 - 创建桌面快捷方式（Windows）
#  单独使用：双击「创建桌面快捷方式.bat」，或
#      powershell -NoProfile -ExecutionPolicy Bypass -File 创建桌面快捷方式.ps1
#  本脚本自带全部逻辑，不依赖 install.ps1，可随程序目录一起复制。
# ============================================================

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$APP_NAME  = '多维分析'
$HTML_NAME = '多维分析.html'

$dir = $PSScriptRoot
if ([string]::IsNullOrEmpty($dir)) { $dir = Split-Path -Parent $MyInvocation.MyCommand.Definition }
if ([string]::IsNullOrEmpty($dir)) { $dir = (Get-Location).Path }

function Say([string]$msg) { Write-Host $msg }
function Finish([int]$code) {
    if (-not $Yes) { Read-Host '按回车键退出' | Out-Null }
    exit $code
}

$progDir = $null
foreach ($cand in @($dir, (Split-Path -Parent $dir), (Join-Path (Split-Path -Parent $dir) $APP_NAME))) {
    if ([string]::IsNullOrEmpty($cand)) { continue }
    if (Test-Path -LiteralPath (Join-Path $cand $HTML_NAME) -PathType Leaf) { $progDir = $cand; break }
}
if (-not $progDir) {
    Say "未找到 $HTML_NAME。"
    Say '请把本脚本放在程序目录里再运行（与本程序的主页面同一个文件夹）。'
    Finish 1
}

$html = Join-Path $progDir $HTML_NAME
$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop)) { $desktop = Join-Path $env:USERPROFILE 'Desktop' }
if (-not (Test-Path -LiteralPath $desktop -PathType Container)) {
    New-Item -ItemType Directory -Path $desktop -Force | Out-Null
}

$lnkPath = Join-Path $desktop ("$APP_NAME.lnk")
try {
    $ws = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut($lnkPath)
    $lnk.TargetPath = $html
    $lnk.WorkingDirectory = $progDir
    $lnk.Description = "$APP_NAME（浏览器打开）"
    $icon = Join-Path $progDir '图标\logo.ico'
    if (Test-Path -LiteralPath $icon -PathType Leaf) { $lnk.IconLocation = "$icon,0" }
    $lnk.WindowStyle = 1
    $lnk.Save()
} catch {
    Say "创建桌面快捷方式失败：$($_.Exception.Message)"
    Finish 1
}

Say "程序目录：$progDir"
Say "已创建：$lnkPath"
Write-Host ''
Write-Host '完成。双击桌面「多维分析」图标即可使用。' -ForegroundColor Green
Finish 0
