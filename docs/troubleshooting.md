# Troubleshooting & FAQ

## Server

### Windows setup: "The KevCast Server service could not be registered (code 1)"
The details show *"The variable cannot be validated because the value … is not a valid value for the Action variable"*.
This was a bug in KevCast Setup 0.2.2: the program files were installed, but the background service wasn't
registered, so the server didn't start. Run **KevCast Setup 0.3.0 or later** over it. Your data is kept.

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

### Slides look different from PowerPoint, or the text is garbled or misplaced
LibreOffice renders the slides. It uses the fonts installed **on the server**. A missing font is replaced by
another one, which makes text wider or narrower, so it wraps differently and boxes no longer line up.
- KevCast checks every PowerPoint after converting it. The media card then says *⚠ N fonts missing on the server*,
  and the Media page lists which fonts.
- Install those fonts on the server **for all users**: on Windows, right-click the font file → **Install for all users**.
  A plain *Install* puts the font in your own account only, and the KevCast service (which runs as SYSTEM) can't see it.
  On Linux, copy the font to `/usr/local/share/fonts` and run `sudo fc-cache -f`.
- Then click **Re-convert these** on the Media page, **Re-convert** on one item, or **Settings → Server → Re-convert all**.
- **Garbled letters** (pieces of letters cut off or overlapping), even with the font installed: LibreOffice can't draw
  that font properly. This happens with some fonts, and with fonts PowerPoint embedded in the file (KevCast 0.5.0 and
  later ignore embedded copies of fonts the server has installed). Fix it in the Web Studio, without changing the file:
  - Open the presentation in **Media** and choose **Fonts → Arial for all text**. KevCast converts it again with Arial,
    which every computer has.
  - Or click **Replace with Arial** next to the one font that goes wrong. That applies to every presentation using it.
    Manage the list under **Settings → Server → Font replacements**; you can pick another font than Arial there.
  - On the Media page, **Use Arial for these** does it for all presentations with missing fonts at once.
  - **Exactly like the original:** export the presentation to PDF in PowerPoint and upload the PDF, or let KevCast Studio
    do that automatically: an administrator turns on *Convert PowerPoint files with PowerPoint on this user's computer*
    for the user ([KevCast Studio](studio.md#powerpoint-converted-on-your-own-computer-windows)).
  - With KevCast 0.3.0 or earlier on Windows, the bundled slide renderer also couldn't find fonts that weren't embedded
    in the PDF. Update the server (0.4.0 and later) and re-convert.
- For a pixel-perfect result, export the presentation to **PDF** in PowerPoint (*File → Export → PDF*) and upload the PDF:
  PowerPoint then embeds its own fonts and layout.
- On Linux the installer adds Carlito and Caladea, which have the same metrics as Calibri and Cambria.
- Animations and slide transitions are not kept, because each slide becomes a still image. Use KevCast's own transitions.
- Embedded videos are not played. Upload the video as a separate media item.

### I forgot my password
- **Another administrator** can set a new one: *Settings → Users → Edit*.
- **The only administrator forgot it**: stop the server. In `data/db.json`, under `users`, delete the entry with your
  `username` (keep a copy of the file first), then start the server. With no administrator left, the Web Studio asks you to
  create one again. Other users and all content stay.
The next visit to `/admin/` asks you to create the account again. Content and screens are kept.

## Screens

### macOS says KevCast Player or Studio "is damaged" / "is beschadigd"
This happens with versions before 0.2.2, which weren't signed at all. The app isn't actually damaged. Either:
- install the latest release, which shows the normal **Open Anyway** option (see [first start on a Mac](studio.md#first-start-on-a-mac)), or
- run once in Terminal, then open the app: `xattr -cr "/Applications/KevCast Studio.app"` (or `KevCast Player.app`).

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
Many sites (public transport, Google, Microsoft 365, banks, social media) forbid being embedded, using
`X-Frame-Options` or `Content-Security-Policy: frame-ancestors`.
- **KevCast Player app**: these restrictions are ignored, so such pages show. If a page is still blank, it probably needs a login or blocks automated browsers. Check it with **Preview on a screen** in the web page dialog.
- **Browser players** can't bypass this. Use the app on that screen, or the site's embed/*publish to web* link (Power BI, Google Slides, YouTube embed URLs).
- Pages that show a cookie banner: the banner appears once per player and then remembers your choice, if you click it on the screen with a mouse. Otherwise pick a page or embed URL without one.
- Text too small or too big? Change the **Zoom** of the web page.

### Videos don't play
- Use H.264/AAC MP4. HEVC/H.265 and some MOV files don't play in all players.
- Videos are muted, so they can start without a click. Sound isn't supported yet.

### The screen restarts on Sunday night
That's the **weekly restart** (default Sunday 03:00), so Windows updates get installed. Change or switch it off per screen in **Displays → Settings**.

### A recurring item (every N minutes) doesn't appear
- It only shows inside its time window, for *show for* seconds at every *every N minutes*, counted from the window start (07:00, 07:15, 07:30, …).
- A higher-priority entry at the same time wins. Check the **Week overview** for that screen.
- Screens check the schedule every 5 seconds, so very short durations (under ~10 s) may be cut short.

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
Yes. Administrators add users under *Settings → Users*, as an **Editor** (content, playlists, schedules, displays and groups) or an **Administrator** (also users, the organisation name, the roll-out key and backups). Single sign-on isn't built in; you can put the Web Studio behind an SSO proxy.

**Android TV / Samsung Tizen / LG webOS?**
Use the TV's browser or a kiosk-browser app with the player address. A native Android app is on the roadmap.

**Where are my files?**
In the server's data folder (see [installation → Backup](installation.md#backup-and-restore)), and as an offline copy on each player.
