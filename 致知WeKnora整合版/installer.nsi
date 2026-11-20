Unicode true
!include MUI2.nsh
!include x64.nsh
Name "致知知识工作台"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\ZhizhiWeKnora"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!define KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZhizhiWeKnora"
!define MUI_ICON "${PAYLOAD}/Zhizhi.ico"
!define MUI_UNICON "${PAYLOAD}/Zhizhi.ico"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "请在 64 位 Windows 10/11 上安装。"
    Abort
  ${EndIf}
FunctionEnd
Function CheckWebView
  SetRegView 32
  ReadRegStr $1 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $1 == "0.0.0.0"
    StrCpy $1 ""
  ${EndIf}
  ${If} $1 == ""
    ReadRegStr $1 HKLM "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $1 == "0.0.0.0"
    StrCpy $1 ""
  ${EndIf}
FunctionEnd
Section
  ; Reserve space for the external model payload as well as embedded files.
  AddSize 1750000
  IfFileExists "$EXEDIR\bundled-models\manifest.json" 0 missing_models
  IfFileExists "$EXEDIR\bundled-models\MiniCPM-V-4_7-1B-Q4_K_M.gguf" 0 missing_models
  IfFileExists "$EXEDIR\bundled-models\mmproj-model-f16.gguf" models_ready missing_models
  missing_models:
    MessageBox MB_ICONSTOP "请先解压独立的 MiniCPM-V 4.7 1B 模型包，保持 bundled-models 文件夹与安装器在同一目录，再运行安装器。" /SD IDOK
    SetErrorLevel 1
    Abort
  models_ready:
  SetOutPath "$INSTDIR"
  File /r /x .DS_Store "${PAYLOAD}/*"
  CreateDirectory "$INSTDIR\bundled-models"
  ClearErrors
  CopyFiles /SILENT "$EXEDIR\bundled-models\*.*" "$INSTDIR\bundled-models"
  IfErrors 0 models_copied
    MessageBox MB_ICONSTOP "模型复制失败，请检查可用磁盘空间后重试。" /SD IDOK
    SetErrorLevel 1
    Abort
  models_copied:
  Call CheckWebView
  ${If} $1 == ""
    ExecWait '"$INSTDIR\runtime\MicrosoftEdgeWebView2RuntimeInstallerX64.exe" /silent /install' $0
    Call CheckWebView
    ${If} $1 == ""
      MessageBox MB_ICONSTOP "WebView2 运行时未能安装，请运行安装目录 runtime 中的离线安装器后重试。" /SD IDOK
      SetErrorLevel 1
      Abort
    ${EndIf}
  ${EndIf}
  nsExec::ExecToLog '"$INSTDIR\runtime\llama-server.exe" --version'
  Pop $0
  ${If} $0 != 0
    ExecShellWait "runas" "$INSTDIR\runtime\VC_redist.x64.exe" "/install /quiet /norestart" SW_SHOW $0
    nsExec::ExecToLog '"$INSTDIR\runtime\llama-server.exe" --version'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_ICONSTOP "模型运行库未能启动，请安装 runtime 中的 VC++ 运行库后重试。" /SD IDOK
      SetErrorLevel 1
      Abort
    ${EndIf}
  ${EndIf}
  CreateShortCut "$DESKTOP\致知知识工作台.lnk" "$INSTDIR\Zhizhi.exe" "" "$INSTDIR\Zhizhi.ico"
  CreateShortCut "$SMPROGRAMS\致知知识工作台.lnk" "$INSTDIR\Zhizhi.exe" "" "$INSTDIR\Zhizhi.ico"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${KEY}" "DisplayName" "致知知识工作台"
  WriteRegStr HKCU "${KEY}" "DisplayVersion" "0.2.0"
  WriteRegStr HKCU "${KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
SectionEnd
Section "Uninstall"
  Delete "$DESKTOP\致知知识工作台.lnk"
  Delete "$SMPROGRAMS\致知知识工作台.lnk"
  DeleteRegKey HKCU "${KEY}"
  Delete "$INSTDIR\Zhizhi.exe"
  Delete "$INSTDIR\Zhizhi.ico"
  Delete "$INSTDIR\.env.lite"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\THIRD_PARTY_NOTICES.md"
  RMDir /r "$INSTDIR\web"
  RMDir /r "$INSTDIR\config"
  RMDir /r "$INSTDIR\dict"
  RMDir /r "$INSTDIR\migrations"
  RMDir /r "$INSTDIR\licenses"
  RMDir /r "$INSTDIR\office"
  RMDir /r "$INSTDIR\python"
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\bundled-models"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
