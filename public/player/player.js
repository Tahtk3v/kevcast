/* KevCast player — runs in any modern browser (Chrome kiosk, Edge, smart TV, Raspberry Pi). */
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const STORE = 'kevcast.player';
  const MANIFEST_CACHE = 'kevcast.manifest';
  const $ = (id) => document.getElementById(id);

  if (qs.has('reset')) {
    localStorage.removeItem(STORE);
    localStorage.removeItem(MANIFEST_CACHE);
  }

  const previewId = qs.get('preview');
  let creds = previewId ? null : load(STORE);
  let manifest = previewId ? null : load(MANIFEST_CACHE);
  let current = { playlistId: null, index: -1, item: null };
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
        setStatus('Cannot reach the KevCast server — retrying…');
        return setTimeout(boot, 5000);
      }
    }
    connectEvents();
    await refresh();
    setInterval(heartbeat, 30000);
    setTimeout(sendScreenshot, 20000);
    setInterval(evaluate, 15000); // pick up schedule changes on the minute
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
        setStatus('Cannot reach the KevCast server — retrying…');
        return setTimeout(refresh, 5000);
      }
    }
    applyDisplaySettings();
    evaluate(true);
    prefetchInBrowser();
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
        nowPlaying: it ? { playlistId: current.playlistId, name: it.name, slide: it.slide || null, slides: it.slides || null } : null,
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
    el.textContent = name || 'This display';
    el.hidden = false;
    clearTimeout(identify.t);
    identify.t = setTimeout(() => (el.hidden = true), 10000);
  }

  function applyDisplaySettings() {
    const d = manifest.display;
    const root = $('root');
    root.className = d.orientation && d.orientation !== 'landscape' ? d.orientation : '';
    root.style.setProperty('--fit', d.fit || 'contain');
    root.style.setProperty('--bg', d.background || '#000');

    $('pairing').hidden = !!d.approved;
    if (!d.approved) {
      $('pairCode').textContent = d.pairingCode || creds.pairingCode;
      $('pairServer').textContent = `Server: ${location.host}`;
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
  function evaluate(force) {
    if (!manifest || !manifest.display.approved) return;
    const r = KevSchedule.resolve(manifest.schedules, manifest.display, new Date());
    const pl = r.playlistId && manifest.playlists[r.playlistId];
    if (!pl || !pl.items.length) {
      current = { playlistId: null, index: -1, item: null };
      clearTimeout(timer);
      clearLayers();
      showIdle(true);
      return;
    }
    showIdle(false);
    if (r.playlistId !== current.playlistId) {
      current = { playlistId: r.playlistId, index: -1, item: null };
      next();
    } else if (force) {
      // Same playlist but content changed: keep position if the item still exists.
      const idx = pl.items.findIndex((i) => current.item && i.itemId === current.item.itemId && i.url === current.item.url);
      if (idx === -1) { current.index = -1; next(); } else current.index = idx;
    }
  }

  function playlist() {
    return manifest && manifest.playlists[current.playlistId];
  }

  function next() {
    clearTimeout(timer);
    const pl = playlist();
    if (!pl || !pl.items.length) return evaluate();
    current.index = (current.index + 1) % pl.items.length;
    const item = pl.items[current.index];
    current.item = item;
    // Report what is on screen (throttled) so the admin can see it live.
    if (!next.last || Date.now() - next.last > 5000) { next.last = Date.now(); setTimeout(heartbeat, 1500); }
    show(item).then((el) => {
      if (current.item !== item) return;
      if (item.type === 'video' && !(item.duration > 0)) {
        el.onended = () => next();
        // Safety net in case `ended` never fires (broken file).
        timer = setTimeout(next, 30 * 60 * 1000);
      } else {
        timer = setTimeout(next, Math.max(2, item.duration || 10) * 1000);
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
        el = document.createElement('iframe');
        el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        el.onload = ok;
        el.src = item.url;
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
        outgoing.replaceChildren();
        outgoing.className = 'layer';
      }
    }, 1200);
    return el;
  }

  function clearLayers() {
    for (const l of [$('layerA'), $('layerB')]) { l.replaceChildren(); l.className = 'layer'; }
  }

  function showIdle(on) {
    $('idle').hidden = !on;
    if (manifest) $('idleOrg').textContent = manifest.orgName || '';
  }

  function tickClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('clock').textContent = time;
    $('idleTime').textContent = time;
    $('idleDate').textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
      const pl = await api(`/api/playlists/${encodeURIComponent(previewId)}/preview`);
      manifest = {
        orgName: 'Preview',
        display: { approved: true, fit: qs.get('fit') || 'contain', orientation: qs.get('orientation') || 'landscape' },
        schedules: [],
        playlists: { [pl.id]: pl },
      };
      manifest.display.defaultPlaylistId = pl.id;
      applyDisplaySettings();
      evaluate(true);
      if (!pl.items.length) $('idleHint').textContent = 'This playlist is empty (or its files are still processing).';
    } catch (e) {
      setStatus('Preview failed — are you logged in to the admin?');
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
