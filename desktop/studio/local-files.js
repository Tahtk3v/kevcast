// "This computer" in KevCast Studio: browse local folders and upload files to the server.
// Uploads are streamed from disk (no size limit from memory) with progress reports.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { app, dialog, ipcMain, session, shell } = require('electron');

const EXTENSIONS = {
  presentation: ['.pptx', '.ppt', '.pps', '.ppsx', '.pot', '.potx', '.odp', '.key', '.pdf'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
  video: ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.mkv'],
};
const TYPE_OF = Object.fromEntries(Object.entries(EXTENSIONS).flatMap(([t, exts]) => exts.map((e) => [e, t])));
const FILTERS = [
  { name: 'Everything KevCast can show', extensions: Object.values(EXTENSIONS).flat().map((e) => e.slice(1)) },
  { name: 'PowerPoint & PDF', extensions: EXTENSIONS.presentation.map((e) => e.slice(1)) },
  { name: 'Images', extensions: EXTENSIONS.image.map((e) => e.slice(1)) },
  { name: 'Videos', extensions: EXTENSIONS.video.map((e) => e.slice(1)) },
];

function fileInfo(p) {
  try {
    const st = fs.statSync(p);
    const type = TYPE_OF[path.extname(p).toLowerCase()];
    if (!st.isFile() || !type) return null;
    return { name: path.basename(p), path: p, size: st.size, mtime: st.mtimeMs, type };
  } catch {
    return null;
  }
}

function places(recent) {
  const out = [];
  const add = (label, p, icon) => { try { if (p && fs.statSync(p).isDirectory() && !out.some((x) => x.path === p)) out.push({ label, path: p, icon }); } catch {} };
  // On Linux without desktop folder settings Electron reports the home folder for these,
  // so fall back to the usual ~/Documents style folders.
  const special = (key, folder) => {
    let p = '';
    try { p = app.getPath(key); } catch {}
    return !p || p === os.homedir() ? path.join(os.homedir(), folder) : p;
  };
  add('Desktop', special('desktop', 'Desktop'), 'desktop');
  add('Documents', special('documents', 'Documents'), 'documents');
  add('Downloads', special('downloads', 'Downloads'), 'downloads');
  add('Pictures', special('pictures', 'Pictures'), 'pictures');
  add('Videos', special('videos', 'Videos'), 'videos');
  // OneDrive (personal and business) on Windows, and cloud folders on macOS.
  for (const v of ['OneDrive', 'OneDriveCommercial', 'OneDriveConsumer']) add(v === 'OneDrive' ? 'OneDrive' : v.replace('OneDrive', 'OneDrive '), process.env[v], 'cloud');
  try {
    for (const d of fs.readdirSync(os.homedir())) if (/^OneDrive/i.test(d)) add(d, path.join(os.homedir(), d), 'cloud');
  } catch {}
  add('Home', os.homedir(), 'home');
  if (process.platform === 'win32') {
    for (const letter of 'CDEFGHIJ') add(`Drive ${letter}:`, `${letter}:\\`, 'drive');
  } else if (process.platform === 'darwin') {
    try { for (const v of fs.readdirSync('/Volumes')) add(v, path.join('/Volumes', v), 'drive'); } catch {}
  } else {
    // USB sticks and other removable drives of this user.
    const user = os.userInfo().username;
    for (const base of [path.join('/media', user), path.join('/run/media', user)]) {
      try { for (const v of fs.readdirSync(base)) add(v, path.join(base, v), 'drive'); } catch {}
    }
  }
  const recentList = (recent || []).filter((p) => !out.some((x) => x.path === p))
    .filter((p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } })
    .map((p) => ({ label: path.basename(p) || p, path: p, icon: 'recent' }));
  return { places: out, recent: recentList };
}

function listDir(dir) {
  const resolved = path.resolve(dir);
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  const dirs = [];
  const files = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('~$')) continue; // hidden and Office lock files
    const p = path.join(resolved, e.name);
    if (e.isDirectory()) {
      if (!/^(\$recycle\.bin|system volume information|node_modules|appdata)$/i.test(e.name)) dirs.push({ name: e.name, path: p });
    } else if (e.isFile()) {
      const info = fileInfo(p);
      if (info) files.push(info);
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  files.sort((a, b) => b.mtime - a.mtime); // newest first: usually what you want to upload
  const parent = path.dirname(resolved);
  return { path: resolved, parent: parent !== resolved ? parent : null, dirs: dirs.slice(0, 500), files: files.slice(0, 500) };
}

