# Installs LibreOffice (needed to convert PowerPoint files) if it is not installed yet.
# Called by the KevCast installer when "LibreOffice" is ticked. Needs internet access.
$ErrorActionPreference = 'Continue'
$soffice = "$env:ProgramFiles\LibreOffice\program\soffice.exe"
if (Test-Path $soffice) { Write-Host 'LibreOffice is already installed.'; exit 0 }

$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($winget) {
  Write-Host 'Installing LibreOffice with winget (this can take a few minutes)...'
  winget install --id TheDocumentFoundation.LibreOffice -e --silent --scope machine --accept-package-agreements --accept-source-agreements
  if (Test-Path $soffice) { exit 0 }
}
# Fallback: open the download page so the user can install it by hand.
Write-Host 'Could not install LibreOffice automatically; opening the download page.'
Start-Process 'https://www.libreoffice.org/download/download-libreoffice/'
exit 0
