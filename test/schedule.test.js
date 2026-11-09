const test = require('node:test');
const assert = require('node:assert');
const { resolve, isActive } = require('../shared/schedule');

const display = { id: 'd1', group: 'Lobby', defaultPlaylistId: 'default' };
// 2026-11-09 is a Monday.
const at = (dateStr, hhmm) => new Date(`${dateStr}T${hhmm}:00`);

test('falls back to the display default playlist', () => {
  assert.deepStrictEqual(resolve([], display, at('2026-11-09', '10:00')), { playlistId: 'default', scheduleId: null });
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
