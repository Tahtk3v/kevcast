# Architecture

```
                     ┌───────────────────────────── KevCast Server (Node.js) ─────────────────────────────┐
 KevCast Studio ───▶ │  /admin/   management SPA (vanilla JS)        /api/*   REST + Server-Sent Events     │
 or a browser        │  /player/  player SPA                         /media/* uploaded files and slides    │
                     │                                                                                     │
 KevCast Player ───▶ │  db.json (JSON file DB)    convert.js: LibreOffice ─▶ PDF ─▶ pdftoppm ─▶ JPEG slides │
 or a browser        │  UDP 41234 discovery       shared/schedule.js (same code runs on the player)        │
                     └─────────────────────────────────────────────────────────────────────────────────────┘
```

## Design goals

1. **Easy to install anywhere.** It is plain Node.js with two dependencies (Express, Multer) and no native modules,
   database server or containers. One script per OS.
2. **Easy for end users.** Drag and drop everywhere, saving is automatic, there are no "publish" steps, and wording avoids jargon.
3. **Screens never go black.** Players decide locally what to play, keep everything on disk, and recover by themselves.
4. **PowerPoint is a first-class format.** Slides are converted once on the server; players only ever show images.

## Components

| Path | What |
|---|---|
| `server/index.js` | Express app: static files, admin API, player API, SSE hubs, UDP discovery |
| `server/db.js` | JSON-file database with atomic writes (`db.json.tmp` → rename) and change listeners |
| `server/auth.js` | User accounts (scrypt-hashed passwords), roles and an HMAC-signed session cookie |
| `server/convert.js` | Finds LibreOffice/Poppler/Ghostscript and converts presentations. Conversions run one at a time. |
| `shared/schedule.js` | Schedule resolution (UMD). Used by the server, the admin and the player. |
| `public/admin/` | Admin single-page app with no build step |
| `public/player/` | Player single-page app plus a service worker for browser offline support |
| `desktop/player/` | Electron kiosk wrapper: exit lock, offline disk cache, screenshots, provisioning |
| `desktop/studio/` | Electron wrapper around `/admin/` |
| `desktop/common/` | Config loading, LAN discovery, "connect to server" window |

## Data model (`db.json`)

```js
settings:  { orgName, provisioningKey, serverId }
users:     { id, username, name, role: 'admin'|'editor', salt, hash, sv, lastLogin }
media:     { id, name, type: 'image'|'video'|'presentation'|'web'|'text', file, slides[], url, zoom, refreshSeconds, text{}, status, error, size }
playlists: { id, name, color, defaultDuration, transition, items: [{ id, mediaId, duration, transition, enabled, mute }] }
schedules: { id, name, playlistId | mediaId, itemDuration, enabled, priority, repeat: 'weekly'|'monthly'|'once',
             days[], everyWeeks, monthDay, allDay, start, end, startDate, endDate,
             interval: { everyMinutes, showSeconds } | null, targets: { displays: [id], groups: [name] } }
groups:    { id, name, color, description }
displays:  { id, name, groups: [name], approved, pairingCode, token, defaultPlaylistId, orientation, fit, background,
             showClock, ticker{}, maintenance{ weeklyRestart, day, time }, lastSeen, ip, resolution, userAgent,
             nowPlaying{}, cache{}, screenshotAt }
```

Media files live in `media/<id>/original.<ext>`. Slides are in `media/<id>/slides/slide-N.jpg`.
Files are immutable (a new upload gets a new id), so they can be cached forever.

## PowerPoint conversion

1. Upload → the media record is created with `status: 'processing'` and the job is queued (one at a time).
2. `soffice --headless --convert-to pdf` runs with a throw-away LibreOffice profile, so it never collides with a desktop LibreOffice.
3. `pdftoppm -jpeg -scale-to 1920` renders each page, or Ghostscript at 150 dpi if Poppler is missing.
4. → `status: 'ready'` with `slides: [...]`. The admin is notified live and the slides appear.

Before step 2, `server/pptx.js` prepares a temporary copy of a `.pptx` when needed: it drops fonts embedded in the
file that the server has installed (LibreOffice often draws embedded subset fonts wrongly), and applies **Arial for all
text** or the server-wide font replacements. The upload itself is never changed.

PDFs skip step 2. Failures store a readable `error` on the media item, shown in the admin with a **Re-convert** button.

## Scheduling

`shared/schedule.js` is used by the server (dashboard), the Web Studio (calendar and week overview) and the player.

