# KevCast server installer for Windows 10/11 and Windows Server 2019+.
# Easiest: double-click install.bat (it asks for administrator rights and runs this script).
#
# What it does:
#   1. Installs Node.js LTS, LibreOffice and Poppler with winget (if missing)
#   2. Copies KevCast to C:\Program Files\KevCast and installs its packages
#   3. Registers a startup task that runs KevCast in the background as SYSTEM
#   4. Opens the firewall port and the admin page
param(
  [int]$Port = 8080,
  [string]$InstallDir = "$env:ProgramFiles\KevCast",
  [string]$DataDir = "$env:ProgramData\KevCast"
)
$ErrorActionPreference = 'Stop'
$src = Resolve-Path (Join-Path $PSScriptRoot '..\..')

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Need-Winget {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'winget was not found. Install "App Installer" from the Microsoft Store, or install Node.js, LibreOffice and Poppler manually.'
  }
}
function Install-Pkg($id, $name) {
  Write-Host "==> Installing $name" -ForegroundColor Cyan
  winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements --scope machine
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { # -1978335189 = already installed
    winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements
  }
  Refresh-Path
}

Refresh-Path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Need-Winget; Install-Pkg 'OpenJS.NodeJS.LTS' 'Node.js LTS' }
if (-not (Test-Path "$env:ProgramFiles\LibreOffice\program\soffice.exe")) { Need-Winget; Install-Pkg 'TheDocumentFoundation.LibreOffice' 'LibreOffice' }

# Poppler (pdftoppm) renders the slides. winget installs it per-user, so copy it next to KevCast.
$popplerDir = Join-Path $InstallDir 'poppler'
if (-not (Test-Path (Join-Path $popplerDir 'pdftoppm.exe'))) {
  $found = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages", "$env:ProgramFiles" -Filter pdftoppm.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $found) {
    Need-Winget; Install-Pkg 'oschwartz10612.Poppler' 'Poppler'
    $found = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages", "$env:ProgramFiles" -Filter pdftoppm.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if ($found) {
    New-Item -ItemType Directory -Force -Path $popplerDir | Out-Null
    Copy-Item -Path (Join-Path $found.DirectoryName '*') -Destination $popplerDir -Recurse -Force
  } else {
    Write-Warning 'Poppler could not be installed automatically; PowerPoint slides will not render until it is installed.'
  }
}

Write-Host "==> Copying KevCast to $InstallDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $InstallDir, $DataDir | Out-Null
foreach ($item in 'server', 'shared', 'public', 'package.json', 'package-lock.json') {
  Copy-Item -Path (Join-Path $src $item) -Destination $InstallDir -Recurse -Force
}
Push-Location $InstallDir
npm ci --omit=dev --no-audit --no-fund
Pop-Location

Write-Host '==> Creating launcher and startup task' -ForegroundColor Cyan
$node = (Get-Command node).Source
$launcher = Join-Path $InstallDir 'kevcast-service.cmd'
@"
@echo off
set PORT=$Port
set KEVCAST_DATA=$DataDir
set PDFTOPPM_PATH=$popplerDir\pdftoppm.exe
set SOFFICE_PATH=$env:ProgramFiles\LibreOffice\program\soffice.exe
cd /d "$InstallDir"
"$node" server\index.js >> "$DataDir\kevcast.log" 2>&1
"@ | Set-Content -Path $launcher -Encoding ASCII

$taskName = 'KevCast Server'
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$launcher`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host '==> Opening firewall port' -ForegroundColor Cyan
Remove-NetFirewallRule -DisplayName 'KevCast' -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName 'KevCast' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Domain, Private | Out-Null
Remove-NetFirewallRule -DisplayName 'KevCast discovery' -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName 'KevCast discovery' -Direction Inbound -Protocol UDP -LocalPort 41234 -Action Allow -Profile Domain, Private | Out-Null

Start-Sleep -Seconds 3
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
Write-Host ''
Write-Host '  KevCast is installed and starts automatically with Windows.' -ForegroundColor Green
Write-Host "  Admin:   http://localhost:$Port/admin/"
Write-Host "  Players: http://${ip}:$Port/player/"
Write-Host "  Log:     $DataDir\kevcast.log"
Start-Process "http://localhost:$Port/admin/"
