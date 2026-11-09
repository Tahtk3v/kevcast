#!/usr/bin/env node
// KevCast server: admin GUI + REST API + player endpoints, all on one port.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const dgram = require('dgram');
const express = require('express');
const multer = require('multer');

const Database = require('./db');
const { createAuth } = require('./auth');
const convert = require('./convert');
const { resolve: resolveSchedule } = require('../shared/schedule');
const pkg = require('../package.json');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.KEVCAST_DATA || path.join(__dirname, '..', 'data'));
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const UPLOAD_TMP = path.join(DATA_DIR, 'uploads');
const SHOTS_DIR = path.join(DATA_DIR, 'screenshots');
const ONLINE_MS = 75 * 1000;
const DISCOVERY_PORT = Number(process.env.DISCOVERY_PORT) || 41234;

fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_TMP, { recursive: true });
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const db = new Database(DATA_DIR);
const auth = createAuth(db, DATA_DIR);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));

// ---------------------------------------------------------------------------
// Live events (Server-Sent Events) for players and the admin GUI
// ---------------------------------------------------------------------------
const playerStreams = new Map(); // displayId -> Set<res>
const adminStreams = new Set();

function sse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
}
function send(res, event, data = {}) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function toPlayer(displayId, event, data) {
  for (const res of playerStreams.get(displayId) || []) send(res, event, data);
}
function toAllPlayers(event, data) {
  for (const id of playerStreams.keys()) toPlayer(id, event, data);
}
function toAdmins(event, data) {
  for (const res of adminStreams) send(res, event, data);
}
setInterval(() => {
  for (const set of playerStreams.values()) for (const r of set) r.write(': ping\n\n');
  for (const r of adminStreams) r.write(': ping\n\n');
}, 25000).unref();

let changeTimer = null;
db.onChange((what) => {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    toAllPlayers('update', { what });
    toAdmins('change', { what });
  }, 300);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function mediaUrl(m, file) {
  return `/media/${m.id}/${encodeURIComponent(file)}`;
}

function publicMedia(m) {
  const out = { ...m };
  if (m.file) out.url = mediaUrl(m, m.file);
  if (m.slides) out.slideUrls = m.slides.map((s) => mediaUrl(m, `slides/${s}`));
  out.thumb = m.type === 'image' ? out.url : m.type === 'presentation' && out.slideUrls && out.slideUrls[0] ? out.slideUrls[0] : null;
  return out;
}

function isOnline(d) {
  return (playerStreams.get(d.id)?.size || 0) > 0 || (d.lastSeen && Date.now() - new Date(d.lastSeen).getTime() < ONLINE_MS);
}

function publicDisplay(d) {
  const { token, ...rest } = d;
  const now = resolveSchedule(db.list('schedules'), d, new Date());
  return { ...rest, online: isOnline(d), scheduledPlaylistId: now.playlistId, scheduleId: now.scheduleId };
}

