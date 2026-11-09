; KevCast installer for Windows.
;
; One script builds two installers:
;   KevCast-Setup-<ver>.exe         choose Server, Player and/or Studio (components page)
;   KevCast-Server-Setup-<ver>.exe  server only (compile without PLAYER_DIR / STUDIO_DIR)
;
; makensis -DVERSION=0.2.1 -DOUTFILE=out.exe -DSERVER_DIR=<staged server> [-DPLAYER_DIR=<win-unpacked>] [-DSTUDIO_DIR=<win-unpacked>]
;          -DASSETS=packaging\assets -DSCRIPTS=packaging\windows kevcast-setup.nsi
; (see packaging/windows/build.ps1)

Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel admin

; Compile-time path separator: makensis on Windows needs "\" (wildcards fail with "/"),
; makensis on Linux/macOS (used to check the script) needs "/".
!ifdef NSIS_WIN32_MAKENSIS
  !define S "\"
!else
  !define S "/"
!endif

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "Sections.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifdef PLAYER_DIR | STUDIO_DIR
  !define PRODUCT "KevCast"
!else
  !define PRODUCT "KevCast Server"
!endif
!define PUBLISHER "Kevin B"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\KevCast"

Name "${PRODUCT} ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES64\KevCast"
InstallDirRegKey HKLM "Software\KevCast" "InstallDir"
BrandingText "${PRODUCT} ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${PRODUCT}"
VIAddVersionKey "FileDescription" "${PRODUCT} installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "LegalCopyright" "MIT License"

Var ComputerName
Var FinishText
Var ServerPort

; --------------------------------------------------------------------------
; Pages
; --------------------------------------------------------------------------
!define MUI_ICON "${ASSETS}${S}server.ico"
!define MUI_UNICON "${ASSETS}${S}server.ico"
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC

!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT} ${VERSION}"
!ifdef PLAYER_DIR | STUDIO_DIR
  !define MUI_WELCOMEPAGE_TEXT "KevCast is easy, self-hosted narrowcasting.$\r$\n$\r$\nOn the next page choose what to install on this computer:$\r$\n$\r$\n  • Server – stores your content and schedules (one per organisation)$\r$\n  • Player – shows content full-screen on a TV or monitor$\r$\n  • Studio – desktop app for managing content$\r$\n$\r$\nClick Next to continue."
!else
  !define MUI_WELCOMEPAGE_TEXT "This installs the KevCast Server: it stores your content and schedules, converts PowerPoint files and serves the screens.$\r$\n$\r$\nIt runs in the background and starts automatically with Windows. You manage it from KevCast Web Studio in your browser.$\r$\n$\r$\nClick Next to continue."
!endif
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${SERVER_DIR}${S}app${S}LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_PAGE_CUSTOMFUNCTION_PRE FinishPre
!define MUI_FINISHPAGE_TITLE "${PRODUCT} is installed"
!define MUI_FINISHPAGE_TEXT "$FinishText"
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open KevCast now"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchKevCast
!define MUI_FINISHPAGE_LINK "KevCast documentation"
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/tahtk3v/kevcast/tree/main/docs"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; --------------------------------------------------------------------------
; Sections
; --------------------------------------------------------------------------
SectionGroup /e "KevCast Server" GrpServer

Section "Server" SecServer
!ifndef PLAYER_DIR & STUDIO_DIR
  SectionIn RO
