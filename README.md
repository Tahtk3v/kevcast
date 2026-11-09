# KevCast

Self-hosted narrowcasting / digital signage that is easy to install and easy to use.
It is inspired by EasyScreen and is an alternative to Xibo.

* **PowerPoint support**: upload a `.pptx`/`.ppt`/`.ppsx`/`.odp` or PDF and every slide becomes a screen. No Office licence is needed on the screens.
* **Visual scheduler**: click and drag on a weekly calendar. Supports overnight slots, date ranges, priorities and per-screen/per-group targeting.
* **Display groups and "Send to screens"**: put a playlist on a whole group at once. You can make it the default, take over the screens right now until a set time, or schedule it.
* **Three apps, one server**
  * **KevCast Server**: runs on Windows, macOS or Linux. One installer, no database server and no Docker.
  * **KevCast Player**: a desktop app for screens (Windows, macOS, Linux and Raspberry Pi). It finds the server on its own, runs as a fullscreen kiosk, plays offline, recovers by itself and sends screenshots back. Any web browser works as a player too.
  * **KevCast Studio**: a desktop app for managing content, playlists, schedules and display groups. The same interface is also available in any browser at `/admin`.
* **Mass roll-out**: deploy the Player MSI or .deb with a `player.json` and new screens show up already approved, named and in the right group.

```
 ┌───────────────────┐   HTTP + live updates (SSE)   ┌──────────────────────┐
 │  KevCast Studio   │ ────────────────────────────▶ │                      │
 │  or browser /admin│                               │   KevCast Server     │
 └───────────────────┘                               │  (Node.js, port 8080)│
 ┌───────────────────┐   pairing, manifest, media    │  LibreOffice+Poppler │
 │  KevCast Player   │ ◀───────────────────────────▶ │  converts PowerPoint │
 │  or browser /player│   UDP 41234 auto-discovery    └──────────────────────┘
 └───────────────────┘
```

---

## 1. Install the server

The server needs **Node.js 18+**, **LibreOffice** (to convert PowerPoint) and **Poppler** (to render slides).
Each installer below sets all of this up and registers KevCast to start automatically.

### Windows (10/11, Server 2019+)
1. Download/clone this repository.
2. Double-click **`install\windows\install.bat`** and accept the administrator prompt.

It installs Node.js, LibreOffice and Poppler with `winget`, copies KevCast to `C:\Program Files\KevCast`,
stores content in `C:\ProgramData\KevCast`, registers a startup task (runs as SYSTEM) and opens the firewall
(TCP 8080 and UDP 41234 for auto-discovery). Uninstall with `install\windows\uninstall.ps1`.

### Linux (Ubuntu, Debian, Raspberry Pi OS, Fedora/RHEL)
```bash
sudo ./install/linux/install.sh
```
This installs a `kevcast` systemd service. Content lives in `/var/lib/kevcast`. Logs: `journalctl -u kevcast -f`.

### macOS
```bash
./install/macos/install.sh
```
This uses Homebrew and registers a LaunchAgent.

### Manual / development
```bash
npm install
npm start          # http://localhost:8080/admin/
```
Environment variables: `PORT` (default 8080), `KEVCAST_DATA` (data folder), `SOFFICE_PATH`, `PDFTOPPM_PATH`,
`DISCOVERY_PORT` (default 41234).

The first time you open `http://<server>:8080/admin/` you create the administrator account.

## 2. Install the apps

The desktop apps live in [`desktop/`](desktop/). Installers are built automatically by GitHub Actions
(see the **Artifacts** of the *Build* workflow run), or locally:

```bash
cd desktop
npm install
npm run player       # run KevCast Player from source
npm run studio       # run KevCast Studio from source
npm run dist         # build installers for the OS you are on
```

| | Windows | macOS | Linux / Raspberry Pi |
|---|---|---|---|
| KevCast Player | `.exe` (one-click) and `.msi` (GPO/Intune) | `.dmg` | `.AppImage`, `.deb` (x64 and arm64) |
| KevCast Studio | `.exe` and `.msi` | `.dmg` | `.AppImage`, `.deb` |

