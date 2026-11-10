# Changelog

All notable changes to KevCast are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.3] - 2026-11-10
### Fixed
- **Windows: KevCast Setup failed with "The KevCast Server service could not be registered (code 1)"**.
  - The service script stored the scheduled-task action in `$action`. PowerShell names are case-insensitive, so that
    was the script's own `-Action` parameter, which only accepts install/uninstall/stop/start, and the assignment failed.
  - The program files were installed, but the server never started.
- In a silent install (`/S`), message boxes no longer wait for a click, and a failed service registration now gives exit code 2.

### Added
- `/NOLIBREOFFICE` for KevCast Setup, so a silent install (`/S /NOLIBREOFFICE`) skips the LibreOffice download.
- CI now really installs KevCast Server Setup on Windows, checks the service, firewall rules, shortcut and web server,
  and uninstalls it again (`packaging/windows/smoke-test.ps1`).

## [0.2.2] - 2026-11-09
### Fixed
- **macOS: "KevCast Studio/Player is damaged and can't be opened"** (Dutch: *"is beschadigd"*).
  - The Mac apps were unsigned, which Apple-silicon Macs report as damaged with no way to open them.
  - They are now signed ad hoc, so macOS shows the normal "unidentified developer" prompt with **Open Anyway** in *System Settings → Privacy & Security*.
  - CI now verifies the signature of every Mac app (`codesign --verify --deep --strict`).
- The docs explain the first start on a Mac, including the `xattr -cr` workaround for 0.2.1 and earlier.

## [0.2.1] - 2026-11-09
### Changed
- **Node.js 26 LTS** ("Lithium") everywhere:
  - The server installers (Windows, macOS, Linux) now bundle Node.js 26 instead of 22.
  - CI runs on 26.
  - The Linux install script installs the current LTS from NodeSource when the system's Node.js is too old.
- The minimum Node.js version for running the server from source is now 20. Node.js 18 is end-of-life.
- GitHub Actions updated: `checkout` v7, `setup-node` v7, `upload-artifact` v7, `download-artifact` v8. This removes the "Node.js 20 is deprecated" warnings in the workflow runs.
- **Electron 42.11.18 → 45.2.3** for KevCast Player and KevCast Studio (newer Chromium). This applies Dependabot's #5. The GitHub Actions updates above cover Dependabot's #4.

### Added
- **Automatic releases.** In GitHub, go to **Actions → Build → Run workflow** on `main` and tick **release**, or push a version tag (`v0.2.1`). Either builds every installer and publishes a GitHub Release with all of them attached. The button creates the tag itself. The release notes are this changelog's section for that version. The release job checks that the tag matches `package.json`.

## [0.2.0] - 2026-11-09
### Security
- **Electron 38.8.6 → 42.11.18** for KevCast Player and KevCast Studio. This fixes [GHSA-jr5w-w6x2-84p9](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9), the mitigation for compromised eMudhra intermediate certificates, and includes later Chromium and V8 security backports. (Reported by Dependabot in #3.)
- Build tooling: `minimatch` ≥ 11.0.1 for [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), through an npm override. electron-builder is updated to 26.18.0. `npm audit` reports 0 vulnerabilities for the server and the desktop apps.

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

- **Web pages in the schedule.** Schedule a web page (or any single item) directly, without a playlist. Create one inline with **+ New web page…**. Web pages get **zoom** and **auto-reload** settings, plus a preview.
- The **KevCast Player app** shows web pages that normally refuse to be embedded (`X-Frame-Options`, CSP `frame-ancestors`), such as departure boards and traffic info.
- **Richer scheduling**:
  - repeat weekly (every 1–4 weeks), monthly (on a day of the month) or once
  - a validity period (*valid from / until*)
  - **repeat within a time window** ("every 15 minutes, show for 60 seconds"), which interrupts the normal content
  - **seconds per item** for each scheduled entry
- **Week overview**: one row per day showing exactly what a screen plays, including its default playlist and recurring items.
- **Weekly restart** of Player app screens (default Sunday 03:00, configurable per display). Windows restarts the computer so updates install. `rebootCommand` and `weeklyRestart` are available in `player.json`.
- Screenshots throughout the documentation and the README.
- **Display groups**:
  - A Groups page: create, colour, rename and delete groups, and add or remove screens.
  - Each group has its own page showing its screens, a week overview and its schedule entries.
  - Group actions: Schedule for this group, Send to group, Set default playlist, Identify, Reload, and **Copy schedule to…** other groups.
  - A screen can be in **several groups**. Existing single-group data is migrated automatically.
- **Displays page**: select several screens, then *Add to group / Remove from group / Set default playlist / Send / Schedule*. Filter by group.
- **Schedule tables**: select several entries, then *Enable / Disable / Change screens / Priority / Remove*. The schedule views can filter on a whole group.
- **KevCast Studio, This computer**: browse quick folders (Desktop, Documents, Downloads, OneDrive, drives, recent folders), see which files are already uploaded, and upload with progress. Includes a native **Browse…** dialog. Uploads stream from disk.
- Dependabot configuration for npm (server and desktop) and GitHub Actions.
- **File → Upload files…** (Ctrl/Cmd+U) in Studio. A playlist's **Upload** button adds the uploaded files to that playlist.

### Changed
- Players check the schedule every 5 seconds (was 15), and resume a playlist where it left off after an interruption.
- A single web page that stays on screen is no longer reloaded each time its duration ends.

### Fixed
- Removing a display (or group) that was the only target of a schedule entry turned that entry into "all displays". Such entries are now removed.
- The Windows MSI build failed because no application icon was set.
- Web pages appeared only after an 8-second delay on players.

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