!endif
  SetShellVarContext all
  ; Upgrade: stop a running server first so its files can be replaced.
  ${If} ${FileExists} "$INSTDIR\Server\service.ps1"
    DetailPrint "Stopping the running KevCast Server..."
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Server\service.ps1" -Action stop -ServerDir "$INSTDIR\Server"'
    Pop $1
  ${EndIf}

  SetOutPath "$INSTDIR\Server"
  File /r "${SERVER_DIR}${S}*.*"
  File "${SCRIPTS}${S}service.ps1"
  File "${SCRIPTS}${S}install-libreoffice.ps1"

  DetailPrint "Registering the KevCast Server service and firewall rules..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Server\service.ps1" -Action install -ServerDir "$INSTDIR\Server"'
  Pop $1
  ${If} $1 != 0
    MessageBox MB_ICONEXCLAMATION "The KevCast Server service could not be registered (code $1). See the installation details."
  ${EndIf}

  ; Port chosen by service.ps1 (keeps the port of an earlier installation).
  StrCpy $ServerPort "8080"
  ClearErrors
  FileOpen $2 "$INSTDIR\Server\port.txt" r
  ${IfNot} ${Errors}
    FileRead $2 $ServerPort
    FileClose $2
  ${EndIf}
  ; Strip the line break from the port.
  StrCpy $ServerPort $ServerPort 5
  Push $ServerPort
  Call TrimNewline
  Pop $ServerPort

  ; Shortcuts: KevCast Web Studio (the admin in the browser) on the desktop and in the Start menu,
  ; plus a start page that explains which address browser-based screens should open.
  WriteINIStr "$INSTDIR\Server\KevCast Web Studio.url" "InternetShortcut" "URL" "http://localhost:$ServerPort/admin/"
  WriteINIStr "$INSTDIR\Server\KevCast Web Studio.url" "InternetShortcut" "IconFile" "$INSTDIR\Server\assets\web-studio.ico"
  WriteINIStr "$INSTDIR\Server\KevCast Web Studio.url" "InternetShortcut" "IconIndex" "0"
  WriteINIStr "$INSTDIR\Server\Connect a screen.url" "InternetShortcut" "URL" "http://localhost:$ServerPort/"
  WriteINIStr "$INSTDIR\Server\Connect a screen.url" "InternetShortcut" "IconFile" "$INSTDIR\Server\assets\server.ico"
  WriteINIStr "$INSTDIR\Server\Connect a screen.url" "InternetShortcut" "IconIndex" "0"

  CopyFiles /SILENT "$INSTDIR\Server\KevCast Web Studio.url" "$DESKTOP\KevCast Web Studio.url"
  CreateDirectory "$SMPROGRAMS\KevCast"
  CopyFiles /SILENT "$INSTDIR\Server\KevCast Web Studio.url" "$SMPROGRAMS\KevCast\KevCast Web Studio.url"
  CopyFiles /SILENT "$INSTDIR\Server\Connect a screen.url" "$SMPROGRAMS\KevCast\Connect a screen (browser player address).url"
  CreateShortcut "$SMPROGRAMS\KevCast\KevCast Server log.lnk" "$WINDIR\notepad.exe" '"$APPDATA\KevCast\kevcast.log"'
  CreateShortcut "$SMPROGRAMS\KevCast\KevCast data folder.lnk" "$APPDATA\KevCast"
SectionEnd

Section "LibreOffice (for PowerPoint, downloads ~350 MB)" SecLibre
  ; Only needed once per server; skipped automatically when already installed.
  DetailPrint "Checking LibreOffice..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Server\install-libreoffice.ps1"'
  Pop $1
  ; The server looks for LibreOffice when converting, but restart it so the dashboard is up to date.
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Stop-ScheduledTask -TaskName ''KevCast Server''; Start-ScheduledTask -TaskName ''KevCast Server''"'
  Pop $1
SectionEnd

SectionGroupEnd

!ifdef PLAYER_DIR
Section "KevCast Player (for screens)" SecPlayer
  SetShellVarContext all
  ; Close a running player (it only exits with Alt+Q, so end the process for the upgrade).
  nsExec::Exec 'taskkill /F /IM "KevCast Player.exe"'
  SetOutPath "$INSTDIR\Player"
  File /r "${PLAYER_DIR}${S}*.*"
  CreateDirectory "$SMPROGRAMS\KevCast"
  CreateShortcut "$SMPROGRAMS\KevCast\KevCast Player.lnk" "$INSTDIR\Player\KevCast Player.exe"
  CreateShortcut "$DESKTOP\KevCast Player.lnk" "$INSTDIR\Player\KevCast Player.exe"
  ; Start at sign-in for every user of this screen computer.
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "KevCast Player" '"$INSTDIR\Player\KevCast Player.exe"'
SectionEnd
!endif

!ifdef STUDIO_DIR
Section "KevCast Studio (desktop management app)" SecStudio
  SetShellVarContext all
  nsExec::Exec 'taskkill /F /IM "KevCast Studio.exe"'
  SetOutPath "$INSTDIR\Studio"
  File /r "${STUDIO_DIR}${S}*.*"
  CreateDirectory "$SMPROGRAMS\KevCast"
  CreateShortcut "$SMPROGRAMS\KevCast\KevCast Studio.lnk" "$INSTDIR\Studio\KevCast Studio.exe"
  CreateShortcut "$DESKTOP\KevCast Studio.lnk" "$INSTDIR\Studio\KevCast Studio.exe"
SectionEnd
!endif

Section "-Uninstaller"
  SetShellVarContext all
  WriteUninstaller "$INSTDIR\Uninstall KevCast.exe"
  CreateDirectory "$SMPROGRAMS\KevCast"
  CreateShortcut "$SMPROGRAMS\KevCast\Uninstall KevCast.lnk" "$INSTDIR\Uninstall KevCast.exe"
  WriteRegStr HKLM "Software\KevCast" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "KevCast"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\Uninstall KevCast.exe"
  WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall KevCast.exe"'
  WriteRegStr HKLM "${UNINST_KEY}" "URLInfoAbout" "https://github.com/tahtk3v/kevcast"
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoRepair" 1
SectionEnd

