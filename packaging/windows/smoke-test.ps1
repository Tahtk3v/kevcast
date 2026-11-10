# Installs KevCast Server Setup silently, checks the background service and the web server, then
# uninstalls it again. CI runs this on every build so a broken installer can't be released.
#   packaging\windows\smoke-test.ps1 [-Setup packaging-out\KevCast-Server-Setup-x.y.z-win-x64.exe]
# Needs administrator rights (GitHub's Windows runners have them).
param([string]$Setup)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $Setup) {
  $Setup = (Get-ChildItem (Join-Path $root 'packaging-out') -Filter 'KevCast-Server-Setup-*-win-x64.exe' | Select-Object -First 1).FullName
}
if (-not $Setup -or -not (Test-Path $Setup)) { throw 'KevCast-Server-Setup-*.exe not found; run build.ps1 first.' }
$installDir = Join-Path $env:ProgramFiles 'KevCast'
$dataDir = Join-Path $env:ProgramData 'KevCast'
$taskName = 'KevCast Server'

function Show-Log {
  $log = Join-Path $dataDir 'kevcast.log'
  if (Test-Path $log) { Write-Host '--- kevcast.log ---'; Get-Content $log -Tail 40 }
}

Write-Host "Installing $Setup silently..."
$p = Start-Process -FilePath $Setup -ArgumentList '/S', '/NOLIBREOFFICE' -Wait -PassThru
if ($p.ExitCode -ne 0) { Show-Log; throw "The installer exited with code $($p.ExitCode)." }

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) { throw "The '$taskName' task was not registered." }
if ($task.Principal.UserId -notmatch 'SYSTEM') { throw "The '$taskName' task does not run as SYSTEM." }
foreach ($rule in 'KevCast', 'KevCast discovery') {
  if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) { throw "Firewall rule '$rule' is missing." }
}
foreach ($f in 'Server\kevcast-server.cmd', 'Server\node\node.exe', 'Server\app\server\index.js', 'Uninstall KevCast.exe') {
  if (-not (Test-Path (Join-Path $installDir $f))) { throw "$f is missing." }
}
if (-not (Test-Path (Join-Path $env:PUBLIC 'Desktop\KevCast Web Studio.url'))) { throw 'The KevCast Web Studio desktop shortcut is missing.' }

$port = (Get-Content (Join-Path $installDir 'Server\port.txt') -Raw).Trim()
$info = $null
for ($i = 0; $i -lt 60 -and -not $info; $i++) {
  try { $info = Invoke-RestMethod -TimeoutSec 2 "http://localhost:$port/api/info" } catch { Start-Sleep -Seconds 1 }
}
if (-not $info) { Show-Log; throw "The server did not answer on port $port." }
Write-Host "Server answers on port ${port}: $($info | ConvertTo-Json -Compress)"
Invoke-WebRequest -UseBasicParsing "http://localhost:$port/admin/" | Out-Null
Invoke-WebRequest -UseBasicParsing "http://localhost:$port/player/" | Out-Null

Write-Host 'Uninstalling...'
# _?= makes the uninstaller run in place and wait, instead of copying itself to %TEMP% and returning.
$p = Start-Process -FilePath (Join-Path $installDir 'Uninstall KevCast.exe') -ArgumentList '/S', "_?=$installDir" -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "The uninstaller exited with code $($p.ExitCode)." }
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw "The '$taskName' task is still there after uninstalling." }
if (Test-Path (Join-Path $installDir 'Server')) { throw 'The program files are still there after uninstalling.' }
if (-not (Test-Path $dataDir)) { throw 'The data folder was removed; it must be kept.' }
Write-Host 'KevCast Server Setup installs, runs and uninstalls correctly.'
