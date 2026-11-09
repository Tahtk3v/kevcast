# KevCast

**Self-hosted narrowcasting / digital signage that is easy to install and easy to use.**
Upload PowerPoint, build a playlist, drag it onto a calendar, and every screen in the building plays it,
even when the network goes down.

[![Build](https://github.com/tahtk3v/kevcast/actions/workflows/build.yml/badge.svg)](https://github.com/tahtk3v/kevcast/actions/workflows/build.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Platforms](https://img.shields.io/badge/server-Windows%20%7C%20Linux%20%7C%20macOS-informational)

KevCast takes its inspiration from EasyScreen and is a simpler alternative to Xibo.

## Highlights

- **PowerPoint as a first-class format.** Drop in a `.pptx` and every slide becomes a screen. No Office licences on screens.
- **Visual scheduler.** Click and drag on a week calendar. Supports overnight slots, date ranges, priorities, and targeting of screens or groups.
- **Display groups and "Send to screens".** Put a playlist on a whole floor in two clicks. Make it the default, take over now, or schedule it.
- **KevCast Player app** for Windows, macOS, Linux and Raspberry Pi:
  - finds the server by itself
  - runs as a fullscreen kiosk that only closes with **Alt+Q**
  - **stores the whole schedule locally** and keeps playing when the server is down
  - recovers from crashes and sends screenshots back
- **KevCast Studio**: a desktop app to manage everything. The same interface is also in any browser.
- **Zero-touch roll-out.** Deploy the MSI or .deb plus a `player.json` with GPO, Intune, MDM or Ansible. Screens appear already approved, named and grouped.
- **Easy to install.** One installer per OS. Plain Node.js, a JSON-file database, no Docker, no database server, no licences.

## Get started

Each part has its own installer. Install only what a computer needs:

| Installer | Install on | Windows | macOS | Linux / Raspberry Pi |
|---|---|---|---|---|
| **KevCast Setup**: pick Server, Player and/or Studio | any Windows PC | `KevCast-Setup-*.exe` | – | – |
| **KevCast Server** | one computer per organisation | `KevCast-Server-Setup-*.exe` | `KevCast-Server-*.pkg` | `kevcast-server_*.deb` |
| **KevCast Player** | each computer behind a screen | `.exe` / `.msi` | `.dmg` | `.deb` / `.AppImage` |
| **KevCast Studio** (optional) | admins' PCs | `.exe` / `.msi` | `.dmg` | `.deb` / `.AppImage` |

Download them from the latest [Build workflow run](https://github.com/tahtk3v/kevcast/actions/workflows/build.yml) (**Artifacts**).

1. **Install the server.** It adds a **KevCast Web Studio** icon to the desktop.
2. **Open KevCast Web Studio** and create your account.
3. **Add content**: drag a PowerPoint onto **Media**, then add it to a playlist.
4. **Connect a screen**, in one of two ways:
   - install **KevCast Player** (it finds the server automatically), or
   - point any browser at **`http://<server>:8080/player/`**

   The screen shows a code. Enter it under **Displays → Add display**.
5. **Schedule**: drag on the **Schedule** calendar, or use **Send to screens**.

Tip: open `http://<server>:8080/` on any computer for a start page that links to the Web Studio and shows the exact player address.

## Documentation

| | |
|---|---|
| [Installation](docs/installation.md) | Windows, Linux, macOS, HTTPS, backups, upgrades |
| [User guide](docs/user-guide.md) | Media, playlists, schedule, displays, groups, send to screens |
| [KevCast Player](docs/player.md) | Screen app, keyboard shortcuts, Alt+Q exit, offline playback, browser players |
| [KevCast Studio](docs/studio.md) | Desktop management app |
| [Enterprise roll-out](docs/rollout.md) | player.json, provisioning key, GPO, Intune, Ansible, MDM |
| [Configuration](docs/configuration.md) | Environment variables, player.json reference |
| [Architecture](docs/architecture.md) | How it works, data model, offline design, security |
| [API reference](docs/api.md) | REST API for automation |
| [Troubleshooting & FAQ](docs/troubleshooting.md) | Common problems and answers |
| [Development](docs/development.md) | Running from source, tests, building, releasing |

## How it fits together

```
 KevCast Studio / browser ──▶ ┌──────────────────────────┐ ◀── KevCast Player / browser
   (manage)                   │      KevCast Server      │       (one per screen)
                              │  Node.js · port 8080     │
                              │  LibreOffice → slides    │   UDP 41234: auto-discovery
                              └──────────────────────────┘
```

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues
privately as described in [SECURITY.md](SECURITY.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © Kevin B
