# KevCast documentation

KevCast is self-hosted narrowcasting (digital signage). You install one server. Screens run the
**KevCast Player** app or any web browser. You manage everything from **KevCast Studio** or the web admin.

| I want to… | Read |
|---|---|
| Install the server on Windows, Linux or macOS | [Installation](installation.md) |
| Learn the admin: media, playlists, schedule, displays, groups | [User guide](user-guide.md) |
| Put screens in groups and update their schedule at once | [User guide → Groups](user-guide.md#groups) |
| Upload PowerPoints from your computer with KevCast Studio | [KevCast Studio](studio.md#uploading-from-this-computer) |
| Set up a screen with the Player app or a browser | [KevCast Player](player.md) |
| Use the desktop management app | [KevCast Studio](studio.md) |
| Deploy many screens at once (GPO, Intune, MDM, Ansible) | [Enterprise roll-out](rollout.md) |
| Look up every setting and environment variable | [Configuration reference](configuration.md) |
| Understand how it works inside | [Architecture](architecture.md) |
| Integrate or automate with the REST API | [API reference](api.md) |
| Fix a problem | [Troubleshooting & FAQ](troubleshooting.md) |
| Work on the code or build the apps | [Development](development.md) |

## Quick start (5 minutes)

1. **Server**:
   - Windows: run `KevCast-Setup` and keep *Server* ticked (or use `KevCast-Server-Setup`).
   - Linux: `sudo apt install ./kevcast-server_*.deb`.
   - macOS: open `KevCast-Server-*.pkg`.

   See [Installation](installation.md#installers-recommended).
2. **Web Studio**: double-click the **KevCast Web Studio** icon on the desktop (or open `http://<server>:8080/admin/`) and create your administrator account.
3. **Content**: on the **Media** page drag in a PowerPoint file. Its slides are converted automatically.
4. **Playlist**: on the **Playlists** page click **New** and click **+** next to your presentation.
5. **Screen**: either
   - install KevCast Player on the screen's PC (it finds the server and shows a 6-character code), or
   - open **`http://<server>:8080/player/`** in the screen's browser.
6. **Pair**: on the **Displays** page click **Add display**, type the code and choose your playlist as the default.

Your presentation is now on screen. Use the **Schedule** page to decide what plays when.

## Glossary

| Term | Meaning |
|---|---|
| **Media** | Something that can be shown: an image, video, PowerPoint/PDF (one item, many slides), web page or text slide. |
| **Playlist** | An ordered list of media that loops. Each item has a duration and a transition. |
| **Display** | One screen running a player. It has a name, an optional group, a default playlist and screen settings. |
| **Group** | A label shared by several displays (e.g. *Canteen*). Schedules and commands can target a whole group. |
| **Schedule entry** | "Play playlist X on these screens on these days between these times." |
| **Default playlist** | What a display plays when no schedule entry is active. |
| **Pairing** | Linking a new player to the server by entering the code it shows. |
| **Provisioning key** | Secret that lets pre-configured players approve themselves without pairing. |
