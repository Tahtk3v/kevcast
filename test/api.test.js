// End-to-end API test: setup, pairing a player, playlists and manifests.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.KEVCAST_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'kevcast-test-'));
const { app } = require('../server/index');

let server;
let base;
let cookie = '';

async function call(method, url, body, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', cookie, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: res.status, body: await res.json().catch(() => null) };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  server.close();
  fs.rmSync(process.env.KEVCAST_DATA, { recursive: true, force: true });
  setTimeout(() => process.exit(0), 50).unref();
});

test('full flow', async () => {
  assert.strictEqual((await call('GET', '/api/session')).body.setupRequired, true);
  assert.strictEqual((await call('GET', '/api/media')).status, 401);
  assert.strictEqual((await call('POST', '/api/setup', { username: 'admin', password: 'secret123' })).status, 200);
  assert.strictEqual((await call('POST', '/api/setup', { username: 'x', password: 'secret123' })).status, 409);

  const text = (await call('POST', '/api/media', { type: 'text', text: { title: 'Hi' } })).body;
  const web = (await call('POST', '/api/media', { type: 'web', url: 'https://example.com' })).body;
  assert.strictEqual((await call('POST', '/api/media', { type: 'web', url: 'javascript:alert(1)' })).status, 400);

  const pl = (await call('POST', '/api/playlists', { name: 'Main' })).body;
  await call('PUT', `/api/playlists/${pl.id}`, { items: [{ mediaId: text.id, duration: 5 }, { mediaId: web.id }] });

  // A player registers and shows a pairing code.
  const reg = (await call('POST', '/api/player/register', {})).body;
  assert.match(reg.pairingCode, /^[A-Z2-9]{6}$/);
  const H = { 'x-display-token': reg.token };
  let m = (await call('GET', '/api/player/manifest', null, H)).body;
  assert.strictEqual(m.display.approved, false);

  assert.strictEqual((await call('POST', '/api/displays/pair', { code: 'WRONG1' })).status, 404);
  const d = (await call('POST', '/api/displays/pair', { code: reg.pairingCode.toLowerCase(), name: 'Lobby', defaultPlaylistId: pl.id })).body;
  assert.strictEqual(d.approved, true);
  assert.strictEqual(d.token, undefined, 'token must not leak to the admin API');

  m = (await call('GET', '/api/player/manifest', null, H)).body;
  assert.strictEqual(m.display.approved, true);
  assert.deepStrictEqual(m.playlists[pl.id].items.map((i) => [i.type, i.duration]), [['text', 5], ['web', 10]]);

  await call('POST', '/api/schedules', { playlistId: pl.id, allDay: true, days: [0, 1, 2, 3, 4, 5, 6] });
  assert.strictEqual((await call('GET', '/api/schedules')).body.length, 1);

  // Schedule a web page directly, valid for a period, recurring every 15 minutes.
  const ns = (await call('POST', '/api/media', { type: 'web', url: 'https://example.org/departures', name: 'Departures', zoom: 80, refreshSeconds: 300 })).body;
  const sched = (await call('POST', '/api/schedules', { mediaId: ns.id, itemDuration: 45, repeat: 'weekly', everyWeeks: 2, days: [1], start: '07:00', end: '09:00',
    startDate: '2026-11-01', endDate: '2026-12-31', interval: { everyMinutes: 15, showSeconds: 60 } })).body;
  assert.deepStrictEqual([sched.mediaId, sched.playlistId, sched.itemDuration, sched.everyWeeks, sched.interval.everyMinutes], [ns.id, null, 45, 2, 15]);
  assert.strictEqual((await call('POST', '/api/schedules', { mediaId: ns.id, repeat: 'once' })).status, 400, 'once needs a date');
  assert.strictEqual((await call('POST', '/api/schedules', { playlistId: pl.id, startDate: '2026-12-01', endDate: '2026-11-01' })).status, 400);
  m = (await call('GET', '/api/player/manifest', null, H)).body;
  const single = m.playlists[`media:${ns.id}`];
  assert.deepStrictEqual([single.items.length, single.items[0].type, single.items[0].zoom, single.items[0].refreshSeconds], [1, 'web', 80, 300]);
  assert.deepStrictEqual(m.display.maintenance, { weeklyRestart: true, day: 0, time: '03:00' });

  // Weekly restart settings are validated.
  await call('PATCH', `/api/displays/${d.id}`, { maintenance: { weeklyRestart: false, day: 9, time: 'soon' } });
  m = (await call('GET', '/api/player/manifest', null, H)).body;
  assert.deepStrictEqual(m.display.maintenance, { weeklyRestart: false, day: 0, time: '03:00' });

  // Deleting a scheduled web page also removes its schedule entries.
  await call('DELETE', `/api/media/${ns.id}`);
  assert.strictEqual((await call('GET', '/api/schedules')).body.some((x) => x.mediaId === ns.id), false);

  // Deleting media removes it from playlists.
  await call('DELETE', `/api/media/${web.id}`);
  m = (await call('GET', '/api/player/manifest', null, H)).body;
  assert.strictEqual(m.playlists[pl.id].items.length, 1);

  // Group commands and bulk settings.
  await call('PATCH', '/api/displays/bulk', { ids: [d.id], patch: { groups: ['Lobby'], token: 'hack' } });
  const cmd = (await call('POST', '/api/displays/command', { group: 'Lobby', action: 'identify' })).body;
  assert.deepStrictEqual([cmd.targeted, cmd.delivered], [1, 0]);
  assert.strictEqual((await call('GET', '/api/player/manifest', null, H)).status, 200, 'bulk patch must not touch the token');

  // Provisioning key: auto-approved registration for mass roll-out.
  const key = (await call('GET', '/api/overview')).body.provisioningKey;
  const bad = (await call('POST', '/api/player/register', { provisioning: { key: 'nope', name: 'X' } })).body;
  assert.strictEqual(bad.approved, false);
  const good = (await call('POST', '/api/player/register', { provisioning: { key, name: 'Canteen', group: 'Floor 1', playlist: 'Main' } })).body;
  assert.strictEqual(good.approved, true);
  const prov = (await call('GET', '/api/displays')).body.find((x) => x.id === good.id);
  assert.deepStrictEqual([prov.name, prov.groups, prov.defaultPlaylistId], ['Canteen', ['Floor 1'], pl.id]);

  // Display groups: create, add members, schedule the group, copy, rename, bulk-edit, delete.
  let groups = (await call('GET', '/api/groups')).body;
  assert.deepStrictEqual(groups.map((g) => g.name).sort(), ['Floor 1', 'Lobby'], 'groups in use exist automatically');
  const meeting = (await call('POST', '/api/groups', { name: 'Meeting rooms', color: '#16a34a' })).body;
  assert.strictEqual((await call('POST', '/api/groups', { name: 'meeting ROOMS' })).status, 409);
  await call('POST', `/api/groups/${meeting.id}/members`, { add: [d.id, good.id] });
  const both = (await call('GET', '/api/displays')).body.find((x) => x.id === good.id);
  assert.deepStrictEqual(both.groups, ['Floor 1', 'Meeting rooms'], 'a display can be in several groups');
  const gs1 = (await call('POST', '/api/schedules', { playlistId: pl.id, allDay: true, targets: { groups: ['Meeting rooms'] } })).body;
  const empty = (await call('POST', '/api/groups', { name: 'Floor 2' })).body;
  assert.strictEqual((await call('POST', `/api/groups/${meeting.id}/copy-schedule`, { toGroupIds: [empty.id] })).body.copied, 1);
  await call('PATCH', `/api/groups/${meeting.id}`, { name: 'Meeting' });
  assert.deepStrictEqual((await call('GET', '/api/schedules')).body.find((x) => x.id === gs1.id).targets.groups, ['Meeting'], 'rename keeps schedules attached');
  assert.ok((await call('GET', '/api/displays')).body.find((x) => x.id === good.id).groups.includes('Meeting'));
  const ids = (await call('GET', '/api/schedules')).body.map((x) => x.id);
  assert.strictEqual((await call('POST', '/api/schedules/bulk', { ids, action: 'disable' })).body.changed, ids.length);
  assert.ok((await call('GET', '/api/schedules')).body.every((x) => x.enabled === false));
  await call('POST', '/api/schedules/bulk', { ids: [gs1.id], action: 'setTargets', targets: { groups: ['Floor 2'] } });
  assert.deepStrictEqual((await call('GET', '/api/schedules')).body.find((x) => x.id === gs1.id).targets, { displays: [], groups: ['Floor 2'] });
  // Deleting a group removes entries that only targeted it (they must not become "all displays").
  const del = (await call('DELETE', `/api/groups/${empty.id}`)).body;
  assert.strictEqual(del.removedSchedules, 2);
  assert.strictEqual((await call('GET', '/api/schedules')).body.some((x) => (x.targets.groups || []).includes('Floor 2')), false);
  groups = (await call('GET', '/api/groups')).body;
  assert.strictEqual(groups.find((g) => g.name === 'Meeting').members, 2);

  // Removing the display invalidates its token.
  await call('DELETE', `/api/displays/${d.id}`);
  assert.strictEqual((await call('GET', '/api/player/manifest', null, H)).status, 401);
});

