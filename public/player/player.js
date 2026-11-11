/* KevCast player — runs in any modern browser (Chrome kiosk, Edge, smart TV, Raspberry Pi). */
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const STORE = 'kevcast.player';
  const MANIFEST_CACHE = 'kevcast.manifest';
  const $ = (id) => document.getElementById(id);
  // Translations follow the screen's own language (shared/i18n.js).
  const tr = window.KevI18n ? window.KevI18n.t : (s) => s;
  const LOCALE = window.KevI18n ? window.KevI18n.locale() : undefined;

  if (qs.has('reset')) {
    localStorage.removeItem(STORE);
    localStorage.removeItem(MANIFEST_CACHE);
  }

  const previewId = qs.get('preview');
  let creds = previewId ? null : load(STORE);
  let manifest = previewId ? null : load(MANIFEST_CACHE);
  let current = { slot: null, key: null, index: -1, item: null, itemDuration: 0 };
  let timer = null;
  let activeLayer = $('layerA');
  let events = null;

  function load(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
  }
  function store(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  }

  function resolution() {
    return `${screen.width * (devicePixelRatio || 1)}x${screen.height * (devicePixelRatio || 1)}`;
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(creds ? { 'X-Display-Token': creds.token } : {}), ...(opts.headers || {}) },
    });
    if (res.status === 401 && creds) {
      // The display was removed in the admin — start over with a fresh code.
      localStorage.removeItem(STORE);
      localStorage.removeItem(MANIFEST_CACHE);
      location.reload();
      throw new Error('unpaired');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function setStatus(msg) {
    $('status').hidden = !msg;
    $('status').textContent = msg || '';
  }

  // ---------------------------------------------------------------------------
  // Boot, pairing and live updates
  // ---------------------------------------------------------------------------
  async function boot() {
    // In a browser a service worker keeps content offline. The KevCast Player app has
    // its own disk cache for the whole schedule, so the service worker is not needed there.
    if ('serviceWorker' in navigator && !previewId) {
      if (window.kevcastNative) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      else navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    keepAwake();
    setInterval(tickClock, 1000);
    tickClock();

    if (previewId) return startPreview();

    if (!creds) {
      try {
        const provisioning = window.kevcastNative?.provisioning ? await window.kevcastNative.provisioning() : null;
        creds = await api('/api/player/register', { method: 'POST', body: JSON.stringify({ resolution: resolution(), userAgent: navigator.userAgent, provisioning }) });
        store(STORE, creds);
      } catch (e) {
        setStatus(tr('Cannot reach the KevCast server — retrying…'));
        return setTimeout(boot, 5000);
      }
    }
    connectEvents();
    await refresh();
    setInterval(heartbeat, 30000);
    setTimeout(sendScreenshot, 20000);
    setInterval(evaluate, 5000); // pick up schedule changes (and short recurring items) quickly
    heartbeat();
  }

  async function refresh() {
    try {
      manifest = await api('/api/player/manifest');
      store(MANIFEST_CACHE, manifest);
      setStatus('');
    } catch (e) {
      if (e.message === 'unpaired') return;
      // With saved content we keep playing quietly: no error banners on public screens.
      if (!manifest) {
        setStatus(tr('Cannot reach the KevCast server — retrying…'));
        return setTimeout(refresh, 5000);
      }
    }
    applyDisplaySettings();
    evaluate(true);
    prefetchInBrowser();
    // The Player app performs the weekly restart (see desktop/player/main.js).
    if (window.kevcastNative && window.kevcastNative.setMaintenance && manifest.display.maintenance) {
      window.kevcastNative.setMaintenance(manifest.display.maintenance);
    }
  }

  // Browser players: ask the service worker to download everything the schedule can show.
  function prefetchInBrowser() {
    if (window.kevcastNative || !manifest || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
    const urls = new Set();
    for (const pl of Object.values(manifest.playlists || {})) {
      for (const it of pl.items) if ((it.type === 'image' || it.type === 'video') && it.url.startsWith('/media/')) urls.add(it.url);
    }
    navigator.serviceWorker.controller.postMessage({ type: 'prefetch', urls: [...urls] });
  }

  function connectEvents() {
    if (events) events.close();
    events = new EventSource(`/api/player/events?token=${encodeURIComponent(creds.token)}`);
    events.addEventListener('update', () => refresh());
    events.addEventListener('approved', () => refresh());
    events.addEventListener('reload', () => location.reload());
    events.addEventListener('identify', (e) => identify(JSON.parse(e.data).name));
    events.addEventListener('screenshot', () => sendScreenshot());
    events.addEventListener('unpaired', () => {
      localStorage.removeItem(STORE);
      localStorage.removeItem(MANIFEST_CACHE);
      location.reload();
    });
    events.onopen = () => { setStatus(''); };
    events.onerror = () => {};
  }

  function heartbeat() {
    if (!creds) return;
    const it = current.item;
    api('/api/player/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        resolution: resolution(),
        nowPlaying: it ? { playlistId: current.key, name: it.name, slide: it.slide || null, slides: it.slides || null } : null,
        cache: cacheStatus,
      }),
    }).then((r) => {
      // Fallback when live events are blocked (e.g. by a proxy): notice pairing via the heartbeat.
      if (r && r.approved && manifest && !manifest.display.approved) refresh();
    }).catch(() => {});
  }

  // The KevCast Player desktop app exposes `kevcastNative` (see desktop/player/preload.js),
  // which can capture the screen. In a plain browser this is simply skipped.
  const native = window.kevcastNative || null;
  let cacheStatus = null;
  if (native && native.cacheStatus) {
    native.cacheStatus().then((s) => { cacheStatus = s; }).catch(() => {});
    native.onCacheStatus((s) => { cacheStatus = s; });
  }
  async function sendScreenshot() {
    if (!native || !creds) return;
    try {
      const jpeg = await native.captureScreenshot();
      await fetch('/api/player/screenshot', { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'X-Display-Token': creds.token }, body: jpeg });
    } catch {}
  }
  if (native && !previewId) setInterval(sendScreenshot, 5 * 60 * 1000);

  function identify(name) {
    const el = $('identify');
    el.textContent = name || tr('This display');
    el.hidden = false;
    clearTimeout(identify.t);
    identify.t = setTimeout(() => (el.hidden = true), 10000);
  }

  function applyDisplaySettings() {
    const d = manifest.display;
    // Display setting "Language": automatic (the computer's language) or a fixed one. Switching reloads once.
    if (window.KevI18n && !qs.has('preview')) {
      const want = ['en', 'nl', 'de'].includes(d.language) ? d.language : 'auto';
      if (want !== window.KevI18n.choice) {
        window.KevI18n.set(want); // stored on this screen; after the reload the choice matches, so this runs once
        location.reload();
        return;
      }
    }
    const root = $('root');
    root.className = d.orientation && d.orientation !== 'landscape' ? d.orientation : '';
    root.style.setProperty('--fit', d.fit || 'contain');
    root.style.setProperty('--bg', d.background || '#000');

    $('pairing').hidden = !!d.approved;
    if (!d.approved) {
      $('pairCode').textContent = d.pairingCode || creds.pairingCode;
      $('pairServer').textContent = tr('Server: {host}', { host: location.host });
      return;
    }
    $('clock').hidden = !d.showClock;

    const t = d.ticker || {};
    const showTicker = !!(t.enabled && t.text);
    $('ticker').hidden = !showTicker;
    root.classList.toggle('has-ticker', showTicker);
    if (showTicker) {
      $('tickerText').textContent = t.text.replace(/\n+/g, '     •     ');
      if (t.bg) root.style.setProperty('--ticker-bg', t.bg);
      if (t.fg) root.style.setProperty('--ticker-fg', t.fg);
      // Constant speed in px/s regardless of text length.
      requestAnimationFrame(() => {
        const track = document.querySelector('.ticker-track');
        const px = track.scrollWidth;
        track.style.animationDuration = `${Math.max(5, px / (Number(t.speed) || 60))}s`;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Scheduling + playback
  // ---------------------------------------------------------------------------
  // `current.slot` identifies what is playing: which schedule entry (or the default) and which content.
  // Positions are remembered per slot, so a playlist resumes where it was after an interrupt
  // (e.g. traffic info shown for one minute every 15 minutes).
  const positions = {};

  function evaluate(force) {
    if (!manifest || !manifest.display.approved) return;
    const r = KevSchedule.resolve(manifest.schedules, manifest.display, new Date());
    const pl = r.key && manifest.playlists[r.key];
    if (!pl || !pl.items.length) {
      if (current.slot) positions[current.slot] = current.index;
      current = { slot: null, key: null, index: -1, item: null, itemDuration: 0 };
      clearTimeout(timer);
      clearLayers();
      showIdle(true);
      return;
    }
    showIdle(false);
    const slot = `${r.scheduleId || 'default'}|${r.key}`;
    if (slot !== current.slot) {
      if (current.slot) positions[current.slot] = current.index;
      const resume = positions[slot];
      current = { slot, key: r.key, index: typeof resume === 'number' ? resume : -1, item: null, itemDuration: r.itemDuration };
      next();
    } else if (force) {
      current.itemDuration = r.itemDuration;
      // Same content but it changed: keep position if the item still exists.
      const idx = pl.items.findIndex((i) => current.item && i.itemId === current.item.itemId && i.url === current.item.url);
      if (idx === -1) { current.index = -1; next(); } else current.index = idx;
    }
  }

  function playlist() {
    return manifest && manifest.playlists[current.key];
  }

  function next() {
    clearTimeout(timer);
    const pl = playlist();
    if (!pl || !pl.items.length) return evaluate();
    current.index = (current.index + 1) % pl.items.length;
    const item = pl.items[current.index];
    const prev = current.item;
    current.item = item;
    // One item that is already on screen (e.g. a single web page): keep it instead of reloading it.
    if (pl.items.length === 1 && prev && prev.itemId === item.itemId && prev.url === item.url && item.type !== 'video' && activeLayer.firstChild) {
      const d = current.itemDuration > 0 ? current.itemDuration : item.duration;
      timer = setTimeout(next, Math.max(2, d || 10) * 1000);
      return;
    }
    // A schedule entry can set how long each item is shown; otherwise the item's own duration.
    const duration = current.itemDuration > 0 ? current.itemDuration : item.duration;
    // Report what is on screen (throttled) so the admin can see it live.
    if (!next.last || Date.now() - next.last > 5000) { next.last = Date.now(); setTimeout(heartbeat, 1500); }
    show(item).then((el) => {
      if (current.item !== item) return;
      if (item.type === 'video' && !(duration > 0)) {
        el.onended = () => next();
        // Safety net in case `ended` never fires (broken file).
        timer = setTimeout(next, 30 * 60 * 1000);
      } else {
        timer = setTimeout(next, Math.max(2, duration || 10) * 1000);
      }
      preload(pl.items[(current.index + 1) % pl.items.length]);
    });
  }

  function preload(item) {
    if (item && item.type === 'image') { const i = new Image(); i.src = item.url; }
  }

  function build(item) {
    return new Promise((resolve) => {
      let el;
      const done = () => resolve(el);
      const fallback = setTimeout(done, 8000);
      const ok = () => { clearTimeout(fallback); done(); };
      if (item.type === 'image') {
        el = new Image();
        el.onload = ok;
        el.onerror = ok;
        el.src = item.url;
      } else if (item.type === 'video') {
        el = document.createElement('video');
        el.muted = item.mute !== false;
        el.playsInline = true;
        el.preload = 'auto';
        el.oncanplay = ok;
        el.onerror = ok;
        el.src = item.url;
      } else if (item.type === 'web') {
        // Zoom lets a desktop-sized page (departure board, traffic map) fit a TV nicely.
        const z = (Number(item.zoom) || 100) / 100;
        el = document.createElement('div');
        el.className = 'web-wrap';
        const frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        Object.assign(frame.style, { width: `${100 / z}%`, height: `${100 / z}%`, transform: `scale(${z})`, transformOrigin: '0 0' });
        // KevCast's own weather/traffic slides get the screen's language and clock setting.
        const url = item.widget
          ? `${item.url}&lang=${encodeURIComponent(item.lang || (window.KevI18n && window.KevI18n.lang) || 'en')}&clock=${encodeURIComponent(clockFormat())}`
          : item.url;
        frame.src = url;
        el.appendChild(frame);
        // An iframe only starts loading once it is in the page, so show it right away.
        ok();
        if (item.refreshSeconds > 0) {
          el._refresh = setInterval(() => { frame.src = url; }, Math.max(10, item.refreshSeconds) * 1000);
        }
      } else if (item.type === 'text') {
        const t = item.text || {};
        el = document.createElement('div');
        el.className = `text-slide align-${t.align || 'center'} size-${t.size || 'normal'}`;
        el.style.background = t.bg || '#1e1b4b';
        if (t.bg2) el.style.background = `linear-gradient(135deg, ${t.bg || '#1e1b4b'}, ${t.bg2})`;
        el.style.color = t.fg || '#ffffff';
        if (t.title) { const h = document.createElement('h1'); h.textContent = t.title; el.appendChild(h); }
        if (t.body) { const p = document.createElement('p'); p.textContent = t.body; el.appendChild(p); }
        ok();
      } else {
        el = document.createElement('div');
        ok();
      }
    });
  }

  async function show(item) {
    const incoming = activeLayer === $('layerA') ? $('layerB') : $('layerA');
    const outgoing = activeLayer;
    const el = await build(item);
    const tr = `t-${item.transition || 'fade'}`;
    incoming.replaceChildren(el);
    incoming.className = `layer ${tr}`;
    void incoming.offsetWidth; // restart CSS transition
    incoming.classList.add('active');
    outgoing.classList.remove('active');
    if (tr === 't-slide') outgoing.classList.add('leaving');
    if (el.tagName === 'VIDEO') el.play().catch(() => { el.muted = true; el.play().catch(() => {}); });
    activeLayer = incoming;
    setTimeout(() => {
      if (activeLayer !== outgoing) {
        outgoing.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
        outgoing.querySelectorAll('.web-wrap').forEach((w) => clearInterval(w._refresh));
        outgoing.replaceChildren();
        outgoing.className = 'layer';
      }
    }, 1200);
    return el;
  }

  function clearLayers() {
    for (const l of [$('layerA'), $('layerB')]) {
      l.querySelectorAll('.web-wrap').forEach((w) => clearInterval(w._refresh));
      l.replaceChildren();
      l.className = 'layer';
    }
  }

  function showIdle(on) {
    $('idle').hidden = !on;
    if (manifest) $('idleOrg').textContent = manifest.orgName || '';
  }

  /** Server setting "Clock" (the same on every screen): automatic (the screen's language), 24-hour or 12-hour. */
  function clockFormat() { return (manifest && manifest.clockFormat) || 'auto'; }
  function clockOptions() {
    const f = clockFormat();
    return f === '12' ? { hour12: true } : f === '24' ? { hourCycle: 'h23' } : {};
  }

  function tickClock() {
    const now = new Date();
    const time = now.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', ...clockOptions() });
    $('clock').textContent = time;
    $('idleTime').textContent = time;
    $('idleDate').textContent = now.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function keepAwake() {
    try {
      if ('wakeLock' in navigator) {
        await navigator.wakeLock.request('screen');
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {});
        });
      }
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Preview mode: /player/?preview=<playlistId> (uses the admin login cookie)
  // ---------------------------------------------------------------------------
  async function startPreview() {
    document.body.style.cursor = 'default';
    try {
      const pl = previewId.startsWith('media:')
        ? await api(`/api/media/${encodeURIComponent(previewId.slice(6))}/preview`)
        : await api(`/api/playlists/${encodeURIComponent(previewId)}/preview`);
      manifest = {
        orgName: 'Preview',
        display: { approved: true, fit: qs.get('fit') || 'contain', orientation: qs.get('orientation') || 'landscape' },
        schedules: [],
        playlists: { [pl.id]: pl },
      };
      manifest.display.defaultPlaylistId = pl.id;
      applyDisplaySettings();
      evaluate(true);
      if (!pl.items.length) $('idleHint').textContent = tr('This playlist is empty (or its files are still processing).');
    } catch (e) {
      setStatus(tr('Preview failed — are you logged in to the admin?'));
    }
  }

  // Keyboard helpers for testing on a desktop: → next item, F fullscreen.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.().catch(() => {});
  });
  document.addEventListener('dblclick', () => document.documentElement.requestFullscreen?.().catch(() => {}));

  boot();
})();
