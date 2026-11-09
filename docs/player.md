# KevCast Player

KevCast Player is the app that runs on each screen. It is available for Windows, macOS and Linux,
including the Raspberry Pi 4/5 (64-bit). A plain web browser can also act as a player; see [Browser players](#browser-players).

## Features at a glance

| | Player app | Browser player |
|---|---|---|
| Finds the server automatically | ✅ | – (type the address) |
| Fullscreen kiosk, starts at login | ✅ | Depends on the device |
| Can only be closed with **Alt+Q** | ✅ | – |
| Whole schedule stored on the device for offline playback | ✅ on disk, including videos | ⚠️ needs HTTPS, images/slides only |
| Survives server outage at power-on | ✅ | ⚠️ needs HTTPS |
| Self-healing (crash/hang/nightly refresh) | ✅ | – |
| Screenshots in the admin | ✅ | – |
| Zero-touch roll-out with `player.json` | ✅ | – |
| Keeps the display awake | ✅ | Wake Lock API, if supported |

## Recommended hardware

- **Windows**: any mini-PC or NUC (Intel N100 or better), or a PC behind the TV. Windows 10/11 Pro is handy for auto-login and Group Policy.
- **Linux**: an Intel N100 mini-PC with Ubuntu or Debian, or a **Raspberry Pi 5 / Pi 4 (4 GB)** with Raspberry Pi OS 64-bit (Desktop).
- **macOS**: a Mac mini.
- A wired network is more reliable than Wi-Fi for signage.
- Turn on **automatic login** for the screen's user account, so the player starts after a power cut.

## Installing

Download the installer for your platform from the GitHub *Build* workflow artifacts, or build it yourself
(see [Development](development.md#building-the-desktop-apps)).

| Platform | File | Notes |
|---|---|---|
| Windows | `KevCast-Player-x.y.z-win-x64.exe` | One-click install for all users, starts right away |
| Windows (managed) | `KevCast-Player-x.y.z-win-x64.msi` | For GPO, Intune or SCCM; see [roll-out](rollout.md) |
| macOS | `KevCast-Player-x.y.z-mac-arm64.dmg` / `-x64.dmg` | Drag to Applications |
| Linux / Pi | `KevCast-Player-x.y.z-linux-arm64.deb` / `-amd64.deb` | `sudo apt install ./KevCast-Player-*.deb` |
| Linux (portable) | `KevCast-Player-x.y.z-linux-x86_64.AppImage` | `chmod +x` and run (needs `libfuse2`) |

## First start

1. Start KevCast Player. It searches the network for KevCast servers (UDP 41234).
2. **One server found**: the player connects automatically. **Several found**: pick one with Tab and Enter, or the mouse. **None found**: type the address, e.g. `192.168.1.20` (port 8080 is assumed) or `signage.company.com`.
3. The screen shows **"Connect this screen"** and a 6-character code.
4. In the admin: **Displays → Add display**, enter the code. Done. The screen starts playing within seconds.

With a [provisioning key](rollout.md) steps 2–4 happen automatically.

## Keyboard shortcuts

Use these with a keyboard plugged into the screen's computer:

| Shortcut | Action |
|---|---|
| **Alt+Q** | **Exit the player.** This is the only way to close it. |
| Ctrl+Shift+K | Choose another server |
| Ctrl+Shift+R | Reset pairing: the screen registers again and shows a new code |
| Ctrl+Shift+W | Toggle between fullscreen kiosk and a normal window (handy for setup) |
| → (right arrow) | Skip to the next item |

### Closing the player
On a public screen the player must not be closed by accident or by passers-by. It therefore ignores:
- Alt+F4 and Cmd+Q
- the window close button (windowed mode)
- quit requests from the taskbar or dock
- other apps trying to quit it
- minimising: the window restores itself

Only the **exit shortcut** closes it. The default is **Alt+Q** (Option+Q on a Mac). To use a different combination,
set `exitShortcut` in [player.json](configuration.md#playerjson), for example `"Control+Alt+Shift+F12"`.

Shutting down, restarting or logging off the computer always works; the player doesn't block it.

> The player can't block operating-system key combinations such as Ctrl+Alt+Del or Win+L. To lock
> down a screen PC completely, also use Windows *Assigned Access* or *Shell Launcher*, or a restricted
> Linux user account.

## Offline playback

Every screen keeps the content it needs on its own disk:

- When the schedule changes, the player downloads **every** image, slide and video that **any** schedule entry or
  its default playlist can show, including content scheduled for next week that it has never played.
- Media is served from disk from then on, so the network is only used once per file.
- The latest schedule and the player program itself are stored too. If the server or network is down,
  the screen keeps following the schedule. This still works after a **power cut while the server is unreachable**.
- Files no longer used by any playlist are deleted automatically, after all current files have downloaded.
- When the server comes back, the player picks up changes within seconds.

The admin shows the state on each display card: **Offline: Ready 24/24 files · 312 MB**.
*Downloading* or *Partial* means the screen isn't fully offline-ready yet.

| OS | Cache location |
|---|---|
| Windows | `%APPDATA%\KevCast Player\offline-cache` |
| macOS | `~/Library/Application Support/KevCast Player/offline-cache` |
| Linux | `~/.config/KevCast Player/offline-cache` |

Web-page items and live data (heartbeats, screenshots) need a connection. A web-page item shows an
error while offline; consider a short duration for those.

## Self-healing

- If the server is unreachable at power-on and nothing is cached yet, a *Connecting…* screen appears. The player retries every 10 seconds.
- If the display process crashes it is restarted. If it hangs for 30 seconds it is restarted.
- Every night at 04:00 (`nightlyReload`) the player refreshes itself to stay fresh on screens that run for months.
- Display sleep and screensavers are blocked while the player runs.
- **Reload** in the admin restarts the player remotely.

## Screenshots

App players send a small screenshot (960 px wide) every 5 minutes, and immediately when you click 📷 in the admin.
Only the most recent screenshot per display is kept on the server.

## Browser players

Any modern browser can be a player. **Make the browser open this page:**

```
http://<server-address>:8080/player/
```

- `<server-address>` is the IP address or name of the computer running KevCast Server, e.g. `http://192.168.1.20:8080/player/`.
- Not sure of the address? Open `http://<server>:8080/` (the start page) on any computer, or look at **Displays → Connect another screen** in the Web Studio. Both list the exact player address with a copy button. The Windows installer also shows it on its last page.
- Don't use `localhost` unless the browser runs on the server itself.
- The page shows a 6-character code. Enter it in **Displays → Add display**.
- Set this page as the browser's **start page** or kiosk URL, so the screen comes back by itself after a restart.

- **Fullscreen**: press F11, double-click, or press `F` on the page. On Chrome/Edge use kiosk mode, for example:
  `msedge --kiosk http://server:8080/player/ --edge-kiosk-type=fullscreen`
  `chromium --kiosk --noerrdialogs --autoplay-policy=no-user-gesture-required http://server:8080/player/`
- **Smart TVs, Android TV and ChromeOS**: use the built-in browser or a kiosk-browser app pointed at the player address.
- **Offline** in a browser needs a service worker. Browsers only allow those on **HTTPS** (or `localhost`).
  Put KevCast behind HTTPS (see [installation](installation.md#https-and-a-friendly-address-optional)) to get
  offline playback in browsers. Videos are not stored offline in browsers. The app has none of these limits.
- **Pairing** is stored in the browser's local storage. Clearing site data (or opening `/player/?reset=1`) shows a new code.
- **Preview** a playlist (admin login required): `/player/?preview=<playlistId>`.
