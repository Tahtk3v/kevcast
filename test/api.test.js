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
