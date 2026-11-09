# KevCast desktop apps

This folder builds two Electron apps from one code base:

| App | Entry | For |
|---|---|---|
| **KevCast Player** | `player/main.js` | Screens: fullscreen kiosk, offline cache, exits only with Alt+Q |
| **KevCast Studio** | `studio/main.js` | Managing content, playlists, schedules and display groups |

```
common/     config loading, LAN discovery, "connect to server" window
player/     main.js, preload.js (window.kevcastNative), offline-cache.js, offline.html
studio/     main.js
electron-builder.player.yml / electron-builder.studio.yml   packaging (exe, msi, dmg, AppImage, deb)
```

```bash
npm install
npm run player -- --server=http://localhost:8080
npm run studio
npm run dist:player     # installers in dist/player/
npm run dist:studio     # installers in dist/studio/
```

Documentation:
- [KevCast Player](../docs/player.md)
- [KevCast Studio](../docs/studio.md)
- [Enterprise roll-out](../docs/rollout.md)
- [Configuration (player.json)](../docs/configuration.md#playerjson)
- [Building](../docs/development.md#building-the-desktop-apps)
