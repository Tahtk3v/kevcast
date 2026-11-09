# Server install scripts

> Most people should use the **installers** instead (KevCast Setup for Windows, or the server `.deb` or `.pkg`). See [docs/installation.md](../docs/installation.md#installers-recommended).
> These scripts install the server from a git checkout, using the system's Node.js.

| OS | Run | Installs to | Data |
|---|---|---|---|
| Windows | double-click `windows\install.bat` | `C:\Program Files\KevCast` | `C:\ProgramData\KevCast` |
| Linux | `sudo ./linux/install.sh` | `/opt/kevcast` | `/var/lib/kevcast` |
| macOS | `./macos/install.sh` | `~/Applications/KevCast` | `~/Library/Application Support/KevCast` |

Uninstall: `windows\uninstall.ps1`, `linux/uninstall.sh`. Your data is always kept.

See [docs/installation.md](../docs/installation.md) for details, HTTPS, backups and upgrades.
