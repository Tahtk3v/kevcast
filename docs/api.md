# REST API reference

Everything the admin and the players do goes through this JSON API, so you can automate KevCast too,
for example to push a news ticker from another system or upload a new menu every morning.

- Base URL: `http://<server>:8080`
- Request and response bodies are JSON unless noted. Errors return `{ "error": "message" }` with a 4xx/5xx status.
- **Admin endpoints** need the session cookie from `POST /api/login`.
- **Player endpoints** need the display token in the `X-Display-Token` header (or `?token=`).

```bash
# Log in and keep the cookie
curl -c kc.txt -H 'Content-Type: application/json' \
     -d '{"username":"admin","password":"secret"}' http://server:8080/api/login
# Use it
curl -b kc.txt http://server:8080/api/displays
```

## Session

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/session` | – | `{ setupRequired, user, orgName, version }` |
| POST | `/api/setup` | `{ username, password, orgName? }` | Creates the admin (first run only; 409 afterwards) |
| POST | `/api/login` | `{ username, password }` | Sets the session cookie. Rate-limited. |
| POST | `/api/logout` | – | Clears the cookie |

## Overview and settings (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/overview` | – | Counts, capabilities (LibreOffice/Poppler paths), `playerUrls`, `serverUrls`, `provisioningKey`, version, platform, data folder |
| PATCH | `/api/settings` | `{ orgName }` | `{ ok }` |
| POST | `/api/password` | `{ current, next }` | `{ ok }` |
| POST | `/api/provisioning-key/rotate` | – | `{ provisioningKey }` |
| GET | `/api/backup` | – | Database export without credentials (download) |
| GET | `/api/events` | – | Server-Sent Events: `change`, `media`, `heartbeat`, `pairing` |

## Media (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/media` | – | List. Each item adds `url`, `slideUrls`, `thumb`. |
| POST | `/api/media/upload` | `multipart/form-data`, field `files` (up to 50 files) | `{ created: [...], rejected: [names] }` |
| POST | `/api/media` | `{ type: 'web', url, name? }` or `{ type: 'text', text: { title, body, bg, bg2, fg, align, size }, name? }` | The media item |
| PATCH | `/api/media/:id` | `{ name?, url?, text?, tags? }` | The media item |
| POST | `/api/media/:id/reconvert` | – | Converts a presentation again |
| DELETE | `/api/media/:id` | – | Also removes it from all playlists |

Presentations start with `status: "processing"` and become `"ready"` or `"error"` (with `error`).

```bash
curl -b kc.txt -F files=@"Weekly update.pptx" http://server:8080/api/media/upload
```

## Playlists (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/playlists` | – | List |
| POST | `/api/playlists` | `{ name?, items? }` | The playlist (a colour is assigned) |
| PUT | `/api/playlists/:id` | Any of `{ name, color, defaultDuration, transition, items }` | The playlist |
| POST | `/api/playlists/:id/duplicate` | – | The copy |
| DELETE | `/api/playlists/:id` | – | Also deletes its schedule entries and clears it as a default |
| GET | `/api/playlists/:id/preview` | – | The flattened playlist exactly as players receive it |

An item looks like `{ mediaId, duration, transition?, enabled?, mute? }`:
- `duration` is in seconds. `0` means the playlist default, or play to the end for videos. For presentations it is per slide.
- `transition` is `fade`, `slide`, `zoom` or `none`.

## Schedules (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/schedules` | – | List |
| POST | `/api/schedules` | entry | The entry |
| PUT | `/api/schedules/:id` | entry | The entry |
| DELETE | `/api/schedules/:id` | – | `{ ok }` |

```json
{
  "name": "Lunch menu",
  "playlistId": "a1b2c3",
  "enabled": true,
  "priority": 0,
  "allDay": false,
  "start": "11:30",
  "end": "13:30",
  "days": [1, 2, 3, 4, 5],
  "startDate": null,
  "endDate": null,
  "targets": { "displays": [], "groups": ["Canteen"] }
}
```
- `days`: 0 = Sunday … 6 = Saturday. An empty list means every day.
- `priority`: 0 normal, 5 high, 10 urgent.
- Empty `targets` means all displays.
- If `end` is earlier than `start`, the entry runs past midnight.

## Displays (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/displays` | – | List with `online`, `scheduledPlaylistId`, `scheduleId`, `nowPlaying`, `cache`, `screenshotAt` (tokens are never returned) |
| POST | `/api/displays/pair` | `{ code, name?, group?, defaultPlaylistId? }` | The approved display |
| PATCH | `/api/displays/:id` | Any of `{ name, group, defaultPlaylistId, orientation, fit, showClock, ticker, background, notes }` | The display |
| PATCH | `/api/displays/bulk` | `{ ids?: [], group?: "name", all?: true, patch: { group, defaultPlaylistId, orientation, fit, showClock, ticker, background } }` | `{ updated }` |
| POST | `/api/displays/:id/identify` · `/reload` · `/screenshot` | – | `{ delivered }`: 1 if the screen is online |
| POST | `/api/displays/command` | `{ action: 'identify'\|'reload'\|'screenshot', ids?, group?, all? }` | `{ targeted, delivered }` |
| GET | `/api/displays/:id/screenshot` | – | Latest JPEG screenshot (404 if none) |
| DELETE | `/api/displays/:id` | – | Unpairs the screen (it shows a new code) |

Example: update the news ticker on every screen in a group.
```bash
curl -b kc.txt -X PATCH -H 'Content-Type: application/json' \
  -d '{"group":"Canteen","patch":{"ticker":{"enabled":true,"text":"Soup of the day: tomato\nFire drill at 14:00","speed":60}}}' \
  http://server:8080/api/displays/bulk
```

## Player API (display token)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/player/register` | `{ resolution?, userAgent?, provisioning?: { key, name, group, playlist } }` | `{ id, token, pairingCode, approved }`. No token needed. |
| GET | `/api/player/manifest` | – | `{ display, schedules, playlists, orgName, serverVersion, generatedAt }` |
| POST | `/api/player/heartbeat` | `{ nowPlaying?, resolution?, cache? }` | `{ ok, approved }` |
| POST | `/api/player/screenshot` | JPEG bytes, `Content-Type: image/jpeg`, max 5 MB | `{ ok }` |
| GET | `/api/player/events` | – | SSE: `update`, `approved`, `identify`, `reload`, `screenshot`, `unpaired` |

Manifest playlists are flattened. Each item has `type` (`image`, `video`, `web`, `text`), `url` or `text`,
`duration`, `transition`, `name`, and for presentations `slide` and `slides`.

## Static paths

| Path | Content |
|---|---|
| `/admin/` | Admin app |
| `/player/` | Player app (`?reset=1` forgets the pairing, `?preview=<playlistId>` previews a playlist) |
| `/media/<id>/<file>` | Media and slides (immutable, cached for 7 days) |
| `/shared/schedule.js` | Schedule logic used by the admin and player |
