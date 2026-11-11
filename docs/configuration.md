# Configuration reference

## Server environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP port for the admin, API, players and media |
| `HOST` | `0.0.0.0` | Interface to listen on. Use `127.0.0.1` behind a reverse proxy on the same machine. |
| `KEVCAST_DATA` | `./data` (installers set a system folder) | Data folder: database, media, screenshots, secret key |
| `DISCOVERY_PORT` | `41234` | UDP port for automatic discovery by the Player and Studio apps |
| `SOFFICE_PATH` | auto-detected | Full path to LibreOffice's `soffice` (`soffice.exe` on Windows) |
| `PDFTOPPM_PATH` | auto-detected | Full path to Poppler's `pdftoppm` |
| `HTTPS_PROXY` + `NODE_USE_ENV_PROXY=1` | – | Only if the server reaches the internet through a proxy, for weather and traffic slides. Set both: Node.js uses the proxy only with `NODE_USE_ENV_PROXY=1`. |

Auto-detection looks at `PATH` and the usual install folders:
- `C:\Program Files\LibreOffice`
- `/Applications/LibreOffice.app`
- Homebrew prefixes
- winget's Poppler package

If `pdftoppm` is missing, Ghostscript (`gs`, `gswin64c`) is used instead.

Where the installers put this configuration:
- **Windows**: in the generated `C:\Program Files\KevCast\kevcast-service.cmd`
- **Linux**: in `/etc/systemd/system/kevcast.service`. Edit it, then run `systemctl daemon-reload && systemctl restart kevcast`.
- **macOS**: in `~/Library/LaunchAgents/com.kevcast.server.plist`

## player.json

Machine-wide settings for KevCast Player. Create the file in:

| OS | Path |
|---|---|
| Windows | `C:\ProgramData\KevCast\player.json` |
| macOS | `/Library/Application Support/KevCast/player.json` |
| Linux | `/etc/kevcast/player.json` |

| Key | Type | Default | Description |
|---|---|---|---|
| `server` | string | – | Server address, e.g. `http://signage.local:8080`. Without it the player searches the network. |
| `provisioningKey` | string | – | Key from **Settings → Roll out the Player app**. Approves the screen automatically. |
| `name` | string | hostname | Display name used when the screen registers with the key |
| `group` | string | – | Group the screen is placed in when it registers with the key |
| `playlist` | string | – | Name or id of the default playlist set when it registers with the key |
| `exitShortcut` | string | `"Alt+Q"` | The only key combination that closes the player. Uses [Electron accelerator syntax](https://www.electronjs.org/docs/latest/api/accelerator), e.g. `"Control+Alt+Shift+F12"`. |
| `autostart` | boolean | `true` | Start the player when the user logs in |
| `kiosk` | boolean | `true` | Use kiosk mode (no window chrome, harder to leave) |
| `windowed` | boolean | `false` | Run in a normal 1280×720 window instead of fullscreen (for testing) |
| `nightlyReload` | `"HH:MM"` | `"04:00"` | Daily refresh time |
| `disableGpu` | boolean | `false` | Turn off hardware acceleration (for some old or virtual GPUs that show a black screen) |
| `weeklyRestart` | boolean | `true` | Set to `false` to never perform the weekly restart on this device, whatever the Web Studio says |
| `rebootCommand` | string | – | macOS/Linux: command used for the weekly restart instead of restarting only the app, e.g. `"sudo /sbin/reboot"` |

Lookup order for every key, first match wins:
1. `--server=…` on the command line (server only)
2. the `KEVCAST_SERVER` environment variable (server only)
3. the machine-wide `player.json`
4. the screen's own settings, written when someone picks a server on the connect screen, in `<userData>/config.json`

`<userData>` is:
- Windows: `%APPDATA%\KevCast Player`
- macOS: `~/Library/Application Support/KevCast Player`
- Linux: `~/.config/KevCast Player`

## studio.json

Same folders as `player.json`. Supports `server`.
KevCast Studio also accepts `--server=…` and `KEVCAST_SERVER`.

## Internet access for weather and traffic slides

Screens never need the internet. The **server** does, for weather and traffic slides only. Allow outgoing HTTPS (port 443)
from the server to:

| Host | Used for | Terms |
|---|---|---|
| `api.met.no` | Weather forecast (MET Norway, yr.no) | Free, no account, commercial use allowed; credit "MET Norway" (shown on the slide) |
| `feeds.meteoalarm.org` | Official weather warnings (KNMI in the Netherlands, DWD in Germany, …) | Free, no account; credit MeteoAlarm (shown on the slide) |
| `nominatim.openstreetmap.org` | Finding a place by name when you set up a slide | Free, no account; light use only (KevCast sends at most one search per second) |
| `router.project-osrm.org` | Routes and normal travel times | Free demo service of the OSRM project, meant for light use; KevCast keeps each route for 24 hours |
| `opendata.ndw.nu` | Current traffic jams and accidents in the Netherlands (NDW, the national road data portal) | Open data, no account; refreshed every 3 minutes |

The server keeps the last good data, so slides keep showing something if one of these is down for a while. Without any
internet access the slides show "No data yet".

## Per-display settings (in the admin)

These are set per screen under **Displays → Settings**, or for many screens at once with *Send to screens*.

| Setting | Values |
|---|---|
| Name, group, notes | text |
| Default playlist | a playlist or none (clock screen) |
| Orientation | `landscape`, `portrait-left`, `portrait-right` |
| Image fit | `contain` (fit) or `cover` (fill) |
| Background | colour |
| Show clock | on/off |
| Language | automatic (the screen computer's language), English, Dutch or German. For the screen's messages, idle clock and weather and traffic slides. |
| Clock | automatic (the screen's language), 24-hour or 12-hour. For the idle screen, the clock in the corner and the times on weather and traffic slides. |
| News ticker | on/off, text (one message per line), speed (slow/normal/fast), colours |
| Weekly restart | on/off (default on), day of the week (default Sunday), time (default 03:00). Player app only. |