1. **Does the entry occur on this date?** (`occursOn`)
   - `once`: the date equals `startDate`.
   - `monthly`: the day of the month equals `monthDay` (clamped to the last day of shorter months).
   - `weekly`: the day is in `days`, and for `everyWeeks > 1` the week number counted from `startDate` (or the creation date) fits the interval.
   - The date must also lie within `startDate`–`endDate`.
2. **Is the time window open?** All day, or `start`–`end`. A window like 22:00–06:00 belongs to the day it **starts**.
3. **Recurring entries** (`interval`) are only active for the first `showSeconds` of every `everyMinutes`, counted from the window start.
4. **Pick the winner**, sorting by:
   1. priority
   2. recurring entries first (so they interrupt)
   3. specificity (display > group > all)
   4. newest
5. The winner's playlist (or single item, key `media:<id>`) plays, with `itemDuration` overriding each item's time.
   Without a winner the **group playlist** plays (a playlist named like one of the display's groups, ignoring case),
   otherwise the display's own default playlist, and without either, the idle clock. The server works out which
   default applies and sends it to the player as `display.defaultPlaylistId`.

The player runs this every 5 seconds against its own copy of the schedule. It keeps working while disconnected,
and remembers the position in each playlist, so a playlist resumes after a recurring item.
`dayTimeline()` samples a day in 5-minute steps for the week overview.

## Player protocol

| Step | Request |
|---|---|
| Register | `POST /api/player/register` → `{ id, token, pairingCode, approved }`. The token is stored in local storage. |
| Live channel | `GET /api/player/events?token=…` (SSE): `update`, `approved`, `identify`, `reload`, `screenshot`, `unpaired` |
| Content | `GET /api/player/manifest` (header `X-Display-Token`) → display settings, all enabled schedules and every playlist they or the default use, flattened (one entry per slide) |
| Status | `POST /api/player/heartbeat` every 30 s and on item change: now playing, resolution, cache status |
| Screenshot | `POST /api/player/screenshot` (JPEG body, app only) |

Every database change triggers an `update` event (debounced to 300 ms), and players fetch the manifest again.

## Offline design

**Player app** (`desktop/player/offline-cache.js`): `protocol.handle('http')` intercepts all requests to the server.

| Request | Strategy |
|---|---|
| `/media/*` | Cache first, served from disk with HTTP Range support (video) |
| `/api/player/manifest`, `/player/*`, `/shared/schedule.js` | Network first (8 s timeout), saved to disk, disk copy when offline |
| Anything else | Passed through |

Requests from web-page items to other sites pass through untouched, except that `X-Frame-Options` and CSP `frame-ancestors` are removed (also through `webRequest` for https), so pages that forbid embedding still display.

Each fresh manifest triggers a background sync that streams every referenced image, slide and video to disk.
Unreferenced files are pruned only after a sync completes without errors.

**Browser player**: a service worker caches the player shell (network first) and media (cache first). On each manifest,
the player sends the full media list to the service worker to download in advance.

## Discovery protocol

A client sends the UDP datagram `KEVCAST_DISCOVER` to port 41234 on:
- `255.255.255.255`
- each interface's subnet broadcast address
- `127.0.0.1`

Each server replies to the sender with JSON:
```json
{ "kevcast": true, "id": "server-instance-id", "name": "Acme HQ", "version": "0.5.0", "port": 8080, "urls": ["http://192.168.1.20:8080"] }
```
The client uses the address the reply came from, de-duplicates by `id`, and prefers a LAN address over loopback.

## Security model

- **Users**: each has a role. *Administrators* can do everything; *Editors* can't manage users, change server settings, see the provisioning key or download backups (enforced by the server, `403`). There is always at least one administrator.
- **Passwords** are hashed with scrypt (random salt). Sessions use an HMAC-SHA256 signed cookie (`HttpOnly`, `SameSite=Lax`, 14 days) keyed by `data/secret.key`, holding the user id and a session version (`sv`). Changing a user's password or role, or removing the user, raises or removes it, which ends that user's sessions at once. Logins are rate-limited to 10 failures per IP per 15 minutes.
- **Players**: a random 192-bit token per display, used only for the player API. Removing a display revokes its token at once.
- **Pairing**: a 6-character code from a 32-symbol alphabet, valid only while unpaired. Stale unpaired registrations are removed after 7 days.
- **Provisioning key**: 96-bit random, compared in constant time. It only creates approved displays.
- **Web-page items** run in a sandboxed iframe. Media is served as static files.
- **Players** never accept inbound connections. Only the server listens.
- Use HTTPS through a reverse proxy when traffic crosses untrusted networks.
