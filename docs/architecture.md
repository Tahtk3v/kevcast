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
| `server/auth.js` | One admin account (scrypt-hashed password) and an HMAC-signed session cookie |
| `server/convert.js` | Finds LibreOffice/Poppler/Ghostscript and converts presentations. Conversions run one at a time. |
| `shared/schedule.js` | Schedule resolution (UMD). Used by the server, the admin and the player. |
| `public/admin/` | Admin single-page app with no build step |
| `public/player/` | Player single-page app plus a service worker for browser offline support |
| `desktop/player/` | Electron kiosk wrapper: exit lock, offline disk cache, screenshots, provisioning |
| `desktop/studio/` | Electron wrapper around `/admin/` |
| `desktop/common/` | Config loading, LAN discovery, "connect to server" window |

## Data model (`db.json`)

```js
settings:  { orgName, adminUser: { username, salt, hash }, provisioningKey, serverId }
media:     { id, name, type: 'image'|'video'|'presentation'|'web'|'text', file, slides[], url, text{}, status, error, size }
playlists: { id, name, color, defaultDuration, transition, items: [{ id, mediaId, duration, transition, enabled, mute }] }
schedules: { id, name, playlistId, enabled, priority, allDay, start, end, days[], startDate, endDate,
             targets: { displays: [id], groups: [name] } }
displays:  { id, name, group, approved, pairingCode, token, defaultPlaylistId, orientation, fit, background,
             showClock, ticker{}, lastSeen, ip, resolution, userAgent, nowPlaying{}, cache{}, screenshotAt }
```

Media files live in `media/<id>/original.<ext>`. Slides are in `media/<id>/slides/slide-N.jpg`.
Files are immutable (a new upload gets a new id), so they can be cached forever.

## PowerPoint conversion

1. Upload → the media record is created with `status: 'processing'` and the job is queued (one at a time).
2. `soffice --headless --convert-to pdf` runs with a throw-away LibreOffice profile, so it never collides with a desktop LibreOffice.
3. `pdftoppm -jpeg -scale-to 1920` renders each page, or Ghostscript at 150 dpi if Poppler is missing.
4. → `status: 'ready'` with `slides: [...]`. The admin is notified live and the slides appear.

PDFs skip step 2. Failures store a readable `error` on the media item, shown in the admin with a **Re-convert** button.

## Scheduling

`resolve(schedules, display, now)` in `shared/schedule.js`:

1. Keep entries that are enabled, target this display (display id, its group, or everyone), and are active now:
   day of week, date range, and time window. A window like 22:00–06:00 belongs to the day it **starts**.
2. Sort by priority, then specificity (display > group > all), then newest.
3. The winner's playlist plays. With no winner, the display's default playlist plays, and with no default, the idle clock.

The player runs this every 15 seconds against its own copy of the schedule, so it keeps working while disconnected.

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
{ "kevcast": true, "id": "server-instance-id", "name": "Acme HQ", "version": "0.1.0", "port": 8080, "urls": ["http://192.168.1.20:8080"] }
```
The client uses the address the reply came from, de-duplicates by `id`, and prefers a LAN address over loopback.

## Security model

- **Admin**: one account. The password is hashed with scrypt (random salt). Sessions use an HMAC-SHA256 signed cookie (`HttpOnly`, `SameSite=Lax`, 14 days) keyed by `data/secret.key`. Logins are rate-limited to 10 failures per IP per 15 minutes.
- **Players**: a random 192-bit token per display, used only for the player API. Removing a display revokes its token at once.
- **Pairing**: a 6-character code from a 32-symbol alphabet, valid only while unpaired. Stale unpaired registrations are removed after 7 days.
- **Provisioning key**: 96-bit random, compared in constant time. It only creates approved displays.
- **Web-page items** run in a sandboxed iframe. Media is served as static files.
- **Players** never accept inbound connections. Only the server listens.
- Use HTTPS through a reverse proxy when traffic crosses untrusted networks.
