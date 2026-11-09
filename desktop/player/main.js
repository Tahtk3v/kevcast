// KevCast Player — fullscreen signage app for Windows, macOS and Linux (incl. Raspberry Pi).
//
// What it adds on top of opening /player/ in a browser:
//   * finds the server on the network by itself (no typing IP addresses on a TV)
//   * starts at boot/login, fullscreen kiosk, hides the cursor, keeps the screen awake
//   * offline playback: content is cached on disk and keeps playing if the server is down
//   * self-healing: reloads after crashes, hangs or lost connections, plus a nightly refresh
//   * screenshots of what is on screen for the admin
//   * mass roll-out: reads server + provisioning key from a machine-wide player.json
//
// Keyboard (for installers): Ctrl+Shift+K = change server, Ctrl+Shift+R = reset pairing,
//                            Ctrl+Shift+Q = quit, Ctrl+Shift+W = toggle windowed mode
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow, ipcMain, powerSaveBlocker, globalShortcut, screen, Menu } = require('electron');
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

// Service workers (offline cache) need a "secure" origin. Signage servers on a LAN are
// usually plain http, so tell Chromium to trust the configured server origin.
if (cfg.server) {
  try {
    app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', new URL(cfg.server).origin);
  } catch {}
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
if (cfg.disableGpu) app.disableHardwareAcceleration();

let win = null;
let retryTimer = null;
let hangTimer = null;

function relaunch() {
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

  win.on('closed', () => { win = null; });
  win.loadURL(playerUrl());
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
    onClosed: () => { if (!win) app.quit(); },
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
ipcMain.handle('player:info', () => ({ version: VERSION, platform: process.platform, arch: process.arch, hostname: os.hostname() }));
ipcMain.on('player:retry', () => win && win.loadURL(playerUrl()));
ipcMain.on('player:change-server', () => showConnect(false));

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  powerSaveBlocker.start('prevent-display-sleep');
  enableAutostart();

  globalShortcut.register('CommandOrControl+Shift+K', () => showConnect(false));
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  globalShortcut.register('CommandOrControl+Shift+W', () => { config.save({ windowed: !cfg.windowed }); relaunch(); });
  globalShortcut.register('CommandOrControl+Shift+R', async () => {
    // Forget the pairing: the screen registers again and shows a new code.
    if (win) {
      await win.webContents.session.clearStorageData({ storages: ['localstorage'] });
      win.loadURL(playerUrl());
    }
  });

  if (cfg.server) {
    createPlayerWindow();
    nightlyRefresh();
  } else {
    showConnect(true);
  }
});

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