test('users and roles', async () => {
  // Signed in as the administrator from the first test.
  const adminCookie = cookie;
  let users = (await call('GET', '/api/users')).body;
  assert.strictEqual(users.length, 1);
  assert.strictEqual(users[0].role, 'admin');
  assert.strictEqual(users[0].hash, undefined, 'password hashes never leave the server');

  assert.strictEqual((await call('POST', '/api/users', { username: 'sam smith', password: 'secret123' })).status, 400, 'no spaces');
  assert.strictEqual((await call('POST', '/api/users', { username: 'sam', password: '123' })).status, 400, 'short password');
  assert.strictEqual((await call('POST', '/api/users', { username: 'ADMIN', password: 'secret123' })).status, 409, 'usernames are unique, ignoring case');
  const sam = (await call('POST', '/api/users', { username: 'sam', name: 'Sam', password: 'secret123' })).body;
  assert.strictEqual(sam.role, 'editor', 'new users are editors by default');

  // Sam signs in (username case doesn't matter) and can manage content, but not users or settings.
  assert.strictEqual((await call('POST', '/api/login', { username: 'Sam', password: 'secret123' })).status, 200);
  const samCookie = cookie;
  assert.strictEqual((await call('GET', '/api/session')).body.user.role, 'editor');
  assert.strictEqual((await call('POST', '/api/playlists', { name: 'By Sam' })).status, 200);
  assert.strictEqual((await call('GET', '/api/overview')).body.provisioningKey, null, 'editors don’t see the roll-out key');
  assert.strictEqual((await call('GET', '/api/users')).status, 403);
  assert.strictEqual((await call('POST', '/api/users', { username: 'eve', password: 'secret123', role: 'admin' })).status, 403);
  assert.strictEqual((await call('PATCH', '/api/settings', { orgName: 'Hacked' })).status, 403);
  assert.strictEqual((await call('POST', '/api/provisioning-key/rotate')).status, 403);
  assert.strictEqual((await call('GET', '/api/backup')).status, 403);
  // Changing your own password keeps you signed in.
  assert.strictEqual((await call('POST', '/api/password', { current: 'secret123', next: 'newpass1' })).status, 200);
  assert.strictEqual((await call('GET', '/api/media')).status, 200);
  const samCookie2 = cookie;
  cookie = samCookie;
  assert.strictEqual((await call('GET', '/api/media')).status, 401, 'other sessions end after a password change');

  // The last administrator can't be demoted or removed; you can't remove yourself.
  cookie = adminCookie;
  const me = users[0];
  assert.strictEqual((await call('PATCH', `/api/users/${me.id}`, { role: 'editor' })).status, 400);
  assert.strictEqual((await call('DELETE', `/api/users/${me.id}`)).status, 400);
  // Promote Sam: that signs Sam out (role changed), then Sam has admin rights.
  assert.strictEqual((await call('PATCH', `/api/users/${sam.id}`, { role: 'admin' })).body.role, 'admin');
  cookie = samCookie2;
  assert.strictEqual((await call('GET', '/api/users')).status, 401);
  await call('POST', '/api/login', { username: 'sam', password: 'newpass1' });
  assert.strictEqual((await call('GET', '/api/users')).body.length, 2);
  assert.strictEqual((await call('DELETE', `/api/users/${me.id}`)).status, 200, 'with two administrators one can go');
  assert.strictEqual((await call('POST', '/api/login', { username: 'admin', password: 'secret123' })).status, 401);
});