function detectType(filename, mimetype) {
  const ext = path.extname(filename).toLowerCase();
  if (convert.PRESENTATION_EXT.includes(ext) || ext === '.pdf') return 'presentation';
  if (/^image\//.test(mimetype) || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) return 'image';
  if (/^video\//.test(mimetype) || ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.mkv'].includes(ext)) return 'video';
  return null;
}

function processPresentation(m) {
  const dir = path.join(MEDIA_DIR, m.id);
  const slidesDir = path.join(dir, 'slides');
  db.update('media', m.id, { status: 'processing', error: null });
  toAdmins('media', { id: m.id, status: 'processing' });
  convert
    .enqueue(async () => {
      fs.rmSync(slidesDir, { recursive: true, force: true });
      return convert.convertPresentation(path.join(dir, m.file), slidesDir);
    })
    .then((slides) => {
      // Drop the intermediate PDF LibreOffice leaves next to the slides.
      for (const f of fs.readdirSync(slidesDir)) if (f.endsWith('.pdf')) fs.rmSync(path.join(slidesDir, f));
      if (!db.get('media', m.id)) return;
      db.update('media', m.id, { status: 'ready', slides, error: null });
      toAdmins('media', { id: m.id, status: 'ready' });
    })
    .catch((err) => {
      console.error(`[convert] ${m.name}:`, err.message);
      if (!db.get('media', m.id)) return;
      db.update('media', m.id, { status: 'error', error: err.message.split('\n')[0] });
      toAdmins('media', { id: m.id, status: 'error' });
    });
}

/** Flatten a playlist into what a player can show: one entry per image/slide/video/page. */
function expandPlaylist(p) {
  if (!p) return null;
  const items = [];
  for (const it of p.items || []) {
    const m = db.get('media', it.mediaId);
    if (!m || m.status !== 'ready') continue;
    if (it.enabled === false) continue;
    const base = { itemId: it.id, mediaId: m.id, name: m.name, transition: it.transition || p.transition || 'fade' };
    const duration = Number(it.duration) > 0 ? Number(it.duration) : m.type === 'video' ? 0 : Number(p.defaultDuration) || 10;
    if (m.type === 'presentation') {
      (m.slides || []).forEach((s, i) => items.push({ ...base, type: 'image', url: mediaUrl(m, `slides/${s}`), duration, slide: i + 1, slides: m.slides.length }));
    } else if (m.type === 'image') items.push({ ...base, type: 'image', url: mediaUrl(m, m.file), duration });
    else if (m.type === 'video') items.push({ ...base, type: 'video', url: mediaUrl(m, m.file), duration, mute: it.mute !== false });
    else if (m.type === 'web') items.push({ ...base, type: 'web', url: m.url, duration });
    else if (m.type === 'text') items.push({ ...base, type: 'text', text: m.text, duration });
  }
  return { id: p.id, name: p.name, items };
}

function playerManifest(d) {
  const schedules = db.list('schedules').filter((s) => s.enabled !== false);
  const ids = new Set(schedules.map((s) => s.playlistId));
  if (d.defaultPlaylistId) ids.add(d.defaultPlaylistId);
  const playlists = {};
  for (const id of ids) {
    const p = expandPlaylist(db.get('playlists', id));
    if (p) playlists[id] = p;
  }
  const { token, ...display } = d;
  return {
    serverVersion: pkg.version,
    orgName: db.data.settings.orgName,
    display,
    schedules,
    playlists,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
const pub = path.join(__dirname, '..', 'public');
// Start page: shows where to manage KevCast and which page screens should open.
app.get('/', (req, res) => res.sendFile(path.join(pub, 'index.html')));
app.get('/api/info', (req, res) => {
  const port = req.socket.localPort || PORT;
  res.json({
    orgName: db.data.settings.orgName,
    version: pkg.version,
    playerUrls: lanAddresses().map((ip) => `http://${ip}:${port}/player/`),
    adminUrls: lanAddresses().map((ip) => `http://${ip}:${port}/admin/`),
  });
});
app.use('/admin', express.static(path.join(pub, 'admin')));
app.use('/player', express.static(path.join(pub, 'player'), { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
app.get('/shared/schedule.js', (req, res) => res.sendFile(path.join(__dirname, '..', 'shared', 'schedule.js')));
app.use('/media', express.static(MEDIA_DIR, { maxAge: '7d', immutable: true }));

// ---------------------------------------------------------------------------
// Session / setup
// ---------------------------------------------------------------------------
app.get('/api/session', (req, res) => {
  res.json({
    setupRequired: !db.data.settings.adminUser,
    user: auth.currentUser(req),
    orgName: db.data.settings.orgName,
    version: pkg.version,
  });
});

app.post('/api/setup', (req, res) => {
  if (db.data.settings.adminUser) return bad(res, 'Already set up', 409);
  const { username, password, orgName } = req.body || {};
  if (!username || !password || password.length < 6) return bad(res, 'Choose a username and a password of at least 6 characters.');
  db.data.settings.adminUser = { username, ...auth.hashPassword(password) };
  if (orgName) db.data.settings.orgName = orgName;
  db.save('settings');
  auth.issue(res, username);
  res.json({ ok: true });
});

const loginAttempts = new Map();
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const a = loginAttempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60 * 1000) Object.assign(a, { n: 0, t: Date.now() });
  if (a.n >= 10) return bad(res, 'Too many attempts, try again in a few minutes.', 429);
  const { username, password } = req.body || {};
  const u = db.data.settings.adminUser;
  if (u && username === u.username && auth.verifyPassword(String(password || ''), u)) {
    loginAttempts.delete(ip);
    auth.issue(res, username);
    return res.json({ ok: true });
  }
  a.n++;
  loginAttempts.set(ip, a);
  bad(res, 'Wrong username or password', 401);
});

app.post('/api/logout', (req, res) => {
  auth.clear(res);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Player API (authenticated with a per-display token)
// ---------------------------------------------------------------------------
const PAIR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function pairingCode() {
  let c;
  do {
    c = Array.from(crypto.randomBytes(6), (b) => PAIR_ALPHABET[b % PAIR_ALPHABET.length]).join('');
  } while (db.list('displays').some((d) => d.pairingCode === c));
  return c;
}

function playerAuth(req, res, next) {
  const token = req.get('x-display-token') || req.query.token;
  const d = token && db.list('displays').find((x) => x.token === token);
  if (!d) return bad(res, 'Unknown display', 401);
  req.display = d;
  next();
}

function provisioningKey() {
  const st = db.data.settings;
  if (!st.provisioningKey) {
    st.provisioningKey = crypto.randomBytes(12).toString('base64url');
    db.save('settings');
  }
  return st.provisioningKey;
}

app.post('/api/player/register', (req, res) => {
  const { resolution, userAgent, provisioning } = req.body || {};
  // Mass roll-out: a player installed with the server's provisioning key is approved
  // straight away (named after the device, placed in the configured group).
  const key = provisioning && String(provisioning.key || '');
  const auto = !!key && key.length === provisioningKey().length &&
    crypto.timingSafeEqual(Buffer.from(key), Buffer.from(provisioningKey()));
  // Drop stale unpaired registrations so the list stays clean.
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  for (const d of [...db.list('displays')]) {
    if (!d.approved && new Date(d.lastSeen || d.createdAt).getTime() < cutoff) db.remove('displays', d.id);
  }
  const d = db.insert('displays', {
    name: (auto && provisioning.name) || 'New display',
    approved: auto,
    pairingCode: auto ? null : pairingCode(),
    token: crypto.randomBytes(24).toString('hex'),
    group: (auto && provisioning.group) || '',
    defaultPlaylistId: null,
    orientation: 'landscape',
    fit: 'contain',
    showClock: false,
    ticker: { enabled: false, text: '', speed: 60 },
    background: '#000000',
    resolution: resolution || null,
    userAgent: userAgent || req.get('user-agent'),
    ip: req.ip,
    lastSeen: new Date().toISOString(),
  });
  if (auto) {
    const pl = provisioning.playlist && db.list('playlists').find((p) => p.name === provisioning.playlist || p.id === provisioning.playlist);
    if (pl) d.defaultPlaylistId = pl.id;
    db.save('displays');
  }
  toAdmins('pairing', { id: d.id });
  res.json({ id: d.id, token: d.token, pairingCode: d.pairingCode, approved: d.approved });
});

app.get('/api/player/manifest', playerAuth, (req, res) => {
  res.json(playerManifest(req.display));
});

app.post('/api/player/heartbeat', playerAuth, (req, res) => {
  const { nowPlaying, resolution, cache } = req.body || {};
  const d = req.display;
  if (cache && typeof cache === 'object') {
    d.cache = { total: Number(cache.total) || 0, cached: Number(cache.cached) || 0, bytes: Number(cache.bytes) || 0, downloading: !!cache.downloading };
  }
  d.lastSeen = new Date().toISOString();
  d.ip = req.ip;
  if (resolution) d.resolution = resolution;
  d.nowPlaying = nowPlaying || null;
  db.saveNow();
  toAdmins('heartbeat', { id: d.id });
  res.json({ ok: true, approved: d.approved });
});

// Screenshot of what is on screen (sent by the KevCast Player app, which can capture itself).
app.post('/api/player/screenshot', playerAuth, express.raw({ type: 'image/jpeg', limit: '5mb' }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return bad(res, 'Expected a JPEG body');
  fs.writeFileSync(path.join(SHOTS_DIR, `${req.display.id}.jpg`), req.body);
  req.display.screenshotAt = new Date().toISOString();
  db.saveNow();
  toAdmins('heartbeat', { id: req.display.id });
  res.json({ ok: true });
});

app.get('/api/player/events', playerAuth, (req, res) => {
  const d = req.display;
  sse(res);
  if (!playerStreams.has(d.id)) playerStreams.set(d.id, new Set());
  playerStreams.get(d.id).add(res);
  d.lastSeen = new Date().toISOString();
  toAdmins('heartbeat', { id: d.id });
  req.on('close', () => {
    playerStreams.get(d.id)?.delete(res);
    toAdmins('heartbeat', { id: d.id });
  });
});

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------
const admin = express.Router();
admin.use(auth.requireAdmin);

admin.get('/events', (req, res) => {
  sse(res);
  adminStreams.add(res);
  req.on('close', () => adminStreams.delete(res));
});

admin.get('/overview', (req, res) => {
  const caps = convert.capabilities();
  res.json({
    version: pkg.version,
    orgName: db.data.settings.orgName,
    counts: {
      media: db.list('media').length,
      playlists: db.list('playlists').length,
      schedules: db.list('schedules').length,
      displays: db.list('displays').filter((d) => d.approved).length,
      online: db.list('displays').filter((d) => d.approved && isOnline(d)).length,
    },
    capabilities: { powerpoint: !!caps.libreoffice, pdf: !!(caps.pdftoppm || caps.ghostscript), ...caps },
    playerUrls: lanAddresses().map((ip) => `http://${ip}:${PORT}/player/`),
    serverUrls: lanAddresses().map((ip) => `http://${ip}:${PORT}`),
    provisioningKey: provisioningKey(),
    platform: `${os.type()} ${os.release()}`,
    dataDir: DATA_DIR,
  });
});

// Media -----------------------------------------------------------------------
const upload = multer({ dest: UPLOAD_TMP, limits: { fileSize: 4 * 1024 * 1024 * 1024 } });

admin.get('/media', (req, res) => res.json(db.list('media').map(publicMedia)));

admin.post('/media/upload', upload.array('files', 50), (req, res) => {
  const created = [];
  const rejected = [];
  for (const f of req.files || []) {
    // Browsers send filenames as latin1 in multipart; restore UTF-8.
    const original = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const type = detectType(original, f.mimetype);
    if (!type) {
      fs.rmSync(f.path, { force: true });
      rejected.push(original);
      continue;
    }
    const ext = path.extname(original).toLowerCase();
    const m = db.insert('media', {
      name: path.basename(original, path.extname(original)),
      originalName: original,
      type,
      file: `original${ext}`,
      size: f.size,
      mimetype: f.mimetype,
      status: type === 'presentation' ? 'processing' : 'ready',
      tags: [],
    });
    const dir = path.join(MEDIA_DIR, m.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(f.path, path.join(dir, m.file));
    if (type === 'presentation') processPresentation(m);
    created.push(publicMedia(m));
  }
  res.json({ created, rejected });
});

admin.post('/media', (req, res) => {
  const { type, name, url, text } = req.body || {};
  if (type === 'web') {
    if (!/^https?:\/\//i.test(url || '')) return bad(res, 'Enter a full web address starting with http:// or https://');
    return res.json(publicMedia(db.insert('media', { type, name: name || url, url, status: 'ready', tags: [] })));
  }
  if (type === 'text') {
    if (!text || !(text.title || text.body)) return bad(res, 'Add a title or some text');
    return res.json(publicMedia(db.insert('media', { type, name: name || text.title || 'Text slide', text, status: 'ready', tags: [] })));
  }
  bad(res, 'Unknown media type');
});

admin.patch('/media/:id', (req, res) => {
  const allowed = ['name', 'url', 'text', 'tags'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  const m = db.update('media', req.params.id, patch);
  if (!m) return bad(res, 'Not found', 404);
  res.json(publicMedia(m));
});

admin.post('/media/:id/reconvert', (req, res) => {
  const m = db.get('media', req.params.id);
  if (!m || m.type !== 'presentation') return bad(res, 'Not a presentation', 404);
  processPresentation(m);
  res.json(publicMedia(m));
});

admin.delete('/media/:id', (req, res) => {
  const id = req.params.id;
  if (!db.remove('media', id)) return bad(res, 'Not found', 404);
  for (const p of db.list('playlists')) p.items = (p.items || []).filter((i) => i.mediaId !== id);
  db.save('playlists');
  fs.rmSync(path.join(MEDIA_DIR, id), { recursive: true, force: true });
  res.json({ ok: true });
});

// Playlists -------------------------------------------------------------------
const PLAYLIST_COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#ea580c', '#db2777', '#7c3aed', '#ca8a04', '#dc2626'];

function cleanItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((i) => i && i.mediaId)
    .map((i) => ({
      id: i.id || Database.id(),
      mediaId: String(i.mediaId),
      duration: Math.max(0, Number(i.duration) || 0),
      transition: ['fade', 'slide', 'none', 'zoom'].includes(i.transition) ? i.transition : undefined,
      enabled: i.enabled !== false,
      mute: i.mute !== false,
    }));
}

admin.get('/playlists', (req, res) => res.json(db.list('playlists')));
admin.post('/playlists', (req, res) => {
  const { name, items } = req.body || {};
  const n = db.list('playlists').length;
  res.json(db.insert('playlists', {
    name: name || `Playlist ${n + 1}`,
    color: PLAYLIST_COLORS[n % PLAYLIST_COLORS.length],
    defaultDuration: 10,
    transition: 'fade',
    items: cleanItems(items),
  }));
});
admin.put('/playlists/:id', (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (b.name !== undefined) patch.name = String(b.name);
  if (b.color !== undefined) patch.color = String(b.color);
  if (b.defaultDuration !== undefined) patch.defaultDuration = Math.max(1, Number(b.defaultDuration) || 10);
  if (b.transition !== undefined) patch.transition = b.transition;
  if (b.items !== undefined) patch.items = cleanItems(b.items);
  const p = db.update('playlists', req.params.id, patch);
  if (!p) return bad(res, 'Not found', 404);
  res.json(p);
});
admin.post('/playlists/:id/duplicate', (req, res) => {
  const p = db.get('playlists', req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  const { id, createdAt, updatedAt, ...rest } = p;
  res.json(db.insert('playlists', { ...rest, name: `${p.name} (copy)`, items: p.items.map((i) => ({ ...i, id: Database.id() })) }));
});
admin.delete('/playlists/:id', (req, res) => {
  const id = req.params.id;
  if (!db.remove('playlists', id)) return bad(res, 'Not found', 404);
  db.data.schedules = db.list('schedules').filter((s) => s.playlistId !== id);
  for (const d of db.list('displays')) if (d.defaultPlaylistId === id) d.defaultPlaylistId = null;
  db.save('schedules');
  res.json({ ok: true });
});
admin.get('/playlists/:id/preview', (req, res) => {
  const p = expandPlaylist(db.get('playlists', req.params.id));
  if (!p) return bad(res, 'Not found', 404);
  res.json(p);
});

// Schedules -------------------------------------------------------------------
function cleanSchedule(b) {
  const time = (t, def) => (/^\d{1,2}:\d{2}$/.test(t || '') ? t.padStart(5, '0') : def);
  const date = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
  return {
    name: String(b.name || ''),
    playlistId: String(b.playlistId || ''),
    enabled: b.enabled !== false,
    priority: Math.max(0, Math.min(10, Number(b.priority) || 0)),
    allDay: !!b.allDay,
    start: time(b.start, '08:00'),
    end: time(b.end, '17:00'),
    days: (Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => d >= 0 && d <= 6),
    startDate: date(b.startDate),
    endDate: date(b.endDate),
    targets: {
      displays: (b.targets?.displays || []).map(String),
      groups: (b.targets?.groups || []).map(String),
    },
  };
}
admin.get('/schedules', (req, res) => res.json(db.list('schedules')));
admin.post('/schedules', (req, res) => {
  const s = cleanSchedule(req.body || {});
  if (!db.get('playlists', s.playlistId)) return bad(res, 'Pick a playlist');
  res.json(db.insert('schedules', s));
});
admin.put('/schedules/:id', (req, res) => {
  const s = cleanSchedule(req.body || {});
  if (!db.get('playlists', s.playlistId)) return bad(res, 'Pick a playlist');
  const out = db.update('schedules', req.params.id, s);
  if (!out) return bad(res, 'Not found', 404);
  res.json(out);
});
admin.delete('/schedules/:id', (req, res) => {
  if (!db.remove('schedules', req.params.id)) return bad(res, 'Not found', 404);
  res.json({ ok: true });
});

// Displays --------------------------------------------------------------------
admin.get('/displays', (req, res) => res.json(db.list('displays').map(publicDisplay)));

admin.post('/displays/pair', (req, res) => {
  const code = String(req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const d = db.list('displays').find((x) => !x.approved && x.pairingCode === code);
  if (!d) return bad(res, 'No screen is showing that code. Check the code on the screen and try again.', 404);
  const { name, group, defaultPlaylistId } = req.body;
  db.update('displays', d.id, {
    approved: true,
    pairingCode: null,
    name: name || `Display ${db.list('displays').filter((x) => x.approved).length + 1}`,
    group: group || '',
    defaultPlaylistId: defaultPlaylistId || null,
  });
  toPlayer(d.id, 'approved', {});
  res.json(publicDisplay(d));
});

// Commands and settings for many displays at once (a group, a selection or all).
function selectDisplays({ ids, group, all }) {
  return db.list('displays').filter((d) => d.approved && (all || (ids || []).includes(d.id) || (group && d.group === group)));
}
admin.post('/displays/command', (req, res) => {
  const { action } = req.body || {};
  if (!['identify', 'reload', 'screenshot'].includes(action)) return bad(res, 'Unknown action');
  let delivered = 0;
  const list = selectDisplays(req.body || {});
  for (const d of list) {
    delivered += playerStreams.get(d.id)?.size ? 1 : 0;
    toPlayer(d.id, action, { name: d.name });
  }
  res.json({ ok: true, targeted: list.length, delivered });
});
admin.patch('/displays/bulk', (req, res) => {
  const allowed = ['group', 'defaultPlaylistId', 'orientation', 'fit', 'showClock', 'ticker', 'background'];
  const patch = Object.fromEntries(Object.entries(req.body?.patch || {}).filter(([k]) => allowed.includes(k)));
  const list = selectDisplays(req.body || {});
  for (const d of list) Object.assign(d, patch, { updatedAt: new Date().toISOString() });
  db.save('displays');
  res.json({ ok: true, updated: list.length });
});
admin.get('/displays/:id/screenshot', (req, res) => {
  const f = path.join(SHOTS_DIR, `${path.basename(req.params.id)}.jpg`);
  if (!fs.existsSync(f)) return res.status(404).end();
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(f);
});

admin.patch('/displays/:id', (req, res) => {
  const allowed = ['name', 'group', 'defaultPlaylistId', 'orientation', 'fit', 'showClock', 'ticker', 'background', 'notes'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  const d = db.update('displays', req.params.id, patch);
  if (!d) return bad(res, 'Not found', 404);
  res.json(publicDisplay(d));
});

admin.post('/displays/:id/:action', (req, res) => {
  const d = db.get('displays', req.params.id);
  if (!d) return bad(res, 'Not found', 404);
  if (!['identify', 'reload', 'screenshot'].includes(req.params.action)) return bad(res, 'Unknown action', 404);
  toPlayer(d.id, req.params.action, { name: d.name });
  res.json({ ok: true, delivered: playerStreams.get(d.id)?.size || 0 });
});

admin.delete('/displays/:id', (req, res) => {
  const id = req.params.id;
  toPlayer(id, 'unpaired', {});
  if (!db.remove('displays', id)) return bad(res, 'Not found', 404);
  fs.rmSync(path.join(SHOTS_DIR, `${id}.jpg`), { force: true });
  for (const s of db.list('schedules')) s.targets.displays = s.targets.displays.filter((x) => x !== id);
  db.save('schedules');
  res.json({ ok: true });
});

// Settings --------------------------------------------------------------------
admin.patch('/settings', (req, res) => {
  if (req.body?.orgName) db.data.settings.orgName = String(req.body.orgName);
  db.save('settings');
  res.json({ ok: true });
});
admin.post('/provisioning-key/rotate', (req, res) => {
  db.data.settings.provisioningKey = null;
  res.json({ provisioningKey: provisioningKey() });
});
admin.post('/password', (req, res) => {
  const { current, next } = req.body || {};
  const u = db.data.settings.adminUser;
  if (!auth.verifyPassword(String(current || ''), u)) return bad(res, 'Current password is wrong', 403);
  if (!next || next.length < 6) return bad(res, 'New password must be at least 6 characters');
  db.data.settings.adminUser = { username: u.username, ...auth.hashPassword(next) };
  db.save('settings');
  res.json({ ok: true });
});
admin.get('/backup', (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="kevcast-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  const { settings, ...rest } = db.data;
  res.json({ ...rest, settings: { orgName: settings.orgName } });
});

app.use('/api', admin);

// Errors ------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message || 'Server error' });
});

// LAN auto-discovery: the KevCast Player and Studio apps broadcast "KEVCAST_DISCOVER"
// on UDP and every server on the network answers with its address, so nobody
// has to type IP addresses on a TV remote.
function startDiscovery() {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('message', (msg, rinfo) => {
    if (msg.toString().trim() !== 'KEVCAST_DISCOVER') return;
    if (!db.data.settings.serverId) {
      db.data.settings.serverId = crypto.randomBytes(8).toString('hex');
      db.save('settings');
    }
    const reply = JSON.stringify({
      kevcast: true,
      id: db.data.settings.serverId,
      name: db.data.settings.orgName,
      version: pkg.version,
      port: PORT,
      urls: lanAddresses().map((ip) => `http://${ip}:${PORT}`),
    });
    sock.send(reply, rinfo.port, rinfo.address);
  });
  sock.on('error', (e) => console.warn(`  Discovery disabled (UDP ${DISCOVERY_PORT}): ${e.message}`));
  sock.bind(DISCOVERY_PORT);
}

if (require.main === module) {
  startDiscovery();
  app.listen(PORT, HOST, () => {
    const caps = convert.capabilities();
    console.log(`\n  KevCast ${pkg.version} is running`);
    console.log(`  Admin:   http://localhost:${PORT}/admin/`);
    for (const u of lanAddresses()) console.log(`  Players: http://${u}:${PORT}/player/`);
    console.log(`  Data:    ${DATA_DIR}`);
    console.log(`  PowerPoint conversion: ${caps.libreoffice ? 'LibreOffice found' : 'NOT available (install LibreOffice)'}`);
    console.log(`  PDF rendering:         ${caps.pdftoppm ? 'pdftoppm' : caps.ghostscript ? 'Ghostscript' : 'NOT available (install Poppler)'}\n`);
  });
}

module.exports = { app, db };
