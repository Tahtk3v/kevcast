// KevCast Studio — desktop app for managing content, playlists, schedules and display groups.
// It connects to a KevCast server (found automatically on the network) and opens its
// management interface in a native window with menus, remembered window size, and
// drag & drop of PowerPoint files straight from Explorer/Finder.
const path = require('path');
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { createConfig } = require('../common/config');
const { openConnectWindow } = require('../common/connect-window');
const { t: tr } = require('../common/i18n');
const { registerLocalFiles } = require('./local-files');

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
  const w = new BrowserWindow({ width: 1280, height: 760, backgroundColor: '#000', title: tr('Preview — KevCast'), autoHideMenuBar: true, parent: win });
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
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: true },
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
      message: tr("Can't reach the KevCast server at {url}", { url: base() }),
      detail: desc,
      buttons: [tr('Try again'), tr('Choose another server'), tr('Quit')],
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

/** File → Upload files…: open the Media page and the system's file picker. */
function uploadFromMenu() {
  if (!win) return;
  win.webContents.executeJavaScript(
    "location.hash = '#/media'; setTimeout(() => window.__kevcastPickFiles && window.__kevcastPickFiles(), 300);"
  ).catch(() => {});
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
      label: tr('File'),
      submenu: [
        { label: tr('Upload files…'), accelerator: 'CmdOrCtrl+U', click: () => uploadFromMenu() },
        { label: tr('New playlist'), accelerator: 'CmdOrCtrl+N', click: () => go('playlists') },
        { type: 'separator' },
        { label: tr('Connect to another server…'), click: showConnect },
        ...(recent.length ? [{ label: tr('Recent servers'), submenu: recent }] : []),
        { label: tr('Open in web browser'), click: () => shell.openExternal(`${base()}/admin/`) },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: tr('Go'),
      submenu: [
        { label: tr('Dashboard'), accelerator: 'CmdOrCtrl+1', click: () => go('dashboard') },
        { label: tr('Media'), accelerator: 'CmdOrCtrl+2', click: () => go('media') },
        { label: tr('Playlists'), accelerator: 'CmdOrCtrl+3', click: () => go('playlists') },
        { label: tr('Schedule'), accelerator: 'CmdOrCtrl+4', click: () => go('schedule') },
        { label: tr('Displays'), accelerator: 'CmdOrCtrl+5', click: () => go('displays') },
        { label: tr('Groups'), accelerator: 'CmdOrCtrl+6', click: () => go('groups') },
        { label: tr('Settings'), accelerator: 'CmdOrCtrl+,', click: () => go('settings') },
      ],
    },
    {
      label: tr('View'),
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: tr('KevCast Studio {version} — connected to {server}', { version: require('../package.json').version, server: cfg.server || tr('nothing') }), enabled: false }],
    },
  ]));
}

function showConnect() {
  openConnectWindow({
    appName: 'KevCast Studio',
    intro: tr('Connect to the KevCast server you want to manage.'),
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

registerLocalFiles({ getServer: () => cfg.server, getWindow: () => win, config });

app.whenReady().then(() => {
  if (cfg.server) createMainWindow();
  else showConnect();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!win && cfg.server) createMainWindow(); });
