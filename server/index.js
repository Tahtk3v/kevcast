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
const fonts = require('./fonts');
const pptx = require('./pptx');
const geo = require('./live/geo');
const liveWeather = require('./live/weather');
const liveTraffic = require('./live/traffic');
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

// ---------------------------------------------------------------------------
// Display groups. A display can belong to several groups (display.groups = [name]);
// schedules target groups by name. Groups also exist on their own (empty groups,
// colour, description), so they can be prepared before screens are added.
// ---------------------------------------------------------------------------
const GROUP_COLORS = ['#0891b2', '#16a34a', '#ea580c', '#db2777', '#7c3aed', '#ca8a04', '#4f46e5', '#dc2626'];
function groupNames() {
  return db.list('groups').map((g) => g.name);
}
/** Make sure groups with these names exist (creates missing ones). Returns the cleaned names. */
function ensureGroups(names) {
  const clean = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];
  for (const name of clean) {
    if (!db.list('groups').some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      db.insert('groups', { name, color: GROUP_COLORS[db.list('groups').length % GROUP_COLORS.length], description: '' });
    }
  }
  // Use the stored spelling.
  return clean.map((n) => db.list('groups').find((g) => g.name.toLowerCase() === n.toLowerCase()).name);
}
/** Remove targets from schedule entries; entries left with no target at all are deleted, not widened to "all". */
function pruneScheduleTargets({ displayId, group }) {
  let removed = 0;
  db.data.schedules = db.list('schedules').filter((s) => {
    const t = s.targets || { displays: [], groups: [] };
    const before = t.displays.length + t.groups.length;
    if (displayId) t.displays = t.displays.filter((x) => x !== displayId);
    if (group) t.groups = t.groups.filter((x) => x !== group);
    if (before > 0 && t.displays.length + t.groups.length === 0) { removed++; return false; }
    return true;
  });
  return removed;
}
(function migrateGroups() {
  let changed = false;
  for (const d of db.list('displays')) {
    if (!Array.isArray(d.groups)) {
      d.groups = d.group ? [d.group] : [];
      delete d.group;
      changed = true;
    }
  }
  const used = [...db.list('displays').flatMap((d) => d.groups), ...db.list('schedules').flatMap((s) => s.targets?.groups || [])];
  const before = db.list('groups').length;
  ensureGroups(used);
  if (changed || db.list('groups').length !== before) db.saveNow();
})();
// 0.2.x had one account in settings.adminUser; it becomes the first administrator.
(function migrateUsers() {
  const old = db.data.settings.adminUser;
  if (old !== undefined) {
    if (old && !db.list('users').length) {
      db.list('users').push({ id: Database.id(), username: old.username, name: old.username, role: 'admin', salt: old.salt, hash: old.hash, sv: 0, createdAt: new Date().toISOString() });
    }
    delete db.data.settings.adminUser;
    db.saveNow();
  }
})();
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
    if (what !== 'users') toAllPlayers('update', { what });
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
  if (m.type === 'weather' || m.type === 'traffic') out.liveStatus = liveStatus.get(m.id) || null;
  return out;
}

function isOnline(d) {
  return (playerStreams.get(d.id)?.size || 0) > 0 || (d.lastSeen && Date.now() - new Date(d.lastSeen).getTime() < ONLINE_MS);
}

// A playlist named exactly like a display group (ignoring case) is that group's playlist: screens in
// the group play it whenever nothing is scheduled, instead of their own default playlist.
const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
function groupPlaylist(d) {
  for (const g of d.groups || []) {
    const p = db.list('playlists').find((x) => sameName(x.name, g));
    if (p) return p;
  }
  return null;
}
const effectiveDefault = (d) => groupPlaylist(d)?.id || d.defaultPlaylistId || null;

