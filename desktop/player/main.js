// KevCast Player — fullscreen signage app for Windows, macOS and Linux (incl. Raspberry Pi).
//
// What it adds on top of opening /player/ in a browser:
//   * finds the server on the network by itself (no typing IP addresses on a TV)
//   * starts at boot/login, fullscreen kiosk, hides the cursor, keeps the screen awake
//   * offline playback: the whole schedule's media is downloaded to disk and keeps
//     playing if the server or network goes down (see offline-cache.js)
//   * locked: it can only be closed with the exit key combination (default Alt+Q)
//   * self-healing: reloads after crashes, hangs or lost connections, plus a nightly refresh
//   * screenshots of what is on screen for the admin
//   * mass roll-out: reads server + provisioning key from a machine-wide player.json
//
// Keyboard (for installers): Alt+Q = exit (configurable with "exitShortcut" in player.json),
//   Ctrl+Shift+K = change server, Ctrl+Shift+R = reset pairing, Ctrl+Shift+W = windowed mode.
// Alt+F4, Cmd+Q, closing the window or killing the app from the taskbar are all ignored.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow, ipcMain, powerSaveBlocker, powerMonitor, globalShortcut, screen, Menu, protocol, session } = require('electron');
const { OfflineCache } = require('./offline-cache');
const { execFile } = require('child_process');
const { createConfig } = require('../common/config');
const { openConnectWindow } = require('../common/connect-window');

app.setName('KevCast Player');
app.setPath('userData', path.join(app.getPath('appData'), 'KevCast Player'));
const VERSION = require('../package.json').version;

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const config = createConfig(app, 'player');
let cfg = config.load();

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
if (cfg.disableGpu) app.disableHardwareAcceleration();

let win = null;
let retryTimer = null;
let hangTimer = null;
let cache = null;

// ---------------------------------------------------------------------------
// Exit lock: the player only closes with the exit shortcut (or an OS shutdown).
// ---------------------------------------------------------------------------
const EXIT_SHORTCUT = cfg.exitShortcut || 'Alt+Q';
let allowQuit = false;

function quitForReal() {
  allowQuit = true;
  app.quit();
}

app.on('before-quit', (e) => {
  if (!allowQuit) e.preventDefault();
});

function relaunch() {
  allowQuit = true;
  app.relaunch();
  app.exit(0);
}

function enableAutostart() {
  if (cfg.autostart === false || !app.isPackaged) return;
  if (process.platform === 'linux') {
    const dir = path.join(os.homedir(), '.config', 'autostart');
    const exe = process.env.APPIMAGE || process.execPath;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'kevcast-player.desktop'),
        `[Desktop Entry]\nType=Application\nName=KevCast Player\nExec="${exe}"\nX-GNOME-Autostart-enabled=true\n`);
    } catch {}
  } else {
    app.setLoginItemSettings({ openAtLogin: true });
  }
}

function playerUrl() {
  return `${cfg.server.replace(/\/+$/, '')}/player/`;
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => win && !win.isDestroyed() && win.loadURL(playerUrl()), 10000);
}

