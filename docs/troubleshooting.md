# Troubleshooting & FAQ

## Server

### The admin page doesn't open
- Check the server is running:
  - Windows: Task Scheduler → *KevCast Server*, or `C:\ProgramData\KevCast\kevcast.log`
  - Linux: `systemctl status kevcast`
- Try `http://localhost:8080/admin/` **on the server itself**. If that works but other PCs can't connect, it's the firewall. Allow TCP 8080. The installers do this for the Domain and Private network profiles. If Windows classified the network as *Public*, change it to *Private*.
- Another program already using port 8080? Install with another port (`-Port 9000` on Windows, `PORT=9000` on Linux).

### PowerPoint files stay on "Converting…" or fail
- **Settings → Server** must show *LibreOffice* and *Slide renderer* as **OK**. Install what is missing (see [installation](installation.md)) and restart the server.
- Large presentations take time: roughly 1–3 seconds per slide on a small server. Conversions run one at a time.
- "Did not produce a PDF": the file is corrupt or password-protected. Open it in PowerPoint, save a copy, and upload that.
- Windows: if the server runs as SYSTEM and a LibreOffice update is stuck, reboot the server once after installing LibreOffice.
- As a workaround, export the presentation to **PDF** in PowerPoint and upload the PDF. Only the rendering step is needed then.

### Slides look different from PowerPoint
LibreOffice renders the slides. It uses the fonts installed **on the server**.
- Install the fonts your presentations use on the server, then click **Re-convert** on the media item.
- On Linux the installer adds Carlito and Caladea, which have the same metrics as Calibri and Cambria.
- Animations and slide transitions are not kept, because each slide becomes a still image. Use KevCast's own transitions.
- Embedded videos are not played. Upload the video as a separate media item.

### I forgot the admin password
Stop the server. In `data/db.json`, set `"adminUser": null` under `settings`, then start the server again.
The next visit to `/admin/` asks you to create the account again. Content and screens are kept.

## Screens

### The player can't find the server
Automatic discovery uses UDP broadcast on port 41234. It doesn't cross routers or VLANs, and some Wi-Fi networks block it.
- Type the address on the connect screen instead (e.g. `192.168.1.20`; port 8080 is assumed).
- Or deploy a [`player.json`](rollout.md) with the `server` address.
- Check that UDP 41234 is allowed inbound on the server's firewall.

### The screen shows a code but nothing happens after pairing
- The code is entered in **Displays → Add display**. It isn't case-sensitive.
- The screen should switch within a second. If not, it can't hold the live connection. Check proxies between the screen and the server; event streams must not be buffered (see [reverse proxy notes](installation.md#https-and-a-friendly-address-optional)). The screen also checks every 30 seconds.

### The screen shows a clock instead of my content
Nothing is scheduled right now and the screen has no default playlist. Set a **default playlist** on the display card,
or check the schedule with the display filter. A playlist whose items are disabled, or whose presentation is still converting, also counts as empty.

### The screen is black or stuck
- Use **Reload** in the admin.
- On the screen, press **Ctrl+Shift+W** to switch to windowed mode and see what's happening.
- Virtual machines or old GPUs: set `"disableGpu": true` in `player.json`.

### How do I close the player?
Press **Alt+Q**, or your configured `exitShortcut`. Alt+F4 and the close button are ignored on purpose.

### A web page stays blank
Many sites (Google, Microsoft 365, banks, social media) forbid being embedded with `X-Frame-Options` or
`Content-Security-Policy: frame-ancestors`. Use the site's embed or *publish to web* link (Power BI,
Google Slides, YouTube embed URLs), or take a screenshot instead.

### Videos don't play
- Use H.264/AAC MP4. HEVC/H.265 and some MOV files don't play in all players.
- Videos are muted, so they can start without a click. Sound isn't supported yet.

### The screen doesn't come back after a power cut
- Turn on **automatic login** for the user account on the screen PC.
- In the BIOS, set *Restore on AC power loss* to **Power On**.
- The player starts at login (installed builds only).

### Is the screen safe if the server is down?
Yes, for the player app. Every screen downloads its whole schedule and keeps it on disk, and keeps playing. This includes after a reboot.
Check **Offline: Ready** on the display card. See [offline playback](player.md#offline-playback).

## FAQ

**Do screens need Microsoft Office or a licence?**
No. The server converts presentations with LibreOffice, and players only show images.

**Does KevCast need internet access?**
No. Everything runs on your network. The installers download prerequisites once.

**How many screens can one server handle?**
Players only download each file once and then send a small heartbeat every 30 seconds, so the load is light.
A modest server handles hundreds of screens. Media downloads after a big upload are the main load.

**Can I run it in Docker?**
It's not needed, and there are no Docker files on purpose: the native installers avoid Docker Desktop licensing in enterprises.

**Can several people use the admin?**
There is currently one admin account; share it, or put the admin behind your SSO proxy. Multiple users with roles are on the roadmap.

**Android TV / Samsung Tizen / LG webOS?**
Use the TV's browser or a kiosk-browser app with the player address. A native Android app is on the roadmap.

**Where are my files?**
In the server's data folder (see [installation → Backup](installation.md#backup-and-restore)), and as an offline copy on each player.