function publicDisplay(d) {
  const { token, ...rest } = d;
  const effectivePlaylistId = effectiveDefault(d);
  const now = resolveSchedule(db.list('schedules'), { ...d, defaultPlaylistId: effectivePlaylistId }, new Date());
  return {
    ...rest, maintenance: maintenanceOf(d), online: isOnline(d),
    groupPlaylistId: groupPlaylist(d)?.id || null, effectivePlaylistId,
    scheduledPlaylistId: now.playlistId, scheduledMediaId: now.mediaId, scheduleId: now.scheduleId,
  };
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
  const original = path.join(dir, m.file);
  convert
    .enqueue(async () => {
      fs.rmSync(slidesDir, { recursive: true, force: true });
      // Embedded fonts / "use Arial" are handled on a temporary copy (see server/pptx.js).
      const have = await fonts.installedFamilies().catch(() => null);
      let prep = null;
      try {
        const replace = Object.fromEntries((db.data.settings.fontReplacements || []).map((r) => [r.from.toLowerCase(), r.to]));
        prep = pptx.prepare(original, db.get('media', m.id)?.fontMode, (name) => !!have && fonts.isInstalled(have, name), replace);
      } catch (e) {
        console.warn(`[convert] ${m.name}: could not prepare the file (${e.message}); converting it as it is`);
      }
      try {
        const slides = await convert.convertPresentation(prep ? prep.file : original, slidesDir);
        const missingFonts = await fonts.missingFonts(prep ? prep.file : original).catch(() => []);
        return { slides, missingFonts, embeddedFonts: pptx.embeddedFonts(original), fontsUsed: fonts.fontsUsed(original), replacedFonts: prep ? prep.replaced : [] };
      } finally {
        if (prep) fs.rmSync(prep.dir, { recursive: true, force: true });
      }
    })
    .then(({ slides, missingFonts, embeddedFonts, fontsUsed, replacedFonts }) => {
      // Drop the intermediate PDF LibreOffice leaves next to the slides.
      for (const f of fs.readdirSync(slidesDir)) if (f.endsWith('.pdf')) fs.rmSync(path.join(slidesDir, f));
      if (!db.get('media', m.id)) return;
      db.update('media', m.id, { status: 'ready', slides, error: null, missingFonts, embeddedFonts, fontsUsed, replacedFonts });
      toAdmins('media', { id: m.id, status: 'ready' });
    })
    .catch((err) => {
      console.error(`[convert] ${m.name}:`, err.message);
      if (!db.get('media', m.id)) return;
      db.update('media', m.id, { status: 'error', error: err.message.split('\n')[0] });
      toAdmins('media', { id: m.id, status: 'error' });
    });
}

/** One media item → the entries a player shows (one per slide for presentations). */
function expandMedia(m, it, defaults) {
  const out = [];
  if (!m || m.status !== 'ready') return out;
  const base = { itemId: it.id || m.id, mediaId: m.id, name: m.name, transition: it.transition || defaults.transition || 'fade' };
  const duration = Number(it.duration) > 0 ? Number(it.duration) : m.type === 'video' ? 0 : Number(defaults.duration) || 10;
  if (m.type === 'presentation') {
    (m.slides || []).forEach((s, i) => out.push({ ...base, type: 'image', url: mediaUrl(m, `slides/${s}`), duration, slide: i + 1, slides: m.slides.length }));
  } else if (m.type === 'image') out.push({ ...base, type: 'image', url: mediaUrl(m, m.file), duration });
  else if (m.type === 'video') out.push({ ...base, type: 'video', url: mediaUrl(m, m.file), duration, mute: it.mute !== false });
  else if (m.type === 'web') out.push({ ...base, type: 'web', url: m.url, duration, zoom: Number(m.zoom) || 100, refreshSeconds: Number(m.refreshSeconds) || 0 });
  else if (m.type === 'text') out.push({ ...base, type: 'text', text: m.text, duration });
  // Weather and traffic slides are pages served by KevCast itself (public/widgets), shown like a web page.
  else if (m.type === 'weather' || m.type === 'traffic') out.push({ ...base, type: 'web', widget: m.type, url: `/widgets/${m.type}.html?id=${m.id}`, duration, zoom: 100, refreshSeconds: 0, ...(LANGS.includes(m.language) ? { lang: m.language } : {}) });
  return out;
}

/** Flatten a playlist into what a player can show: one entry per image/slide/video/page. */
function expandPlaylist(p) {
  if (!p) return null;
  const items = [];
  for (const it of p.items || []) {
    if (it.enabled === false) continue;
    items.push(...expandMedia(db.get('media', it.mediaId), it, { transition: p.transition, duration: p.defaultDuration }));
  }
  return { id: p.id, name: p.name, items };
}

/** A single scheduled media item (e.g. a web page) as a one-item "playlist" keyed "media:<id>". */
function expandSingle(mediaId) {
  const m = db.get('media', mediaId);
  if (!m) return null;
  return { id: `media:${m.id}`, name: m.name, items: expandMedia(m, { id: m.id }, { transition: 'fade', duration: 30 }) };
}

