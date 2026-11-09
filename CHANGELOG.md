# Changelog

All notable changes to KevCast are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]
### Added
- **Separate installers** for the Server, Player and Studio.
  - The server installers bundle their own Node.js runtime:
    - Windows `KevCast-Server-Setup.exe` (with Poppler included)
    - Linux `kevcast-server` `.deb` (amd64 and arm64)
    - macOS `.pkg`
  - **KevCast Setup** for Windows lets you choose Server (with optional LibreOffice), Player and/or Studio.
- Installing the server adds a **KevCast Web Studio** desktop and menu shortcut.
- **Start page** at the server address with a link to the Web Studio and the exact page browser-based screens must open. It is also shown on the Displays page and by the installers.
- App icons for KevCast Player, KevCast Studio and the server.

### Fixed
- The Windows MSI build failed because no application icon was set.

## [0.1.0] - 2026-11-09
### Added
- **Server** for Windows, macOS and Linux with one-step installers. There is no database server and no Docker.
- **PowerPoint and PDF support**: slides are converted to images on the server with LibreOffice and Poppler.
- **Media library** for images, videos, web pages and text slides, with drag & drop upload.
- **Playlist editor** with drag & drop ordering, per-item durations, transitions, preview and auto-save.
- **Visual week scheduler** with click-and-drag, overnight slots, date ranges, priorities and targeting of displays and groups.
- **Displays and groups**:
  - pairing codes
  - live status and now-playing
  - per-screen orientation, fit, clock and news ticker
  - group actions
- **Send to screens**: make a playlist the default, take over now until a set time, or schedule it.
- **Web player** for any browser, with service-worker offline support.
- **KevCast Player app** (Windows/macOS/Linux/Raspberry Pi):
  - LAN auto-discovery
  - fullscreen kiosk that only closes with **Alt+Q**
  - offline cache of the whole schedule on disk
  - self-healing
  - screenshots
- **KevCast Studio app** for managing everything from the desktop.
- **Enterprise roll-out**: `player.json` with a provisioning key gives zero-touch approval with name, group and default playlist.
- REST API, documentation and a CI workflow that builds the desktop installers.