function createPlayerWindow() {
  const { bounds } = screen.getPrimaryDisplay();
  const windowed = !!cfg.windowed;
  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: windowed ? 1280 : bounds.width,
    height: windowed ? 720 : bounds.height,
    fullscreen: !windowed,
    kiosk: !windowed && cfg.kiosk !== false,
    frame: windowed,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'KevCast Player',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.webContents.setUserAgent(`${win.webContents.getUserAgent().replace(/ KevCastPlayer\/\S+/, "")} KevCastPlayer/${VERSION} (${os.platform()}; ${os.hostname()})`);
  win.setMenu(null);

  // Hide the mouse pointer on the signage canvas.
  win.webContents.on('dom-ready', () => win.webContents.insertCSS('*{cursor:none!important}'));

  // Server unreachable and nothing cached yet: show a friendly screen and keep retrying.
  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = aborted (navigation replaced)
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { server: cfg.server, error: desc } });
    scheduleRetry();
  });

  // Self-healing.
  win.webContents.on('render-process-gone', () => setTimeout(() => win && win.loadURL(playerUrl()), 2000));
  win.on('unresponsive', () => {
    clearTimeout(hangTimer);
    hangTimer = setTimeout(() => win && win.webContents.forcefullyCrashRenderer(), 30000);
  });
  win.on('responsive', () => clearTimeout(hangTimer));

  // Web pages in playlists must never navigate the player itself away.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(cfg.server) && !url.startsWith('file:')) e.preventDefault();
  });

  // Alt+F4 / the close button / Cmd+W: ignored unless the exit shortcut was used.
  win.on('close', (e) => {
    if (!allowQuit) e.preventDefault();
  });
  // Windows log-off or shutdown must not be blocked.
  win.on('session-end', () => { allowQuit = true; });
  // If something minimises or hides the window, bring it back.
  win.on('minimize', () => { if (!allowQuit && !cfg.windowed) setTimeout(() => win && win.restore(), 500); });

  win.on('closed', () => { win = null; });
  win.loadURL(playerUrl());
}

function startOfflineCache() {
  const origin = new URL(cfg.server);
  cache = new OfflineCache(path.join(app.getPath('userData'), 'offline-cache'), cfg.server, (status) => {
    if (win && !win.isDestroyed()) win.webContents.send('player:cache-status', status);
  });
  // Route the player's requests through the cache (http or https, whatever the server uses).
  protocol.handle(origin.protocol.replace(':', ''), (request) => cache.handle(request));
}

// ---------------------------------------------------------------------------
// Web pages in playlists: many sites (departure boards, traffic maps, dashboards) forbid being
// shown inside another page with X-Frame-Options or CSP frame-ancestors. A signage screen is
// a display, not a browser, so the player drops those two restrictions for embedded pages.
// ---------------------------------------------------------------------------
function allowEmbeddingWebPages() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== 'subFrame') return callback({});
    const headers = { ...details.responseHeaders };
    for (const name of Object.keys(headers)) {
      const lower = name.toLowerCase();
      if (lower === 'x-frame-options') delete headers[name];
      if (lower === 'content-security-policy') {
        headers[name] = headers[name].map((v) => v.split(';').filter((d) => !/^\s*frame-ancestors/i.test(d)).join(';'));
      }
    }
    callback({ responseHeaders: headers });
  });
}

// ---------------------------------------------------------------------------
// Weekly restart (set per display in the Web Studio; default Sunday 03:00).
// Windows: the computer restarts, so pending Windows updates get installed.
// macOS / Linux: the player app restarts (set "rebootCommand" in player.json to reboot the OS).
// ---------------------------------------------------------------------------
let maintenance = cfg.maintenance || { weeklyRestart: true, day: 0, time: '03:00' };

function checkWeeklyRestart() {
  if (!maintenance || !maintenance.weeklyRestart || cfg.weeklyRestart === false) return;
  const now = new Date();
  const [hh, mm] = String(maintenance.time || '03:00').split(':').map(Number);
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm || 0, 0);
  const minutesLate = (now - due) / 60000;
  // Run within 30 minutes of the planned time (covers a computer that was briefly asleep).
  if (now.getDay() !== Number(maintenance.day) || minutesLate < 0 || minutesLate > 30) return;
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  if (config.load().lastWeeklyRestart === today) return; // already done today
  config.save({ lastWeeklyRestart: today });
  console.log('[maintenance] weekly restart');
  allowQuit = true;
  if (process.platform === 'win32') {
    execFile('shutdown.exe', ['/r', '/t', '60', '/c', 'KevCast weekly restart (installs updates)'], { windowsHide: true }, (err) => {
      if (err) relaunch(); // no permission to restart Windows: at least restart the player
    });
  } else if (cfg.rebootCommand) {
    execFile('/bin/sh', ['-c', cfg.rebootCommand], (err) => { if (err) relaunch(); });
  } else {
    relaunch();
  }
}