function playerManifest(d) {
  const schedules = db.list('schedules').filter((s) => s.enabled !== false);
  const ids = new Set(schedules.filter((s) => s.playlistId).map((s) => s.playlistId));
  const defaultId = effectiveDefault(d);
  if (defaultId) ids.add(defaultId);
  const playlists = {};
  for (const id of ids) {
    const p = expandPlaylist(db.get('playlists', id));
    if (p) playlists[id] = p;
  }
  for (const s of schedules) {
    if (!s.mediaId || playlists[`media:${s.mediaId}`]) continue;
    const p = expandSingle(s.mediaId);
    if (p) playlists[p.id] = p;
  }
  const { token, ...display } = d;
  display.maintenance = maintenanceOf(d);
  display.ownDefaultPlaylistId = d.defaultPlaylistId || null;
  display.defaultPlaylistId = defaultId; // the group's playlist, if one is named after a group
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
// Code shared by the server, the Web Studio and the player: scheduling and translations.
app.use('/shared', express.static(path.join(__dirname, '..', 'shared'), { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
app.use('/media', express.static(MEDIA_DIR, { maxAge: '7d', immutable: true }));

// ---------------------------------------------------------------------------
// Session / setup
// ---------------------------------------------------------------------------
const ROLES = ['admin', 'editor'];
// Per-user KevCast Studio options (set by an administrator):
//   powerpoint     – Studio on Windows converts PowerPoint files with the user's own PowerPoint to PDF before uploading
//   replaceFonts   – and applies the server's font replacements to the file first
const STUDIO_OPTIONS = ['powerpoint', 'replaceFonts'];
const studioOptions = (u) => ({ powerpoint: !!u.studio?.powerpoint, replaceFonts: u.studio?.replaceFonts !== false });
const cleanStudio = (v, old = {}) => Object.fromEntries(STUDIO_OPTIONS.map((k) => [k, v && k in v ? !!v[k] : studioOptions({ studio: old })[k]]));
const publicUser = (u) => u && { id: u.id, username: u.username, name: u.name || u.username, role: u.role, createdAt: u.createdAt, lastLogin: u.lastLogin || null, studio: studioOptions(u) };
const findUser = (username) => {
  const n = String(username || '').trim().toLowerCase();
  return n ? db.list('users').find((u) => u.username.toLowerCase() === n) : null;
};
// Setup (create an administrator) is open while there is none: on first run, or after removing a
// forgotten administrator from db.json (see docs/troubleshooting.md).
const admins = () => db.list('users').filter((u) => u.role === 'admin');
const validUsername = (n) => /^[\p{L}\p{N}._@-]{1,64}$/u.test(n);

app.get('/api/session', (req, res) => {
  res.json({
    setupRequired: !admins().length,
    user: publicUser(auth.currentUser(req)),
    orgName: db.data.settings.orgName,
    version: pkg.version,
  });
});

app.post('/api/setup', (req, res) => {
  if (admins().length) return bad(res, 'Already set up', 409);
  const { password, orgName } = req.body || {};
  const username = String(req.body?.username || '').trim();
  if (!validUsername(username) || !password || password.length < 6) return bad(res, 'Choose a username (letters, digits, . _ @ -) and a password of at least 6 characters.');
  if (findUser(username)) return bad(res, 'That username is already taken', 409);
  const user = db.insert('users', { username, name: username, role: 'admin', sv: 0, lastLogin: new Date().toISOString(), ...auth.hashPassword(password) });
  if (orgName) db.data.settings.orgName = orgName;
  db.save('settings');
  auth.issue(res, user);
  res.json({ ok: true });
});

const loginAttempts = new Map();
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const a = loginAttempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60 * 1000) Object.assign(a, { n: 0, t: Date.now() });
  if (a.n >= 10) return bad(res, 'Too many attempts, try again in a few minutes.', 429);
  const { username, password } = req.body || {};
  const u = findUser(username);
  if (u && auth.verifyPassword(String(password || ''), u)) {
    loginAttempts.delete(ip);
    u.lastLogin = new Date().toISOString();
    db.save('users');
    auth.issue(res, u);
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
    groups: auto && provisioning.group ? ensureGroups([provisioning.group]) : [],
    defaultPlaylistId: null,
    orientation: 'landscape',
    fit: 'contain',
    showClock: false,
    ticker: { enabled: false, text: '', speed: 60 },
    background: '#000000',
    maintenance: { ...DEFAULT_MAINTENANCE },
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
admin.use(auth.requireUser);
const adminOnly = auth.requireAdministrator;

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
    // Editors can't add screens with the key, so they don't get to see it.
    provisioningKey: req.user.role === 'admin' ? provisioningKey() : null,
    fontReplacements: db.data.settings.fontReplacements || [],
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
      // KevCast Studio converted a PowerPoint to this PDF with the user's own PowerPoint.
      ...(ext === '.pdf' && req.body?.convertedWith === 'PowerPoint'
        ? { convertedWith: 'PowerPoint', sourceName: String(req.body.sourceName || '').slice(0, 255) || null }
        : {}),
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
  const { type, name, url, text, zoom, refreshSeconds } = req.body || {};
  if (type === 'web') {
    if (!/^https?:\/\//i.test(url || '')) return bad(res, 'Enter a full web address starting with http:// or https://');
    return res.json(publicMedia(db.insert('media', { type, name: name || url, url, zoom: cleanZoom(zoom), refreshSeconds: Math.max(0, Number(refreshSeconds) || 0), status: 'ready', tags: [] })));
  }
  if (type === 'text') {
    if (!text || !(text.title || text.body)) return bad(res, 'Add a title or some text');
    return res.json(publicMedia(db.insert('media', { type, name: name || text.title || 'Text slide', text, status: 'ready', tags: [] })));
  }
  if (type === 'weather' || type === 'traffic') {
    const place = cleanPlace(req.body.place);
    if (!place) return bad(res, 'Choose a location');
    const rec = { type, name: name || place.name, place, status: 'ready', tags: [], language: LANGS.includes(req.body.language) ? req.body.language : 'auto' };
    if (type === 'weather') rec.weather = cleanWeatherOptions(req.body.weather);
    if (type === 'traffic') rec.destinations = cleanDestinations(req.body.destinations);
    const created = db.insert('media', rec);
    if (require.main === module) liveData(created, LANGS.includes(created.language) ? created.language : 'en').catch(() => {}); // ready before a screen asks
    return res.json(publicMedia(created));
  }
  bad(res, 'Unknown media type');
});

const LANGS = ['en', 'nl', 'de'];
const cleanZoom = (z) => Math.max(25, Math.min(400, Math.round(Number(z) || 100)));
// Live data slides ------------------------------------------------------------------
function cleanPlace(p) {
  const lat = Number(p?.lat);
  const lon = Number(p?.lon);
  if (!p || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {
    name: String(p.name || '').trim().slice(0, 80) || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    country: String(p.country || '').toLowerCase().slice(0, 2),
    region: String(p.region || '').slice(0, 80),
  };
}
const cleanDestinations = (list) => (Array.isArray(list) ? list.map(cleanPlace).filter(Boolean).slice(0, 8) : []);
const cleanWeatherOptions = (o = {}) => ({ hourly: o.hourly !== false, days: o.days !== false, warnings: o.warnings !== false });
admin.patch('/media/:id', (req, res) => {
  const allowed = ['name', 'url', 'text', 'tags', 'zoom', 'refreshSeconds'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  if ('place' in (req.body || {})) {
    patch.place = cleanPlace(req.body.place);
    if (!patch.place) return bad(res, 'Choose a location');
  }
  if ('destinations' in (req.body || {})) patch.destinations = cleanDestinations(req.body.destinations);
  if ('weather' in (req.body || {})) patch.weather = cleanWeatherOptions(req.body.weather);
  if ('language' in (req.body || {})) patch.language = LANGS.includes(req.body.language) ? req.body.language : 'auto';
  if ('url' in patch && !/^https?:\/\//i.test(patch.url || '')) return bad(res, 'Enter a full web address starting with http:// or https://');
  if ('zoom' in patch) patch.zoom = cleanZoom(patch.zoom);
  if ('refreshSeconds' in patch) patch.refreshSeconds = Math.max(0, Number(patch.refreshSeconds) || 0);
  const before = db.get('media', req.params.id);
  if (!before) return bad(res, 'Not found', 404);
  const oldMode = before.fontMode || 'auto'; // db.update changes the record in place
  // How fonts are handled when converting a PowerPoint (server/pptx.js); changing it converts again.
  if ('fontMode' in (req.body || {})) {
    if (!pptx.MODES.includes(req.body.fontMode)) return bad(res, 'Unknown font option');
    patch.fontMode = req.body.fontMode;
  }
  const m = db.update('media', req.params.id, patch);
  if (m.type === 'presentation' && 'fontMode' in patch && patch.fontMode !== oldMode && m.status !== 'processing') processPresentation(m);
  res.json(publicMedia(db.get('media', m.id)));
});

// Find a place by name for weather and traffic slides (OpenStreetMap).
admin.get('/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  try {
    const seen = new Set();
    res.json((await geo.search(q, String(req.query.lang || 'en').slice(0, 5))).filter((p) => !seen.has(p.label) && seen.add(p.label)));
  } catch (e) {
    bad(res, 'Could not search for places: the server can’t reach OpenStreetMap', 502);
  }
});
admin.get('/places/cities', (req, res) => res.json(liveTraffic.citiesFor(String(req.query.country || '').toLowerCase())));

admin.get('/media/:id/preview', (req, res) => {
  const p = expandSingle(req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  res.json(p);
});

// After installing fonts on the server: convert every presentation again.
admin.post('/media/reconvert-all', (req, res) => {
  const onlyMissing = !!req.body?.onlyMissingFonts;
  const fontMode = req.body?.fontMode;
  if (fontMode !== undefined && !pptx.MODES.includes(fontMode)) return bad(res, 'Unknown font option');
  const list = db.list('media').filter((m) => m.type === 'presentation' && m.status !== 'processing' && (!onlyMissing || (m.missingFonts || []).length));
  for (const m of list) {
    if (fontMode) m.fontMode = fontMode;
    processPresentation(m);
  }
  res.json({ ok: true, count: list.length });
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
  db.data.schedules = db.list('schedules').filter((x) => x.mediaId !== id);
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
const DEFAULT_MAINTENANCE = { weeklyRestart: true, day: 0, time: '03:00' };
/** Weekly restart settings of a display (older displays get the default: Sunday 03:00). */
function maintenanceOf(d) {
  const m = d.maintenance || {};
  return {
    weeklyRestart: m.weeklyRestart !== undefined ? !!m.weeklyRestart : DEFAULT_MAINTENANCE.weeklyRestart,
    day: Number.isInteger(m.day) && m.day >= 0 && m.day <= 6 ? m.day : DEFAULT_MAINTENANCE.day,
    time: /^\d{2}:\d{2}$/.test(m.time || '') ? m.time : DEFAULT_MAINTENANCE.time,
  };
}

function cleanSchedule(b) {
  const time = (t, def) => (/^\d{1,2}:\d{2}$/.test(t || '') ? t.padStart(5, '0') : def);
  const date = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
  const int = (v, min, max, def) => Math.max(min, Math.min(max, Math.round(Number(v)) || def));
  const repeat = ['weekly', 'monthly', 'once'].includes(b.repeat) ? b.repeat : 'weekly';
  const iv = b.interval && Number(b.interval.everyMinutes) > 0 && Number(b.interval.showSeconds) > 0
    ? { everyMinutes: int(b.interval.everyMinutes, 1, 1440, 15), showSeconds: int(b.interval.showSeconds, 5, 86400, 60) }
    : null;
  return {
    name: String(b.name || ''),
    playlistId: b.mediaId ? null : String(b.playlistId || ''),
    mediaId: b.mediaId ? String(b.mediaId) : null,
    itemDuration: Math.max(0, Math.round(Number(b.itemDuration) || 0)),
    enabled: b.enabled !== false,
    priority: Math.max(0, Math.min(10, Number(b.priority) || 0)),
    repeat,
    everyWeeks: int(b.everyWeeks, 1, 52, 1),
    monthDay: int(b.monthDay, 1, 31, 1),
    allDay: !!b.allDay,
    start: time(b.start, '08:00'),
    end: time(b.end, '17:00'),
    days: (Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => d >= 0 && d <= 6),
    startDate: date(b.startDate),
    endDate: repeat === 'once' ? date(b.startDate) : date(b.endDate),
    interval: iv,
    targets: {
      displays: (b.targets?.displays || []).map(String),
      groups: ensureGroups(b.targets?.groups || []),
    },
  };
}
function scheduleProblem(s) {
  if (s.mediaId ? !db.get('media', s.mediaId) : !db.get('playlists', s.playlistId)) return 'Pick a playlist, media item or web page';
  if (s.repeat === 'once' && !s.startDate) return 'Pick the date';
  if (s.startDate && s.endDate && s.endDate < s.startDate) return 'The end date is before the start date';
  return null;
}
admin.get('/schedules', (req, res) => res.json(db.list('schedules')));
admin.post('/schedules', (req, res) => {
  const s = cleanSchedule(req.body || {});
  const problem = scheduleProblem(s);
  if (problem) return bad(res, problem);
  res.json(db.insert('schedules', s));
});
admin.put('/schedules/:id', (req, res) => {
  const s = cleanSchedule(req.body || {});
  const problem = scheduleProblem(s);
  if (problem) return bad(res, problem);
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
  const { name, group, groups, defaultPlaylistId } = req.body;
  db.update('displays', d.id, {
    approved: true,
    pairingCode: null,
    name: name || `Display ${db.list('displays').filter((x) => x.approved).length + 1}`,
    groups: ensureGroups(Array.isArray(groups) ? groups : group ? [group] : []),
    defaultPlaylistId: defaultPlaylistId || null,
  });
  toPlayer(d.id, 'approved', {});
  res.json(publicDisplay(d));
});

// Commands and settings for many displays at once (a group, a selection or all).
function selectDisplays({ ids, group, all }) {
  return db.list('displays').filter((d) => d.approved && (all || (ids || []).includes(d.id) || (group && (d.groups || []).includes(group))));
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
  const allowed = ['groups', 'defaultPlaylistId', 'orientation', 'fit', 'showClock', 'clockFormat', 'language', 'ticker', 'background', 'maintenance'];
  const patch = Object.fromEntries(Object.entries(req.body?.patch || {}).filter(([k]) => allowed.includes(k)));
  if (patch.maintenance) patch.maintenance = maintenanceOf({ maintenance: patch.maintenance });
  if (patch.groups) patch.groups = ensureGroups(patch.groups);
  const add = ensureGroups(req.body?.addGroups || []);
  const remove = (req.body?.removeGroups || []).map(String);
  const list = selectDisplays(req.body || {});
  for (const d of list) {
    Object.assign(d, patch, { updatedAt: new Date().toISOString() });
    if (add.length || remove.length) d.groups = [...new Set([...(d.groups || []), ...add])].filter((g) => !remove.includes(g));
  }
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
  const allowed = ['name', 'groups', 'defaultPlaylistId', 'orientation', 'fit', 'showClock', 'clockFormat', 'language', 'ticker', 'background', 'notes', 'maintenance'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  if (patch.maintenance) patch.maintenance = maintenanceOf({ maintenance: patch.maintenance });
  if (patch.groups) patch.groups = ensureGroups(Array.isArray(patch.groups) ? patch.groups : []);
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
  const removedSchedules = pruneScheduleTargets({ displayId: id });
  db.save('schedules');
  res.json({ ok: true, removedSchedules });
});

// Groups ----------------------------------------------------------------------
function publicGroup(g) {
  const members = db.list('displays').filter((d) => d.approved && (d.groups || []).includes(g.name));
  return {
    ...g,
    displayIds: members.map((d) => d.id),
    members: members.length,
    online: members.filter(isOnline).length,
    schedules: db.list('schedules').filter((s) => (s.targets?.groups || []).includes(g.name)).length,
    playlistId: db.list('playlists').find((p) => sameName(p.name, g.name))?.id || null,
  };
}
admin.get('/groups', (req, res) => res.json(db.list('groups').map(publicGroup)));
admin.post('/groups', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return bad(res, 'Give the group a name');
  if (groupNames().some((n) => n.toLowerCase() === name.toLowerCase())) return bad(res, 'A group with that name already exists', 409);
  const [created] = ensureGroups([name]);
  const g = db.list('groups').find((x) => x.name === created);
  if (req.body.color) g.color = String(req.body.color);
  if (req.body.description) g.description = String(req.body.description);
  if (Array.isArray(req.body.displayIds)) {
    for (const d of db.list('displays')) if (req.body.displayIds.includes(d.id)) d.groups = [...new Set([...(d.groups || []), g.name])];
  }
  db.save('groups');
  res.json(publicGroup(g));
});
admin.patch('/groups/:id', (req, res) => {
  const g = db.get('groups', req.params.id);
  if (!g) return bad(res, 'Not found', 404);
  const b = req.body || {};
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name) return bad(res, 'Give the group a name');
    if (name !== g.name && groupNames().some((n) => n.toLowerCase() === name.toLowerCase())) return bad(res, 'A group with that name already exists', 409);
    // Renaming keeps members and schedules attached.
    for (const d of db.list('displays')) d.groups = (d.groups || []).map((x) => (x === g.name ? name : x));
    for (const s of db.list('schedules')) s.targets.groups = (s.targets.groups || []).map((x) => (x === g.name ? name : x));
    g.name = name;
  }
  if (b.color !== undefined) g.color = String(b.color);
  if (b.description !== undefined) g.description = String(b.description);
  g.updatedAt = new Date().toISOString();
  db.save('groups');
  res.json(publicGroup(g));
});
admin.post('/groups/:id/members', (req, res) => {
  const g = db.get('groups', req.params.id);
  if (!g) return bad(res, 'Not found', 404);
  const add = (req.body?.add || []).map(String);
  const remove = (req.body?.remove || []).map(String);
  for (const d of db.list('displays')) {
    if (add.includes(d.id)) d.groups = [...new Set([...(d.groups || []), g.name])];
    if (remove.includes(d.id)) d.groups = (d.groups || []).filter((x) => x !== g.name);
  }
  db.save('displays');
  res.json(publicGroup(g));
});
/** Copy every schedule entry of this group to other groups (they get their own, editable copies). */
admin.post('/groups/:id/copy-schedule', (req, res) => {
  const g = db.get('groups', req.params.id);
  if (!g) return bad(res, 'Not found', 404);
  const targets = (req.body?.toGroupIds || []).map((id) => db.get('groups', id)).filter((x) => x && x.id !== g.id);
  if (!targets.length) return bad(res, 'Pick at least one other group');
  const source = db.list('schedules').filter((s) => (s.targets?.groups || []).includes(g.name));
  let copied = 0;
  for (const t of targets) {
    for (const s of source) {
      const { id, createdAt, updatedAt, ...rest } = s;
      db.insert('schedules', { ...JSON.parse(JSON.stringify(rest)), targets: { displays: [], groups: [t.name] } });
      copied++;
    }
  }
  res.json({ ok: true, copied });
});
admin.delete('/groups/:id', (req, res) => {
  const g = db.get('groups', req.params.id);
  if (!g) return bad(res, 'Not found', 404);
  for (const d of db.list('displays')) d.groups = (d.groups || []).filter((x) => x !== g.name);
  const removedSchedules = pruneScheduleTargets({ group: g.name });
  db.remove('groups', g.id);
  res.json({ ok: true, removedSchedules });
});

// Change many schedule entries at once.
admin.post('/schedules/bulk', (req, res) => {
  const { ids, action } = req.body || {};
  const list = db.list('schedules').filter((s) => (ids || []).includes(s.id));
  if (!list.length) return bad(res, 'Select at least one entry');
  if (action === 'delete') {
    db.data.schedules = db.list('schedules').filter((s) => !ids.includes(s.id));
  } else if (action === 'enable' || action === 'disable') {
    for (const s of list) s.enabled = action === 'enable';
  } else if (action === 'setTargets') {
    const t = req.body.targets || {};
    const targets = { displays: (t.displays || []).map(String), groups: ensureGroups(t.groups || []) };
    for (const s of list) s.targets = JSON.parse(JSON.stringify(targets));
  } else if (action === 'priority') {
    for (const s of list) s.priority = Math.max(0, Math.min(10, Number(req.body.priority) || 0));
  } else {
    return bad(res, 'Unknown action');
  }
  db.save('schedules');
  res.json({ ok: true, changed: list.length });
});

// Settings --------------------------------------------------------------------
admin.patch('/settings', adminOnly, (req, res) => {
  if (req.body?.orgName) db.data.settings.orgName = String(req.body.orgName);
  db.save('settings');
  res.json({ ok: true });
});
// Server-wide font replacements for PowerPoint conversion, e.g. [{ from: 'Corporate Sans', to: 'Arial' }].
// Presentations that use a changed font are converted again.
admin.put('/font-replacements', adminOnly, (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body?.replacements;
  if (!Array.isArray(list)) return bad(res, 'Send a list of replacements');
  const clean = [];
  for (const r of list) {
    const from = String(r?.from || '').trim().slice(0, 100);
    const to = String(r?.to || 'Arial').trim().slice(0, 100) || 'Arial';
    if (from && !clean.some((x) => x.from.toLowerCase() === from.toLowerCase())) clean.push({ from, to });
  }
  const before = new Map((db.data.settings.fontReplacements || []).map((r) => [r.from.toLowerCase(), r.to]));
  const after = new Map(clean.map((r) => [r.from.toLowerCase(), r.to]));
  const changed = new Set([...before.keys(), ...after.keys()].filter((k) => before.get(k) !== after.get(k)));
  db.data.settings.fontReplacements = clean;
  db.save('settings');
  let reconverting = 0;
  if (changed.size) {
    for (const m of db.list('media')) {
      if (m.type !== 'presentation' || m.status === 'processing') continue;
      if ((m.fontsUsed || []).some((f) => changed.has(f.toLowerCase())) || (m.fontsUsed === undefined && /\.(pptx|potx|ppsx|pptm)$/i.test(m.file || ''))) {
        processPresentation(m);
        reconverting++;
      }
    }
  }
  res.json({ replacements: clean, reconverting });
});

admin.post('/provisioning-key/rotate', adminOnly, (req, res) => {
  db.data.settings.provisioningKey = null;
  res.json({ provisioningKey: provisioningKey() });
});
// Your own password. Signs you out everywhere else.
admin.post('/password', (req, res) => {
  const { current, next } = req.body || {};
  const u = req.user;
  if (!auth.verifyPassword(String(current || ''), u)) return bad(res, 'Current password is wrong', 403);
  if (!next || next.length < 6) return bad(res, 'New password must be at least 6 characters');
  Object.assign(u, auth.hashPassword(next), { sv: (u.sv || 0) + 1 });
  db.save('users');
  auth.issue(res, u);
  res.json({ ok: true });
});
admin.get('/backup', adminOnly, (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="kevcast-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  const { settings, users, ...rest } = db.data;
  res.json({ ...rest, settings: { orgName: settings.orgName } });
});

// Users (administrators only) ---------------------------------------------------
admin.get('/users', adminOnly, (req, res) => res.json(db.list('users').map(publicUser)));
admin.post('/users', adminOnly, (req, res) => {
  const { password, role = 'editor' } = req.body || {};
  const username = String(req.body?.username || '').trim();
  if (!validUsername(username)) return bad(res, 'Choose a username: letters, digits and . _ @ - only, no spaces.');
  if (findUser(username)) return bad(res, 'That username is already taken', 409);
  if (!ROLES.includes(role)) return bad(res, 'Unknown role');
  if (!password || password.length < 6) return bad(res, 'The password must be at least 6 characters');
  const name = String(req.body?.name || '').trim().slice(0, 100) || username;
  const user = db.insert('users', { username, name, role, sv: 0, studio: cleanStudio(req.body?.studio), ...auth.hashPassword(password) });
  res.json(publicUser(user));
});
admin.patch('/users/:id', adminOnly, (req, res) => {
  const u = db.get('users', req.params.id);
  if (!u) return bad(res, 'User not found', 404);
  const { name, role, password } = req.body || {};
  if (role !== undefined && role !== u.role) {
    if (!ROLES.includes(role)) return bad(res, 'Unknown role');
    if (u.role === 'admin' && admins().length === 1) return bad(res, 'There must be at least one administrator');
    u.role = role;
    u.sv = (u.sv || 0) + 1;
  }
  if (password !== undefined && password !== '') {
    if (password.length < 6) return bad(res, 'The password must be at least 6 characters');
    Object.assign(u, auth.hashPassword(password));
    u.sv = (u.sv || 0) + 1;
  }
  if (name !== undefined) u.name = String(name).trim().slice(0, 100) || u.username;
  if (req.body?.studio !== undefined) u.studio = cleanStudio(req.body.studio, u.studio);
  u.updatedAt = new Date().toISOString();
  db.save('users');
  if (u.id === req.user.id) auth.issue(res, u); // keep yourself signed in
  res.json(publicUser(u));
});
admin.delete('/users/:id', adminOnly, (req, res) => {
  const u = db.get('users', req.params.id);
  if (!u) return bad(res, 'User not found', 404);
  if (u.id === req.user.id) return bad(res, 'You can’t remove your own account');
  if (u.role === 'admin' && admins().length === 1) return bad(res, 'There must be at least one administrator');
  db.remove('users', u.id);
  res.json({ ok: true });
});

// Data for the weather and traffic slides (public/widgets). Players and previews load it without a login;
// it only exists for those two media types and contains nothing private.
// Weather/traffic data, with the outcome remembered per slide (shown in the Web Studio).
const liveStatus = new Map(); // media id → { ok, at, error }
async function liveData(m, lang = 'en') {
  try {
    const data = m.type === 'weather'
      ? { name: m.name, options: cleanWeatherOptions(m.weather), ...(await liveWeather.weather(m.place, lang)) }
      : { name: m.name, ...(await liveTraffic.traffic(m.place, m.destinations)) };
    const failed = m.type === 'traffic' ? data.routes.filter((r) => r.error) : [];
    const problem = (failed[0] && failed[0].error) || data.liveError || (data.stale && data.error) || null;
    liveStatus.set(m.id, { ok: !(failed.length && failed.length === data.routes.length), at: new Date().toISOString(), error: problem });
    return data;
  } catch (e) {
    liveStatus.set(m.id, { ok: false, at: new Date().toISOString(), error: e.message });
    throw e;
  }
}
app.get('/api/widgets/:id', async (req, res) => {
  const m = db.get('media', req.params.id);
  if (!m || !['weather', 'traffic'].includes(m.type) || !m.place) return bad(res, 'Not found', 404);
  res.setHeader('Cache-Control', 'no-store');
  const lang = String(req.query.lang || 'en').slice(0, 2);
  const work = liveData(m, lang);
  // Never keep a screen waiting long: if the data isn't ready within a few seconds, say so (it keeps loading
  // in the background) and the slide asks again shortly.
  const timer = new Promise((resolve) => setTimeout(() => resolve({ loading: true }), 6000));
  try {
    const data = await Promise.race([work, timer]);
    if (data.loading) { work.catch(() => {}); return res.status(202).json({ loading: true }); }
    res.json(data);
  } catch (e) {
    console.warn(`[live] ${m.type} ${m.name}: ${e.message}`);
    res.status(502).json({ error: e.message });
  }
});
// Keep all weather and traffic slides fresh in the background, so screens get their data instantly.
function refreshLiveSlides() {
  for (const m of db.list('media')) {
    if ((m.type === 'weather' || m.type === 'traffic') && m.place) {
      liveData(m, LANGS.includes(m.language) ? m.language : 'en').catch((e) => console.warn(`[live] ${m.type} ${m.name}: ${e.message}`));
    }
  }
}
app.use('/widgets', express.static(path.join(pub, 'widgets'), { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

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
  setTimeout(refreshLiveSlides, 5000);
  setInterval(refreshLiveSlides, 2 * 60 * 1000);
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