test('0.2.x single admin account becomes the first administrator', () => {
  const { execFileSync } = require('child_process');
  const { hashPassword, verifyPassword } = require('../server/auth');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kevcast-migrate-'));
  try {
    const old = { username: 'boss', ...hashPassword('oldpass1') };
    fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ settings: { orgName: 'Acme', adminUser: old }, media: [], playlists: [], displays: [], schedules: [] }));
    execFileSync(process.execPath, ['-e', "require('./server/index'); process.exit(0)"], { cwd: path.join(__dirname, '..'), env: { ...process.env, KEVCAST_DATA: dir } });
    const db = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
    assert.strictEqual(db.settings.adminUser, undefined);
    assert.strictEqual(db.users.length, 1);
    assert.strictEqual(db.users[0].username, 'boss');
    assert.strictEqual(db.users[0].role, 'admin');
    assert.ok(verifyPassword('oldpass1', db.users[0]), 'the old password still works');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a playlist named like a group plays on that group', async () => {
  await call('POST', '/api/login', { username: 'sam', password: 'newpass1' }); // administrator after the users test
  const own = (await call('POST', '/api/playlists', { name: 'Own default' })).body;
  const reg = (await call('POST', '/api/player/register', {})).body;
  const d = (await call('POST', '/api/displays/pair', { code: reg.pairingCode, name: 'Canteen 1', groups: ['Canteen'], defaultPlaylistId: own.id })).body;
  const H = { 'x-display-token': reg.token };
  let m = (await call('GET', '/api/player/manifest', null, H)).body;
  assert.strictEqual(m.display.defaultPlaylistId, own.id, 'without a group playlist the screen plays its own default');

  const canteen = (await call('POST', '/api/playlists', { name: ' canteen ' })).body; // case and spaces don't matter
  m = (await call('GET', '/api/player/manifest', null, H)).body;
  assert.strictEqual(m.display.defaultPlaylistId, canteen.id, 'the group playlist wins');
  assert.strictEqual(m.display.ownDefaultPlaylistId, own.id);
  assert.ok(m.playlists[canteen.id], 'the group playlist is in the manifest');
  const pub = (await call('GET', '/api/displays')).body.find((x) => x.id === d.id);
  assert.strictEqual(pub.groupPlaylistId, canteen.id);
  assert.strictEqual(pub.scheduledPlaylistId, canteen.id);
  assert.strictEqual((await call('GET', '/api/groups')).body.find((g) => g.name === 'Canteen').playlistId, canteen.id);

  // Schedules still win over the group playlist.
  const sched = (await call('POST', '/api/schedules', { playlistId: own.id, allDay: true, days: [0, 1, 2, 3, 4, 5, 6], targets: { groups: ['Canteen'] } })).body;
  assert.strictEqual((await call('GET', '/api/displays')).body.find((x) => x.id === d.id).scheduledPlaylistId, own.id);
  await call('DELETE', `/api/schedules/${sched.id}`);

  // Renamed: the screen falls back to its own default.
  await call('PUT', `/api/playlists/${canteen.id}`, { name: 'Canteen menu' });
  m = (await call('GET', '/api/player/manifest', null, H)).body;
  assert.strictEqual(m.display.defaultPlaylistId, own.id);
});

