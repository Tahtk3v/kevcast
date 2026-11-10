// "Connect to server" window shared by KevCast Player and KevCast Studio.
const path = require('path');
const { BrowserWindow, ipcMain } = require('electron');
const { discover, normaliseUrl, check } = require('./discovery');
const { t: tr, strings } = require('./i18n');

// Text shown by connect.html / connect.js, translated here because that window has no server yet.
const UI = ['Connect to KevCast', 'Choose the KevCast server to connect to.', 'Servers found on your network', 'Searching…', 'Search again',
  'Or enter the address', 'e.g. 192.168.1.20 or kevcast.company.local:8080', 'Connect', 'Cancel', 'Could not connect',
  'No servers found automatically. Enter the address below (shown on the server when it starts).', 'KevCast server', 'Connect →', 'Current: {url}'];

let opts = null;
let win = null;

ipcMain.handle('connect:info', () => ({
  appName: opts.appName,
  intro: opts.intro,
  hint: opts.hint,
  current: opts.current,
  autoConnect: opts.autoConnect,
  canCancel: opts.canCancel,
  strings: strings(UI),
  lang: require('./i18n').lang(),
}));
ipcMain.handle('connect:discover', () => discover());
ipcMain.handle('connect:cancel', () => win && win.close());
ipcMain.handle('connect:connect', async (e, input) => {
  const url = normaliseUrl(input);
  if (!url) return { ok: false, error: tr('That does not look like a valid address.') };
  const r = await check(url);
  if (!r.ok) return { ok: false, error: tr('Could not reach a KevCast server at {url}: {error}', { url, error: r.error }) };
  const w = win;
  win = null;
  await opts.onConnected(url);
  if (w && !w.isDestroyed()) w.close();
  return { ok: true };
});

/**
 * @param {object} o  { appName, intro, hint, current, autoConnect, canCancel, fullscreen, onConnected(url) }
 */
function openConnectWindow(o) {
  opts = o;
  if (win && !win.isDestroyed()) {
    win.focus();
    return win;
  }
  win = new BrowserWindow({
    width: 640,
    height: 680,
    fullscreen: !!o.fullscreen,
    backgroundColor: '#0b1020',
    title: o.appName,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'connect-preload.js'), contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'connect.html'));
  win.on('closed', () => {
    win = null;
    if (o.onClosed) o.onClosed();
  });
  return win;
}

module.exports = { openConnectWindow };
