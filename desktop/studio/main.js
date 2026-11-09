// KevCast Studio — desktop app for managing content, playlists, schedules and display groups.
// It connects to a KevCast server (found automatically on the network) and opens its
// management interface in a native window with menus, remembered window size, and
// drag & drop of PowerPoint files straight from Explorer/Finder.
const path = require('path');
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { createConfig } = require('../common/config');
const { openConnectWindow } = require('../common/connect-window');

app.setName('KevCast Studio');
app.setPath('userData', path.join(app.getPath('appData'), 'KevCast Studio'));

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const config = createConfig(app, 'studio');
let cfg = config.load();
let win = null;

function base() {
  return cfg.server.replace(/\/+$/, '');
}

function rememberServer(url) {
  const recent = [url, ...(cfg.recent || []).filter((u) => u !== url)].slice(0, 5);
  cfg = config.save({ server: url, recent });
}

function openPreview(url) {
  const w = new BrowserWindow({ width: 1280, height: 760, backgroundColor: '#000', title: 'Preview — KevCast', autoHideMenuBar: true, parent: win });
  w.loadURL(url);
}

function createMainWindow() {
  const b = cfg.bounds || {};
  win = new BrowserWindow({
    width: b.width || 1440,
    height: b.height || 920,
    x: b.x,
    y: b.y,
    minWidth: 900,
    minHeight: 600,
    title: 'KevCast Studio',
    backgroundColor: '#f4f5fb',
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  if (cfg.maximized) win.maximize();
  win.webContents.setUserAgent(`${win.webContents.getUserAgent().replace(/ KevCastStudio\/\S+/, "")} KevCastStudio/${require('../package.json').version}`);

  // Keep everything on our server inside the app; other links open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(base())) {
      if (url.includes('/player/')) openPreview(url);
      else if (url.includes('/api/backup')) win.webContents.downloadURL(url);
      else win.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(base())) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  win.webContents.on('did-fail-load', async (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    const r = await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'KevCast Studio',
      message: `Can't reach the KevCast server at ${base()}`,
      detail: desc,
      buttons: ['Try again', 'Choose another server', 'Quit'],
    });
    if (r.response === 0) win.loadURL(`${base()}/admin/`);
    else if (r.response === 1) showConnect();
    else app.quit();
  });
  win.on('close', () => {
    config.save({ bounds: win.isMaximized() ? cfg.bounds : win.getBounds(), maximized: win.isMaximized() });
  });
  win.on('closed', () => { win = null; });
  win.loadURL(`${base()}/admin/`);
  buildMenu();
}

function go(hash) {
  if (win) win.loadURL(`${base()}/admin/#/${hash}`);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const recent = (cfg.recent || []).filter((u) => u !== cfg.server).map((u) => ({
    label: u,
    click: () => { rememberServer(u); win.loadURL(`${base()}/admin/`); buildMenu(); },
  }));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Upload media…', accelerator: 'CmdOrCtrl+U', click: () => go('media') },
        { label: 'New playlist', accelerator: 'CmdOrCtrl+N', click: () => go('playlists') },
        { type: 'separator' },
        { label: 'Connect to another server…', click: showConnect },
        ...(recent.length ? [{ label: 'Recent servers', submenu: recent }] : []),
        { label: 'Open in web browser', click: () => shell.openExternal(`${base()}/admin/`) },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Go',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => go('dashboard') },
        { label: 'Media', accelerator: 'CmdOrCtrl+2', click: () => go('media') },
        { label: 'Playlists', accelerator: 'CmdOrCtrl+3', click: () => go('playlists') },
        { label: 'Schedule', accelerator: 'CmdOrCtrl+4', click: () => go('schedule') },
        { label: 'Displays & groups', accelerator: 'CmdOrCtrl+5', click: () => go('displays') },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => go('settings') },
      ],
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: `KevCast Studio ${require('../package.json').version} — connected to ${cfg.server || 'nothing'}`, enabled: false }],
    },
  ]));
}

function showConnect() {
  openConnectWindow({
    appName: 'KevCast Studio',
    intro: 'Connect to the KevCast server you want to manage.',
    current: cfg.server,
    autoConnect: !cfg.server,
    canCancel: !!win,
    onConnected: (url) => {
      rememberServer(url);
      if (win) {
        win.loadURL(`${base()}/admin/`);
        buildMenu();
      } else {
        createMainWindow();
      }
    },
    onClosed: () => { if (!win) app.quit(); },
  });
}

app.whenReady().then(() => {
  if (cfg.server) createMainWindow();
  else showConnect();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!win && cfg.server) createMainWindow(); });
