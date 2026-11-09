# Builds the Windows installers:
#   packaging-out\KevCast-Setup-<ver>-win-x64.exe         Server + Player + Studio, choose components
#   packaging-out\KevCast-Server-Setup-<ver>-win-x64.exe  Server only
# Run from the repository root AFTER building the desktop apps (desktop\dist\{player,studio}\win-unpacked):
#   cd desktop; npm ci; npx electron-builder --config electron-builder.player.yml --win --dir; (same for studio); cd ..
#   powershell -ExecutionPolicy Bypass -File packaging\windows\build.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$out = Join-Path $root 'packaging-out'
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
New-Item -ItemType Directory -Force -Path $out | Out-Null

Write-Host "==> Staging KevCast Server $version (bundled Node.js + Poppler)"
$serverDir = Join-Path $out 'server-win-x64'
node (Join-Path $root 'packaging\stage-server.js') --platform win --arch x64 --out $serverDir
if ($LASTEXITCODE -ne 0) { throw 'Staging the server failed' }

$makensis = (Get-Command makensis -ErrorAction SilentlyContinue).Source
if (-not $makensis) { $makensis = "${env:ProgramFiles(x86)}\NSIS\makensis.exe" }
if (-not (Test-Path $makensis)) {
  Write-Host '==> Installing NSIS'
  choco install nsis -y --no-progress | Out-Null
  $makensis = "${env:ProgramFiles(x86)}\NSIS\makensis.exe"
}

$nsi = Join-Path $PSScriptRoot 'kevcast-setup.nsi'
$common = @("-DVERSION=$version", "-DSERVER_DIR=$serverDir", "-DASSETS=$(Join-Path $root 'packaging\assets')", "-DSCRIPTS=$PSScriptRoot")

$player = Join-Path $root 'desktop\dist\player\win-unpacked'
$studio = Join-Path $root 'desktop\dist\studio\win-unpacked'
if ((Test-Path $player) -and (Test-Path $studio)) {
  Write-Host '==> Building KevCast Setup (choose components)'
  & $makensis @common "-DPLAYER_DIR=$player" "-DSTUDIO_DIR=$studio" "-DOUTFILE=$(Join-Path $out "KevCast-Setup-$version-win-x64.exe")" $nsi
  if ($LASTEXITCODE -ne 0) { throw 'makensis failed (KevCast Setup)' }
} else {
  Write-Warning 'Player/Studio builds not found; skipping the combined installer.'
}

Write-Host '==> Building KevCast Server Setup'
& $makensis @common "-DOUTFILE=$(Join-Path $out "KevCast-Server-Setup-$version-win-x64.exe")" $nsi
if ($LASTEXITCODE -ne 0) { throw 'makensis failed (KevCast Server Setup)' }

Get-ChildItem $out -Filter *.exe | ForEach-Object { Write-Host "  $($_.Name)  $([math]::Round($_.Length / 1MB)) MB" }