; Descriptions shown on the components page.
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${GrpServer} "Install one server per organisation. It runs in the background and starts with Windows."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecServer} "The KevCast Server, plus a 'KevCast Web Studio' shortcut on the desktop to manage everything in your browser."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecLibre} "Converts PowerPoint files to slides. Installed with winget if missing (needs internet). Skip it if you only upload PDFs and images."
  !ifdef PLAYER_DIR
  !insertmacro MUI_DESCRIPTION_TEXT ${SecPlayer} "Install on every computer connected to a screen. Full-screen, starts at sign-in, keeps playing offline. Close with Alt+Q."
  !endif
  !ifdef STUDIO_DIR
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStudio} "Desktop app for managing content, playlists, schedules and display groups. Not needed if you use the Web Studio."
  !endif
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; --------------------------------------------------------------------------
; Functions
; --------------------------------------------------------------------------
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "KevCast needs 64-bit Windows."
    Abort
  ${EndIf}
  SetRegView 64
  ReadEnvStr $ComputerName COMPUTERNAME
  StrCpy $ServerPort "8080"
  ; Player and Studio are not ticked by default when the server is (and vice versa makes no sense to guess),
  ; so: Server + LibreOffice + Studio are ticked, Player is not (most PCs running setup are not screens).
  !ifdef PLAYER_DIR
    !insertmacro UnselectSection ${SecPlayer}
  !endif
  ; LibreOffice already present? Leave it unticked.
  ${If} ${FileExists} "$PROGRAMFILES64\LibreOffice\program\soffice.exe"
    !insertmacro UnselectSection ${SecLibre}
  ${EndIf}
FunctionEnd

; The LibreOffice option only makes sense together with the server.
Function .onSelChange
  ${IfNot} ${SectionIsSelected} ${SecServer}
    !insertmacro UnselectSection ${SecLibre}
  ${EndIf}
FunctionEnd

Function FinishPre
  ; Build the text of the finish page from what was installed.
  StrCpy $FinishText ""
  ${If} ${SectionIsSelected} ${SecServer}
    StrCpy $FinishText "Manage KevCast with the 'KevCast Web Studio' icon on your desktop (http://localhost:$ServerPort/admin/).$\r$\n$\r$\nTo use a web browser as a screen (smart TV, any PC), open this page on it and press F11:$\r$\n    http://$ComputerName:$ServerPort/player/$\r$\n(or the IP address of this computer instead of $ComputerName)$\r$\n$\r$\n"
  ${EndIf}
  !ifdef PLAYER_DIR
  ${If} ${SectionIsSelected} ${SecPlayer}
    StrCpy $FinishText "$FinishText$\r$\nKevCast Player starts at sign-in, finds the server and shows a code: enter it in the Web Studio under Displays > Add display. Close the player with Alt+Q.$\r$\n$\r$\n"
  ${EndIf}
  !endif
  ${If} $FinishText == ""
    StrCpy $FinishText "KevCast is ready."
  ${EndIf}
FunctionEnd

Function LaunchKevCast
  SetShellVarContext all
  ${If} ${SectionIsSelected} ${SecServer}
    ExecShell "open" "http://localhost:$ServerPort/admin/"
    Return
  ${EndIf}
  !ifdef STUDIO_DIR
  ${If} ${SectionIsSelected} ${SecStudio}
    Exec '"$INSTDIR\Studio\KevCast Studio.exe"'
    Return
  ${EndIf}
  !endif
  !ifdef PLAYER_DIR
  ${If} ${SectionIsSelected} ${SecPlayer}
    Exec '"$INSTDIR\Player\KevCast Player.exe"'
  ${EndIf}
  !endif
FunctionEnd

Function TrimNewline
  Exch $R0
  Push $R1
  loop:
    StrCpy $R1 $R0 1 -1
    ${If} $R1 == "$\r"
    ${OrIf} $R1 == "$\n"
    ${OrIf} $R1 == " "
      StrCpy $R0 $R0 -1
      Goto loop
    ${EndIf}
  Pop $R1
  Exch $R0
FunctionEnd

; --------------------------------------------------------------------------
; Uninstaller (your content in C:\ProgramData\KevCast is kept)
; --------------------------------------------------------------------------
Function un.onInit
  SetRegView 64
FunctionEnd

Section "Uninstall"
  SetShellVarContext all
  ${If} ${FileExists} "$INSTDIR\Server\service.ps1"
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Server\service.ps1" -Action uninstall -ServerDir "$INSTDIR\Server"'
    Pop $1
  ${EndIf}
  nsExec::Exec 'taskkill /F /IM "KevCast Player.exe"'
  nsExec::Exec 'taskkill /F /IM "KevCast Studio.exe"'
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "KevCast Player"

  Delete "$DESKTOP\KevCast Web Studio.url"
  Delete "$DESKTOP\KevCast Player.lnk"
  Delete "$DESKTOP\KevCast Studio.lnk"
  RMDir /r "$SMPROGRAMS\KevCast"
  RMDir /r "$INSTDIR\Server"
  RMDir /r "$INSTDIR\Player"
  RMDir /r "$INSTDIR\Studio"
  Delete "$INSTDIR\Uninstall KevCast.exe"
  RMDir "$INSTDIR"

  DeleteRegKey HKLM "${UNINST_KEY}"
  DeleteRegKey HKLM "Software\KevCast"
  MessageBox MB_ICONINFORMATION "KevCast was removed. Your content is still in $APPDATA\KevCast (delete that folder yourself if you no longer need it)."
SectionEnd
