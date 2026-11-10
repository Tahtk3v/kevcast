# Enterprise roll-out

This page describes how to deploy KevCast Player to tens or hundreds of screens without visiting each one to type a pairing code.

## How it works

1. In **Settings → Roll out the Player app**, copy the **provisioning key** and the example `player.json`.
2. Deploy two things to every screen computer:
   - the **KevCast Player** installer (MSI, .deb or .dmg)
   - a **`player.json`** file in the machine-wide folder
3. When the player starts it reads `player.json`, connects to the server and registers with the key. The server then:
   - **approves it immediately** (no pairing code)
   - **names** it after `name`, or else the computer's hostname
   - puts it in the **group** from `group`
   - sets its **default playlist** to `playlist` (matched by name or id)

From then on the screen is managed centrally like any other. You can rename it or change its group in the admin.

### The file

```json
{
  "server": "http://signage.company.local:8080",
  "provisioningKey": "copy-from-settings",
  "group": "Canteen",
  "playlist": "Canteen menu",
  "exitShortcut": "Alt+Q",
  "nightlyReload": "04:00"
}
```
Every key is described in the [configuration reference](configuration.md#playerjson).

| OS | Path |
|---|---|
| Windows | `C:\ProgramData\KevCast\player.json` |
| macOS | `/Library/Application Support/KevCast/player.json` |
| Linux / Raspberry Pi | `/etc/kevcast/player.json` |

Settings in this file **override** what someone chooses on the screen itself. On a screen with a deployed
`server`, Ctrl+Shift+K can't switch servers, because the deployed server always wins. Change the file instead.

### The key

- Treat the key like a password. Anyone who has it can add a screen to your server.
- **New key** in Settings replaces it. Screens that are already connected keep working; only new installs need the new key.
- The key only approves new screens. It gives no access to the admin.

## Windows: Group Policy, Intune or SCCM

**MSI**: `KevCast-Player-x.y.z-win-x64.msi` installs per machine and supports a silent install:
```powershell
msiexec /i KevCast-Player-0.2.3-win-x64.msi /qn
```

**player.json** with a small PowerShell script (Intune *Platform script*, SCCM, or a GPO startup script):
```powershell
$dir = "$env:ProgramData\KevCast"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
@'
{
  "server": "http://signage.company.local:8080",
  "provisioningKey": "copy-from-settings",
  "group": "Floor 2"
}
'@ | Set-Content -Path "$dir\player.json" -Encoding UTF8
```
or with **Group Policy Preferences → Windows Settings → Files** (copy from a share to `%ProgramData%\KevCast\player.json`).

**Recommended screen PC settings**
- Turn on automatic sign-in for a local, non-admin "signage" user. The player starts at sign-in and is set to start at login automatically.
- Power plan: never sleep, never turn off the display.
- Turn off Windows Update automatic restarts during opening hours.
- Optional: *Assigned Access* (kiosk mode) or *Shell Launcher* with KevCast Player as the only app.

## Linux / Raspberry Pi: Ansible or a script

```bash
sudo apt install ./KevCast-Player-0.2.3-linux-arm64.deb
sudo mkdir -p /etc/kevcast
sudo tee /etc/kevcast/player.json >/dev/null <<'JSON'
{ "server": "http://signage.company.local:8080", "provisioningKey": "copy-from-settings", "group": "Warehouse" }
JSON
```

An Ansible example:
```yaml
- hosts: signage
  become: true
  tasks:
    - name: Install KevCast Player
      ansible.builtin.apt:
        deb: /srv/packages/KevCast-Player-0.2.3-linux-arm64.deb
    - name: Configure KevCast Player
      ansible.builtin.copy:
        dest: /etc/kevcast/player.json
        mode: "0644"
        content: "{{ {'server': kevcast_server, 'provisioningKey': kevcast_key, 'group': kevcast_group} | to_nice_json }}"
```

Turn on desktop auto-login for the screen user. On Raspberry Pi OS: `sudo raspi-config` → *System Options → Boot / Auto Login → Desktop Autologin*.
The player adds itself to `~/.config/autostart` on first start.

## macOS: MDM (Jamf, Intune, Kandji…)

- Deploy the `.dmg` or the app bundle with your MDM.
- Deploy `/Library/Application Support/KevCast/player.json` with a script or a package.
- Enable automatic login and turn off sleep (`sudo pmset -a sleep 0 displaysleep 0`).

## Without a key: bulk pairing

You can still deploy only the `server` setting. Each screen then shows a pairing code, which someone
enters under **Displays → Add display**. This suits a handful of screens, or when you want an explicit approval step.

## After the roll-out

- Use **groups** to send content to many screens at once (*Send to group*, schedule targets).
- Watch the **Offline** status on each card to confirm every screen has the content stored locally.
- Use **Reload** on a group after a server upgrade to switch all screens to the new player at once.
