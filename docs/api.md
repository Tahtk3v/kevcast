# REST API reference

Everything the admin and the players do goes through this JSON API, so you can automate KevCast too,
for example to push a news ticker from another system or upload a new menu every morning.

- Base URL: `http://<server>:8080`
- Request and response bodies are JSON unless noted. Errors return `{ "error": "message" }` with a 4xx/5xx status.
- **Studio endpoints** need the session cookie from `POST /api/login`. Endpoints marked *admin* need a user with the
  Administrator role (otherwise `403`); all others work for Editors too. Create a separate user for each script or integration.
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
| GET | `/api/session` | – | `{ setupRequired, user: { id, username, name, role }, orgName, version }` |
| POST | `/api/setup` | `{ username, password, orgName? }` | Creates the first administrator (only while there is none; 409 afterwards) |
| POST | `/api/login` | `{ username, password }` | Sets the session cookie. The username is not case-sensitive. Rate-limited. |
| POST | `/api/logout` | – | Clears the cookie |

## Overview and settings

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/overview` | – | Counts, capabilities (LibreOffice/Poppler paths), `playerUrls`, `serverUrls`, `provisioningKey` (`null` for editors), version, platform, data folder |
| PATCH | `/api/settings` | `{ orgName }` | `{ ok }` (*admin*) |
| POST | `/api/password` | `{ current, next }` | `{ ok }`. Changes your own password and ends your other sessions. |
| POST | `/api/provisioning-key/rotate` | – | `{ provisioningKey }` (*admin*) |
| GET | `/api/backup` | – | Database export without users or credentials (download) (*admin*) |
| GET | `/api/events` | – | Server-Sent Events: `change`, `media`, `heartbeat`, `pairing` |

## Users (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/users` | – | `[{ id, username, name, role, createdAt, lastLogin }]` (never passwords) |
| POST | `/api/users` | `{ username, password, name?, role? }` | The new user. `role` is `editor` (default) or `admin`. Usernames: letters, digits, `. _ @ -`; unique, ignoring case (409). |
| PATCH | `/api/users/:id` | `{ name?, role?, password? }` | The user. A new role or password ends that user's sessions. |
| DELETE | `/api/users/:id` | – | `{ ok }`. Not yourself, and not the last administrator (400). |

## Media (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/media` | – | List. Each item adds `url`, `slideUrls`, `thumb`. |
| POST | `/api/media/upload` | `multipart/form-data`, field `files` (up to 50 files) | `{ created: [...], rejected: [names] }` |
| POST | `/api/media` | `{ type: 'web', url, name?, zoom?, refreshSeconds? }` or `{ type: 'text', text: { title, body, bg, bg2, fg, align, size }, name? }` | The media item |
| PATCH | `/api/media/:id` | `{ name?, url?, text?, tags?, zoom?, refreshSeconds? }` | The media item |
| GET | `/api/media/:id/preview` | – | The item as players receive it (used by `/player/?preview=media:<id>`) |
| POST | `/api/media/:id/reconvert` | – | Converts a presentation again |
| DELETE | `/api/media/:id` | – | Also removes it from all playlists and deletes schedule entries that play it |

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
| POST | `/api/schedules/bulk` | `{ ids: [], action: 'enable'\|'disable'\|'delete'\|'setTargets'\|'priority', targets?, priority? }` | `{ changed }` |

```json
{
  "name": "Train departures",
  "playlistId": null,
  "mediaId": "d4e5f6",
  "itemDuration": 60,
  "enabled": true,
  "priority": 0,
  "repeat": "weekly",
  "days": [1, 2, 3, 4, 5],
  "everyWeeks": 1,
  "monthDay": 1,
  "allDay": false,
  "start": "07:00",
  "end": "09:30",
  "interval": { "everyMinutes": 15, "showSeconds": 60 },
  "startDate": "2026-11-01",
  "endDate": "2026-12-31",
  "targets": { "displays": [], "groups": ["Lobby"] }
}
```
- **What plays**: `playlistId`, or `mediaId` for a single item such as a web page.
- `itemDuration`: seconds per item. `0` = the item's own time.
- `repeat`:
  - `weekly`: uses `days` and `everyWeeks`. Weeks are counted from `startDate`, or from the creation date.
  - `monthly`: uses `monthDay`.
  - `once`: uses `startDate` as the only date.
