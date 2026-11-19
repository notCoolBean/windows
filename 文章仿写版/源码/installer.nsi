Unicode true
!include MUI2.nsh
!include x64.nsh
Name "致知文章仿写"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\ZhizhiWriter"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "Writer.ico"
!define KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZhizhiWriter"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "请在 64 位 Windows 上安装。"
    Abort
  ${EndIf}
FunctionEnd

Section
  SetOutPath "$INSTDIR"
  File /r /x .DS_Store "${PAYLOAD}/*"
  nsExec::ExecToLog '"$INSTDIR\runtime\llama-server.exe" --version'
  Pop $0
  ${If} $0 != 0
    ClearErrors
    ExecShellWait "runas" "$INSTDIR\runtime\VC_redist.x64.exe" "/install /quiet /norestart" SW_SHOW $0
    nsExec::ExecToLog '"$INSTDIR\runtime\llama-server.exe" --version'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_ICONSTOP "推理运行库未能启动。请安装随附的 VC++ 运行库后重新安装。" /SD IDOK
      SetErrorLevel 1
      Abort
    ${EndIf}
  ${EndIf}
  CreateShortCut "$DESKTOP\致知文章仿写.lnk" "$INSTDIR\python\python.exe" '-B "$INSTDIR\writer.py"' "$INSTDIR\Writer.ico"
  CreateShortCut "$SMPROGRAMS\致知文章仿写.lnk" "$INSTDIR\python\python.exe" '-B "$INSTDIR\writer.py"' "$INSTDIR\Writer.ico"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${KEY}" "DisplayName" "致知文章仿写"
  WriteRegStr HKCU "${KEY}" "DisplayVersion" "1.2.0"
  WriteRegStr HKCU "${KEY}" "DisplayIcon" "$INSTDIR\Writer.ico"
  WriteRegStr HKCU "${KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\致知文章仿写.lnk"
  Delete "$SMPROGRAMS\致知文章仿写.lnk"
  DeleteRegKey HKCU "${KEY}"
  Delete "$INSTDIR\writer.py"
  Delete "$INSTDIR\rag.py"
  Delete "$INSTDIR\Writer.ico"
  RMDir /r "$INSTDIR\web"
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\python"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