### KevCast Player
1. Install and start it on the screen's PC, mini-PC, NUC or Raspberry Pi.
2. It searches the network. If it finds exactly one KevCast server it connects automatically; otherwise you pick one or type the address.
3. The screen shows a 6-character code. In the admin go to **Displays → Add display** and type that code.

After that everything is managed centrally. The player:
* starts at login, runs fullscreen and keeps the display awake
* keeps playing cached content if the network or server goes down
* reloads itself after crashes or hangs, and refreshes nightly at 04:00
* sends a screenshot every 5 minutes, or on demand with 📷 in the admin

Installer shortcuts on the screen: **Ctrl+Shift+K** changes server, **Ctrl+Shift+R** resets pairing,
**Ctrl+Shift+W** toggles windowed mode, **Ctrl+Shift+Q** quits.

**No app?** Any modern browser works as a player: open `http://<server>:8080/player/` and press F11.
That covers smart TVs with a browser, Android TV boxes and ChromeOS. For offline playback in a browser, serve
KevCast over HTTPS or use the app.

### Rolling out many screens (no pairing codes)
In **Settings → Roll out the Player app** you'll find a provisioning key. Put a `player.json` on each device:

| OS | Location |
|---|---|
| Windows | `C:\ProgramData\KevCast\player.json` |
| macOS | `/Library/Application Support/KevCast/player.json` |
| Linux | `/etc/kevcast/player.json` |

```json
{
  "server": "http://signage.company.local:8080",
  "provisioningKey": "…from Settings…",
  "group": "Reception",
  "playlist": "Welcome loop"
}
```
Screens that start with a valid key are approved immediately, named after the computer, and put in the group with that default playlist.
Optional keys: `name`, `autostart` (default `true`), `nightlyReload` (`"04:00"`), `kiosk`, `windowed`, `disableGpu`.
`studio.json` in the same folder can preset the server for KevCast Studio. Both apps also accept `--server=URL`
or the `KEVCAST_SERVER` environment variable.

## 3. Using KevCast

1. **Media**: drag PowerPoint files, PDFs, images or videos onto the page. You can also add web pages (dashboards, Power BI) or make text slides with the built-in editor.
2. **Playlists**: drag media into a playlist and drag to reorder. Set seconds per item (per slide for PowerPoint) and transitions (fade, slide, zoom). Changes save automatically. **Preview** shows exactly what a screen will show.
3. **Displays**: give screens a group (e.g. *Canteen*, *Floor 2*). Each group has **Send to group**, **Identify** and **Reload**. Per screen you can set orientation (portrait), fit/fill, a clock overlay, a news ticker and a default playlist.
4. **Schedule**: drag on the calendar to say what plays when, and on which screens or groups. When entries overlap, *Urgent* beats *High*, which beats *Normal*. Outside scheduled times a screen plays its default playlist, or a clock if it has none.

Screens decide what to play from a copy of the schedule they keep locally. A schedule switch therefore still happens on time while the server is unreachable.

## Project layout

```
server/        Node.js server (Express): API, PowerPoint conversion, discovery
shared/        schedule logic shared by server, admin and player
public/admin/  management web app (also used inside KevCast Studio)
public/player/ player web app (also used inside KevCast Player)
desktop/       Electron apps: player/, studio/, common/ (discovery, connect screen)
install/       server installers for Windows, Linux, macOS
test/          npm test
```

## Notes and limitations
* PowerPoint animations, transitions and embedded videos are flattened to one image per slide. Upload videos separately.
* Videos play best as H.264 MP4.
* Some websites refuse to be embedded (X-Frame-Options). These can't be shown as web pages.
* Back up the data folder (or use **Settings → Download backup** for the database).
* The desktop installers are unsigned. Add code-signing certificates in the build workflow before a wide roll-out to avoid SmartScreen and Gatekeeper warnings.
