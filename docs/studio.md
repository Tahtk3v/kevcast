# KevCast Studio

KevCast Studio is the desktop app for managing KevCast. It runs on Windows, macOS and Linux. It shows the same
interface as the web admin (`/admin/`), in a native window with menus and keyboard shortcuts.
Use whichever you prefer; both always show the same data.

## Installing

| Platform | File |
|---|---|
| Windows | `KevCast-Studio-x.y.z-win-x64.exe` (choose the folder) or `.msi` (managed roll-out) |
| macOS | `KevCast-Studio-x.y.z-mac-*.dmg` |
| Linux | `.deb` or `.AppImage` |

## Connecting

At first start Studio searches the network and lists every KevCast server it finds, with the
organisation name. If there is only one, it connects straight away. You can also type an address.

Then sign in with your admin account. Studio remembers the server, the window size and position,
and up to five recent servers (**File → Recent servers**).

IT can preset the server with `studio.json` (same folders as [`player.json`](rollout.md)) or
`--server=http://…`.

## Menus and shortcuts

| Menu | Item | Shortcut |
|---|---|---|
| File | Upload media… | Ctrl/Cmd+U |
| File | New playlist | Ctrl/Cmd+N |
| File | Connect to another server… / Recent servers / Open in web browser | |
| Go | Dashboard · Media · Playlists · Schedule · Displays & groups | Ctrl/Cmd+1 … 5 |
| Go | Settings | Ctrl/Cmd+, |
| View | Reload, zoom, full screen, developer tools | |

## Working in Studio

- **Drag PowerPoint files** from Explorer or Finder straight onto the window to upload them.
- **Preview** in the playlist editor opens a separate preview window.
- **Download backup** opens a normal save dialog.
- Links to other websites open in your default browser.

See the [user guide](user-guide.md) for the screens themselves: media, playlists, schedule, displays, groups
and *Send to screens*.
