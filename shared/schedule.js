/*
 * Schedule resolution shared by the server (dashboard "now playing"), the Web Studio
 * (calendar and week overview) and the player (which resolves locally so it keeps
 * working when the server is down).
 *
 * A schedule entry looks like:
 * {
 *   id, name, enabled, priority (higher wins), createdAt,
 *   playlistId | mediaId,           // what plays: a playlist or one media item (e.g. a web page)
 *   itemDuration: 0,                // seconds each item is shown (0 = playlist/item default)
 *   targets: { displays: [displayId], groups: [groupName] },   // empty = all displays
 *
 *   repeat: 'weekly' | 'monthly' | 'once',
 *   days: [0..6],                   // weekly: 0 = Sunday, empty = every day
 *   everyWeeks: 1,                  // weekly: 1 = every week, 2 = every other week, ...
 *   monthDay: 1,                    // monthly: day of the month (1-31)
 *   startDate, endDate,             // "YYYY-MM-DD" or null: the period in which the entry is valid
 *                                   // ('once' uses startDate as its only date)
 *   allDay: false, start: "08:00", end: "17:00",   // end <= start runs past midnight
 *
 *   interval: { everyMinutes: 15, showSeconds: 60 } | null
 *                                   // recurring within the time window: show for showSeconds
 *                                   // every everyMinutes, counted from the window start
 * }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KevSchedule = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY_MS = 24 * 3600 * 1000;

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

  function parseDate(key) {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  /** Monday 00:00 of the week containing d (local time). */
  function weekStart(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }

  function contentKey(entry) {
    return entry.mediaId ? `media:${entry.mediaId}` : entry.playlistId || null;
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

  /** Does the entry run on calendar date d (ignoring the time of day)? */
  function occursOn(entry, d) {
    const key = dateKey(d);
    const repeat = entry.repeat || 'weekly';
    if (repeat === 'once') return !!entry.startDate && key === entry.startDate;
    if (entry.startDate && key < entry.startDate) return false;
    if (entry.endDate && key > entry.endDate) return false;
    if (repeat === 'monthly') {
      const want = Number(entry.monthDay) || 1;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      // "the 31st" in a 30-day month means the last day of that month.
      return d.getDate() === Math.min(want, lastDay);
    }
    const days = entry.days && entry.days.length ? entry.days : [0, 1, 2, 3, 4, 5, 6];
    if (!days.includes(d.getDay())) return false;
    const every = Math.max(1, Number(entry.everyWeeks) || 1);
    if (every > 1) {
      const anchor = weekStart(entry.startDate ? parseDate(entry.startDate) : new Date(entry.createdAt || Date.now()));
      const weeks = Math.round((weekStart(d) - anchor) / (7 * DAY_MS));
      if (((weeks % every) + every) % every !== 0) return false;
    }
    return true;
  }

  /**
   * Seconds since the current time window of the entry started, or -1 when the
   * window is not open at `now`. Handles all-day and overnight windows.
   */
  function secondsIntoWindow(entry, now) {
    const sec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    if (entry.allDay) return occursOn(entry, now) ? sec : -1;
    const s = toMinutes(entry.start) * 60;
    const e = toMinutes(entry.end) * 60;
    if (e > s) return sec >= s && sec < e && occursOn(entry, now) ? sec - s : -1;
    // Overnight (e.g. 22:00-06:00): the evening part belongs to today,
    // the early-morning part belongs to the window that started yesterday.
    if (sec >= s) return occursOn(entry, now) ? sec - s : -1;
    if (sec < e) {
      const y = new Date(now.getTime() - DAY_MS);
      return occursOn(entry, y) ? sec + 86400 - s : -1;
    }
    return -1;
  }

  function hasInterval(entry) {
    return !!(entry.interval && Number(entry.interval.everyMinutes) > 0 && Number(entry.interval.showSeconds) > 0);
  }

  /** Is the entry active at moment `now`? */
  function isActive(entry, now) {
    if (entry.enabled === false) return false;
    const into = secondsIntoWindow(entry, now);
    if (into < 0) return false;
    if (!hasInterval(entry)) return true;
    const period = Number(entry.interval.everyMinutes) * 60;
    return into % period < Number(entry.interval.showSeconds);
  }

  /**
   * What should a display show at `now`?
   * Returns { key, playlistId, mediaId, scheduleId, itemDuration }:
   *   key is "media:<id>" for a single item, otherwise the playlist id (null = nothing).
   * Order: highest priority, then recurring "interrupt" entries, then the most specific
   * target (display > group > everyone), then the most recently created entry.
   * Without an active entry the display's default playlist plays.
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
      .filter((e) => contentKey(e) && appliesToDisplay(e, display) && isActive(e, now))
      .sort((a, b) =>
        (b.priority || 0) - (a.priority || 0) ||
        Number(hasInterval(b)) - Number(hasInterval(a)) ||
        specificity(b) - specificity(a) ||
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );
    if (active.length) {
      const e = active[0];
      return { key: contentKey(e), playlistId: e.playlistId || null, mediaId: e.mediaId || null, scheduleId: e.id, itemDuration: Number(e.itemDuration) || 0 };
    }
    const pid = (display && display.defaultPlaylistId) || null;
    return { key: pid, playlistId: pid, mediaId: null, scheduleId: null, itemDuration: 0 };
  }

  /**
   * Timeline of one calendar day for a display: [{ from, to, key, scheduleId }] in minutes,
   * sampled every `stepMinutes`. Recurring (interval) entries are left out; see `intervalsOn`.
   */
  function dayTimeline(schedules, display, date, stepMinutes = 5) {
    const base = (schedules || []).filter((e) => !hasInterval(e));
    const segs = [];
    for (let m = 0; m < 1440; m += stepMinutes) {
      const t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(m / 60), m % 60, 30);
      const r = resolve(base, display, t);
      const last = segs[segs.length - 1];
      if (last && last.key === r.key && last.scheduleId === r.scheduleId) last.to = m + stepMinutes;
      else segs.push({ from: m, to: m + stepMinutes, key: r.key, scheduleId: r.scheduleId });
    }
    return segs;
  }

  /** Recurring (interval) entries that occur on `date` for a display. */
  function intervalsOn(schedules, display, date) {
    return (schedules || []).filter((e) => e.enabled !== false && hasInterval(e) && appliesToDisplay(e, display) &&
      (occursOn(e, date) || (!e.allDay && toMinutes(e.end) <= toMinutes(e.start) && occursOn(e, new Date(date.getTime() - DAY_MS)))));
  }

  return { resolve, isActive, occursOn, appliesToDisplay, hasInterval, contentKey, dayTimeline, intervalsOn, toMinutes, dateKey, weekStart };
});
