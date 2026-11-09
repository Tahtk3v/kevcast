# User guide

The admin is available at `http://<server>:8080/admin/` and inside [KevCast Studio](studio.md).
Changes reach the screens within seconds. Nothing needs a "publish" button.

- [Dashboard](#dashboard)
- [Media](#media)
- [Playlists](#playlists)
- [Schedule](#schedule)
- [Displays and groups](#displays-and-groups)
- [Send to screens](#send-to-screens)
- [Settings](#settings)
- [Tips for good-looking screens](#tips-for-good-looking-screens)

---

## Dashboard

- **Counters**: screens online, media, playlists and active schedules. Click one to go there.
- **Get started in 4 steps**: a checklist that disappears once you have content, a playlist, a screen and a schedule.
- **Screens**: every display with its live status and what it is showing right now (including the slide number).
- **Recent uploads**.
- A warning appears at the top if the server can't convert PowerPoint (LibreOffice or Poppler missing).

## Media

Everything you can show on a screen lives here.

### Uploading
Drag files **anywhere** onto the admin window, or click **Upload files**. A progress bar shows for each file.

| Type | Formats | Notes |
|---|---|---|
| PowerPoint & PDF | `.pptx .ppt .pps .ppsx .pot .potx .odp .key .pdf` | Converted to one image per slide (1920 px wide). Shows a spinner while converting. |
| Images | `.jpg .png .gif .webp .svg .bmp` | Shown as-is. |
| Videos | `.mp4 .webm .mov .m4v .ogv .mkv` | H.264 MP4 plays everywhere. Muted by default so screens can autoplay. |

Upload limit: 4 GB per file.

### Web pages
Click **Web page** and enter an address, e.g. a Power BI *Publish to web* link, a Grafana dashboard or an intranet page.
Some sites block being shown inside another page. They then show as a blank or error page;
see [Troubleshooting](troubleshooting.md#a-web-page-stays-blank).

### Text slides
Click **Text slide** to make an announcement without PowerPoint. You set:
- a heading and body text, with a live preview
- one of six colour presets, or your own background gradient and text colour
- alignment (centre or left) and size (S, M or L)

### Managing media
Click a card to open its details. From there you can:
- **Rename** it.
- **Browse slides**: click a thumbnail in the strip to preview that slide.
- **Add to playlist**, or create a new playlist from the item.
- **Re-convert** a presentation, for example after installing a font on the server.
- **Edit text** (text slides only).
- **Delete** it. The item is also removed from every playlist.

**Used in** lists the playlists that contain the item. Use the filter chips (Images, Videos, PowerPoint & PDF, …) and the search box to find things.

## Playlists

A playlist is an ordered set of media that loops. The page has three columns: your playlists, the editor and the media library.

| Action | How |
|---|---|
| Create | **New** |
| Add media | Drag from the library into the list (at any position), or click **+** to add at the end |
| Reorder | Drag an item by its handle ⋮⋮ |
| Duration | Seconds per item. For PowerPoint it's **seconds per slide**. Empty = playlist default. For videos, empty = play to the end. |
| Skip temporarily | Untick the checkbox; the item stays in the list |
| Remove | 🗑 on the row |
| Rename / colour | Edit the name at the top. The colour is used in the schedule calendar. |
| Default time and transition | Fade, Slide, Zoom or None for the whole playlist |
| Preview | Opens exactly what a screen will show, in a new window |
| Duplicate / delete | Icons next to the name |

Changes save automatically. *All changes saved* appears at the top. The total running time is shown above the list.

## Schedule

The schedule decides **what plays when, and where**.

### The calendar
- A week view (Monday to Sunday) with **This week** and arrows to page through weeks. Today is highlighted and a red line shows the current time.
- **Click and drag** on a day to make a new entry for that time range (snaps to 30 minutes). Click a block to edit it.
- The **display filter** (top right) shows only entries that apply to one screen. It also says what that screen plays outside scheduled times.
- Overlapping entries are drawn side by side. Disabled entries are striped.
- Below the calendar a table lists every entry, with an on/off switch.

### An entry
| Field | Meaning |
|---|---|
| What should play? | The playlist |
| Which screens? | **All displays**, one or more groups (▦), and/or individual displays |
| Days | Mon–Sun toggles, plus *Weekdays*, *Weekend* and *Every day* shortcuts |
| All day / From–Until | The time window. If *Until* is earlier than *From*, it runs past midnight (e.g. 22:00–06:00). |
| Starting on / Ending on | Optional date range, e.g. a campaign from 1 to 14 December |
| Priority | **Normal**, **High** or **Urgent**, used when entries overlap |
| Label | Optional name shown on the calendar |
| Enabled | Switch an entry off without deleting it |

### Which entry wins?
When more than one entry is active for a screen at the same moment:
1. The **highest priority** wins (Urgent > High > Normal).
2. On equal priority, the **most specific** entry wins: aimed at this display > aimed at its group > aimed at everyone.
3. Otherwise the **most recently created** entry wins.

If no entry is active, the screen plays its **default playlist**. If it has none, it shows a clock with your organisation name.

Screens carry a copy of the schedule, so switches happen on time even when the server is unreachable.

## Displays and groups

### Adding a display
1. Start **KevCast Player** on the screen, or open `http://<server>:8080/player/` in its browser.
2. The screen shows a 6-character code. The **Displays** menu gets a "1 new" badge.
3. Click **Add display** and fill in:
   - the code
   - a name (e.g. *Reception TV*)
   - optionally a group (e.g. *Ground floor*)
   - a default playlist
4. Click **Connect display**.

For many screens at once, skip pairing with a [provisioning key](rollout.md).

### The display card
- Online status, plus an **App** or **Browser** badge.
- A live preview: the latest **screenshot** for app players, otherwise the current slide.
- What is scheduled now, the default playlist (change it right there), resolution and IP address.
- **Offline: Ready 12/12 files** (app players): how much of the schedule is stored on the device.
- Buttons:
  - **Settings**
  - **Identify**: shows the name full-screen for 10 seconds
  - **Reload**
  - **📷**: take a screenshot now
  - **Schedule**: opens the calendar filtered to this screen

### Display settings
| Setting | Options |
|---|---|
| Name, group, notes | Free text. Type a new group name to create a group. |
| Default playlist | Plays when nothing is scheduled |
| Orientation | Landscape, Portrait ⟲ or Portrait ⟳. Use portrait for a TV mounted on its side; the content is rotated for you. |
| Image fit | **Fit** shows everything (black bars if the shape differs). **Fill** crops to fill the screen. |
| Background | Colour behind images that don't fill the screen |
| Show clock | Clock in the top-right corner |
| News ticker | Scrolling text bar at the bottom. One message per line. Speed and colours are adjustable. |
| Remove | Disconnects the screen. It shows a new pairing code. |

### Groups
The Displays page is organised by group. Each group header has these actions:
- **Send to group** (see below)
- **Identify** and **Reload** for every screen in the group
- **Rename**, which also updates schedules that target the group

## Send to screens

**Send to screens** is the fastest way to put a playlist on many screens. Find it on the Displays page (per group and at the top) and in the playlist editor.

1. Pick the playlist and the screens: all, groups and/or individual screens. The dialog shows how many screens that is.
2. Choose how:
   - **Make it the default**: the playlist becomes the default of those screens. Scheduled content still takes over at its times.
   - **Take over now**: plays immediately with high priority until the time you pick today, then the screens return to normal. Good for announcements and emergencies.
   - **Schedule…**: opens the schedule dialog with the screens already filled in.

## Settings

- **General**: organisation name, shown on idle screens and in the apps.
- **Change password**.
- **Connect a screen**: the player addresses of this server, with copy buttons.
- **Server**: whether LibreOffice and the slide renderer were found (with install hints), version, platform and data folder.
- **Roll out the Player app**: the provisioning key and a ready-made `player.json` (see [Enterprise roll-out](rollout.md)). **New key** replaces the key; screens that are already connected keep working.
- **Account**: download a backup (JSON) and sign out.

## Tips for good-looking screens

- Make presentations in **16:9**, or 9:16 for portrait screens, so they fill the screen.
- Use big text. People read signage from metres away and only for a few seconds.
- 8–12 seconds per slide is a good default. Use longer for slides with a lot of text.
- Use high-contrast colours. Thin fonts and pastel-on-white disappear on TVs.
- For video, use H.264 MP4 at the screen's resolution (usually 1920×1080).
- Install any special fonts your presentations use on the server, then **Re-convert** them. Otherwise LibreOffice substitutes a similar font.