function nightlyRefresh() {
  // Reload once a night (default 04:00) to keep long-running screens fresh.
  const [hh, mm] = String(cfg.nightlyReload || '04:00').split(':').map(Number);
  const next = new Date();
  next.setHours(hh, mm || 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    if (win) win.webContents.reloadIgnoringCache();
    nightlyRefresh();
  }, next - new Date());
}

function showConnect(autoConnect) {
  openConnectWindow({
    appName: 'KevCast Player',
    intro: 'This screen is not connected yet. Pick your KevCast server — after that, everything is managed from the admin.',
    hint: 'Ctrl+Shift+K opens this screen again later.',
    current: cfg.server,
    autoConnect,
    canCancel: !!win,
    fullscreen: !win && !cfg.windowed,
    onConnected: (url) => {
      if (url === cfg.server) return;
      config.save({ server: url });
      relaunch();
    },
    // Without a player window there is nothing to show; keep asking for a server.
    onClosed: () => { if (!win && !allowQuit) setTimeout(() => showConnect(false), 300); },
  });
}

// ---------------------------------------------------------------------------
// IPC for the web player (see preload.js)
// ---------------------------------------------------------------------------
ipcMain.handle('player:screenshot', async () => {
  if (!win) return null;
  const img = await win.webContents.capturePage();
  const size = img.getSize();
  const scaled = size.width > 960 ? img.resize({ width: 960 }) : img;
  return scaled.toJPEG(70);
});
ipcMain.handle('player:provisioning', () => {
  if (!cfg.provisioningKey) return null;
  return { key: cfg.provisioningKey, name: cfg.name || os.hostname(), group: cfg.group || '', playlist: cfg.playlist || '' };
});
ipcMain.handle('player:info', () => ({ version: VERSION, platform: process.platform, arch: process.arch, hostname: os.hostname(), exitShortcut: EXIT_SHORTCUT }));
ipcMain.handle('player:cache-status', () => (cache ? cache.getStatus() : null));
ipcMain.on('player:maintenance', (e, m) => {
  if (!m || typeof m !== 'object') return;
  maintenance = { weeklyRestart: !!m.weeklyRestart, day: Number(m.day) || 0, time: String(m.time || '03:00') };
  // Remember it, so the restart also happens when the server is unreachable.
  if (JSON.stringify(cfg.maintenance) !== JSON.stringify(maintenance)) cfg = config.save({ maintenance });
});
ipcMain.on('player:retry', () => win && win.loadURL(playerUrl()));
ipcMain.on('player:change-server', () => showConnect(false));

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  powerSaveBlocker.start('prevent-display-sleep');
  enableAutostart();
  allowEmbeddingWebPages();
  setInterval(checkWeeklyRestart, 60 * 1000);

  // macOS / Linux shutdown: let the system close the app.
  powerMonitor.on('shutdown', () => { allowQuit = true; });

  if (!globalShortcut.register(EXIT_SHORTCUT, quitForReal)) {
    console.warn(`Could not register exit shortcut "${EXIT_SHORTCUT}", falling back to Alt+Q`);
    globalShortcut.register('Alt+Q', quitForReal);
  }
  globalShortcut.register('CommandOrControl+Shift+K', () => showConnect(false));
  globalShortcut.register('CommandOrControl+Shift+W', () => { config.save({ windowed: !cfg.windowed }); relaunch(); });
  globalShortcut.register('CommandOrControl+Shift+R', async () => {
    // Forget the pairing: the screen registers again and shows a new code.
    if (win) {
      await win.webContents.session.clearStorageData({ storages: ['localstorage'] });
      win.loadURL(playerUrl());
    }
  });

  if (cfg.server) {
    startOfflineCache();
    createPlayerWindow();
    nightlyRefresh();
  } else {
    showConnect(true);
  }
});

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.on('window-all-closed', () => { if (allowQuit) app.quit(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
