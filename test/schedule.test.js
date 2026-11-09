const test = require('node:test');
const assert = require('node:assert');
const { resolve, isActive, occursOn, dayTimeline } = require('../shared/schedule');

const display = { id: 'd1', groups: ['Lobby', 'Floor 1'], defaultPlaylistId: 'default' };
// 2026-11-09 is a Monday.
const at = (dateStr, hhmm, ss = '00') => new Date(`${dateStr}T${hhmm}:${ss}`);

test('falls back to the display default playlist', () => {
  const r = resolve([], display, at('2026-11-09', '10:00'));
  assert.deepStrictEqual([r.key, r.playlistId, r.scheduleId], ['default', 'default', null]);
});

test('weekday time window', () => {
  const s = { id: 's', playlistId: 'p', days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' };
  assert.strictEqual(isActive(s, at('2026-11-09', '08:00')), true);
  assert.strictEqual(isActive(s, at('2026-11-09', '16:59')), true);
  assert.strictEqual(isActive(s, at('2026-11-09', '17:00')), false);
  assert.strictEqual(isActive(s, at('2026-11-08', '10:00')), false); // Sunday
});

test('overnight window belongs to the day it started', () => {
  const s = { id: 's', playlistId: 'p', days: [5], start: '22:00', end: '02:00' }; // Friday night
  assert.strictEqual(isActive(s, at('2026-11-13', '23:00')), true); // Fri
  assert.strictEqual(isActive(s, at('2026-11-14', '01:30')), true); // Sat early morning
  assert.strictEqual(isActive(s, at('2026-11-14', '23:00')), false); // Sat night
  assert.strictEqual(isActive(s, at('2026-11-13', '01:00')), false); // Fri early morning (Thu night)
});

test('date range and disabled entries', () => {
  const s = { id: 's', playlistId: 'p', allDay: true, startDate: '2026-11-10', endDate: '2026-11-11' };
  assert.strictEqual(isActive(s, at('2026-11-09', '12:00')), false);
  assert.strictEqual(isActive(s, at('2026-11-10', '12:00')), true);
  assert.strictEqual(isActive(s, at('2026-11-12', '12:00')), false);
  assert.strictEqual(isActive({ ...s, enabled: false }, at('2026-11-10', '12:00')), false);
});

test('targets: displays, groups and everyone', () => {
  const now = at('2026-11-09', '12:00');
  const other = { id: 'x', playlistId: 'other', allDay: true, targets: { displays: ['d2'], groups: [] } };
  assert.strictEqual(resolve([other], display, now).playlistId, 'default');
  const grp = { id: 'g', playlistId: 'lobby', allDay: true, targets: { displays: [], groups: ['Lobby'] } };
  assert.strictEqual(resolve([other, grp], display, now).playlistId, 'lobby');
});

test('priority beats specificity, specificity beats recency', () => {
  const now = at('2026-11-09', '12:00');
  const all = { id: 'a', playlistId: 'all', allDay: true, createdAt: '2026-02-01' };
  const mine = { id: 'm', playlistId: 'mine', allDay: true, targets: { displays: ['d1'] }, createdAt: '2026-01-01' };
  assert.strictEqual(resolve([all, mine], display, now).playlistId, 'mine');
  const urgent = { id: 'u', playlistId: 'urgent', allDay: true, priority: 10 };
  assert.strictEqual(resolve([all, mine, urgent], display, now).playlistId, 'urgent');
});

test('once, monthly and every-other-week repeats', () => {
  const day = (k) => new Date(`${k}T12:00:00`);
  const once = { repeat: 'once', startDate: '2026-11-12' };
  assert.strictEqual(occursOn(once, day('2026-11-12')), true);
  assert.strictEqual(occursOn(once, day('2026-11-19')), false);

  const monthly = { repeat: 'monthly', monthDay: 31 };
  assert.strictEqual(occursOn(monthly, day('2026-11-30')), true, '31st falls back to the last day');
  assert.strictEqual(occursOn(monthly, day('2026-12-31')), true);
  assert.strictEqual(occursOn(monthly, day('2026-12-30')), false);

  const biweekly = { repeat: 'weekly', days: [1], everyWeeks: 2, startDate: '2026-11-09' };
  assert.strictEqual(occursOn(biweekly, day('2026-11-09')), true);
  assert.strictEqual(occursOn(biweekly, day('2026-11-16')), false);
  assert.strictEqual(occursOn(biweekly, day('2026-11-23')), true);

  const period = { repeat: 'weekly', startDate: '2026-11-10', endDate: '2026-11-11' };
  assert.strictEqual(occursOn(period, day('2026-11-09')), false);
  assert.strictEqual(occursOn(period, day('2026-11-11')), true);
});

test('recurring interval: every 15 minutes for 60 seconds, and it interrupts the base content', () => {
  const traffic = { id: 't', mediaId: 'web1', start: '07:00', end: '09:00', interval: { everyMinutes: 15, showSeconds: 60 }, createdAt: '2026-01-01' };
  const base = { id: 'b', playlistId: 'news', start: '06:00', end: '12:00', createdAt: '2026-02-01' };
  assert.strictEqual(isActive(traffic, at('2026-11-09', '07:00', '30')), true);
  assert.strictEqual(isActive(traffic, at('2026-11-09', '07:01', '00')), false);
  assert.strictEqual(isActive(traffic, at('2026-11-09', '07:15', '10')), true);
  assert.strictEqual(isActive(traffic, at('2026-11-09', '09:00', '10')), false);
  assert.strictEqual(resolve([base, traffic], display, at('2026-11-09', '07:30', '05')).key, 'media:web1');
  assert.strictEqual(resolve([base, traffic], display, at('2026-11-09', '07:31', '05')).key, 'news');
});

test('single media items with their own duration, and the day timeline', () => {
  const web = { id: 'w', mediaId: 'ns', itemDuration: 45, start: '08:00', end: '10:00' };
  const r = resolve([web], display, at('2026-11-09', '08:30'));
  assert.deepStrictEqual([r.key, r.mediaId, r.itemDuration], ['media:ns', 'ns', 45]);
  const tl = dayTimeline([web], display, new Date('2026-11-09T00:00:00'));
  assert.deepStrictEqual(tl.map((s) => [s.from, s.to, s.key]), [[0, 480, 'default'], [480, 600, 'media:ns'], [600, 1440, 'default']]);
});
