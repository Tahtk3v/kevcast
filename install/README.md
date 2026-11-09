# Server installers

| OS | Run | Installs to | Data |
|---|---|---|---|
| Windows | double-click `windows\install.bat` | `C:\Program Files\KevCast` | `C:\ProgramData\KevCast` |
| Linux | `sudo ./linux/install.sh` | `/opt/kevcast` | `/var/lib/kevcast` |
| macOS | `./macos/install.sh` | `~/Applications/KevCast` | `~/Library/Application Support/KevCast` |

Uninstall: `windows\uninstall.ps1`, `linux/uninstall.sh`. Your data is always kept.

See [docs/installation.md](../docs/installation.md) for details, HTTPS, backups and upgrades.
