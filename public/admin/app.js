/* KevCast admin — dependency-free single page app. */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Tiny DOM helpers
  // ---------------------------------------------------------------------------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const ICONS = {
    dashboard: '<path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z"/>',
    media: '<path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z"/>',
    playlist: '<path d="M3 6h12v2H3zm0 4h12v2H3zm0 4h8v2H3zm14-4v8.18A3 3 0 1 0 19 21V12h3v-2z"/>',
    schedule: '<path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14zM7 12h5v5H7z"/>',
    display: '<path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7v2H8v2h8v-2h-2v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H3V5h18z"/>',
    settings: '<path d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54a7 7 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.38 1.05.7 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54a7 7 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>',
    plus: '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/>',
    upload: '<path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>',
    image: '<path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z"/>',
    video: '<path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11z"/>',
    presentation: '<path d="M21 3H3v2h1v11a1 1 0 0 0 1 1h5.6L8 21h2l2.6-4h.8l2.6 4h2l-2.6-4H19a1 1 0 0 0 1-1V5h1zm-3 12H6V5h12zM8 12l3-3 2 2 3-4v3l-3 4-2-2-3 3z"/>',
    web: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.08 16zM8.03 8H5.08a7.99 7.99 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96A14.1 14.1 0 0 1 10.09 16h3.82A14.1 14.1 0 0 1 12 19.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4z"/>',
    text: '<path d="M5 4v3h5.5v12h3V7H19V4z"/>',
    drag: '<path d="M9 4h2v2H9zm4 0h2v2h-2zM9 9h2v2H9zm4 0h2v2h-2zm-4 5h2v2H9zm4 0h2v2h-2zm-4 5h2v2H9zm4 0h2v2h-2z"/>',
    trash: '<path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    copy: '<path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z"/>',
    menu: '<path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/>',
    left: '<path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>',
    right: '<path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>',
    eye: '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
    refresh: '<path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"/>',
  };
  const icon = (name) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'currentColor');
    s.innerHTML = ICONS[name] || '';
    return s;
  };

  function toast(msg, kind = '') {
    const t = h('div', { class: `toast ${kind}` }, msg);
    document.getElementById('toasts').append(t);
    setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3000);
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      ...opts,
      headers: opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login') {
      state.session.user = null;
      render();
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  const fmtSize = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
  const fmtDur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60 ? (s % 60) + 's' : ''}` : `${s}s`);
  const ago = (iso) => {
    if (!iso) return 'never';
    const s = Math.round((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return new Date(iso).toLocaleDateString();
  };
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const TYPE_LABEL = { image: 'Image', video: 'Video', presentation: 'PowerPoint', web: 'Web page', text: 'Text' };

  // ---------------------------------------------------------------------------
  // State + data loading
  // ---------------------------------------------------------------------------
  const state = {
    session: null,
    media: [],
    playlists: [],
    schedules: [],
    displays: [],
    overview: null,
    uploads: [],
    mediaFilter: 'all',
    mediaSearch: '',
    calWeekOffset: 0,
    calDisplay: '',
    busy: false, // true while the user is dragging/editing something we must not re-render
  };

  async function loadAll() {
    const [media, playlists, schedules, displays, overview] = await Promise.all([
      api('/media'), api('/playlists'), api('/schedules'), api('/displays'), api('/overview'),
    ]);
    Object.assign(state, { media, playlists, schedules, displays, overview });
  }

  const byId = (list, id) => list.find((x) => x.id === id);
  const playlistColor = (id) => (byId(state.playlists, id) || {}).color || '#64748b';

  let events = null;
  let reloadTimer = null;
  function connectEvents() {
    if (events) events.close();
    events = new EventSource('/api/events');
    const soon = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(async () => {
        try { await loadAll(); } catch { return; }
        if (!state.busy && !document.querySelector('.modal-back')) renderPage({ soft: true });
        updateNavBadges();
      }, 400);
    };
    ['change', 'media', 'heartbeat', 'pairing'].forEach((e) => events.addEventListener(e, soon));
  }

  // ---------------------------------------------------------------------------
  // Router + shell
  // ---------------------------------------------------------------------------
  const ROUTES = [
    ['dashboard', 'Dashboard', 'dashboard'],
    ['media', 'Media', 'media'],
    ['playlists', 'Playlists', 'playlist'],
    ['schedule', 'Schedule', 'schedule'],
    ['displays', 'Displays', 'display'],
    ['settings', 'Settings', 'settings'],
  ];
  const route = () => {
    const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
    return { page: ROUTES.some((r) => r[0] === page) ? page : 'dashboard', arg };
  };
  const go = (hash) => { location.hash = hash; };
  window.addEventListener('hashchange', () => { document.querySelector('.shell')?.classList.remove('nav-open'); renderShell(); });

  async function start() {
    state.session = await api('/session');
    render();
  }

  async function render() {
    const app = document.getElementById('app');
    if (!state.session.user) {
      if (events) events.close();
      app.replaceChildren(authScreen());
      return;
    }
    app.replaceChildren(h('div', { class: 'auth-wrap' }, h('div', { class: 'spinner' })));
    await loadAll();
    connectEvents();
    renderShell();
  }

  function renderShell() {
    const { page } = route();
    const app = document.getElementById('app');
    let shell = app.querySelector('.shell');
    if (!shell) {
      shell = h('div', { class: 'shell' },
        h('aside', { class: 'sidebar' },
          h('div', { class: 'logo' }, h('div', { class: 'logo-mark' }, icon('display')), 'KevCast'),
          h('nav', { class: 'nav' }, ROUTES.map(([id, label, ic]) => h('a', { href: `#/${id}`, 'data-id': id }, icon(ic), label, h('span', { class: 'badge', hidden: true })))),
          h('div', { class: 'sidebar-foot' }, `${state.session.orgName} · v${state.session.version}`)),
        h('main', { class: 'main', id: 'page' }));
      app.replaceChildren(shell);
    }
    shell.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.id === page));
    updateNavBadges();
    renderPage();
  }

  function updateNavBadges() {
    const pending = state.displays.filter((d) => !d.approved && Date.now() - new Date(d.lastSeen) < 120000).length;
    const b = document.querySelector('.nav a[data-id=displays] .badge');
    if (b) { b.hidden = !pending; b.textContent = `${pending} new`; }
  }

  function renderPage(opts = {}) {
    const el = document.getElementById('page');
    if (!el) return;
    const { page, arg } = route();
    const scroll = window.scrollY;
    const view = { dashboard: Dashboard, media: MediaPage, playlists: PlaylistsPage, schedule: SchedulePage, displays: DisplaysPage, settings: SettingsPage }[page];
    el.replaceChildren(...[].concat(view(arg)).flat(Infinity).filter(Boolean));
    if (opts.soft) window.scrollTo(0, scroll);
  }

  function pageHead(title, sub, ...actions) {
    return h('div', { class: 'page-head' },
      h('button', { class: 'btn icon ghost menu-btn', onclick: () => document.querySelector('.shell').classList.toggle('nav-open') }, icon('menu')),
      h('div', {}, h('h1', {}, title), sub ? h('p', { class: 'muted' }, sub) : null),
      h('div', { class: 'spacer' }),
      ...actions);
  }

  // ---------------------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------------------
  function modal({ title, body, footer, wide, onClose }) {
    const back = h('div', { class: 'modal-back' });
    const close = () => { back.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    const m = h('div', { class: `modal ${wide ? 'wide' : ''}`, role: 'dialog' },
      h('div', { class: 'modal-head' }, h('h2', {}, title), h('div', { class: 'spacer' }), h('button', { class: 'btn ghost sm', onclick: close, 'aria-label': 'Close' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      footer ? h('div', { class: 'modal-foot' }, typeof footer === 'function' ? footer(close) : footer) : null);
    back.append(m);
    document.body.append(back);
    setTimeout(() => m.querySelector('input:not([type=checkbox]):not([type=color]), select, textarea')?.focus(), 30);
    return close;
  }

  function confirmBox(title, text, okLabel = 'Delete') {
    return new Promise((resolve) => {
      let ok = false;
      modal({
        title,
        body: h('p', {}, text),
        onClose: () => resolve(ok),
        footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, 'Cancel'),
          h('button', { class: 'btn primary', style: { background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }, onclick: () => { ok = true; close(); } }, okLabel)],
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Login / first-run setup
  // ---------------------------------------------------------------------------
  function authScreen() {
    const setup = state.session.setupRequired;
    const err = h('div', { class: 'err-text' });
    const user = h('input', { placeholder: 'admin', value: setup ? 'admin' : '', autocomplete: 'username' });
    const pass = h('input', { type: 'password', autocomplete: setup ? 'new-password' : 'current-password' });
    const org = h('input', { placeholder: 'e.g. Acme Reception' });
    const submit = async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        await api(setup ? '/setup' : '/login', { method: 'POST', body: { username: user.value.trim(), password: pass.value, orgName: org.value.trim() } });
        state.session = await api('/session');
        render();
      } catch (x) { err.textContent = x.message; }
    };
    return h('div', { class: 'auth-wrap' },
      h('form', { class: 'card auth-card', onsubmit: submit },
        h('div', { class: 'logo' }, h('div', { class: 'logo-mark' }, icon('display')), 'KevCast'),
        h('h2', {}, setup ? 'Welcome! Let’s set up your server' : 'Sign in'),
        setup ? h('p', { class: 'muted' }, 'Create the administrator account. You can change the password later in Settings.') : null,
        setup ? h('label', { class: 'field' }, 'Organisation name', org) : null,
        h('label', { class: 'field' }, 'Username', user),
        h('label', { class: 'field' }, setup ? 'Choose a password' : 'Password', setup ? h('span', { class: 'hint' }, 'At least 6 characters') : null, pass),
        err,
        h('button', { class: 'btn primary', type: 'submit' }, setup ? 'Create account & continue' : 'Sign in')));
  }

  // ---------------------------------------------------------------------------
  // Shared media visuals
  // ---------------------------------------------------------------------------
  function mediaThumb(m, small) {
    const t = h('div', { class: 'thumb' });
    if (!m) { t.append(icon('media')); return t; }
    if (m.status === 'processing') t.append(h('div', { class: 'spinner' }));
    else if (m.status === 'error') t.append(h('span', { class: 'badge err' }, 'Failed'));
    else if (m.thumb) t.append(h('img', { src: m.thumb, loading: 'lazy', alt: '' }));
    else if (m.type === 'video') t.append(h('video', { src: m.url + '#t=1', muted: true, preload: 'metadata' }));
    else if (m.type === 'text') {
      const x = m.text || {};
      t.append(h('div', { class: 'text-thumb', style: { background: x.bg2 ? `linear-gradient(135deg, ${x.bg}, ${x.bg2})` : x.bg || '#1e1b4b', color: x.fg || '#fff' } },
        h('b', {}, x.title || ''), small ? null : h('span', {}, (x.body || '').slice(0, 80))));
    } else t.append(icon(m.type === 'web' ? 'web' : 'media'));
    if (!small) {
      t.append(h('span', { class: 'badge ov' }, TYPE_LABEL[m.type] || m.type));
      if (m.type === 'presentation' && m.slides) t.append(h('span', { class: 'ov-r' }, `${m.slides.length} slides`));
    }
    return t;
  }

  function playlistRuntime(p) {
    let secs = 0;
    let unknown = false;
    for (const it of p.items || []) {
      if (it.enabled === false) continue;
      const m = byId(state.media, it.mediaId);
      if (!m) continue;
      const d = Number(it.duration) || (m.type === 'video' ? 0 : p.defaultDuration || 10);
      if (!d) unknown = true;
      secs += d * (m.type === 'presentation' ? (m.slides || []).length || 1 : 1);
    }
    return fmtDur(secs) + (unknown ? ' + videos' : '');
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  function Dashboard() {
    const o = state.overview;
    const displays = state.displays.filter((d) => d.approved);
    const steps = [
      ['Upload content', 'Images, videos, PowerPoint or PDF', '#/media', state.media.length > 0],
      ['Build a playlist', 'Put your content in order', '#/playlists', state.playlists.some((p) => p.items.length)],
      ['Connect a screen', 'Open the player on any TV or PC', '#/displays', displays.length > 0],
      ['Schedule it', 'Choose what plays when', '#/schedule', state.schedules.length > 0 || displays.some((d) => d.defaultPlaylistId)],
    ];
    const allDone = steps.every((s) => s[3]);
    const warnings = [];
    if (o && !o.capabilities.powerpoint) warnings.push('LibreOffice was not found on the server, so PowerPoint files can’t be converted yet. See Settings → Server for how to install it.');
    else if (o && !o.capabilities.pdf) warnings.push('No PDF renderer (Poppler or Ghostscript) found on the server. PowerPoint/PDF slides can’t be rendered yet. See Settings → Server.');

    return [
      pageHead(`Welcome to ${state.session.orgName}`, 'Here’s what is happening on your screens.',
        h('a', { class: 'btn primary', href: '#/media' }, icon('upload'), 'Upload content')),
      ...warnings.map((w) => h('div', { class: 'alert' }, w)),
      h('div', { class: 'stats' },
        stat(`${o.counts.online}/${o.counts.displays}`, 'Screens online', '#/displays'),
        stat(state.media.length, 'Media files', '#/media'),
        stat(state.playlists.length, 'Playlists', '#/playlists'),
        stat(state.schedules.filter((s) => s.enabled !== false).length, 'Active schedules', '#/schedule')),
      allDone ? null : h('div', { class: 'card pad', style: { marginBottom: '16px' } },
        h('h2', { style: { marginBottom: '12px' } }, 'Get started in 4 steps'),
        h('div', { class: 'steps' }, steps.map(([t, s, href, done], i) =>
          h('a', { class: `step ${done ? 'done' : ''}`, href }, h('div', { class: 'n' }, done ? '✓' : i + 1), h('div', {}, h('b', {}, t), h('span', { class: 'muted small' }, s)))))),
      h('div', { class: 'dash-cols' },
        h('div', { class: 'card' },
          h('div', { class: 'section-head' }, h('h2', {}, 'Screens'), h('div', { class: 'spacer' }), h('a', { class: 'btn sm', href: '#/displays' }, 'Manage')),
          displays.length ? displays.map((d) => {
            const pl = byId(state.playlists, d.scheduledPlaylistId);
            return h('div', { class: 'list-row' },
              h('span', { class: `dot ${d.online ? 'on' : ''}` }),
              h('div', { style: { minWidth: 0 } }, h('b', {}, d.name), h('div', { class: 'muted small' }, d.online ? (d.nowPlaying ? `Showing: ${d.nowPlaying.name}${d.nowPlaying.slides ? ` (slide ${d.nowPlaying.slide}/${d.nowPlaying.slides})` : ''}` : 'Online') : `Offline · last seen ${ago(d.lastSeen)}`)),
              h('div', { class: 'spacer' }),
              pl ? h('span', { class: 'row small' }, h('span', { class: 'swatch', style: { background: pl.color } }), pl.name) : h('span', { class: 'muted small' }, 'Nothing scheduled'));
          }) : h('div', { class: 'empty' }, h('h3', {}, 'No screens yet'), h('p', {}, 'Open the player on a TV, PC or Raspberry Pi to connect it.'), h('a', { class: 'btn primary', href: '#/displays' }, 'Add a display'))),
        h('div', { class: 'card' },
          h('div', { class: 'section-head' }, h('h2', {}, 'Recent uploads')),
          state.media.length ? [...state.media].reverse().slice(0, 6).map((m) =>
            h('div', { class: 'list-row' }, h('div', { style: { width: '64px' } }, mediaThumb(m, true)), h('div', { style: { minWidth: 0 } }, h('b', { class: 'small' }, m.name), h('div', { class: 'muted small' }, TYPE_LABEL[m.type], m.status === 'processing' ? ' · converting…' : '')))) :
            h('div', { class: 'empty' }, h('p', {}, 'Nothing uploaded yet.')))),
    ];
  }
  function stat(num, lbl, href) {
    return h('a', { class: 'card stat', href, style: { textDecoration: 'none', color: 'inherit' } }, h('div', { class: 'num' }, num), h('div', { class: 'lbl' }, lbl));
  }

  // ---------------------------------------------------------------------------
  // Media library
  // ---------------------------------------------------------------------------
  const ACCEPT = 'image/*,video/*,.pdf,.ppt,.pptx,.pps,.ppsx,.pot,.potx,.odp,.key';

  function pickFiles() {
    const inp = h('input', { type: 'file', multiple: true, accept: ACCEPT });
    inp.onchange = () => uploadFiles([...inp.files]);
    inp.click();
  }

  function uploadFiles(files) {
    if (!files.length) return;
    if (route().page !== 'media') go('#/media');
    for (const file of files) {
      const u = { name: file.name, progress: 0, done: false, error: null };
      state.uploads.push(u);
      const fd = new FormData();
      fd.append('files', file, file.name);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media/upload');
      xhr.upload.onprogress = (e) => { u.progress = e.loaded / e.total; drawUploads(); };
      xhr.onload = async () => {
        u.done = true;
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status >= 400) u.error = res.error || 'Upload failed';
        else if (res.rejected?.length) u.error = 'This file type is not supported';
        else toast(`Uploaded ${file.name}${/\.(pptx?|ppsx?|potx?|odp|key|pdf)$/i.test(file.name) ? ' — converting slides…' : ''}`, 'ok');
        if (u.error) toast(`${file.name}: ${u.error}`, 'err');
        setTimeout(() => { state.uploads = state.uploads.filter((x) => x !== u); drawUploads(); }, u.error ? 5000 : 800);
        state.media = await api('/media');
        if (route().page === 'media') renderPage({ soft: true });
      };
      xhr.onerror = () => { u.done = true; u.error = 'Network error'; drawUploads(); };
      xhr.send(fd);
    }
    drawUploads();
  }

  function drawUploads() {
    const box = document.getElementById('uploads');
    if (!box) return;
    box.replaceChildren(...state.uploads.map((u) => h('div', { class: 'card upload-row' },
      h('b', { class: 'small', style: { minWidth: '160px' } }, u.name),
      h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round(u.progress * 100)}%`, background: u.error ? 'var(--danger)' : '' } })),
      h('span', { class: 'small muted' }, u.error ? u.error : u.done ? 'Done' : `${Math.round(u.progress * 100)}%`))));
  }

  // Drag files anywhere on the page to upload.
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!state.session?.user || !e.dataTransfer?.types?.includes('Files')) return;
    dragDepth++;
    if (!document.querySelector('.drop-overlay')) document.body.append(h('div', { class: 'drop-overlay' }, 'Drop files to upload'));
  });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.querySelector('.drop-overlay')?.remove(); } });
  window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    dragDepth = 0;
    document.querySelector('.drop-overlay')?.remove();
    uploadFiles([...e.dataTransfer.files]);
  });

  function MediaPage() {
    const filters = [['all', 'All'], ['image', 'Images'], ['video', 'Videos'], ['presentation', 'PowerPoint & PDF'], ['web', 'Web pages'], ['text', 'Text']];
    const q = state.mediaSearch.toLowerCase();
    const list = state.media.filter((m) => (state.mediaFilter === 'all' || m.type === state.mediaFilter) && (!q || m.name.toLowerCase().includes(q))).reverse();
    const search = h('input', { type: 'search', placeholder: 'Search media…', value: state.mediaSearch,
      oninput: (e) => { state.mediaSearch = e.target.value; const pos = e.target.selectionStart; renderPage({ soft: true }); const s = document.querySelector('.toolbar input[type=search]'); s.focus(); s.setSelectionRange(pos, pos); } });
    setTimeout(drawUploads);
    return [
      pageHead('Media', 'Everything you can show on a screen.',
        h('button', { class: 'btn', onclick: () => webDialog() }, icon('web'), 'Web page'),
        h('button', { class: 'btn', onclick: () => textDialog() }, icon('text'), 'Text slide'),
        h('button', { class: 'btn primary', onclick: pickFiles }, icon('upload'), 'Upload files')),
      h('div', { class: 'dropzone', onclick: pickFiles },
        h('b', {}, 'Drag & drop files here'), ' or click to browse', h('br'),
        h('span', { class: 'small' }, 'PowerPoint (.pptx, .ppt, .ppsx), PDF, images (JPG, PNG, GIF, WebP, SVG) and videos (MP4, WebM)')),
      h('div', { id: 'uploads', class: 'uploads' }),
      h('div', { class: 'toolbar' },
        h('div', { class: 'chips' }, filters.map(([id, label]) => h('button', { class: `chip ${state.mediaFilter === id ? 'on' : ''}`, onclick: () => { state.mediaFilter = id; renderPage(); } }, label))),
        h('div', { class: 'spacer' }), search),
      list.length ? h('div', { class: 'media-grid' }, list.map((m) =>
        h('div', { class: 'card media-card', onclick: () => mediaDialog(m) },
          mediaThumb(m),
          h('div', { class: 'media-meta' }, h('div', { class: 'name', title: m.name }, m.name),
            h('div', { class: 'muted small' }, m.status === 'processing' ? 'Converting slides…' : m.status === 'error' ? 'Conversion failed — click for details' : m.size ? fmtSize(m.size) : m.type === 'web' ? m.url : TYPE_LABEL[m.type]))))) :
        h('div', { class: 'card empty' }, h('h3', {}, state.media.length ? 'No matches' : 'Your media library is empty'), h('p', {}, 'Upload a PowerPoint, some photos or a video to get started.')),
    ];
  }

  function addToPlaylistControl(m) {
    const sel = h('select', {}, h('option', { value: '' }, 'Add to playlist…'), state.playlists.map((p) => h('option', { value: p.id }, p.name)), h('option', { value: '__new' }, '+ New playlist'));
    sel.onchange = async () => {
      let pid = sel.value;
      if (!pid) return;
      if (pid === '__new') pid = (await api('/playlists', { method: 'POST', body: { name: m.name } })).id;
      const p = await api('/playlists').then((ps) => byId(ps, pid));
      p.items.push({ mediaId: m.id, duration: 0 });
      await api(`/playlists/${pid}`, { method: 'PUT', body: { items: p.items } });
      toast(`Added to “${p.name}”`, 'ok');
      sel.value = '';
    };
    return sel;
  }

  function mediaDialog(m) {
    const name = h('input', { value: m.name });
    let preview;
    if (m.type === 'image') preview = h('img', { src: m.url });
    else if (m.type === 'video') preview = h('video', { src: m.url, controls: true, muted: true });
    else if (m.type === 'presentation' && m.slideUrls) preview = h('img', { src: m.slideUrls[0] });
    else if (m.type === 'web') preview = h('iframe', { src: m.url, sandbox: 'allow-scripts allow-same-origin' });
    else if (m.type === 'text') preview = textPreview(m.text);
    const big = h('div', { class: 'preview-big' }, preview || (m.status === 'processing' ? h('div', { class: 'spinner' }) : icon('media')));
    const usedIn = state.playlists.filter((p) => p.items.some((i) => i.mediaId === m.id));
    modal({
      title: TYPE_LABEL[m.type] || 'Media',
      wide: true,
      body: [
        big,
        m.status === 'error' ? h('div', { class: 'alert' }, h('b', {}, 'Conversion failed: '), m.error) : null,
        m.slideUrls && m.slideUrls.length > 1 ? h('div', { class: 'slides-strip' }, m.slideUrls.map((u) => h('img', { src: u, loading: 'lazy', onclick: () => big.replaceChildren(h('img', { src: u })) }))) : null,
        h('label', { class: 'field' }, 'Name', name),
        h('div', { class: 'muted small' },
          [m.originalName, m.size ? fmtSize(m.size) : null, m.slides ? `${m.slides.length} slides` : null, `Added ${new Date(m.createdAt).toLocaleString()}`].filter(Boolean).join(' · ')),
        h('div', { class: 'small' }, usedIn.length ? ['Used in: ', usedIn.map((p, i) => [i ? ', ' : '', h('a', { href: `#/playlists/${p.id}` }, p.name)])] : h('span', { class: 'muted' }, 'Not used in any playlist yet.')),
      ],
      footer: (close) => [
        h('button', { class: 'btn danger', onclick: async () => {
          if (!(await confirmBox('Delete media?', `“${m.name}” will be removed from all playlists and screens.`))) return;
          await api(`/media/${m.id}`, { method: 'DELETE' });
          close(); toast('Deleted'); await loadAll(); renderPage();
        } }, icon('trash'), 'Delete'),
        m.type === 'presentation' ? h('button', { class: 'btn', onclick: async () => { await api(`/media/${m.id}/reconvert`, { method: 'POST' }); close(); toast('Converting again…'); } }, icon('refresh'), 'Re-convert') : null,
        m.type === 'text' ? h('button', { class: 'btn', onclick: () => { close(); textDialog(m); } }, 'Edit text') : null,
        addToPlaylistControl(m),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn primary', onclick: async () => {
          if (name.value.trim() && name.value !== m.name) await api(`/media/${m.id}`, { method: 'PATCH', body: { name: name.value.trim() } });
          close(); await loadAll(); renderPage();
        } }, 'Done'),
      ],
    });
  }

  function webDialog() {
    const url = h('input', { placeholder: 'https://example.com/dashboard' });
    const name = h('input', { placeholder: 'Optional' });
    const err = h('div', { class: 'err-text' });
    modal({
      title: 'Add a web page',
      body: [h('p', { class: 'muted' }, 'Show a live website, dashboard or Power BI report. Note: some sites block being shown inside other pages.'),
        h('label', { class: 'field' }, 'Web address', url), h('label', { class: 'field' }, 'Name', name), err],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: async () => {
          try {
            let u = url.value.trim();
            if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
            await api('/media', { method: 'POST', body: { type: 'web', url: u, name: name.value.trim() } });
            close(); await loadAll(); renderPage(); toast('Web page added', 'ok');
          } catch (e) { err.textContent = e.message; }
        } }, 'Add')],
    });
  }

  function textPreview(t = {}) {
    return h('div', { class: 'text-preview', style: { background: t.bg2 ? `linear-gradient(135deg, ${t.bg || '#1e1b4b'}, ${t.bg2})` : t.bg || '#1e1b4b', color: t.fg || '#fff', textAlign: t.align === 'left' ? 'left' : 'center', alignItems: t.align === 'left' ? 'flex-start' : 'center' } },
      h('h1', {}, t.title || ''), h('p', {}, t.body || ''));
  }

  function textDialog(existing) {
    const t = Object.assign({ title: '', body: '', bg: '#1e1b4b', bg2: '#7c3aed', fg: '#ffffff', align: 'center', size: 'normal' }, existing?.text || {});
    const pv = h('div');
    const redraw = () => pv.replaceChildren(textPreview(t));
    const bind = (el, key) => { el.addEventListener('input', () => { t[key] = el.value; redraw(); }); return el; };
    const presets = [['#1e1b4b', '#7c3aed', '#ffffff'], ['#0f172a', '#0891b2', '#ffffff'], ['#14532d', '#16a34a', '#ffffff'], ['#7c2d12', '#ea580c', '#ffffff'], ['#ffffff', '#e2e8f0', '#0f172a'], ['#000000', '', '#facc15']];
    const colors = { bg: h('input', { type: 'color', value: t.bg }), bg2: h('input', { type: 'color', value: t.bg2 || t.bg }), fg: h('input', { type: 'color', value: t.fg }) };
    Object.entries(colors).forEach(([k, el]) => bind(el, k));
    redraw();
    modal({
      title: existing ? 'Edit text slide' : 'New text slide',
      wide: true,
      body: [
        pv,
        h('label', { class: 'field' }, 'Heading', bind(h('input', { value: t.title, placeholder: 'Welcome to our office!' }), 'title')),
        h('label', { class: 'field' }, 'Text', bind(h('textarea', { rows: 3, placeholder: 'Coffee is in the kitchen on the 2nd floor.' }, t.body), 'body')),
        h('div', { class: 'row wrap', style: { gap: '18px' } },
          h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, 'Style'),
            h('div', { class: 'row' }, presets.map(([a, b, c]) => h('button', { class: 'btn icon', title: 'Preset', style: { width: '34px', height: '34px', background: b ? `linear-gradient(135deg, ${a}, ${b})` : a, color: c }, onclick: () => {
              Object.assign(t, { bg: a, bg2: b, fg: c }); colors.bg.value = a; colors.bg2.value = b || a; colors.fg.value = c; redraw();
            } }, 'A')))),
          h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, 'Colours'), h('div', { class: 'row' }, colors.bg, colors.bg2, colors.fg)),
          h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, 'Align'), segmented([['center', 'Centre'], ['left', 'Left']], t.align, (v) => { t.align = v; redraw(); })),
          h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, 'Size'), segmented([['small', 'S'], ['normal', 'M'], ['large', 'L']], t.size, (v) => { t.size = v; }))),
      ],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: async () => {
          try {
            if (existing) await api(`/media/${existing.id}`, { method: 'PATCH', body: { text: t, name: t.title || existing.name } });
            else await api('/media', { method: 'POST', body: { type: 'text', text: t, name: t.title } });
            close(); await loadAll(); renderPage(); toast('Saved', 'ok');
          } catch (e) { toast(e.message, 'err'); }
        } }, 'Save')],
    });
  }

  function segmented(options, value, onChange) {
    const el = h('div', { class: 'seg' });
    const draw = () => el.replaceChildren(...options.map(([v, label]) => h('button', { type: 'button', class: v === value ? 'on' : '', onclick: () => { value = v; draw(); onChange(v); } }, label)));
    draw();
    return el;
  }

  // ---------------------------------------------------------------------------
  // Playlists
  // ---------------------------------------------------------------------------
  let saveTimer = null;
  function savePlaylist(p, immediate) {
    clearTimeout(saveTimer);
    const doSave = async () => {
      try {
        const saved = await api(`/playlists/${p.id}`, { method: 'PUT', body: p });
        Object.assign(p, { items: saved.items });
        const status = document.getElementById('save-status');
        if (status) status.textContent = 'All changes saved';
      } catch (e) { toast(e.message, 'err'); }
    };
    const status = document.getElementById('save-status');
    if (status) status.textContent = 'Saving…';
    if (immediate) return doSave();
    saveTimer = setTimeout(doSave, 500);
  }

  async function newPlaylist() {
    const p = await api('/playlists', { method: 'POST', body: {} });
    state.playlists.push(p);
    go(`#/playlists/${p.id}`);
  }

  function PlaylistsPage(arg) {
    const p = byId(state.playlists, arg) || state.playlists[0];
    const listCol = h('div', { class: 'card pl-list' },
      h('div', { class: 'section-head' }, h('h3', {}, 'Playlists'), h('div', { class: 'spacer' }), h('button', { class: 'btn sm primary', onclick: newPlaylist }, icon('plus'), 'New')),
      state.playlists.map((x) => h('a', { href: `#/playlists/${x.id}`, class: p && x.id === p.id ? 'active' : '' },
        h('span', { class: 'swatch', style: { background: x.color } }),
        h('div', { style: { minWidth: 0 } }, h('div', { style: { fontWeight: 600 } }, x.name), h('div', { class: 'muted small' }, `${x.items.length} items · ${playlistRuntime(x)}`)))));
    if (!p) {
      return [pageHead('Playlists', 'A playlist is a set of content that plays in a loop.'),
        h('div', { class: 'card empty' }, h('h3', {}, 'No playlists yet'), h('p', {}, 'Create a playlist, then drag your media into it.'), h('button', { class: 'btn primary', onclick: newPlaylist }, icon('plus'), 'Create your first playlist'))];
    }
    return [
      pageHead('Playlists', 'Drag media in from the right, then drag items to change the order. Changes save automatically.',
        h('span', { id: 'save-status', class: 'muted small' }, ''),
        h('a', { class: 'btn', href: `/player/?preview=${p.id}`, target: '_blank' }, icon('play'), 'Preview'),
        h('button', { class: 'btn', onclick: () => scheduleDialog({ playlistId: p.id }) }, icon('schedule'), 'Schedule'),
        h('button', { class: 'btn primary', onclick: () => sendDialog({ playlistId: p.id }) }, icon('play'), 'Send to screens')),
      h('div', { class: 'pl-layout' }, listCol, playlistEditor(p), libraryPanel(p)),
    ];
  }

  function playlistEditor(p) {
    const items = h('div', { class: 'pl-items' });
    const runtime = h('span', { class: 'muted small' });
    const drawRuntime = () => { runtime.textContent = `${p.items.length} items · total ${playlistRuntime(p)}`; };

    const name = h('input', { value: p.name, style: { fontSize: '17px', fontWeight: 700 }, oninput: () => { p.name = name.value; savePlaylist(p); } });
    const color = h('input', { type: 'color', value: p.color, title: 'Colour in the schedule', oninput: () => { p.color = color.value; savePlaylist(p); } });
    const defDur = h('input', { type: 'number', min: 1, value: p.defaultDuration || 10, style: { width: '80px' }, oninput: () => { p.defaultDuration = Number(defDur.value) || 10; savePlaylist(p); draw(); } });
    const trans = h('select', { style: { width: 'auto' }, onchange: () => { p.transition = trans.value; savePlaylist(p); } },
      [['fade', 'Fade'], ['slide', 'Slide'], ['zoom', 'Zoom'], ['none', 'None']].map(([v, l]) => h('option', { value: v, selected: (p.transition || 'fade') === v }, l)));

    let dragFrom = null;
    function draw() {
      drawRuntime();
      if (!p.items.length) {
        const hint = h('div', { class: 'pl-drop-hint' }, h('b', {}, 'This playlist is empty.'), h('br'), 'Drag media here from the library, or click + next to an item.');
        hint.addEventListener('dragover', (e) => { e.preventDefault(); hint.classList.add('over'); });
        hint.addEventListener('dragleave', () => hint.classList.remove('over'));
        hint.addEventListener('drop', (e) => { e.preventDefault(); const mid = e.dataTransfer.getData('text/kevcast-media'); if (mid) addItem(mid, 0); });
        items.replaceChildren(hint);
        return;
      }
      items.replaceChildren(...p.items.map((it, idx) => {
        const m = byId(state.media, it.mediaId);
        const dur = h('input', { type: 'number', min: 0, value: it.duration || '', placeholder: m?.type === 'video' ? 'auto' : String(p.defaultDuration || 10), title: m?.type === 'presentation' ? 'Seconds per slide' : 'Seconds on screen',
          oninput: () => { it.duration = Number(dur.value) || 0; savePlaylist(p); drawRuntime(); } });
        const row = h('div', { class: `pl-item ${it.enabled === false ? 'disabled' : ''}`, draggable: true },
          h('div', { class: 'handle', title: 'Drag to reorder' }, icon('drag')),
          mediaThumb(m, true),
          h('div', { style: { minWidth: 0 } },
            h('div', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m ? m.name : '(deleted)'),
            h('div', { class: 'muted small' }, m ? `${TYPE_LABEL[m.type]}${m.slides ? ` · ${m.slides.length} slides` : ''}${m.status === 'processing' ? ' · converting…' : ''}` : '')),
          h('div', { class: 'controls' },
            h('label', { class: 'row small muted', title: m?.type === 'presentation' ? 'Seconds per slide' : 'Seconds on screen' }, dur, m?.type === 'presentation' ? 's/slide' : 's'),
            h('label', { class: 'check small', title: 'Show this item' }, h('input', { type: 'checkbox', checked: it.enabled !== false, onchange: (e) => { it.enabled = e.target.checked; row.classList.toggle('disabled', !it.enabled); savePlaylist(p); drawRuntime(); } })),
            h('button', { class: 'btn icon ghost', title: 'Remove from playlist', onclick: () => { p.items.splice(idx, 1); savePlaylist(p); draw(); } }, icon('trash'))));
        row.addEventListener('dragstart', (e) => { dragFrom = idx; state.busy = true; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/kevcast-item', String(idx)); });
        row.addEventListener('dragend', () => { state.busy = false; dragFrom = null; draw(); });
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          const after = e.offsetY > row.offsetHeight / 2;
          row.classList.toggle('drop-after', after);
          row.classList.toggle('drop-before', !after);
        });
        row.addEventListener('dragleave', () => row.classList.remove('drop-after', 'drop-before'));
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          const after = e.offsetY > row.offsetHeight / 2;
          const target = idx + (after ? 1 : 0);
          const mid = e.dataTransfer.getData('text/kevcast-media');
          if (mid) return addItem(mid, target);
          if (dragFrom === null) return;
          const [moved] = p.items.splice(dragFrom, 1);
          p.items.splice(target > dragFrom ? target - 1 : target, 0, moved);
          dragFrom = null;
          savePlaylist(p, true);
          draw();
        });
        return row;
      }));
    }
    function addItem(mediaId, at) {
      p.items.splice(at ?? p.items.length, 0, { id: Math.random().toString(16).slice(2), mediaId, duration: 0, enabled: true });
      savePlaylist(p, true);
      draw();
    }
    p._addItem = addItem;
    draw();

    return h('div', { class: 'card' },
      h('div', { class: 'section-head', style: { flexWrap: 'wrap' } }, color, h('div', { style: { flex: 1, minWidth: '180px' } }, name),
        h('button', { class: 'btn sm ghost', title: 'Duplicate', onclick: async () => { const c = await api(`/playlists/${p.id}/duplicate`, { method: 'POST' }); state.playlists.push(c); go(`#/playlists/${c.id}`); } }, icon('copy')),
        h('button', { class: 'btn sm ghost danger', title: 'Delete playlist', onclick: async () => {
          if (!(await confirmBox('Delete playlist?', `“${p.name}” and any schedules using it will be deleted. Your media stays in the library.`))) return;
          await api(`/playlists/${p.id}`, { method: 'DELETE' });
          await loadAll(); go('#/playlists'); renderPage();
        } }, icon('trash'))),
      h('div', { class: 'row wrap', style: { padding: '10px 16px', borderBottom: '1px solid var(--line)', gap: '16px' } },
        h('label', { class: 'row small' }, 'Default time', defDur, 'sec'),
        h('label', { class: 'row small' }, 'Transition', trans),
        h('div', { class: 'spacer' }), runtime),
      items);
  }

  function libraryPanel(p) {
    let q = '';
    const list = h('div', { class: 'lib-scroll' });
    const draw = () => {
      const ms = state.media.filter((m) => !q || m.name.toLowerCase().includes(q)).reverse();
      list.replaceChildren(...(ms.length ? ms.map((m) => {
        const row = h('div', { class: 'lib-item', draggable: true, title: 'Drag into the playlist' },
          mediaThumb(m, true),
          h('div', { style: { minWidth: 0 } }, h('div', { class: 'name' }, m.name), h('div', { class: 'muted small' }, TYPE_LABEL[m.type])),
          h('button', { class: 'btn icon sm', title: 'Add to end of playlist', onclick: () => p._addItem(m.id) }, icon('plus')));
        row.addEventListener('dragstart', (e) => { state.busy = true; e.dataTransfer.setData('text/kevcast-media', m.id); e.dataTransfer.effectAllowed = 'copy'; });
        row.addEventListener('dragend', () => { state.busy = false; });
        return row;
      }) : [h('div', { class: 'empty small' }, 'No media yet. ', h('a', { href: '#/media' }, 'Upload some'))]));
    };
    draw();
    return h('div', { class: 'card pl-library' },
      h('div', { class: 'section-head' }, h('h3', {}, 'Library'), h('div', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: pickFiles }, icon('upload'), 'Upload')),
      h('div', { style: { padding: '10px 12px' } }, h('input', { type: 'search', placeholder: 'Search…', oninput: (e) => { q = e.target.value.toLowerCase(); draw(); } })),
      list);
  }

  // ---------------------------------------------------------------------------
  // Schedule — week calendar
  // ---------------------------------------------------------------------------
  const HOUR_PX = 44;
  const dkey = KevSchedule.dateKey;
  const pad = (n) => String(n).padStart(2, '0');
  const minToHHMM = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

  function weekStart(offset) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // Monday first
    d.setDate(d.getDate() - dow + offset * 7);
    return d;
  }

  function entryOnDate(s, date) {
    // Returns [startMin, endMin] segments of entry s on this calendar date.
    const segs = [];
    const okDay = (d) => {
      const days = s.days && s.days.length ? s.days : [0, 1, 2, 3, 4, 5, 6];
      const k = dkey(d);
      return days.includes(d.getDay()) && (!s.startDate || k >= s.startDate) && (!s.endDate || k <= s.endDate);
    };
    if (s.allDay) { if (okDay(date)) segs.push([0, 1440]); return segs; }
    const st = KevSchedule.toMinutes(s.start);
    const en = KevSchedule.toMinutes(s.end);
    if (en > st) { if (okDay(date)) segs.push([st, en]); return segs; }
    const prev = new Date(date); prev.setDate(prev.getDate() - 1);
    if (okDay(prev) && en > 0) segs.push([0, en]);
    if (okDay(date)) segs.push([st, 1440]);
    return segs;
  }

  function SchedulePage() {
    const start = weekStart(state.calWeekOffset);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
    const today = dkey(new Date());
    const filterDisplay = byId(state.displays, state.calDisplay);
    const relevant = state.schedules.filter((s) => !filterDisplay || KevSchedule.appliesToDisplay(s, filterDisplay));
    const approved = state.displays.filter((d) => d.approved);

    const displaySel = h('select', { style: { width: 'auto' }, onchange: (e) => { state.calDisplay = e.target.value; renderPage(); } },
      h('option', { value: '' }, 'All displays'), approved.map((d) => h('option', { value: d.id, selected: d.id === state.calDisplay }, d.name)));

    const head = h('div', { class: 'cal-head' }, h('div'), days.map((d) =>
      h('div', { class: dkey(d) === today ? 'today' : '' }, DAYS[d.getDay()], h('small', {}, d.toLocaleDateString([], { day: 'numeric', month: 'short' })))));

    const body = h('div', { class: 'cal-body' });
    body.append(h('div', { class: 'cal-hours' }, Array.from({ length: 24 }, (_, i) => h('div', {}, i ? `${pad(i)}:00` : ''))));
    days.forEach((d) => {
      const col = h('div', { class: `cal-day ${dkey(d) === today ? 'today' : ''} ${[0, 6].includes(d.getDay()) ? 'weekend' : ''}`, style: { height: `${24 * HOUR_PX}px` } });
      // Lay out overlapping blocks side-by-side.
      const blocks = [];
      relevant.forEach((s) => entryOnDate(s, d).forEach(([a, b]) => blocks.push({ s, a, b })));
      blocks.sort((x, y) => (y.s.priority || 0) - (x.s.priority || 0) || x.a - y.a);
      const lanes = [];
      blocks.forEach((bk) => {
        let lane = lanes.findIndex((l) => l.every((o) => o.b <= bk.a || o.a >= bk.b));
        if (lane === -1) { lanes.push([]); lane = lanes.length - 1; }
        lanes[lane].push(bk);
        bk.lane = lane;
      });
      blocks.forEach((bk) => {
        const p = byId(state.playlists, bk.s.playlistId);
        const w = 100 / Math.max(1, lanes.length);
        const el = h('div', {
          class: `cal-block ${bk.s.enabled === false ? 'off' : ''}`,
          title: `${p?.name || '?'} · ${bk.s.allDay ? 'All day' : `${bk.s.start}–${bk.s.end}`}`,
          style: { top: `${(bk.a / 60) * HOUR_PX}px`, height: `${Math.max(18, ((bk.b - bk.a) / 60) * HOUR_PX - 2)}px`, background: p?.color || '#64748b',
            left: `calc(${bk.lane * w}% + 3px)`, width: `calc(${w}% - 6px)`, right: 'auto' },
          onmousedown: (e) => e.stopPropagation(),
          onclick: (e) => { e.stopPropagation(); scheduleDialog(bk.s); },
        }, h('b', {}, bk.s.name || p?.name || 'Playlist'), h('span', {}, bk.s.allDay ? 'All day' : `${bk.s.start}–${bk.s.end}`), bk.s.priority >= 5 ? h('span', {}, ' · ⚑') : null);
        col.append(el);
      });
      if (dkey(d) === today) {
        const now = new Date();
        col.append(h('div', { class: 'cal-now', style: { top: `${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX}px` } }));
      }
      // Click-and-drag on empty space to create a new entry.
      col.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const rect = col.getBoundingClientRect();
        const snap = (y) => Math.max(0, Math.min(1440, Math.round(((y - rect.top) / HOUR_PX) * 2) * 30));
        const a = Math.min(1410, Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30);
        let b = a + 60;
        const sel = h('div', { class: 'cal-block selecting' });
        const drawSel = () => Object.assign(sel.style, { top: `${(Math.min(a, b) / 60) * HOUR_PX}px`, height: `${(Math.abs(b - a) / 60) * HOUR_PX}px` });
        drawSel();
        col.append(sel);
        state.busy = true;
        const move = (ev) => { b = snap(ev.clientY); if (b === a) b = a + 30; drawSel(); };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          state.busy = false;
          sel.remove();
          const s = Math.min(a, b), en = Math.max(a, b);
          scheduleDialog({ days: [d.getDay()], start: minToHHMM(s), end: en >= 1440 ? '00:00' : minToHHMM(en), targets: { displays: filterDisplay ? [filterDisplay.id] : [], groups: [] } });
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
      body.append(col);
    });

    const scroll = h('div', { class: 'cal-scroll' }, body);
    setTimeout(() => { if (!scroll.dataset.done) { scroll.scrollTop = 7 * HOUR_PX; scroll.dataset.done = 1; } });

    const usedPlaylists = [...new Set(relevant.map((s) => s.playlistId))].map((id) => byId(state.playlists, id)).filter(Boolean);
    const fallback = filterDisplay ? byId(state.playlists, filterDisplay.defaultPlaylistId) : null;

    return [
      pageHead('Schedule', 'Click and drag on the calendar to schedule a playlist. Click a block to edit it.',
        displaySel,
        h('button', { class: 'btn primary', onclick: () => scheduleDialog({ targets: { displays: filterDisplay ? [filterDisplay.id] : [], groups: [] } }) }, icon('plus'), 'Add to schedule')),
      h('div', { class: 'row', style: { marginBottom: '12px' } },
        h('button', { class: 'btn sm', onclick: () => { state.calWeekOffset--; renderPage(); } }, icon('left')),
        h('button', { class: 'btn sm', onclick: () => { state.calWeekOffset = 0; renderPage(); } }, 'This week'),
        h('button', { class: 'btn sm', onclick: () => { state.calWeekOffset++; renderPage(); } }, icon('right')),
        h('b', { style: { marginLeft: '8px' } }, `${days[0].toLocaleDateString([], { day: 'numeric', month: 'long' })} – ${days[6].toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}`)),
      h('div', { class: 'card cal' }, head, scroll),
      h('div', { class: 'legend' },
        usedPlaylists.map((p) => h('span', {}, h('span', { class: 'swatch', style: { background: p.color } }), p.name)),
        filterDisplay ? h('span', { class: 'muted' }, `Outside scheduled times “${filterDisplay.name}” shows: `, fallback ? h('b', {}, fallback.name) : 'the idle clock screen', ' (change under Displays)') :
          h('span', { class: 'muted' }, 'Outside scheduled times each display shows its default playlist.')),
      scheduleTable(relevant),
    ];
  }

  function describeTargets(s) {
    const t = s.targets || {};
    const parts = [...(t.displays || []).map((id) => byId(state.displays, id)?.name).filter(Boolean), ...(t.groups || []).map((g) => `Group: ${g}`)];
    return parts.length ? parts.join(', ') : 'All displays';
  }
  function describeDays(s) {
    const d = (s.days && s.days.length ? s.days : [0, 1, 2, 3, 4, 5, 6]).slice().sort();
    if (d.length === 7) return 'Every day';
    if (d.join() === '1,2,3,4,5') return 'Weekdays';
    if (d.join() === '0,6') return 'Weekends';
    return d.map((x) => DAYS[x]).join(', ');
  }

  function scheduleTable(list) {
    if (!list.length) return h('div', { class: 'card empty', style: { marginTop: '16px' } }, h('h3', {}, 'Nothing scheduled yet'), h('p', {}, 'Drag on the calendar above, or set a default playlist for each display.'));
    return h('div', { class: 'card', style: { marginTop: '16px', overflowX: 'auto' } },
      h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, ['', 'Playlist', 'When', 'Screens', 'Priority', 'On'].map((x) => h('th', {}, x)))),
        h('tbody', {}, list.map((s) => {
          const p = byId(state.playlists, s.playlistId);
          return h('tr', { class: 'click', onclick: () => scheduleDialog(s) },
            h('td', { style: { width: '20px' } }, h('span', { class: 'swatch', style: { background: p?.color } })),
            h('td', {}, h('b', {}, s.name || p?.name || '?'), s.name ? h('div', { class: 'muted small' }, p?.name) : null),
            h('td', {}, `${describeDays(s)}, ${s.allDay ? 'all day' : `${s.start}–${s.end}`}`, s.startDate || s.endDate ? h('div', { class: 'muted small' }, `${s.startDate || '…'} → ${s.endDate || '…'}`) : null),
            h('td', {}, describeTargets(s)),
            h('td', {}, s.priority >= 10 ? h('span', { class: 'badge err' }, 'Urgent') : s.priority >= 5 ? h('span', { class: 'badge warn' }, 'High') : h('span', { class: 'muted' }, 'Normal')),
            h('td', { onclick: (e) => e.stopPropagation() }, h('input', { type: 'checkbox', checked: s.enabled !== false, onchange: async (e) => { await api(`/schedules/${s.id}`, { method: 'PUT', body: { ...s, enabled: e.target.checked } }); } })));
        }))));
  }

  function scheduleDialog(initial = {}) {
    if (!state.playlists.length) {
      toast('Create a playlist first, then schedule it.', 'err');
      return go('#/playlists');
    }
    const s = JSON.parse(JSON.stringify(Object.assign({ name: '', playlistId: state.playlists[0].id, days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00', allDay: false, priority: 0, enabled: true, targets: { displays: [], groups: [] }, startDate: null, endDate: null }, initial)));
    s.targets = s.targets || { displays: [], groups: [] };
    const err = h('div', { class: 'err-text' });

    const plSel = h('select', { onchange: () => { s.playlistId = plSel.value; } }, state.playlists.map((p) => h('option', { value: p.id, selected: p.id === s.playlistId }, p.name)));

    const dayBox = h('div', { class: 'day-pick' });
    const drawDays = () => dayBox.replaceChildren(...[1, 2, 3, 4, 5, 6, 0].map((d) => h('button', { type: 'button', class: s.days.includes(d) ? 'on' : '', onclick: () => {
      s.days = s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d]; drawDays();
    } }, DAYS[d])));
    drawDays();
    const quick = (label, days) => h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { s.days = days; drawDays(); } }, label);

    const startI = h('input', { type: 'time', value: s.start, oninput: () => (s.start = startI.value) });
    const endI = h('input', { type: 'time', value: s.end, oninput: () => (s.end = endI.value) });
    const timeRow = h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'From', startI), h('label', { class: 'field' }, 'Until', h('span', { class: 'hint' }, 'An earlier time means it runs past midnight'), endI));
    timeRow.hidden = s.allDay;
    const allDay = h('input', { type: 'checkbox', checked: s.allDay, onchange: () => { s.allDay = allDay.checked; timeRow.hidden = s.allDay; } });

    const approved = state.displays.filter((d) => d.approved);
    const targetBox = targetChips(s.targets);

    const from = h('input', { type: 'date', value: s.startDate || '', oninput: () => (s.startDate = from.value || null) });
    const until = h('input', { type: 'date', value: s.endDate || '', oninput: () => (s.endDate = until.value || null) });
    const name = h('input', { value: s.name, placeholder: 'e.g. Lunch menu (optional)', oninput: () => (s.name = name.value) });

    modal({
      title: s.id ? 'Edit scheduled content' : 'Schedule a playlist',
      body: [
        h('label', { class: 'field' }, 'What should play?', plSel),
        h('div', { class: 'field' }, h('b', { class: 'small' }, 'Which screens?'), targetBox, approved.length ? null : h('span', { class: 'hint' }, 'No displays connected yet — “All displays” will include them once added.')),
        h('div', { class: 'field' }, h('b', { class: 'small' }, 'On which days?'), dayBox, h('div', { class: 'row' }, quick('Weekdays', [1, 2, 3, 4, 5]), quick('Weekend', [0, 6]), quick('Every day', [0, 1, 2, 3, 4, 5, 6]))),
        h('label', { class: 'check' }, allDay, 'All day'),
        timeRow,
        h('details', { open: !!(s.startDate || s.endDate || s.priority || s.name) },
          h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, 'More options'),
          h('div', { class: 'stack', style: { marginTop: '12px' } },
            h('label', { class: 'field' }, 'Label', name),
            h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Starting on', h('span', { class: 'hint' }, 'Leave empty to start now'), from), h('label', { class: 'field' }, 'Ending on', h('span', { class: 'hint' }, 'Leave empty to repeat forever'), until)),
            h('div', { class: 'field' }, h('b', { class: 'small' }, 'Priority'), h('span', { class: 'hint' }, 'When schedules overlap, the higher priority wins.'),
              segmented([[0, 'Normal'], [5, 'High'], [10, 'Urgent']], s.priority >= 10 ? 10 : s.priority >= 5 ? 5 : 0, (v) => { s.priority = v; })))),
        err,
      ],
      footer: (close) => [
        s.id ? h('button', { class: 'btn danger', onclick: async () => {
          if (!(await confirmBox('Remove from schedule?', 'The playlist itself is not deleted.', 'Remove'))) return;
          await api(`/schedules/${s.id}`, { method: 'DELETE' }); close(); await loadAll(); renderPage();
        } }, icon('trash'), 'Remove') : null,
        s.id ? h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: s.enabled !== false, onchange: (e) => (s.enabled = e.target.checked) }), 'Enabled') : null,
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn', onclick: close }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (!s.days.length) { err.textContent = 'Pick at least one day.'; return; }
          if (!s.allDay && s.start === s.end) { err.textContent = 'Start and end time can’t be the same.'; return; }
          try {
            await api(s.id ? `/schedules/${s.id}` : '/schedules', { method: s.id ? 'PUT' : 'POST', body: s });
            close(); await loadAll();
            if (route().page !== 'schedule') go('#/schedule'); else renderPage();
            toast('Schedule saved', 'ok');
          } catch (e) { err.textContent = e.message; }
        } }, 'Save'),
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // Displays
  // ---------------------------------------------------------------------------
  function playlistSelect(value, onChange, emptyLabel = 'Nothing (show clock)') {
    return h('select', { onchange: (e) => onChange(e.target.value || null) },
      h('option', { value: '' }, emptyLabel), state.playlists.map((p) => h('option', { value: p.id, selected: p.id === value }, p.name)));
  }

  function playerUrl() {
    return (state.overview?.playerUrls || [])[0] || `${location.origin}/player/`;
  }

  function pairDialog() {
    const code = h('input', { class: 'code-input', maxlength: 6, placeholder: 'ABC123', autocomplete: 'off' });
    const name = h('input', { placeholder: 'e.g. Reception TV' });
    const group = h('input', { placeholder: 'e.g. Ground floor (optional)', list: 'groups-list' });
    let defPl = state.playlists[0]?.id || null;
    const err = h('div', { class: 'err-text' });
    const groups = [...new Set(state.displays.map((d) => d.group).filter(Boolean))];
    modal({
      title: 'Add a display',
      body: [
        h('ol', { style: { margin: 0, paddingLeft: '20px', lineHeight: 1.8 } },
          h('li', {}, 'On the screen (smart TV, mini-PC, Raspberry Pi…) open a browser at:', h('div', { class: 'urlbox', style: { margin: '6px 0' } }, playerUrl())),
          h('li', {}, 'A 6-character code appears on the screen. Type it below.')),
        h('label', { class: 'field' }, 'Code shown on the screen', code),
        h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Name', name), h('label', { class: 'field' }, 'Group', group, h('datalist', { id: 'groups-list' }, groups.map((g) => h('option', { value: g }))))),
        h('label', { class: 'field' }, 'Show by default', h('span', { class: 'hint' }, 'Plays whenever nothing else is scheduled'), playlistSelect(defPl, (v) => (defPl = v))),
        err,
      ],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: async () => {
          try {
            await api('/displays/pair', { method: 'POST', body: { code: code.value, name: name.value.trim(), group: group.value.trim(), defaultPlaylistId: defPl } });
            close(); toast('Display connected!', 'ok'); await loadAll(); renderPage();
          } catch (e) { err.textContent = e.message; }
        } }, 'Connect display')],
    });
  }

  const isApp = (d) => /KevCastPlayer/.test(d.userAgent || '');
  const groupNames = () => [...new Set(state.displays.filter((d) => d.approved).map((d) => d.group).filter(Boolean))].sort();

  async function groupCommand(sel, action, label) {
    const r = await api('/displays/command', { method: 'POST', body: { ...sel, action } });
    if (!r.targeted) return toast('No screens in this selection', 'err');
    toast(r.delivered ? `${label} sent to ${r.delivered} of ${r.targeted} screen${r.targeted > 1 ? 's' : ''}` : 'All screens in this selection are offline', r.delivered ? '' : 'err');
  }

  function DisplaysPage() {
    const approved = state.displays.filter((d) => d.approved);
    const pending = state.displays.filter((d) => !d.approved && Date.now() - new Date(d.lastSeen) < 120000);
    const groups = groupNames();
    const sections = [...groups.map((g) => [g, approved.filter((d) => d.group === g)]), ['', approved.filter((d) => !d.group)]].filter(([, list]) => list.length);
    const section = ([g, list]) => {
      const sel = g ? { group: g } : { ids: list.map((d) => d.id) };
      const online = list.filter((d) => d.online).length;
      return h('div', { style: { marginBottom: '22px' } },
        h('div', { class: 'row wrap', style: { marginBottom: '10px' } },
          h('h2', {}, g ? `▦ ${g}` : groups.length ? 'Not in a group' : 'All screens'),
          h('span', { class: 'muted small' }, `${list.length} screen${list.length > 1 ? 's' : ''} · ${online} online`),
          h('div', { class: 'spacer' }),
          h('button', { class: 'btn sm primary', onclick: () => sendDialog({ targets: g ? { displays: [], groups: [g] } : { displays: sel.ids, groups: [] } }) }, icon('play'), g ? 'Send to group' : 'Send to these'),
          h('button', { class: 'btn sm', onclick: () => groupCommand(sel, 'identify', 'Identify') }, icon('eye'), 'Identify'),
          h('button', { class: 'btn sm', onclick: () => groupCommand(sel, 'reload', 'Reload') }, icon('refresh'), 'Reload'),
          g ? h('button', { class: 'btn sm ghost', onclick: () => renameGroupDialog(g) }, 'Rename') : null),
        h('div', { class: 'disp-grid' }, list.map(displayCard)));
    };
    return [
      pageHead('Displays', 'Screens running the KevCast Player app or a web browser. Put screens in groups to send content to many at once.',
        approved.length ? h('button', { class: 'btn', onclick: () => sendDialog({}) }, icon('play'), 'Send to screens') : null,
        h('button', { class: 'btn primary', onclick: pairDialog }, icon('plus'), 'Add display')),
      pending.length ? h('div', { class: 'alert' }, h('b', {}, `${pending.length} screen${pending.length > 1 ? 's are' : ' is'} waiting to be connected. `), 'Click “Add display” and enter the code shown on the screen.') : null,
      approved.length ? sections.map(section) :
        h('div', { class: 'card empty' }, h('h3', {}, 'No displays yet'),
          h('p', {}, 'Install the KevCast Player app on the screen (it finds this server automatically), or open this address in its browser:'), h('div', { class: 'urlbox', style: { maxWidth: '420px', margin: '10px auto' } }, playerUrl()),
          h('button', { class: 'btn primary', onclick: pairDialog }, 'I see a code — add display')),
    ];
  }

  function renameGroupDialog(g) {
    const name = h('input', { value: g });
    modal({
      title: 'Rename group',
      body: [h('label', { class: 'field' }, 'Group name', name)],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: async () => {
          const nn = name.value.trim();
          await api('/displays/bulk', { method: 'PATCH', body: { group: g, patch: { group: nn } } });
          for (const s of state.schedules.filter((x) => (x.targets?.groups || []).includes(g))) {
            await api(`/schedules/${s.id}`, { method: 'PUT', body: { ...s, targets: { ...s.targets, groups: s.targets.groups.map((x) => (x === g ? nn : x)).filter(Boolean) } } });
          }
          close(); await loadAll(); renderPage(); toast('Group renamed', 'ok');
        } }, 'Save')],
    });
  }

  function targetChips(targets, onChange) {
    const approved = state.displays.filter((d) => d.approved);
    const groups = groupNames();
    const box = h('div', { class: 'chips' });
    const draw = () => {
      const all = !targets.displays.length && !targets.groups.length;
      box.replaceChildren(
        h('button', { type: 'button', class: `chip ${all ? 'on' : ''}`, onclick: () => { targets.displays = []; targets.groups = []; draw(); onChange && onChange(); } }, 'All displays'),
        ...groups.map((g) => h('button', { type: 'button', class: `chip ${targets.groups.includes(g) ? 'on' : ''}`, onclick: () => {
          targets.groups = targets.groups.includes(g) ? targets.groups.filter((x) => x !== g) : [...targets.groups, g]; draw(); onChange && onChange();
        } }, `▦ ${g}`)),
        ...approved.map((d) => h('button', { type: 'button', class: `chip ${targets.displays.includes(d.id) ? 'on' : ''}`, onclick: () => {
          targets.displays = targets.displays.includes(d.id) ? targets.displays.filter((x) => x !== d.id) : [...targets.displays, d.id]; draw(); onChange && onChange();
        } }, d.name)));
    };
    draw();
    return box;
  }

  /** "Send to screens": put a playlist on a group / selection of screens right now, temporarily, or on a schedule. */
  function sendDialog({ playlistId, targets }) {
    if (!state.playlists.length) { toast('Create a playlist first.', 'err'); return go('#/playlists'); }
    const t = JSON.parse(JSON.stringify(targets || { displays: [], groups: [] }));
    let pid = playlistId || state.playlists[0].id;
    let mode = 'default';
    const count = h('span', { class: 'muted small' });
    const resolveIds = () => {
      const approved = state.displays.filter((d) => d.approved);
      if (!t.displays.length && !t.groups.length) return approved.map((d) => d.id);
      return approved.filter((d) => t.displays.includes(d.id) || (d.group && t.groups.includes(d.group))).map((d) => d.id);
    };
    const updateCount = () => { const n = resolveIds().length; count.textContent = `${n} screen${n === 1 ? '' : 's'} selected`; };
    updateCount();
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60000);
    const until = h('input', { type: 'time', value: `${pad(later.getHours())}:${pad(later.getMinutes())}`, style: { width: 'auto' } });
    const untilRow = h('label', { class: 'row small' }, 'Show until', until, h('span', { class: 'muted' }, 'today, then go back to normal'));
    untilRow.hidden = true;
    const hint = h('p', { class: 'muted small', style: { margin: 0 } });
    const hints = {
      default: 'The playlist becomes the default content of these screens. Scheduled content still takes over at its scheduled times.',
      now: 'Takes over these screens immediately (high priority), then they return to their normal content.',
      schedule: 'Pick days and times in the next step.',
    };
    hint.textContent = hints.default;
    modal({
      title: 'Send to screens',
      body: [
        playlistId ? h('div', {}, h('b', {}, 'Playlist: '), byId(state.playlists, pid)?.name) :
          h('label', { class: 'field' }, 'What should play?', playlistSelect(pid, (v) => (pid = v), '— choose —')),
        h('div', { class: 'field' }, h('b', { class: 'small' }, 'Which screens?'), targetChips(t, updateCount), count),
        h('div', { class: 'field' }, h('b', { class: 'small' }, 'How?'),
          segmented([['default', 'Make it the default'], ['now', 'Take over now'], ['schedule', 'Schedule…']], mode, (v) => { mode = v; untilRow.hidden = v !== 'now'; hint.textContent = hints[v]; }),
          hint),
        untilRow,
      ],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (!pid) return toast('Choose a playlist', 'err');
          const ids = resolveIds();
          if (!ids.length) return toast('No screens selected (or none connected yet).', 'err');
          if (mode === 'schedule') { close(); return scheduleDialog({ playlistId: pid, targets: t }); }
          if (mode === 'default') {
            await api('/displays/bulk', { method: 'PATCH', body: { ids, patch: { defaultPlaylistId: pid } } });
          } else {
            const d = new Date();
            const start = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            if (until.value <= start) return toast('Pick an end time later today.', 'err');
            await api('/schedules', { method: 'POST', body: { name: `Now: ${byId(state.playlists, pid)?.name || ''}`, playlistId: pid, targets: t, days: [d.getDay()], start, end: until.value, startDate: dkey(d), endDate: dkey(d), priority: 5 } });
          }
          close(); await loadAll(); renderPage();
          toast(`Sent to ${ids.length} screen${ids.length > 1 ? 's' : ''}`, 'ok');
        } }, icon('play'), 'Send')],
    });
  }

  function displayCard(d) {
    const scheduled = byId(state.playlists, d.scheduledPlaylistId);
    const np = d.nowPlaying;
    const npMedia = np && state.media.find((m) => m.name === np.name);
    const shot = d.screenshotAt && d.online ? `/api/displays/${d.id}/screenshot?t=${encodeURIComponent(d.screenshotAt)}` : null;
    const preview = shot ? h('img', { src: shot, title: `Screenshot ${ago(d.screenshotAt)}` }) :
      d.online && npMedia?.thumb ? h('img', { src: npMedia.type === 'presentation' && np.slide ? npMedia.slideUrls[np.slide - 1] : npMedia.thumb }) : icon('display');
    return h('div', { class: 'card disp-card' },
      h('div', { class: 'row' }, h('span', { class: `dot ${d.online ? 'on' : ''}` }), h('h3', {}, d.name),
        h('span', { class: 'badge', title: isApp(d) ? 'KevCast Player app' : 'Web browser' }, isApp(d) ? 'App' : 'Browser'), h('div', { class: 'spacer' }),
        h('span', { class: 'small muted' }, d.online ? 'Online' : `Offline · ${ago(d.lastSeen)}`)),
      h('div', { class: 'disp-screen', style: d.orientation && d.orientation !== 'landscape' ? { aspectRatio: '9/16', maxHeight: '220px', margin: '0 auto' } : {} },
        preview,
        h('div', { class: 'np' }, d.online ? (np ? `▶ ${np.name}${np.slides ? ` · slide ${np.slide}/${np.slides}` : ''}` : 'Idle') : 'Not connected', shot ? h('span', { style: { float: 'right', opacity: 0.8 } }, `📷 ${ago(d.screenshotAt)}`) : null)),
      h('dl', { class: 'kv' },
        h('dt', {}, 'Now scheduled'), h('dd', {}, scheduled ? scheduled.name : '—', d.scheduleId ? '' : scheduled ? ' (default)' : ''),
        h('dt', {}, 'Default'), h('dd', {}, playlistSelect(d.defaultPlaylistId, async (v) => { await api(`/displays/${d.id}`, { method: 'PATCH', body: { defaultPlaylistId: v } }); toast('Saved', 'ok'); })),
        h('dt', {}, 'Screen'), h('dd', {}, d.resolution || '—', d.ip ? ` · ${d.ip.replace('::ffff:', '')}` : ''),
        d.cache ? h('dt', {}, 'Offline') : null,
        d.cache ? h('dd', { title: 'Media stored on the device, so it keeps playing if the server goes down' },
          d.cache.total && d.cache.cached >= d.cache.total ? h('span', { class: 'badge ok' }, 'Ready') : h('span', { class: 'badge warn' }, d.cache.downloading ? 'Downloading' : 'Partial'),
          ` ${d.cache.cached}/${d.cache.total} files · ${fmtSize(d.cache.bytes || 0)}`) : null),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn sm', onclick: () => displayDialog(d) }, icon('settings'), 'Settings'),
        h('button', { class: 'btn sm', title: 'Show the name on the screen for 10 seconds', onclick: async () => { const r = await api(`/displays/${d.id}/identify`, { method: 'POST' }); toast(r.delivered ? 'Look at your screens!' : 'Display is offline', r.delivered ? '' : 'err'); } }, icon('eye'), 'Identify'),
        h('button', { class: 'btn sm', onclick: async () => { const r = await api(`/displays/${d.id}/reload`, { method: 'POST' }); toast(r.delivered ? 'Reloading player…' : 'Display is offline', r.delivered ? '' : 'err'); } }, icon('refresh'), 'Reload'),
        isApp(d) ? h('button', { class: 'btn sm', title: 'Take a screenshot of this screen', onclick: async () => { const r = await api(`/displays/${d.id}/screenshot`, { method: 'POST' }); toast(r.delivered ? 'Screenshot requested — it appears in a few seconds' : 'Display is offline', r.delivered ? '' : 'err'); } }, '📷') : null,
        h('a', { class: 'btn sm ghost', href: '#/schedule', onclick: () => { state.calDisplay = d.id; } }, icon('schedule'), 'Schedule')));
  }

  function displayDialog(d) {
    const s = JSON.parse(JSON.stringify(d));
    s.ticker = Object.assign({ enabled: false, text: '', speed: 60, bg: '#111827', fg: '#ffffff' }, s.ticker || {});
    const groups = [...new Set(state.displays.map((x) => x.group).filter(Boolean))];
    const tickerBox = h('div', { class: 'stack' },
      h('label', { class: 'field' }, 'Ticker text', h('span', { class: 'hint' }, 'Each line becomes a separate message'), h('textarea', { rows: 3, oninput: (e) => (s.ticker.text = e.target.value) }, s.ticker.text)),
      h('div', { class: 'row wrap', style: { gap: '16px' } },
        h('label', { class: 'row small' }, 'Speed', segmented([[35, 'Slow'], [60, 'Normal'], [110, 'Fast']], [35, 60, 110].includes(s.ticker.speed) ? s.ticker.speed : 60, (v) => (s.ticker.speed = v))),
        h('label', { class: 'row small' }, 'Background', h('input', { type: 'color', value: s.ticker.bg, oninput: (e) => (s.ticker.bg = e.target.value) })),
        h('label', { class: 'row small' }, 'Text', h('input', { type: 'color', value: s.ticker.fg, oninput: (e) => (s.ticker.fg = e.target.value) }))));
    tickerBox.hidden = !s.ticker.enabled;
    modal({
      title: `Display settings — ${d.name}`,
      body: [
        h('div', { class: 'grid2' },
          h('label', { class: 'field' }, 'Name', h('input', { value: s.name, oninput: (e) => (s.name = e.target.value) })),
          h('label', { class: 'field' }, 'Group', h('input', { value: s.group || '', list: 'groups-list2', oninput: (e) => (s.group = e.target.value) }), h('datalist', { id: 'groups-list2' }, groups.map((g) => h('option', { value: g }))))),
        h('label', { class: 'field' }, 'Default playlist', h('span', { class: 'hint' }, 'Plays whenever nothing else is scheduled'), playlistSelect(s.defaultPlaylistId, (v) => (s.defaultPlaylistId = v))),
        h('div', { class: 'grid2' },
          h('div', { class: 'field' }, h('b', { class: 'small' }, 'Orientation'), segmented([['landscape', 'Landscape'], ['portrait-left', 'Portrait ⟲'], ['portrait-right', 'Portrait ⟳']], s.orientation || 'landscape', (v) => (s.orientation = v))),
          h('div', { class: 'field' }, h('b', { class: 'small' }, 'Image fit'), segmented([['contain', 'Fit (black bars)'], ['cover', 'Fill (crop)']], s.fit || 'contain', (v) => (s.fit = v)))),
        h('div', { class: 'row wrap', style: { gap: '20px' } },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!s.showClock, onchange: (e) => (s.showClock = e.target.checked) }), 'Show clock'),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.ticker.enabled, onchange: (e) => { s.ticker.enabled = e.target.checked; tickerBox.hidden = !e.target.checked; } }), 'Show news ticker'),
          h('label', { class: 'row small' }, 'Background', h('input', { type: 'color', value: s.background || '#000000', oninput: (e) => (s.background = e.target.value) }))),
        tickerBox,
        h('label', { class: 'field' }, 'Notes', h('input', { value: s.notes || '', placeholder: 'Location, hardware, contact…', oninput: (e) => (s.notes = e.target.value) })),
      ],
      footer: (close) => [
        h('button', { class: 'btn danger', onclick: async () => {
          if (!(await confirmBox('Remove display?', `“${d.name}” will be disconnected and show a new pairing code.`, 'Remove'))) return;
          await api(`/displays/${d.id}`, { method: 'DELETE' }); close(); await loadAll(); renderPage();
        } }, icon('trash'), 'Remove'),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn', onclick: close }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: async () => {
          await api(`/displays/${d.id}`, { method: 'PATCH', body: { name: s.name, group: s.group, defaultPlaylistId: s.defaultPlaylistId, orientation: s.orientation, fit: s.fit, showClock: s.showClock, ticker: s.ticker, background: s.background, notes: s.notes } });
          close(); toast('Saved — the screen updates in a moment', 'ok'); await loadAll(); renderPage();
        } }, 'Save'),
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  function rolloutCard(o) {
    const server = (o.serverUrls || [])[0] || location.origin;
    const json = () => JSON.stringify({ server, provisioningKey: o.provisioningKey, group: 'Reception', playlist: state.playlists[0]?.name || 'Main' }, null, 2);
    const pre = h('pre', { class: 'urlbox', style: { whiteSpace: 'pre', overflowX: 'auto', margin: 0 } }, json());
    return h('div', { class: 'card pad stack' }, h('h2', {}, 'Roll out the Player app'),
      h('p', { class: 'muted', style: { margin: 0 } }, 'Install KevCast Player on each screen. On the same network it finds this server automatically and shows a pairing code. To deploy many screens without pairing (GPO, Intune, MDM, Ansible…), also place this file on each device:'),
      h('div', { class: 'small' },
        h('div', {}, h('b', {}, 'Windows: '), h('code', {}, 'C:\\ProgramData\\KevCast\\player.json')),
        h('div', {}, h('b', {}, 'macOS: '), h('code', {}, '/Library/Application Support/KevCast/player.json')),
        h('div', {}, h('b', {}, 'Linux / Raspberry Pi: '), h('code', {}, '/etc/kevcast/player.json'))),
      pre,
      h('p', { class: 'muted small', style: { margin: 0 } }, 'Screens using the key are approved automatically, named after the device and put in the given group with the given default playlist. Keep the key private.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => { navigator.clipboard?.writeText(json()); toast('Copied'); } }, icon('copy'), 'Copy'),
        h('button', { class: 'btn sm danger', onclick: async () => {
          if (!(await confirmBox('Create a new key?', 'Screens already connected keep working. New installs need the new key.', 'New key'))) return;
          o.provisioningKey = (await api('/provisioning-key/rotate', { method: 'POST' })).provisioningKey;
          pre.textContent = json();
        } }, 'New key')));
  }

  function SettingsPage() {
    const o = state.overview;
    const org = h('input', { value: state.session.orgName });
    const cur = h('input', { type: 'password', autocomplete: 'current-password' });
    const nxt = h('input', { type: 'password', autocomplete: 'new-password' });
    const cap = (ok, label, hint) => h('div', { class: 'list-row' }, h('span', { class: `badge ${ok ? 'ok' : 'warn'}` }, ok ? 'OK' : 'Missing'), h('div', {}, h('b', {}, label), h('div', { class: 'muted small' }, ok ? ok : hint)));
    return [
      pageHead('Settings', null),
      h('div', { class: 'dash-cols', style: { marginTop: 0 } },
        h('div', { class: 'stack' },
          h('div', { class: 'card pad stack' }, h('h2', {}, 'General'),
            h('label', { class: 'field' }, 'Organisation name', h('span', { class: 'hint' }, 'Shown on idle screens'), org),
            h('div', {}, h('button', { class: 'btn primary', onclick: async () => { await api('/settings', { method: 'PATCH', body: { orgName: org.value } }); state.session.orgName = org.value; toast('Saved', 'ok'); } }, 'Save'))),
          h('div', { class: 'card pad stack' }, h('h2', {}, 'Change password'),
            h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Current password', cur), h('label', { class: 'field' }, 'New password', nxt)),
            h('div', {}, h('button', { class: 'btn', onclick: async () => {
              try { await api('/password', { method: 'POST', body: { current: cur.value, next: nxt.value } }); cur.value = nxt.value = ''; toast('Password changed', 'ok'); } catch (e) { toast(e.message, 'err'); }
            } }, 'Change password'))),
          h('div', { class: 'card pad stack' }, h('h2', {}, 'Connect a screen'),
            h('p', { class: 'muted', style: { margin: 0 } }, 'Open one of these addresses in the browser of the screen. For a kiosk setup see the install scripts in the install/player folder.'),
            (o.playerUrls.length ? o.playerUrls : [`${location.origin}/player/`]).map((u) => h('div', { class: 'urlbox' }, h('span', { style: { flex: 1 } }, u),
              h('button', { class: 'btn sm', onclick: () => { navigator.clipboard?.writeText(u); toast('Copied'); } }, icon('copy'))))),
        ),
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'section-head' }, h('h2', {}, 'Server')),
            cap(o.capabilities.libreoffice, 'LibreOffice (PowerPoint conversion)', 'Install LibreOffice on the server to convert .pptx files. Windows: winget install TheDocumentFoundation.LibreOffice · macOS: brew install --cask libreoffice · Linux: apt install libreoffice-impress'),
            cap(o.capabilities.pdftoppm || o.capabilities.ghostscript, 'Slide renderer (Poppler / Ghostscript)', 'Windows: winget install oschwartz10612.Poppler · macOS: brew install poppler · Linux: apt install poppler-utils'),
            h('div', { class: 'list-row' }, h('dl', { class: 'kv' }, h('dt', {}, 'Version'), h('dd', {}, o.version), h('dt', {}, 'Platform'), h('dd', {}, o.platform), h('dt', {}, 'Data folder'), h('dd', { title: o.dataDir }, o.dataDir)))),
          rolloutCard(o),
          h('div', { class: 'card pad stack' }, h('h2', {}, 'Account'),
            h('div', { class: 'row wrap' },
              h('a', { class: 'btn', href: '/api/backup' }, 'Download backup (JSON)'),
              h('button', { class: 'btn danger', onclick: async () => { await api('/logout', { method: 'POST' }); state.session.user = null; render(); } }, 'Sign out'))))),
    ];
  }

  start().catch((e) => {
    document.getElementById('app').replaceChildren(h('div', { class: 'auth-wrap' }, h('div', { class: 'card pad' }, 'Could not reach the KevCast server: ', e.message)));
  });
})();