test('re-convert all presentations', async () => {
  const r = (await call('POST', '/api/media/reconvert-all', {})).body;
  assert.strictEqual(r.count, 0, 'no presentations uploaded in these tests');
});

test('fonts used by a PowerPoint file', () => {
  const zlib = require('zlib');
  const { fontsUsed } = require('../server/fonts');
  // A minimal .pptx-like zip with one slide and one theme.
  const files = {
    'ppt/slides/slide1.xml': '<p:sld><a:rPr><a:latin typeface="Corporate Sans"/><a:ea typeface="MS Gothic"/></a:rPr><a:latin typeface="+mj-lt"/></p:sld>',
    'ppt/theme/theme1.xml': '<a:theme><a:majorFont><a:latin typeface="Calibri Light"/><a:font script="Jpan" typeface="Yu Gothic"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:theme>',
    'docProps/app.xml': '<a:latin typeface="Ignored"/>',
  };
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = zlib.deflateRawSync(Buffer.from(text));
    const n = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(text.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(text.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    local.push(lh, n, data);
    central.push(ch, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const file = path.join(process.env.KEVCAST_DATA, 'fonts.pptx');
  fs.writeFileSync(file, Buffer.concat([...local, cd, end]));
  assert.deepStrictEqual(fontsUsed(file).sort(), ['Calibri', 'Calibri Light', 'Corporate Sans']);
});

test('font replacements and font options', async () => {
  await call('POST', '/api/login', { username: 'sam', password: 'newpass1' }); // administrator
  let r = await call('PUT', '/api/font-replacements', [{ from: ' Corporate Sans ', to: '' }, { from: 'corporate sans', to: 'Verdana' }, { from: '' }]);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.replacements, [{ from: 'Corporate Sans', to: 'Arial' }], 'trimmed, Arial by default, no duplicates or blanks');
  assert.deepStrictEqual((await call('GET', '/api/overview')).body.fontReplacements, r.body.replacements);
  assert.strictEqual((await call('PUT', '/api/font-replacements', { nope: 1 })).status, 400);
  const text = (await call('POST', '/api/media', { type: 'text', text: { title: 'x' } })).body;
  assert.strictEqual((await call('PATCH', `/api/media/${text.id}`, { fontMode: 'comic' })).status, 400);
  assert.strictEqual((await call('PATCH', `/api/media/${text.id}`, { fontMode: 'arial' })).body.fontMode, 'arial');
  assert.strictEqual((await call('POST', '/api/media/reconvert-all', { fontMode: 'nope' })).status, 400);
  // Editors can't change the server-wide list.
  await call('POST', '/api/users', { username: 'ed', password: 'secret123' });
  await call('POST', '/api/login', { username: 'ed', password: 'secret123' });
  assert.strictEqual((await call('PUT', '/api/font-replacements', [])).status, 403);
});

test('Studio options per user, and PDFs converted by PowerPoint', async () => {
  await call('POST', '/api/login', { username: 'sam', password: 'newpass1' }); // administrator
  const u = (await call('POST', '/api/users', { username: 'lisa', password: 'secret123', studio: { powerpoint: true } })).body;
  assert.deepStrictEqual(u.studio, { powerpoint: true, replaceFonts: true }, 'font replacements are applied first by default');
  const p = (await call('PATCH', `/api/users/${u.id}`, { studio: { replaceFonts: false } })).body;
  assert.deepStrictEqual(p.studio, { powerpoint: true, replaceFonts: false }, 'only the given option changes');
  await call('POST', '/api/login', { username: 'lisa', password: 'secret123' });
  assert.deepStrictEqual((await call('GET', '/api/session')).body.user.studio, { powerpoint: true, replaceFonts: false });

  // KevCast Studio uploads the PDF with two extra form fields.
  const upload = async (name, type, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append('files', new Blob([type === 'pdf' ? '%PDF-1.4\n%%EOF\n' : 'png'], { type: type === 'pdf' ? 'application/pdf' : 'image/png' }), name);
    const res = await fetch(base + '/api/media/upload', { method: 'POST', headers: { cookie }, body: fd });
    return (await res.json()).created[0];
  };
  const pdf = await upload('Eindejaarsactie.pdf', 'pdf', { convertedWith: 'PowerPoint', sourceName: 'Eindejaarsactie.pptx' });
  assert.strictEqual(pdf.name, 'Eindejaarsactie');
  assert.strictEqual(pdf.convertedWith, 'PowerPoint');
  assert.strictEqual(pdf.sourceName, 'Eindejaarsactie.pptx');
  const img = await upload('photo.png', 'png', { convertedWith: 'PowerPoint' });
  assert.strictEqual(img.convertedWith, undefined, 'only PDFs can be marked');
});
