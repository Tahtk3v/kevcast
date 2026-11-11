# Packaging

This folder builds the KevCast installers. The desktop apps (Player, Studio) are packaged by
electron-builder in [`desktop/`](../desktop). This folder adds the **server installers** and the
combined **Windows KevCast Setup**. CI (`.github/workflows/build.yml`) runs all of it on every push to `main`.

| Script | Runs on | Produces |
|---|---|---|
| `stage-server.js` | any | A self-contained server folder: `app/`, a bundled Node.js in `node/`, and on Windows Poppler in `poppler/` (downloads are checksum-verified) |
| `windows/build.ps1` | Windows | `KevCast-Setup-<ver>-win-x64.exe` (choose components) and `KevCast-Server-Setup-<ver>-win-x64.exe` |
| `linux/build-deb.sh amd64\|arm64` | Linux | `kevcast-server_<ver>_<arch>.deb` |
| `macos/build-pkg.sh arm64\|x64` | macOS | `KevCast-Server-<ver>-mac-<arch>.pkg` |

Output goes to `packaging-out/`.

## Windows

```powershell
cd desktop
npm ci
npx electron-builder --config electron-builder.player.yml --win    # also creates dist\player\win-unpacked
npx electron-builder --config electron-builder.studio.yml --win
cd ..
.\packaging\windows\build.ps1     # installs NSIS with Chocolatey if makensis is missing
```

`windows/kevcast-setup.nsi` is a single NSIS script:
- With `-DPLAYER_DIR` and `-DSTUDIO_DIR` it builds the component installer.
- Without them it builds the server-only installer.

At install time:
- `windows/service.ps1` registers the background service and the firewall rules.
- `windows/install-libreoffice.ps1` installs LibreOffice with winget when that option is ticked.

`windows/smoke-test.ps1` installs KevCast Server Setup silently (`/S /NOLIBREOFFICE`), checks the service,
firewall rules, shortcut and web server, and uninstalls it again. CI runs it after every Windows build. It needs
administrator rights, so only run it on a test machine.

The NSIS script also compiles on Linux (`apt install nsis`), which is handy for checking syntax:
```bash
node packaging/stage-server.js --platform win --arch x64 --out /tmp/stage --skip-poppler
makensis -DVERSION=0.6.0 -DOUTFILE=/tmp/setup.exe -DSERVER_DIR=/tmp/stage \
  -DASSETS=$PWD/packaging/assets -DSCRIPTS=$PWD/packaging/windows packaging/windows/kevcast-setup.nsi
```

## Linux

```bash
packaging/linux/build-deb.sh amd64
packaging/linux/build-deb.sh arm64     # Raspberry Pi 4/5 (64-bit OS)
sudo apt install ./packaging-out/kevcast-server_*_amd64.deb
```

## macOS

```bash
packaging/macos/build-pkg.sh arm64     # Apple silicon
packaging/macos/build-pkg.sh x64       # Intel
```

## Assets

`assets/` holds the icons used by the installers and shortcuts:
- `server.ico` / `server-256.png`: KevCast Server
- `web-studio.ico` / `.png`: the KevCast Web Studio shortcut
- `player.ico`: KevCast Player

The app icons used by electron-builder are in `desktop/build/`.

## Signing

All installers are unsigned. Before a wide roll-out, sign them:
- Windows: `signtool` on the `.exe` files (add a step after `build.ps1`), plus electron-builder's `CSC_LINK`.
- macOS: `productsign` for the `.pkg`, and notarise everything.
