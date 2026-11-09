# Removes the KevCast startup task, firewall rule and program files.
# Your content in C:\ProgramData\KevCast is kept.
$ErrorActionPreference = 'SilentlyContinue'
Stop-ScheduledTask -TaskName 'KevCast Server'
Unregister-ScheduledTask -TaskName 'KevCast Server' -Confirm:$false
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*KevCast*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-NetFirewallRule -DisplayName 'KevCast'
Remove-NetFirewallRule -DisplayName 'KevCast discovery'
Remove-Item -Recurse -Force "$env:ProgramFiles\KevCast"
Write-Host "KevCast removed. Content is still in $env:ProgramData\KevCast."
