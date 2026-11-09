/*
 * Schedule resolution shared by the server (dashboard "now playing") and the
 * player (which resolves locally so it keeps working when the server is down).
 *
 * A schedule entry looks like:
 * {
 *   id, name, playlistId, enabled, priority (higher wins),
 *   targets: { displays: [displayId], groups: [groupName] }, // empty = all displays
 *   days: [0..6],               // 0 = Sunday, empty = every day
 *   start: "08:00", end: "17:00", // end <= start means it runs past midnight
 *   allDay: false,
 *   startDate: "2026-01-01" | null, endDate: "2026-12-31" | null
 * }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KevSchedule = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function toMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function appliesToDisplay(entry, display) {
    const t = entry.targets || {};
    const ds = t.displays || [];
    const gs = t.groups || [];
    if (!ds.length && !gs.length) return true;
    if (display && ds.includes(display.id)) return true;
    if (display && display.group && gs.includes(display.group)) return true;
    return false;
  }

  function dayAndDateOk(entry, d) {
    const days = entry.days && entry.days.length ? entry.days : [0, 1, 2, 3, 4, 5, 6];
    if (!days.includes(d.getDay())) return false;
    const key = dateKey(d);
    if (entry.startDate && key < entry.startDate) return false;
    if (entry.endDate && key > entry.endDate) return false;
    return true;
  }

  /** Is the entry active at moment `now`? Handles overnight windows. */
  function isActive(entry, now) {
    if (entry.enabled === false) return false;
    if (entry.allDay) return dayAndDateOk(entry, now);
    const s = toMinutes(entry.start);
    const e = toMinutes(entry.end);
    const cur = now.getHours() * 60 + now.getMinutes();
    if (e > s) return cur >= s && cur < e && dayAndDateOk(entry, now);
    // Overnight (e.g. 22:00 - 06:00): the evening part belongs to today,
    // the early-morning part belongs to the window that started yesterday.
    if (cur >= s) return dayAndDateOk(entry, now);
    if (cur < e) {
      const y = new Date(now.getTime());
      y.setDate(y.getDate() - 1);
      return dayAndDateOk(entry, y);
    }
    return false;
  }

  /**
   * Returns { playlistId, scheduleId|null } for a display at a moment.
   * Highest priority wins; ties go to the most specific target
   * (display > group > everyone), then to the most recently created entry.
   */
  function resolve(schedules, display, now) {
    now = now || new Date();
    const specificity = (e) => {
      const t = e.targets || {};
      if (display && (t.displays || []).includes(display.id)) return 2;
      if (display && display.group && (t.groups || []).includes(display.group)) return 1;
      return 0;
    };
    const active = (schedules || [])
      .filter((e) => e.playlistId && appliesToDisplay(e, display) && isActive(e, now))
      .sort((a, b) =>
        (b.priority || 0) - (a.priority || 0) ||
        specificity(b) - specificity(a) ||
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );
    if (active.length) return { playlistId: active[0].playlistId, scheduleId: active[0].id };
    return { playlistId: (display && display.defaultPlaylistId) || null, scheduleId: null };
  }

  return { resolve, isActive, appliesToDisplay, toMinutes, dateKey };
});