- `interval` (optional): show the content for `showSeconds` every `everyMinutes` within the time window, counted from its start.
- `startDate` / `endDate`: the period in which the entry is valid.
- `days`: 0 = Sunday … 6 = Saturday. An empty list means every day.
- `priority`: 0 normal, 5 high, 10 urgent.
- Empty `targets` means all displays.
- If `end` is earlier than `start`, the entry runs past midnight.

## Displays (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/displays` | – | List with `online`, `scheduledPlaylistId`, `scheduleId`, `nowPlaying`, `cache`, `screenshotAt` (tokens are never returned) |
| POST | `/api/displays/pair` | `{ code, name?, groups?: [], defaultPlaylistId? }` | The approved display |
| PATCH | `/api/displays/:id` | Any of `{ name, groups, defaultPlaylistId, orientation, fit, showClock, ticker, background, notes, maintenance }` | The display |
| PATCH | `/api/displays/bulk` | `{ ids?: [], group?: "name", all?: true, addGroups?: [], removeGroups?: [], patch: { groups, defaultPlaylistId, orientation, fit, showClock, ticker, background, maintenance } }` | `{ updated }` |
| POST | `/api/displays/:id/identify` · `/reload` · `/screenshot` | – | `{ delivered }`: 1 if the screen is online |
| POST | `/api/displays/command` | `{ action: 'identify'\|'reload'\|'screenshot', ids?, group?, all? }` | `{ targeted, delivered }` |
| GET | `/api/displays/:id/screenshot` | – | Latest JPEG screenshot (404 if none) |
| DELETE | `/api/displays/:id` | – | Unpairs the screen (it shows a new code). Entries aimed only at this screen are removed: `{ removedSchedules }`. |

Example: update the news ticker on every screen in a group.
```bash
curl -b kc.txt -X PATCH -H 'Content-Type: application/json' \
  -d '{"group":"Canteen","patch":{"ticker":{"enabled":true,"text":"Soup of the day: tomato\nFire drill at 14:00","speed":60}}}' \
  http://server:8080/api/displays/bulk
```

## Groups (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/groups` | – | `[{ id, name, color, description, displayIds, members, online, schedules }]` |
| POST | `/api/groups` | `{ name, color?, description?, displayIds? }` | The group (409 if the name exists) |
| PATCH | `/api/groups/:id` | `{ name?, color?, description? }` | The group. Renaming updates the members and schedule entries. |
| POST | `/api/groups/:id/members` | `{ add?: [displayId], remove?: [displayId] }` | The group |
| POST | `/api/groups/:id/copy-schedule` | `{ toGroupIds: [id] }` | `{ copied }`: copies of all entries aimed at this group |
| DELETE | `/api/groups/:id` | – | `{ removedSchedules }`. Members leave the group; entries aimed only at it are deleted. |

A display can be in several groups: `display.groups` is an array of names. Schedule entries target groups by name.

## Player API (display token)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/player/register` | `{ resolution?, userAgent?, provisioning?: { key, name, group, playlist } }` | `{ id, token, pairingCode, approved }`. No token needed. |
| GET | `/api/player/manifest` | – | `{ display, schedules, playlists, orgName, serverVersion, generatedAt }` |
| GET | `/api/info` | – | Public: `{ orgName, version, playerUrls, adminUrls }` (used by the start page) |
| POST | `/api/player/heartbeat` | `{ nowPlaying?, resolution?, cache? }` | `{ ok, approved }` |
| POST | `/api/player/screenshot` | JPEG bytes, `Content-Type: image/jpeg`, max 5 MB | `{ ok }` |
| GET | `/api/player/events` | – | SSE: `update`, `approved`, `identify`, `reload`, `screenshot`, `unpaired` |

`maintenance` is `{ weeklyRestart: true, day: 0, time: "03:00" }` (day 0 = Sunday): the weekly restart of Player app screens.

Manifest playlists are flattened. Single scheduled items appear as playlists with the key `media:<id>`. Each item has `type` (`image`, `video`, `web`, `text`), `url` or `text`,
`duration`, `transition`, `name`, for presentations `slide` and `slides`, and for web pages `zoom` and `refreshSeconds`.

## Static paths

| Path | Content |
|---|---|
| `/admin/` | Admin app |
| `/` | Start page: link to the Web Studio and the address for browser players |
| `/player/` | Player app (`?reset=1` forgets the pairing, `?preview=<playlistId>` or `?preview=media:<id>` previews) |
| `/media/<id>/<file>` | Media and slides (immutable, cached for 7 days) |
| `/shared/schedule.js` | Schedule logic used by the admin and player |