/** Stream one file to POST /api/media/upload as multipart/form-data. */
async function uploadFile(serverUrl, cookie, file, onProgress) {
  const boundary = `----KevCastStudio${crypto.randomBytes(12).toString('hex')}`;
  const name = path.basename(file.path).replace(/"/g, '%22').replace(/[\r\n]/g, ' ');
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  let sent = 0;
  async function* body() {
    yield head;
    for await (const chunk of fs.createReadStream(file.path, { highWaterMark: 1 << 20 })) {
      sent += chunk.length;
      onProgress(sent);
      yield chunk;
    }
    yield tail;
  }
  const res = await fetch(`${serverUrl}/api/media/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, Cookie: cookie },
    body: Readable.toWeb(Readable.from(body())),
    duplex: 'half',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
  if (json.rejected && json.rejected.length) throw new Error('This file type is not supported');
  return json.created || [];
}

/**
 * Registers the IPC used by the Web Studio page inside KevCast Studio (see preload.js).
 * getServer() returns the server URL; config is the Studio config store (for recent folders).
 */
function registerLocalFiles({ getServer, getWindow, config }) {
  // Only the Web Studio page of the connected server may use these functions.
  const allowed = (e) => {
    try { return new URL(e.senderFrame.url).origin === new URL(getServer()).origin; } catch { return false; }
  };
  const guard = (fn) => async (e, ...args) => {
    if (!allowed(e)) throw new Error('Not allowed');
    return fn(e, ...args);
  };
  const remember = (dir) => {
    const cfg = config.load();
    const recent = [dir, ...(cfg.recentFolders || []).filter((d) => d !== dir)].slice(0, 6);
    config.save({ recentFolders: recent, lastFolder: dir });
  };

  ipcMain.handle('studio:places', guard(() => {
    const cfg = config.load();
    const p = places(cfg.recentFolders);
    const docs = p.places.find((x) => x.icon === 'documents');
    return { ...p, lastFolder: cfg.lastFolder || (docs ? docs.path : os.homedir()), platform: process.platform };
  }));
  ipcMain.handle('studio:list', guard((e, dir) => {
    try {
      return listDir(dir);
    } catch (err) {
      return { error: err.code === 'EACCES' || err.code === 'EPERM' ? 'No permission to open this folder' : err.message, path: dir };
    }
  }));
  ipcMain.handle('studio:pick-files', guard(async () => {
    const cfg = config.load();
    const r = await dialog.showOpenDialog(getWindow(), {
      title: 'Choose files to upload to KevCast',
      defaultPath: cfg.lastFolder || app.getPath('documents'),
      properties: ['openFile', 'multiSelections'],
      filters: FILTERS,
    });
    if (r.canceled || !r.filePaths.length) return [];
    remember(path.dirname(r.filePaths[0]));
    return r.filePaths.map(fileInfo).filter(Boolean);
  }));
  ipcMain.handle('studio:pick-folder', guard(async () => {
    const cfg = config.load();
    const r = await dialog.showOpenDialog(getWindow(), { title: 'Open a folder', defaultPath: cfg.lastFolder || app.getPath('documents'), properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths.length) return null;
    remember(r.filePaths[0]);
    return r.filePaths[0];
  }));
  ipcMain.handle('studio:remember-folder', guard((e, dir) => { remember(dir); return true; }));
  ipcMain.handle('studio:reveal', guard((e, p) => { shell.showItemInFolder(p); return true; }));

  ipcMain.handle('studio:upload', guard(async (e, paths) => {
    const server = getServer().replace(/\/+$/, '');
    const cookies = await session.defaultSession.cookies.get({ url: server });
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const files = (paths || []).map(fileInfo).filter(Boolean);
    const results = [];
    for (const f of files) {
      let last = 0;
      const report = (status, loaded, extra = {}) => e.sender.send('studio:upload-progress', { path: f.path, name: f.name, size: f.size, loaded, status, ...extra });
      report('uploading', 0);
      try {
        const created = await uploadFile(server, cookie, f, (loaded) => {
          if (Date.now() - last > 200) { last = Date.now(); report('uploading', loaded); }
        });
        report('done', f.size);
        results.push(...created);
      } catch (err) {
        report('error', 0, { error: err.message });
      }
    }
    if (files[0]) remember(path.dirname(files[0].path));
    return results;
  }));
}

module.exports = { registerLocalFiles, listDir, places };
