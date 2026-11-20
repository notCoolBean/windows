@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"

rem Create a desktop shortcut for this program folder (self-contained).
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0创建桌面快捷方式.ps1" %*
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo Failed with code %RC%.
  pause
)
endlocal
exit /b %RC%
