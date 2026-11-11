/* KevCast admin — dependency-free single page app. */
(function () {
  'use strict';
  // Translations (shared/i18n.js): t(text, vars) and tn(count, singular, plural, vars). Dates follow the chosen language.
  const { t, tn } = window.KevI18n;
  const LOCALE = window.KevI18n.locale();

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
    user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/>',
    weather: '<path d="M6.5 19A4.5 4.5 0 0 1 6 10.03 6 6 0 0 1 17.6 8.5 4.5 4.5 0 1 1 17.5 19z"/>',
    traffic: '<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11a2 2 0 0 1 2 2v4h-2v2h-2v-2H7v2H5v-2H3v-4a2 2 0 0 1 2-2zm2.1 0h9.8l-1.1-3.4a.5.5 0 0 0-.5-.6H8.7a.5.5 0 0 0-.5.4zM6.5 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>',
    check: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
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
    group: '<path d="M4 5h7v6H4zm9 0h7v6h-7zM4 13h7v6H4zm9 0h7v6h-7z"/>',
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
    if (!res.ok) throw new Error(data.error ? t(data.error) : t('Request failed ({status})', { status: res.status }));
    return data;
  }

  const fmtSize = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
  const fmtDur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60 ? (s % 60) + 's' : ''}` : `${s}s`);
  const ago = (iso) => {
    if (!iso) return t('never');
    const s = Math.round((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return t('just now');
    if (s < 3600) return t('{v} min ago', { v: Math.floor(s / 60) });
    if (s < 86400) return t('{v} h ago', { v: Math.floor(s / 3600) });
    return new Date(iso).toLocaleDateString(LOCALE);
  };
  const DAYS = [t('Sun'), t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat')];
  const TYPE_LABEL = { image: t('Image'), video: t('Video'), presentation: t('PowerPoint'), web: t('Web page'), text: t('Text'), weather: t('Weather'), traffic: t('Traffic') };

  // ---------------------------------------------------------------------------
  // State + data loading
  // ---------------------------------------------------------------------------
  const state = {
    session: null,
    media: [],
    playlists: [],
    schedules: [],
    displays: [],
    groups: [],
    overview: null,
    uploads: [],
    mediaFilter: 'all',
    mediaSearch: '',
    calWeekOffset: 0,
    calDisplay: '',
    busy: false, // true while the user is dragging/editing something we must not re-render
  };

  async function loadAll() {
    const [media, playlists, schedules, displays, overview, groups, users] = await Promise.all([
      api('/media'), api('/playlists'), api('/schedules'), api('/displays'), api('/overview'), api('/groups'),
      isAdmin() ? api('/users') : [],
    ]);
    Object.assign(state, { media, playlists, schedules, displays, overview, groups, users });
  }

  const isAdmin = () => state.session?.user?.role === 'admin';
  // A playlist named like a group (ignoring case) plays on that group when nothing is scheduled.
  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const groupPlaylistFor = (groupName) => state.playlists.find((p) => sameName(p.name, groupName)) || null;
  const groupsForPlaylist = (p) => state.groups.filter((g) => sameName(g.name, p.name));
  /** A stand-in "display" for a whole group, for the schedule views. */
  const groupTarget = (name) => ({ id: '__group', name, groups: [name], defaultPlaylistId: groupPlaylistFor(name)?.id || null });
  /** A display as the schedule code should see it: with its group playlist as the default. */
  const asScheduled = (d) => d && { ...d, defaultPlaylistId: d.effectivePlaylistId ?? d.defaultPlaylistId };
  const ROLE_LABEL = { admin: t('Administrator'), editor: t('Editor') };
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
    ['dashboard', t('Dashboard'), 'dashboard'],
    ['media', t('Media'), 'media'],
    ['playlists', t('Playlists'), 'playlist'],
    ['schedule', t('Schedule'), 'schedule'],
    ['displays', t('Displays'), 'display'],
    ['groups', t('Groups'), 'group'],
    ['settings', t('Settings'), 'settings'],
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
          h('div', { class: 'sidebar-foot' },
            h('div', { class: 'sidebar-user', title: `${state.session.user.username} · ${ROLE_LABEL[state.session.user.role]}` }, icon('user'), state.session.user.name),
            `${state.session.orgName} · v${state.session.version}`)),
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
    if (b) { b.hidden = !pending; b.textContent = t('{pending} new', { pending: pending }); }
  }

  function renderPage(opts = {}) {
    const el = document.getElementById('page');
    if (!el) return;
    const { page, arg } = route();
    const scroll = window.scrollY;
    const view = { dashboard: Dashboard, media: MediaPage, playlists: PlaylistsPage, schedule: SchedulePage, displays: DisplaysPage, groups: GroupsPage, settings: SettingsPage }[page];
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
      h('div', { class: 'modal-head' }, h('h2', {}, title), h('div', { class: 'spacer' }), h('button', { class: 'btn ghost sm', onclick: close, 'aria-label': t('Close') }, '✕')),
      h('div', { class: 'modal-body' }, body),
      footer ? h('div', { class: 'modal-foot' }, typeof footer === 'function' ? footer(close) : footer) : null);
    back.append(m);
    document.body.append(back);
    setTimeout(() => m.querySelector('input:not([type=checkbox]):not([type=color]), select, textarea')?.focus(), 30);
    return close;
  }

  function confirmBox(title, text, okLabel = t('Delete')) {
    return new Promise((resolve) => {
      let ok = false;
      modal({
        title,
        body: h('p', {}, text),
        onClose: () => resolve(ok),
        footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
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
    const org = h('input', { placeholder: t('e.g. Acme Reception') });
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
        h('h2', {}, setup ? t('Welcome! Let’s set up your server') : t('Sign in')),
        setup ? h('p', { class: 'muted' }, t('Create the first administrator account. You can add more users later in Settings → Users.')) : null,
        setup ? h('label', { class: 'field' }, t('Organisation name'), org) : null,
        h('label', { class: 'field' }, t('Username'), user),
        h('label', { class: 'field' }, setup ? t('Choose a password') : t('Password'), setup ? h('span', { class: 'hint' }, t('At least 6 characters')) : null, pass),
        err,
        h('button', { class: 'btn primary', type: 'submit' }, setup ? t('Create account & continue') : t('Sign in'))));
  }

  // ---------------------------------------------------------------------------
  // Shared media visuals
  // ---------------------------------------------------------------------------
  function mediaThumb(m, small) {
    const tx = h('div', { class: 'thumb' });
    if (!m) { tx.append(icon('media')); return tx; }
    if (m.status === 'processing') tx.append(h('div', { class: 'spinner' }));
    else if (m.status === 'error') tx.append(h('span', { class: 'badge err' }, t('Failed')));
    else if (m.thumb) tx.append(h('img', { src: m.thumb, loading: 'lazy', alt: '' }));
    else if (m.type === 'video') tx.append(h('video', { src: m.url + '#t=1', muted: true, preload: 'metadata' }));
    else if (m.type === 'text') {
      const x = m.text || {};
      tx.append(h('div', { class: 'text-thumb', style: { background: x.bg2 ? `linear-gradient(135deg, ${x.bg}, ${x.bg2})` : x.bg || '#1e1b4b', color: x.fg || '#fff' } },
        h('b', {}, x.title || ''), small ? null : h('span', {}, (x.body || '').slice(0, 80))));
    } else if (m.type === 'weather' || m.type === 'traffic') {
      tx.append(h('div', { class: `live-thumb ${m.type}` }, icon(m.type), h('b', {}, m.place?.name || '')));
    } else tx.append(icon(m.type === 'web' ? 'web' : 'media'));
    if (!small) {
      tx.append(h('span', { class: 'badge ov' }, TYPE_LABEL[m.type] || m.type));
      if (m.type === 'presentation' && m.slides) tx.append(h('span', { class: 'ov-r' }, t('{n} slides', { n: m.slides.length })));
    }
    return tx;
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
    return fmtDur(secs) + (unknown ? t(' + videos') : '');
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  function Dashboard() {
    const o = state.overview;
    const displays = state.displays.filter((d) => d.approved);
    const steps = [
      [t('Upload content'), t('Images, videos, PowerPoint or PDF'), '#/media', state.media.length > 0],
      [t('Build a playlist'), t('Put your content in order'), '#/playlists', state.playlists.some((p) => p.items.length)],
      [t('Connect a screen'), t('Open the player on any TV or PC'), '#/displays', displays.length > 0],
      [t('Schedule it'), t('Choose what plays when'), '#/schedule', state.schedules.length > 0 || displays.some((d) => d.defaultPlaylistId)],
    ];
    const allDone = steps.every((s) => s[3]);
    const warnings = [];
    if (o && !o.capabilities.powerpoint) warnings.push(t('LibreOffice was not found on the server, so PowerPoint files can’t be converted yet. See Settings → Server for how to install it.'));
    else if (o && !o.capabilities.pdf) warnings.push(t('No PDF renderer (Poppler or Ghostscript) found on the server. PowerPoint/PDF slides can’t be rendered yet. See Settings → Server.'));

    return [
      pageHead(t('Welcome to {orgName}', { orgName: state.session.orgName }), t('Here’s what is happening on your screens.'),
        h('a', { class: 'btn primary', href: '#/media' }, icon('upload'), t('Upload content'))),
      ...warnings.map((w) => h('div', { class: 'alert' }, w)),
      h('div', { class: 'stats' },
        stat(`${o.counts.online}/${o.counts.displays}`, t('Screens online'), '#/displays'),
        stat(state.media.length, t('Media files'), '#/media'),
        stat(state.playlists.length, t('Playlists'), '#/playlists'),
        stat(state.schedules.filter((s) => s.enabled !== false).length, t('Active schedules'), '#/schedule')),
      allDone ? null : h('div', { class: 'card pad', style: { marginBottom: '16px' } },
        h('h2', { style: { marginBottom: '12px' } }, t('Get started in 4 steps')),
        h('div', { class: 'steps' }, steps.map(([t, s, href, done], i) =>
          h('a', { class: `step ${done ? 'done' : ''}`, href }, h('div', { class: 'n' }, done ? '✓' : i + 1), h('div', {}, h('b', {}, t), h('span', { class: 'muted small' }, s)))))),
      h('div', { class: 'dash-cols' },
        h('div', { class: 'card' },
          h('div', { class: 'section-head' }, h('h2', {}, t('Screens')), h('div', { class: 'spacer' }), h('a', { class: 'btn sm', href: '#/displays' }, t('Manage'))),
          displays.length ? displays.map((d) => {
            const pl = d.scheduledMediaId || d.scheduledPlaylistId ? contentInfo(d.scheduledMediaId ? `media:${d.scheduledMediaId}` : d.scheduledPlaylistId) : null;
            return h('div', { class: 'list-row' },
              h('span', { class: `dot ${d.online ? 'on' : ''}` }),
              h('div', { style: { minWidth: 0 } }, h('b', {}, d.name), h('div', { class: 'muted small' }, d.online ? (d.nowPlaying ? t('Showing: {name}{v}', { name: d.nowPlaying.name, v: d.nowPlaying.slides ? t(' (slide {slide}/{slides})', { slide: d.nowPlaying.slide, slides: d.nowPlaying.slides }) : '' }) : t('Online')) : t('Offline · last seen {v}', { v: ago(d.lastSeen) }))),
              h('div', { class: 'spacer' }),
              pl ? h('span', { class: 'row small' }, h('span', { class: 'swatch', style: { background: pl.color } }), pl.name) : h('span', { class: 'muted small' }, t('Nothing scheduled')));
          }) : h('div', { class: 'empty' }, h('h3', {}, t('No screens yet')), h('p', {}, t('Open the player on a TV, PC or Raspberry Pi to connect it.')), h('a', { class: 'btn primary', href: '#/displays' }, t('Add a display')))),
        h('div', { class: 'card' },
          h('div', { class: 'section-head' }, h('h2', {}, t('Recent uploads'))),
          state.media.length ? [...state.media].reverse().slice(0, 6).map((m) =>
            h('div', { class: 'list-row' }, h('div', { style: { width: '64px' } }, mediaThumb(m, true)), h('div', { style: { minWidth: 0 } }, h('b', { class: 'small' }, m.name), h('div', { class: 'muted small' }, TYPE_LABEL[m.type], m.status === 'processing' ? t(' · converting…') : '')))) :
            h('div', { class: 'empty' }, h('p', {}, t('Nothing uploaded yet.'))))),
    ];
  }
  function stat(num, lbl, href) {
    return h('a', { class: 'card stat', href, style: { textDecoration: 'none', color: 'inherit' } }, h('div', { class: 'num' }, num), h('div', { class: 'lbl' }, lbl));
  }

  // ---------------------------------------------------------------------------
  // Media library
  // ---------------------------------------------------------------------------
  const ACCEPT = 'image/*,video/*,.pdf,.ppt,.pptx,.pps,.ppsx,.pot,.potx,.odp,.key';

  // Inside KevCast Studio the page gets `window.kevcastStudio` (desktop/studio/preload.js):
  // native file dialog, local folder browsing and uploads streamed from disk.
  const studio = window.kevcastStudio || null;

  /** Choose files to upload. opts.addTo = a playlist to add the uploaded items to. */
  function pickFiles(opts = {}) {
    if (studio) {
      studio.pickFiles().then((files) => { if (files.length) uploadLocal(files.map((f) => f.path), opts); });
      return;
    }
    const inp = h('input', { type: 'file', multiple: true, accept: ACCEPT });
    inp.onchange = () => uploadFiles([...inp.files], opts);
    inp.click();
  }
  window.__kevcastPickFiles = () => pickFiles();

  /** After uploading: refresh, and add the new items to a playlist when asked. */
  async function afterUpload(created, opts) {
    state.media = await api('/media');
    if (opts.addTo && created.length) {
      const p = byId(state.playlists, opts.addTo.id) || opts.addTo;
      p.items.push(...created.map((m) => ({ mediaId: m.id, duration: 0, enabled: true })));
      const saved = await api(`/playlists/${p.id}`, { method: 'PUT', body: { items: p.items } });
      p.items = saved.items;
      toast(tn(created.length, 'Added {n} item to “{name}”', 'Added {n} items to “{name}”', { name: p.name }), 'ok');
    }
    if (['media', 'playlists'].includes(route().page)) renderPage({ soft: true });
  }

  function uploadFiles(files, opts = {}) {
    if (!files.length) return;
    // In KevCast Studio, let the app upload dropped files from disk (and convert PowerPoints when enabled).
    if (studio?.pathForFile) {
      const paths = files.map((f) => studio.pathForFile(f));
      if (paths.every(Boolean)) return uploadLocal(paths, opts);
    }
    if (!opts.addTo && route().page !== 'media') go('#/media');
    const created = [];
    let pending = files.length;
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
        if (xhr.status >= 400) u.error = res.error || t('Upload failed');
        else if (res.rejected?.length) u.error = t('This file type is not supported');
        else { created.push(...(res.created || [])); toast(t('Uploaded {name}{v}', { name: file.name, v: /\.(pptx?|ppsx?|potx?|odp|key|pdf)$/i.test(file.name) ? t(' — converting slides…') : '' }), 'ok'); }
        if (u.error) toast(`${file.name}: ${u.error}`, 'err');
        setTimeout(() => { state.uploads = state.uploads.filter((x) => x !== u); drawUploads(); }, u.error ? 5000 : 800);
        if (--pending === 0) afterUpload(created, opts); else { state.media = await api('/media'); if (route().page === 'media') renderPage({ soft: true }); }
      };
      xhr.onerror = () => { u.done = true; u.error = t('Network error'); drawUploads(); if (--pending === 0) afterUpload(created, opts); };
      xhr.send(fd);
    }
    drawUploads();
  }

  /** KevCast Studio: upload files from this computer by path (streamed by the app). */
  async function uploadLocal(paths, opts = {}) {
    if (!paths.length) return;
    if (!opts.addTo && route().page !== 'media') go('#/media');
    const rows = new Map(paths.map((p) => [p, { name: p.split(/[\\/]/).pop(), progress: 0, done: false, error: null }]));
    rows.forEach((u) => state.uploads.push(u));
    drawUploads();
    const off = studio.onUploadProgress((ev) => {
      const u = rows.get(ev.path);
      if (!u) return;
      u.progress = ev.size ? ev.loaded / ev.size : 1;
      u.converting = ev.status === 'converting';
      if (ev.warning) toast(`${u.name}: ${ev.warning}`, 'err');
      if (ev.status === 'done' && ev.convertedWith) { u.done = true; u.progress = 1; toast(t('Uploaded {name} — converted with PowerPoint on this computer', { name: u.name }), 'ok'); }
      else if (ev.status === 'done') { u.done = true; u.progress = 1; toast(t('Uploaded {name}{v}', { name: u.name, v: /\.(pptx?|ppsx?|potx?|odp|key|pdf)$/i.test(u.name) ? t(' — converting slides…') : '' }), 'ok'); }
      if (ev.status === 'error') { u.done = true; u.error = ev.error; toast(`${u.name}: ${ev.error}`, 'err'); }
      drawUploads();
    });
    let created = [];
    const me = state.session.user;
    const uploadOpts = { powerpoint: !!me.studio?.powerpoint, replaceFonts: me.studio?.replaceFonts !== false, fontReplacements: state.overview?.fontReplacements || [] };
    try { created = await studio.upload(paths, uploadOpts); } catch (e) { toast(e.message, 'err'); }
    off();
    setTimeout(() => { state.uploads = state.uploads.filter((x) => ![...rows.values()].includes(x) || x.error); drawUploads(); }, 900);
    setTimeout(() => { state.uploads = state.uploads.filter((x) => ![...rows.values()].includes(x)); drawUploads(); }, 6000);
    await afterUpload(created, opts);
    if (state.local) state.local.selected.clear();
  }

  // --- "This computer" panel (KevCast Studio only) -------------------------------
  const FILE_ICON = { presentation: 'presentation', image: 'image', video: 'video' };
  function localPanel() {
    const L = state.local || (state.local = { open: true, dir: null, listing: null, places: null, selected: new Set(), loading: false });
    const box = h('div', { class: 'card local' });
    const fmtDate = (ms) => new Date(ms).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
    const uploaded = (f) => state.media.some((m) => m.originalName === f.name && m.size === f.size);
    const open = async (dir) => {
      L.loading = true; draw();
      const r = await studio.list(dir);
      L.loading = false;
      if (r.error) { toast(r.error, 'err'); draw(); return; }
      L.dir = r.path; L.listing = r; L.selected.clear();
      studio.rememberFolder(r.path);
      draw();
    };
    const draw = () => {
      if (!L.open) {
        box.replaceChildren(h('div', { class: 'section-head' }, icon('display'), h('h3', {}, t('This computer')), h('div', { class: 'spacer' }),
          h('button', { class: 'btn sm', onclick: () => pickFiles() }, icon('upload'), t('Browse…')),
          h('button', { class: 'btn sm ghost', onclick: () => { L.open = true; draw(); } }, t('Show'))));
        return;
      }
      const lst = L.listing;
      const places = L.places || { places: [], recent: [] };
      const crumbs = lst ? lst.path.split(/[\\/]/).filter(Boolean) : [];
      const sep = lst && lst.path.includes('\\') ? '\\' : '/';
      const sel = [...L.selected];
      box.replaceChildren(
        h('div', { class: 'section-head' }, icon('display'), h('h3', {}, t('This computer')),
          h('span', { class: 'muted small' }, t('Pick PowerPoints, PDFs, images and videos from your computer')),
          h('div', { class: 'spacer' }),
          h('button', { class: 'btn sm', onclick: () => pickFiles() }, icon('upload'), t('Browse…')),
          h('button', { class: 'btn sm ghost', onclick: () => { L.open = false; draw(); } }, t('Hide'))),
        state.session.user.studio?.powerpoint && L.caps ? h('div', { class: `ppt-note small ${L.caps.powerpoint ? 'on' : ''}` }, icon('presentation'), L.caps.powerpoint
          ? t('PowerPoint files are converted to PDF with PowerPoint on this computer before uploading.')
          : t('PowerPoint isn’t installed on this computer, so the server converts PowerPoint files.')) : null,
        h('div', { class: 'local-body' },
          h('div', { class: 'local-places' },
            places.places.map((p) => h('button', { class: `local-place ${lst && lst.path === p.path ? 'on' : ''}`, onclick: () => open(p.path) }, p.label)),
            places.recent.length ? [h('div', { class: 'muted small', style: { margin: '10px 10px 4px' } }, t('Recent folders')),
              places.recent.map((p) => h('button', { class: `local-place ${lst && lst.path === p.path ? 'on' : ''}`, title: p.path, onclick: () => open(p.path) }, p.label))] : null,
            h('button', { class: 'local-place', onclick: async () => { const d = await studio.pickFolder(); if (d) open(d); } }, t('Other folder…'))),
          h('div', { class: 'local-main' },
            lst ? h('div', { class: 'local-crumbs' },
              h('button', { class: 'btn sm icon', title: t('Up one folder'), disabled: !lst.parent, onclick: () => open(lst.parent) }, icon('left')),
              h('span', { class: 'small', title: lst.path }, crumbs.slice(-3).join(` ${sep === '/' ? '›' : '›'} `) || lst.path)) : null,
            L.loading ? h('div', { class: 'empty small' }, t('Loading…')) : !lst ? h('div', { class: 'empty small' }, t('Pick a folder on the left.')) :
              h('div', { class: 'local-list' },
                lst.dirs.map((d) => h('div', { class: 'local-row dir', ondblclick: () => open(d.path), onclick: () => open(d.path) },
                  h('span', { class: 'local-ico' }, '📁'), h('span', { class: 'local-name' }, d.name))),
                lst.files.map((f) => h('label', { class: `local-row ${L.selected.has(f.path) ? 'picked' : ''}`, ondblclick: () => uploadLocal([f.path]) },
                  h('input', { type: 'checkbox', checked: L.selected.has(f.path), onchange: (e) => { e.target.checked ? L.selected.add(f.path) : L.selected.delete(f.path); draw(); } }),
                  h('span', { class: 'local-ico' }, icon(FILE_ICON[f.type] || 'media')),
                  h('span', { class: 'local-name', title: f.path }, f.name),
                  uploaded(f) ? h('span', { class: 'badge ok' }, t('Uploaded')) : null,
                  h('span', { class: 'muted small' }, fmtSize(f.size)),
                  h('span', { class: 'muted small', style: { minWidth: '92px', textAlign: 'right' } }, fmtDate(f.mtime)))),
                !lst.dirs.length && !lst.files.length ? h('div', { class: 'empty small' }, t('No PowerPoints, PDFs, images or videos in this folder.')) : null),
            h('div', { class: 'local-foot' },
              h('span', { class: 'muted small' }, lst ? tn(lst.files.length, '{n} file · double-click a file to upload it straight away', '{n} files · double-click a file to upload it straight away') : ''),
              h('div', { class: 'spacer' }),
              lst && lst.files.length ? h('button', { class: 'btn sm ghost', onclick: () => { lst.files.forEach((f) => L.selected.add(f.path)); draw(); } }, t('Select all')) : null,
              h('button', { class: 'btn primary sm', disabled: !sel.length, onclick: () => uploadLocal(sel) }, icon('upload'), sel.length ? tn(sel.length, 'Upload {n} file', 'Upload {n} files') : t('Upload'))))));
    };
    draw();
    if (!L.places) {
      studio.places().then((p) => { L.places = p; if (!L.dir) open(p.lastFolder); else draw(); });
      if (studio.capabilities && !L.caps) studio.capabilities().then((c) => { L.caps = c; draw(); }).catch(() => {});
    }
    return box;
  }

  function drawUploads() {
    const box = document.getElementById('uploads');
    if (!box) return;
    box.replaceChildren(...state.uploads.map((u) => h('div', { class: 'card upload-row' },
      h('b', { class: 'small', style: { minWidth: '160px' } }, u.name),
      h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round(u.progress * 100)}%`, background: u.error ? 'var(--danger)' : '' } })),
      h('span', { class: 'small muted' }, u.error ? u.error : u.done ? t('Done') : u.converting ? t('Converting with PowerPoint…') : `${Math.round(u.progress * 100)}%`))));
  }

  // Drag files anywhere on the page to upload.
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!state.session?.user || !e.dataTransfer?.types?.includes('Files')) return;
    dragDepth++;
    if (!document.querySelector('.drop-overlay')) document.body.append(h('div', { class: 'drop-overlay' }, t('Drop files to upload')));
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

  const selectedMedia = new Set();
  /** Delete media items after one confirmation. */
  async function deleteMedia(list) {
    if (!list.length) return false;
    const used = list.filter((m) => state.playlists.some((p) => p.items.some((i) => i.mediaId === m.id))).length;
    const title = list.length === 1 ? t('Delete “{name}”?', { name: list[0].name }) : t('Delete {n} items?', { n: list.length });
    const text = list.length === 1
      ? (used ? t('It will be removed from the library, from the playlists that use it and from all screens. This can’t be undone.') : t('It will be removed from the library and from all screens. This can’t be undone.'))
      : (used ? t('They will be removed from the library, from every playlist that uses them and from all screens. This can’t be undone.') : t('They will be removed from the library and from all screens. This can’t be undone.'));
    if (!(await confirmBox(title, text))) return false;
    for (const m of list) {
      try { await api(`/media/${m.id}`, { method: 'DELETE' }); selectedMedia.delete(m.id); } catch (e) { toast(e.message, 'err'); }
    }
    toast(list.length === 1 ? t('Deleted') : t('{n} items deleted', { n: list.length }));
    await loadAll(); renderPage({ soft: true });
    return true;
  }

  const FONT_HELP = t('Install the font on the server “for all users” (Windows: right-click the font file → Install for all users; Linux: copy it to /usr/local/share/fonts and run fc-cache -f), then click Re-convert. Fonts installed only for your own account are invisible to the KevCast service.');
  function fontsAlert() {
    const affected = state.media.filter((m) => m.type === 'presentation' && m.status === 'ready' && m.missingFonts?.length);
    if (!affected.length) return null;
    const names = [...new Set(affected.flatMap((m) => m.missingFonts))].sort();
    return h('div', { class: 'alert', style: { marginBottom: '12px' } },
      h('b', {}, tn(affected.length, '{n} presentation uses fonts that aren’t installed on the server:', '{n} presentations use fonts that aren’t installed on the server:')), ' ', names.join(', '), '. ',
      t('The slides were made with a replacement font, so text can look different or be misplaced. '), FONT_HELP, ' ',
      h('button', { class: 'btn sm', onclick: async () => {
        const r = await api('/media/reconvert-all', { method: 'POST', body: { onlyMissingFonts: true } });
        toast(tn(r.count, 'Converting {n} presentation again…', 'Converting {n} presentations again…')); await loadAll(); renderPage({ soft: true });
      } }, icon('refresh'), t('Re-convert these')), ' ',
      h('button', { class: 'btn sm', title: t('Converts these presentations again with Arial for all text'), onclick: async () => {
        const r = await api('/media/reconvert-all', { method: 'POST', body: { onlyMissingFonts: true, fontMode: 'arial' } });
        toast(tn(r.count, 'Converting {n} presentation again…', 'Converting {n} presentations again…')); await loadAll(); renderPage({ soft: true });
      } }, t('Use Arial for these')));
  }

  /** Font options of one PowerPoint: Arial for all text, or replace one font everywhere (administrators). */
  function fontsSection(m, close) {
    const ooxml = /\.(pptx|potx|ppsx|pptm)$/i.test(m.file || '');
    if (m.type !== 'presentation' || !ooxml) return null;
    const used = (m.fontsUsed || []).filter((f) => !/^\+/.test(f));
    const reps = state.overview?.fontReplacements || [];
    const repOf = (f) => reps.find((r) => r.from.toLowerCase() === f.toLowerCase());
    const mode = m.fontMode === 'arial' ? 'arial' : 'auto';
    const setMode = async (v) => {
      await api(`/media/${m.id}`, { method: 'PATCH', body: { fontMode: v } });
      close(); toast(t('Converting again…')); await loadAll(); renderPage({ soft: true });
    };
    return h('div', { class: 'fonts-box stack' },
      h('div', { class: 'row wrap' },
        h('b', {}, t('Fonts')),
        h('div', { class: 'spacer' }),
        segmented([['auto', t('As in the file')], ['arial', t('Arial for all text')]], mode, setMode)),
      h('div', { class: 'muted small' }, t('Text garbled, chopped up or in the wrong place? Choose “Arial for all text”, or replace just the font that goes wrong.')),
      used.length && mode === 'auto' ? h('div', { class: 'font-list' }, used.map((f) => {
        const r = repOf(f);
        const missing = (m.missingFonts || []).includes(f);
        return h('div', { class: 'font-row' },
          h('span', { class: 'font-name' }, f),
          r ? h('span', { class: 'badge' }, t('→ {font} on every slide', { font: r.to })) : missing ? h('span', { class: 'badge warn' }, t('Missing on the server')) : h('span', { class: 'badge ok' }, t('Installed')),
          (m.embeddedFonts || []).some((e) => e.toLowerCase() === f.toLowerCase()) ? h('span', { class: 'badge', title: t('PowerPoint saved a copy of this font in the file') }, t('Embedded')) : null,
          h('div', { class: 'spacer' }),
          isAdmin() ? h('button', { class: 'btn sm', title: r ? t('Use the font itself again') : t('Applies to every presentation that uses this font') , onclick: async () => {
            const list = r ? reps.filter((x) => x !== r) : [...reps, { from: f, to: 'Arial' }];
            const res = await api('/font-replacements', { method: 'PUT', body: list });
            close();
            toast(r ? t('“{font}” is used again', { font: f }) : t('“{font}” is replaced by Arial in every presentation', { font: f }), 'ok');
            if (res.reconverting) toast(tn(res.reconverting, 'Converting {n} presentation again…', 'Converting {n} presentations again…'));
            await loadAll(); renderPage({ soft: true });
          } }, r ? t('Use the font again') : t('Replace with Arial')) : null);
      })) : null);
  }

  function MediaPage() {
    const filters = [['all', t('All')], ['image', t('Images')], ['video', t('Videos')], ['presentation', t('PowerPoint & PDF')], ['web', t('Web pages')], ['text', t('Text')], ['live', t('Weather & traffic')]];
    const q = state.mediaSearch.toLowerCase();
    const list = state.media.filter((m) => (state.mediaFilter === 'all' || m.type === state.mediaFilter || (state.mediaFilter === 'live' && ['weather', 'traffic'].includes(m.type))) && (!q || m.name.toLowerCase().includes(q))).reverse();
    const search = h('input', { type: 'search', placeholder: t('Search media…'), value: state.mediaSearch,
      oninput: (e) => { state.mediaSearch = e.target.value; const pos = e.target.selectionStart; renderPage({ soft: true }); const s = document.querySelector('.toolbar input[type=search]'); s.focus(); s.setSelectionRange(pos, pos); } });
    setTimeout(drawUploads);
    for (const id of [...selectedMedia]) if (!byId(state.media, id)) selectedMedia.delete(id);
    const toggle = (m) => { selectedMedia.has(m.id) ? selectedMedia.delete(m.id) : selectedMedia.add(m.id); renderPage({ soft: true }); };
    const selectionBar = () => selectedMedia.size ? h('div', { class: 'bulk-bar card' },
      h('b', {}, t('{size} selected', { size: selectedMedia.size })),
      h('button', { class: 'btn sm', onclick: () => { list.forEach((m) => selectedMedia.add(m.id)); renderPage({ soft: true }); } }, t('Select all {n}', { n: list.length })),
      h('button', { class: 'btn sm danger', onclick: () => deleteMedia(state.media.filter((m) => selectedMedia.has(m.id))) }, icon('trash'), t('Delete')),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn sm ghost', onclick: () => { selectedMedia.clear(); renderPage({ soft: true }); } }, t('Clear'))) : null;
    return [
      pageHead(t('Media'), t('Everything you can show on a screen.'),
        h('button', { class: 'btn', onclick: () => webDialog() }, icon('web'), t('Web page')),
        h('button', { class: 'btn', onclick: () => textDialog() }, icon('text'), t('Text slide')),
        h('button', { class: 'btn', onclick: () => liveDialog('weather') }, icon('weather'), t('Weather')),
        h('button', { class: 'btn', onclick: () => liveDialog('traffic') }, icon('traffic'), t('Traffic')),
        h('button', { class: 'btn primary', onclick: () => pickFiles() }, icon('upload'), t('Upload files'))),
      h('div', { class: 'dropzone', onclick: () => pickFiles() },
        h('b', {}, t('Drag & drop files here')), t(' or click to browse'), h('br'),
        h('span', { class: 'small' }, t('PowerPoint (.pptx, .ppt, .ppsx), PDF, images (JPG, PNG, GIF, WebP, SVG) and videos (MP4, WebM)'))),
      studio ? localPanel() : null,
      h('div', { id: 'uploads', class: 'uploads' }),
      h('div', { class: 'toolbar' },
        h('div', { class: 'chips' }, filters.map(([id, label]) => h('button', { class: `chip ${state.mediaFilter === id ? 'on' : ''}`, onclick: () => { state.mediaFilter = id; renderPage(); } }, label))),
        h('div', { class: 'spacer' }), search),
      fontsAlert(),
      selectionBar(),
      list.length ? h('div', { class: `media-grid ${selectedMedia.size ? 'selecting' : ''}` }, list.map((m) =>
        h('div', { class: `card media-card ${selectedMedia.has(m.id) ? 'picked' : ''}`, onclick: () => (selectedMedia.size ? toggle(m) : mediaDialog(m)) },
          h('label', { class: 'card-check', title: t('Select'), onclick: (e) => e.stopPropagation() },
            h('input', { type: 'checkbox', checked: selectedMedia.has(m.id), onchange: () => toggle(m) })),
          h('button', { class: 'card-del', title: t('Delete'), 'aria-label': t('Delete {name}', { name: m.name }), onclick: (e) => { e.stopPropagation(); deleteMedia([m]); } }, icon('trash')),
          mediaThumb(m),
          h('div', { class: 'media-meta' }, h('div', { class: 'name', title: m.name }, m.name),
            m.missingFonts?.length && m.status === 'ready'
              ? h('div', { class: 'small', style: { color: 'var(--warn)', fontWeight: 600 }, title: m.missingFonts.join(', ') }, tn(m.missingFonts.length, '⚠ {n} font missing on the server', '⚠ {n} fonts missing on the server'))
              : h('div', { class: 'muted small' }, m.status === 'processing' ? t('Converting slides…') : m.status === 'error' ? t('Conversion failed — click for details') : m.size ? fmtSize(m.size) : m.type === 'web' ? m.url : TYPE_LABEL[m.type]))))) :
        h('div', { class: 'card empty' }, h('h3', {}, state.media.length ? t('No matches') : t('Your media library is empty')), h('p', {}, t('Upload a PowerPoint, some photos or a video to get started.'))),
    ];
  }

  function addToPlaylistControl(m) {
    const sel = h('select', {}, h('option', { value: '' }, t('Add to playlist…')), state.playlists.map((p) => h('option', { value: p.id }, p.name)), h('option', { value: '__new' }, t('+ New playlist')));
    sel.onchange = async () => {
      let pid = sel.value;
      if (!pid) return;
      if (pid === '__new') pid = (await api('/playlists', { method: 'POST', body: { name: m.name } })).id;
      const p = await api('/playlists').then((ps) => byId(ps, pid));
      p.items.push({ mediaId: m.id, duration: 0 });
      await api(`/playlists/${pid}`, { method: 'PUT', body: { items: p.items } });
      toast(t('Added to “{name}”', { name: p.name }), 'ok');
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
    else if (m.type === 'web') preview = h('iframe', { src: m.url, sandbox: 'allow-scripts allow-same-origin', referrerpolicy: 'no-referrer' });
    else if (m.type === 'weather' || m.type === 'traffic') preview = h('iframe', { src: `/widgets/${m.type}.html?id=${m.id}&lang=${window.KevI18n.lang}`, sandbox: 'allow-scripts allow-same-origin', class: 'widget-preview' });
    else if (m.type === 'text') preview = textPreview(m.text);
    const big = h('div', { class: 'preview-big' }, preview || (m.status === 'processing' ? h('div', { class: 'spinner' }) : icon('media')));
    const usedIn = state.playlists.filter((p) => p.items.some((i) => i.mediaId === m.id));
    let closeDialog = () => {};
    closeDialog = modal({
      title: TYPE_LABEL[m.type] || t('Media'),
      wide: true,
      body: [
        big,
        m.status === 'error' ? h('div', { class: 'alert' }, h('b', {}, t('Conversion failed: ')), t(m.error || '')) : null,
        m.missingFonts?.length && m.status === 'ready' ? h('div', { class: 'alert' }, h('b', {}, t('Missing on the server: {v}. ', { v: m.missingFonts.join(', ') })), t('These slides use a replacement font, so text can look different or be misplaced. '), FONT_HELP) : null,
        m.status === 'ready' ? fontsSection(m, () => closeDialog()) : null,
        m.convertedWith === 'PowerPoint' ? h('div', { class: 'muted small' }, icon('presentation'), ' ', m.sourceName
          ? t('Converted to PDF by PowerPoint on the uploader’s computer, from “{file}”.', { file: m.sourceName })
          : t('Converted to PDF by PowerPoint on the uploader’s computer.')) : null,
        m.slideUrls && m.slideUrls.length > 1 ? h('div', { class: 'slides-strip' }, m.slideUrls.map((u) => h('img', { src: u, loading: 'lazy', onclick: () => big.replaceChildren(h('img', { src: u })) }))) : null,
        h('label', { class: 'field' }, t('Name'), name),
        h('div', { class: 'muted small' },
          [m.originalName, m.size ? fmtSize(m.size) : null, m.slides ? t('{n} slides', { n: m.slides.length }) : null, t('Added {v}', { v: new Date(m.createdAt).toLocaleString(LOCALE) })].filter(Boolean).join(' · ')),
        h('div', { class: 'small' }, usedIn.length ? [t('Used in: '), usedIn.map((p, i) => [i ? ', ' : '', h('a', { href: `#/playlists/${p.id}` }, p.name)])] : h('span', { class: 'muted' }, t('Not used in any playlist yet.'))),
      ],
      footer: (close) => [
        h('button', { class: 'btn danger', onclick: async () => { if (await deleteMedia([m])) close(); } }, icon('trash'), t('Delete')),
        m.type === 'presentation' ? h('button', { class: 'btn', onclick: async () => { await api(`/media/${m.id}/reconvert`, { method: 'POST' }); close(); toast(t('Converting again…')); } }, icon('refresh'), t('Re-convert')) : null,
        m.type === 'text' ? h('button', { class: 'btn', onclick: () => { close(); textDialog(m); } }, t('Edit text')) : null,
        m.type === 'web' ? h('button', { class: 'btn', onclick: () => { close(); webDialog(m); } }, t('Edit web page')) : null,
        m.type === 'weather' ? h('button', { class: 'btn', onclick: () => { close(); liveDialog('weather', m); } }, t('Edit weather')) : null,
        m.type === 'traffic' ? h('button', { class: 'btn', onclick: () => { close(); liveDialog('traffic', m); } }, t('Edit traffic')) : null,
        h('button', { class: 'btn', title: t('Schedule this item on its own'), onclick: () => { close(); scheduleDialog({ mediaId: m.id }); } }, icon('schedule'), t('Schedule')),
        addToPlaylistControl(m),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn primary', onclick: async () => {
          if (name.value.trim() && name.value !== m.name) await api(`/media/${m.id}`, { method: 'PATCH', body: { name: name.value.trim() } });
          close(); await loadAll(); renderPage();
        } }, t('Done')),
      ],
    });
  }

  /** Add or edit a web page (departure board, traffic info, dashboard…). */
  function webDialog(existing) {
    const url = h('input', { placeholder: 'https://example.org/departures', value: existing?.url || '' });
    const name = h('input', { placeholder: t('e.g. Train departures'), value: existing?.name || '' });
    let zoom = Number(existing?.zoom) || 100;
    let refresh = Number(existing?.refreshSeconds) || 0;
    const err = h('div', { class: 'err-text' });
    const save = async (thenSchedule, close) => {
      err.textContent = '';
      try {
        let u = url.value.trim();
        if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
        const body = { url: u, name: name.value.trim() || u, zoom, refreshSeconds: refresh };
        const m = existing
          ? await api(`/media/${existing.id}`, { method: 'PATCH', body })
          : await api('/media', { method: 'POST', body: { type: 'web', ...body } });
        close(); await loadAll(); renderPage(); toast(existing ? t('Saved') : t('Web page added'), 'ok');
        if (thenSchedule) scheduleDialog({ mediaId: m.id });
      } catch (e) { err.textContent = e.message; }
    };
    modal({
      title: existing ? t('Edit web page') : t('Add a web page'),
      body: [
        h('p', { class: 'muted', style: { margin: 0 } }, t('Show a live website: train departures, traffic info, weather, a dashboard or a Power BI report. '),
          t('Screens running the KevCast Player app can also show sites that normally refuse to be embedded; in a plain browser some sites stay blank.')),
        h('label', { class: 'field' }, t('Web address'), url),
        h('label', { class: 'field' }, t('Name'), name),
        h('div', { class: 'grid2' },
          h('div', { class: 'field' }, h('b', { class: 'small' }, t('Zoom')), h('span', { class: 'hint' }, t('Below 100% fits more of a desktop page on the screen')),
            segmented([[67, '67%'], [80, '80%'], [100, '100%'], [125, '125%'], [150, '150%']], zoom, (v) => (zoom = v))),
          h('div', { class: 'field' }, h('b', { class: 'small' }, t('Reload the page')), h('span', { class: 'hint' }, t('For pages that do not update by themselves')),
            h('select', { onchange: (e) => (refresh = Number(e.target.value)) },
              [[0, t('Never (the page updates itself)')], [60, t('Every minute')], [300, t('Every 5 minutes')], [900, t('Every 15 minutes')], [3600, t('Every hour')]]
                .map(([v, l]) => h('option', { value: v, selected: v === refresh }, l))))),
        existing ? h('a', { class: 'btn sm', href: `/player/?preview=media:${existing.id}`, target: '_blank', style: { alignSelf: 'flex-start' } }, icon('play'), t('Preview on a screen')) : null,
        err,
      ],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn', onclick: () => save(true, close) }, icon('schedule'), existing ? t('Save & schedule') : t('Add & schedule')),
        h('button', { class: 'btn primary', onclick: () => save(false, close) }, existing ? t('Save') : t('Add'))],
    });
  }

  /** Pick a place by name (OpenStreetMap search on the server). onPick(place) gets { name, lat, lon, country, region }. */
  function placePicker(current, onPick, placeholder) {
    const q = h('input', { type: 'search', placeholder: placeholder || t('Town, address or postcode'), value: '' });
    const results = h('div', { class: 'place-results' });
    const chosen = h('div', { class: 'place-chosen' });
    const showChosen = (p) => chosen.replaceChildren(...(p ? [icon('check'), h('b', {}, p.name), h('span', { class: 'muted small' }, ` ${p.label || p.region || ''}`)] : [h('span', { class: 'muted small' }, t('No location chosen yet'))]));
    if (current !== undefined) showChosen(current);
    const go = async () => {
      if (q.value.trim().length < 2) return;
      results.replaceChildren(h('div', { class: 'muted small' }, t('Searching…')));
      try {
        const list = await api(`/geocode?q=${encodeURIComponent(q.value.trim())}&lang=${encodeURIComponent(window.KevI18n.lang)}`);
        results.replaceChildren(...(list.length ? list.map((p) => h('button', { type: 'button', class: 'place-result', onclick: () => { results.replaceChildren(); q.value = ''; if (current !== undefined) showChosen(p); onPick(p); } },
          h('b', {}, p.name), h('span', { class: 'muted small' }, p.label))) : [h('div', { class: 'muted small' }, t('Nothing found. Try a town name or postcode.'))]));
      } catch (e) { results.replaceChildren(h('div', { class: 'err-text' }, e.message)); }
    };
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    return h('div', { class: 'stack', style: { gap: '6px' } }, current !== undefined ? chosen : null, h('div', { class: 'row' }, q, h('button', { type: 'button', class: 'btn', onclick: go }, t('Search'))), results);
  }

  /** Weather and traffic slides: KevCast fetches the data (MET Norway, MeteoAlarm, OSRM, NDW); you pick the place. */
  function liveDialog(type, existing) {
    const s = { name: existing?.name || '', place: existing?.place || null, weather: Object.assign({ hourly: true, days: true, warnings: true }, existing?.weather || {}),
      destinations: (existing?.destinations || []).slice(), auto: !(existing?.destinations || []).length };
    const name = h('input', { value: s.name, placeholder: type === 'weather' ? t('Optional, e.g. Weather in Utrecht') : t('Optional, e.g. Traffic'), oninput: (e) => (s.name = e.target.value) });
    const err = h('div', { class: 'err-text' });
    const destBox = h('div', { class: 'stack', style: { gap: '8px' } });
    let cities = [];
    const loadCities = async () => { cities = s.place?.country ? await api(`/places/cities?country=${s.place.country}`).catch(() => []) : []; drawDest(); };
    const isSel = (c) => s.destinations.some((d) => d.name === c.name);
    function drawDest() {
      if (type !== 'traffic') return;
      destBox.replaceChildren(
        h('label', { class: 'check' }, h('input', { type: 'radio', name: 'dest-mode', checked: s.auto, onchange: () => { s.auto = true; drawDest(); } }), h('span', {}, t('The nearest big cities (automatic)'))),
        h('label', { class: 'check' }, h('input', { type: 'radio', name: 'dest-mode', checked: !s.auto, onchange: () => { s.auto = false; drawDest(); } }), h('span', {}, t('Choose destinations (up to 8)'))),
        s.auto ? null : h('div', { class: 'stack', style: { gap: '8px', marginLeft: '24px' } },
          cities.length ? h('div', { class: 'chips' }, cities.map((c) => h('button', { type: 'button', class: `chip ${isSel(c) ? 'on' : ''}`, onclick: () => {
            s.destinations = isSel(c) ? s.destinations.filter((d) => d.name !== c.name) : [...s.destinations, c].slice(0, 8); drawDest();
          } }, c.name))) : null,
          h('div', { class: 'chips' }, s.destinations.filter((d) => !cities.some((c) => c.name === d.name)).map((d) => h('span', { class: 'chip on' }, d.name, ' ',
            h('a', { href: '#', onclick: (e) => { e.preventDefault(); s.destinations = s.destinations.filter((x) => x !== d); drawDest(); } }, '✕')))),
          placePicker(undefined, (p) => { s.destinations = [...s.destinations, p].slice(0, 8); drawDest(); }, t('Add another place…'))));
    }
    const save = async (thenSchedule, close) => {
      err.textContent = '';
      if (!s.place) { err.textContent = t('Choose a location'); return; }
      if (type === 'traffic' && !s.auto && !s.destinations.length) { err.textContent = t('Choose at least one destination'); return; }
      const body = { name: s.name.trim() || s.place.name, place: s.place };
      if (type === 'weather') body.weather = s.weather;
      if (type === 'traffic') body.destinations = s.auto ? [] : s.destinations;
      try {
        const m = existing ? await api(`/media/${existing.id}`, { method: 'PATCH', body }) : await api('/media', { method: 'POST', body: { type, ...body } });
        close(); await loadAll(); renderPage(); toast(existing ? t('Saved') : type === 'weather' ? t('Weather added') : t('Traffic added'), 'ok');
        if (thenSchedule) scheduleDialog({ mediaId: m.id });
      } catch (e) { err.textContent = e.message; }
    };
    const check = (key, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.weather[key], onchange: (e) => (s.weather[key] = e.target.checked) }), h('span', {}, label));
    loadCities();
    modal({
      title: type === 'weather' ? (existing ? t('Edit weather') : t('Add weather')) : (existing ? t('Edit traffic') : t('Add traffic')),
      body: [
        h('p', { class: 'muted', style: { margin: 0 } }, type === 'weather'
          ? t('The weather now, today hour by hour, the next 5 days and official weather warnings (KNMI in the Netherlands) for a place. Updated automatically.')
          : t('Travel times by car from a place to big cities, including current traffic jams in the Netherlands. Updated every few minutes.')),
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('Location')), placePicker(s.place, (p) => { s.place = p; loadCities(); })),
        type === 'weather' ? h('div', { class: 'field' }, h('b', { class: 'small' }, t('Show')), check('hourly', t('Today, hour by hour')), check('days', t('The next 5 days')), check('warnings', t('Weather warnings'))) : null,
        type === 'traffic' ? h('div', { class: 'field' }, h('b', { class: 'small' }, t('Destinations')), destBox) : null,
        h('label', { class: 'field' }, t('Name'), name),
        h('p', { class: 'muted small', style: { margin: 0 } }, type === 'weather'
          ? t('Data: MET Norway (forecast) and MeteoAlarm (warnings). The KevCast server needs internet access; screens don’t.')
          : t('Data: OpenStreetMap/OSRM (routes) and NDW (traffic jams in the Netherlands). The KevCast server needs internet access; screens don’t.')),
        existing ? h('a', { class: 'btn sm', href: `/widgets/${type}.html?id=${existing.id}&lang=${window.KevI18n.lang}`, target: '_blank', style: { alignSelf: 'flex-start' } }, icon('play'), t('Preview on a screen')) : null,
        err,
      ],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn', onclick: () => save(true, close) }, icon('schedule'), existing ? t('Save & schedule') : t('Add & schedule')),
        h('button', { class: 'btn primary', onclick: () => save(false, close) }, existing ? t('Save') : t('Add'))],
    });
  }

  function textPreview(t = {}) {
    return h('div', { class: 'text-preview', style: { background: t.bg2 ? `linear-gradient(135deg, ${t.bg || '#1e1b4b'}, ${t.bg2})` : t.bg || '#1e1b4b', color: t.fg || '#fff', textAlign: t.align === 'left' ? 'left' : 'center', alignItems: t.align === 'left' ? 'flex-start' : 'center' } },
      h('h1', {}, t.title || ''), h('p', {}, t.body || ''));
  }

  function textDialog(existing) {
    const tx = Object.assign({ title: '', body: '', bg: '#1e1b4b', bg2: '#7c3aed', fg: '#ffffff', align: 'center', size: 'normal' }, existing?.text || {});
    const pv = h('div');
    const redraw = () => pv.replaceChildren(textPreview(tx));
    const bind = (el, key) => { el.addEventListener('input', () => { tx[key] = el.value; redraw(); }); return el; };
    const presets = [['#1e1b4b', '#7c3aed', '#ffffff'], ['#0f172a', '#0891b2', '#ffffff'], ['#14532d', '#16a34a', '#ffffff'], ['#7c2d12', '#ea580c', '#ffffff'], ['#ffffff', '#e2e8f0', '#0f172a'], ['#000000', '', '#facc15']];
    const colors = { bg: h('input', { type: 'color', value: tx.bg }), bg2: h('input', { type: 'color', value: tx.bg2 || tx.bg }), fg: h('input', { type: 'color', value: tx.fg }) };
    Object.entries(colors).forEach(([k, el]) => bind(el, k));
    redraw();
    modal({
      title: existing ? t('Edit text slide') : t('New text slide'),
      wide: true,
      body: [
        pv,
        h('label', { class: 'field' }, t('Heading'), bind(h('input', { value: tx.title, placeholder: t('Welcome to our office!') }), 'title')),
        h('label', { class: 'field' }, t('Text'), bind(h('textarea', { rows: 3, placeholder: t('Coffee is in the kitchen on the 2nd floor.') }, tx.body), 'body')),
        h('div', { class: 'row wrap', style: { gap: '18px' } },
          h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, t('Style')),
            h('div', { class: 'row' }, presets.map(([a, b, c]) => h('button', { class: 'btn icon', title: t('Preset'), style: { width: '34px', height: '34px', background: b ? `linear-gradient(135deg, ${a}, ${b})` : a, color: c }, onclick: () => {
              Object.assign(tx, { bg: a, bg2: b, fg: c }); colors.bg.value = a; colors.bg2.value = b || a; colors.fg.value = c; redraw();
            } }, 'A')))),
          h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, t('Colours')), h('div', { class: 'row' }, colors.bg, colors.bg2, colors.fg)),
          h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, t('Align')), segmented([['center', t('Centre')], ['left', t('Left')]], tx.align, (v) => { tx.align = v; redraw(); })),
          h('div', { class: 'stack', style: { gap: '6px' } }, h('b', { class: 'small' }, t('Size')), segmented([['small', 'S'], ['normal', 'M'], ['large', 'L']], tx.size, (v) => { tx.size = v; }))),
      ],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn primary', onclick: async () => {
          try {
            if (existing) await api(`/media/${existing.id}`, { method: 'PATCH', body: { text: tx, name: tx.title || existing.name } });
            else await api('/media', { method: 'POST', body: { type: 'text', text: tx, name: tx.title } });
            close(); await loadAll(); renderPage(); toast(t('Saved'), 'ok');
          } catch (e) { toast(e.message, 'err'); }
        } }, t('Save'))],
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
        if (status) status.textContent = t('All changes saved');
      } catch (e) { toast(e.message, 'err'); }
    };
    const status = document.getElementById('save-status');
    if (status) status.textContent = t('Saving…');
    if (immediate) return doSave();
    saveTimer = setTimeout(doSave, 500);
  }

  async function newPlaylist() {
    const p = await api('/playlists', { method: 'POST', body: {} });
    state.playlists.push(p);
    go(`#/playlists/${p.id}`);
  }

  async function deletePlaylist(p) {
    const n = state.schedules.filter((s) => s.playlistId === p.id).length;
    const text = n ? tn(n, 'Its {n} schedule entry is deleted too. Your media stays in the library.', 'Its {n} schedule entries are deleted too. Your media stays in the library.') : t('Your media stays in the library.');
    if (!(await confirmBox(t('Delete playlist “{name}”?', { name: p.name }), text))) return;
    await api(`/playlists/${p.id}`, { method: 'DELETE' });
    await loadAll(); go('#/playlists'); renderPage();
  }

  function PlaylistsPage(arg) {
    const p = byId(state.playlists, arg) || state.playlists[0];
    const listCol = h('div', { class: 'card pl-list' },
      h('div', { class: 'section-head' }, h('h3', {}, t('Playlists')), h('div', { class: 'spacer' }), h('button', { class: 'btn sm primary', onclick: newPlaylist }, icon('plus'), t('New'))),
      state.playlists.map((x) => h('a', { href: `#/playlists/${x.id}`, class: p && x.id === p.id ? 'active' : '' },
        h('button', { class: 'btn icon sm row-del', title: t('Delete playlist'), onclick: (e) => { e.preventDefault(); e.stopPropagation(); deletePlaylist(x); } }, icon('trash')),
        h('span', { class: 'swatch', style: { background: x.color } }),
        h('div', { style: { minWidth: 0 } }, h('div', { style: { fontWeight: 600 } }, x.name), h('div', { class: 'muted small' }, t('{n} items · {v}', { n: x.items.length, v: playlistRuntime(x) }), groupsForPlaylist(x).length ? t(' · ▦ group') : '')))));
    if (!p) {
      return [pageHead(t('Playlists'), t('A playlist is a set of content that plays in a loop.')),
        h('div', { class: 'card empty' }, h('h3', {}, t('No playlists yet')), h('p', {}, t('Create a playlist, then drag your media into it.')), h('button', { class: 'btn primary', onclick: newPlaylist }, icon('plus'), t('Create your first playlist')))];
    }
    return [
      pageHead(t('Playlists'), t('Drag media in from the right, then drag items to change the order. Changes save automatically.'),
        h('span', { id: 'save-status', class: 'muted small' }, ''),
        h('a', { class: 'btn', href: `/player/?preview=${p.id}`, target: '_blank' }, icon('play'), t('Preview')),
        h('button', { class: 'btn', onclick: () => scheduleDialog({ playlistId: p.id }) }, icon('schedule'), t('Schedule')),
        h('button', { class: 'btn primary', onclick: () => sendDialog({ playlistId: p.id }) }, icon('play'), t('Send to screens'))),
      h('div', { class: 'pl-layout' }, listCol, playlistEditor(p), libraryPanel(p)),
    ];
  }

  function playlistEditor(p) {
    const items = h('div', { class: 'pl-items' });
    const runtime = h('span', { class: 'muted small' });
    const drawRuntime = () => { runtime.textContent = t('{n} items · total {v}', { n: p.items.length, v: playlistRuntime(p) }); };

    const groupNote = h('div', { class: 'group-note small' });
    const drawGroupNote = () => {
      const gs = groupsForPlaylist(p);
      const screens = state.displays.filter((d) => d.approved && gs.some((g) => (d.groups || []).includes(g.name))).length;
      groupNote.hidden = !gs.length && !state.groups.length;
      groupNote.classList.toggle('on', gs.length > 0);
      groupNote.replaceChildren(...(gs.length
        ? [icon('group'), h('span', {}, h('b', {}, t('Plays on group “{name}”', { name: gs[0].name })), tn(screens, ' ({n} screen) whenever nothing else is scheduled, because it has the same name.', ' ({n} screens) whenever nothing else is scheduled, because it has the same name.'))]
        : [h('span', { class: 'muted' }, t('Tip: give this playlist the same name as a display group and that group plays it automatically.'))]));
    };
    drawGroupNote();
    const name = h('input', { value: p.name, style: { fontSize: '17px', fontWeight: 700 }, oninput: () => { p.name = name.value; savePlaylist(p); drawGroupNote(); } });
    const color = h('input', { type: 'color', value: p.color, title: t('Colour in the schedule'), oninput: () => { p.color = color.value; savePlaylist(p); } });
    const defDur = h('input', { type: 'number', min: 1, value: p.defaultDuration || 10, style: { width: '80px' }, oninput: () => { p.defaultDuration = Number(defDur.value) || 10; savePlaylist(p); draw(); } });
    const trans = h('select', { style: { width: 'auto' }, onchange: () => { p.transition = trans.value; savePlaylist(p); } },
      [['fade', t('Fade')], ['slide', t('Slide')], ['zoom', t('Zoom')], ['none', t('None')]].map(([v, l]) => h('option', { value: v, selected: (p.transition || 'fade') === v }, l)));

    let dragFrom = null;
    function draw() {
      drawRuntime();
      if (!p.items.length) {
        const hint = h('div', { class: 'pl-drop-hint' }, h('b', {}, t('This playlist is empty.')), h('br'), t('Drag media here from the library, or click + next to an item.'));
        hint.addEventListener('dragover', (e) => { e.preventDefault(); hint.classList.add('over'); });
        hint.addEventListener('dragleave', () => hint.classList.remove('over'));
        hint.addEventListener('drop', (e) => { e.preventDefault(); const mid = e.dataTransfer.getData('text/kevcast-media'); if (mid) addItem(mid, 0); });
        items.replaceChildren(hint);
        return;
      }
      items.replaceChildren(...p.items.map((it, idx) => {
        const m = byId(state.media, it.mediaId);
        const dur = h('input', { type: 'number', min: 0, value: it.duration || '', placeholder: m?.type === 'video' ? 'auto' : String(p.defaultDuration || 10), title: m?.type === 'presentation' ? t('Seconds per slide') : t('Seconds on screen'),
          oninput: () => { it.duration = Number(dur.value) || 0; savePlaylist(p); drawRuntime(); } });
        const row = h('div', { class: `pl-item ${it.enabled === false ? 'disabled' : ''}`, draggable: true },
          h('div', { class: 'handle', title: t('Drag to reorder') }, icon('drag')),
          mediaThumb(m, true),
          h('div', { style: { minWidth: 0 } },
            h('div', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m ? m.name : t('(deleted)')),
            h('div', { class: 'muted small' }, m ? `${TYPE_LABEL[m.type]}${m.slides ? t(' · {n} slides', { n: m.slides.length }) : ''}${m.status === 'processing' ? t(' · converting…') : ''}` : '')),
          h('div', { class: 'controls' },
            h('label', { class: 'row small muted', title: m?.type === 'presentation' ? t('Seconds per slide') : t('Seconds on screen') }, dur, m?.type === 'presentation' ? t('s/slide') : 's'),
            h('label', { class: 'check small', title: t('Show this item') }, h('input', { type: 'checkbox', checked: it.enabled !== false, onchange: (e) => { it.enabled = e.target.checked; row.classList.toggle('disabled', !it.enabled); savePlaylist(p); drawRuntime(); } })),
            h('button', { class: 'btn icon ghost row-del', title: t('Remove from this playlist (the file stays in Media)'), onclick: () => {
              const [gone] = p.items.splice(idx, 1); savePlaylist(p, true); draw();
              toast(h('span', {}, t('Removed “{v}” from the playlist. ', { v: m ? m.name : 'item' }),
                h('a', { href: '#', onclick: (e) => { e.preventDefault(); p.items.splice(idx, 0, gone); savePlaylist(p, true); draw(); e.target.closest('.toast')?.remove(); } }, t('Undo'))));
            } }, icon('trash'))));
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
        h('button', { class: 'btn sm ghost', title: t('Duplicate'), onclick: async () => { const c = await api(`/playlists/${p.id}/duplicate`, { method: 'POST' }); state.playlists.push(c); go(`#/playlists/${c.id}`); } }, icon('copy')),
        h('button', { class: 'btn sm ghost danger', title: t('Delete playlist'), onclick: () => deletePlaylist(p) }, icon('trash'))),
      h('div', { class: 'row wrap', style: { padding: '10px 16px', borderBottom: '1px solid var(--line)', gap: '16px' } },
        h('label', { class: 'row small' }, t('Default time'), defDur, t('sec')),
        h('label', { class: 'row small' }, t('Transition'), trans),
        h('div', { class: 'spacer' }), runtime),
      groupNote,
      items);
  }

  function libraryPanel(p) {
    let q = '';
    const list = h('div', { class: 'lib-scroll' });
    const draw = () => {
      const ms = state.media.filter((m) => !q || m.name.toLowerCase().includes(q)).reverse();
      list.replaceChildren(...(ms.length ? ms.map((m) => {
        const row = h('div', { class: 'lib-item', draggable: true, title: t('Drag into the playlist') },
          mediaThumb(m, true),
          h('div', { style: { minWidth: 0 } }, h('div', { class: 'name' }, m.name), h('div', { class: 'muted small' }, TYPE_LABEL[m.type])),
          h('div', { class: 'row', style: { gap: '4px' } },
            h('button', { class: 'btn icon sm row-del', title: t('Delete from the library'), onclick: () => deleteMedia([m]) }, icon('trash')),
            h('button', { class: 'btn icon sm', title: t('Add to end of playlist'), onclick: () => p._addItem(m.id) }, icon('plus'))));
        row.addEventListener('dragstart', (e) => { state.busy = true; e.dataTransfer.setData('text/kevcast-media', m.id); e.dataTransfer.effectAllowed = 'copy'; });
        row.addEventListener('dragend', () => { state.busy = false; });
        return row;
      }) : [h('div', { class: 'empty small' }, t('No media yet. '), h('a', { href: '#/media' }, t('Upload some')))]));
    };
    draw();
    return h('div', { class: 'card pl-library' },
      h('div', { class: 'section-head' }, h('h3', {}, t('Library')), h('div', { class: 'spacer' }),
        h('button', { class: 'btn sm', title: t('Upload files and add them to this playlist'), onclick: () => pickFiles({ addTo: p }) }, icon('upload'), t('Upload'))),
      h('div', { style: { padding: '10px 12px' } }, h('input', { type: 'search', placeholder: t('Search…'), oninput: (e) => { q = e.target.value.toLowerCase(); draw(); } })),
      list);
  }

  // ---------------------------------------------------------------------------
  // Schedule — calendar + week overview
  // ---------------------------------------------------------------------------
  const HOUR_PX = 44;
  const dkey = KevSchedule.dateKey;
  const pad = (n) => String(n).padStart(2, '0');
  const minToHHMM = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const TYPE_COLOR = { web: '#0d9488', image: '#2563eb', video: '#9333ea', presentation: '#b45309', text: '#db2777' };
  const ordinal = (n) => window.KevI18n.lang === 'nl' ? `${n}e` : window.KevI18n.lang === 'de' ? `${n}.` : `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

  /** Schedule targets for a screen, a group filter ({ id: '__group', groups: [name] }) or nothing. */
  function targetsFor(display) {
    if (!display || display.id === '__none') return { displays: [], groups: [] };
    if (display.id === '__group') return { displays: [], groups: [...display.groups] };
    return { displays: [display.id], groups: [] };
  }

  function weekStart(offset) {
    const d = KevSchedule.weekStart(new Date());
    d.setDate(d.getDate() + offset * 7);
    return d;
  }

  /** Name and colour of what a schedule entry (or a resolved key) plays. */
  function contentInfo(sOrKey) {
    const key = typeof sOrKey === 'string' || sOrKey === null ? sOrKey : KevSchedule.contentKey(sOrKey);
    if (!key) return { name: 'Clock screen', color: '#94a3b8', kind: 'idle' };
    if (key.startsWith('media:')) {
      const m = byId(state.media, key.slice(6));
      return { name: m ? m.name : '(deleted item)', color: TYPE_COLOR[m?.type] || '#64748b', kind: m?.type === 'web' ? 'Web page' : TYPE_LABEL[m?.type] || 'Item' };
    }
    const p = byId(state.playlists, key);
    return { name: p ? p.name : '(deleted playlist)', color: p?.color || '#64748b', kind: 'Playlist' };
  }

  /** [startMin, endMin] segments of entry s on this calendar date. */
  function entryOnDate(s, date) {
    const segs = [];
    if (s.allDay) { if (KevSchedule.occursOn(s, date)) segs.push([0, 1440]); return segs; }
    const st = KevSchedule.toMinutes(s.start);
    const en = KevSchedule.toMinutes(s.end);
    if (en > st) { if (KevSchedule.occursOn(s, date)) segs.push([st, en]); return segs; }
    const prev = new Date(date); prev.setDate(prev.getDate() - 1);
    if (KevSchedule.occursOn(s, prev) && en > 0) segs.push([0, en]);
    if (KevSchedule.occursOn(s, date)) segs.push([st, 1440]);
    return segs;
  }

  function describeTargets(s) {
    const tx = s.targets || {};
    const parts = [...(tx.displays || []).map((id) => byId(state.displays, id)?.name).filter(Boolean), ...(tx.groups || []).map((g) => t('Group: {g}', { g: g }))];
    return parts.length ? parts.join(', ') : t('All displays');
  }
  function describeDays(s) {
    const d = (s.days && s.days.length ? s.days : [0, 1, 2, 3, 4, 5, 6]).slice().sort();
    if (d.length === 7) return t('Every day');
    if (d.join() === '1,2,3,4,5') return t('Weekdays');
    if (d.join() === '0,6') return t('Weekends');
    return d.map((x) => DAYS[x]).join(', ');
  }
  function describeInterval(s) {
    return KevSchedule.hasInterval(s) ? t('every {everyMinutes} min for {showSeconds} s', { everyMinutes: s.interval.everyMinutes, showSeconds: s.interval.showSeconds }) : '';
  }
  /** "Weekdays, 08:00–17:00 · every 15 min for 60 s" */
  function describeWhen(s) {
    const repeat = s.repeat || 'weekly';
    let when;
    if (repeat === 'once') when = t('Once on {v}', { v: s.startDate ? new Date(s.startDate + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '?' });
    else if (repeat === 'monthly') when = t('Every month on the {v}', { v: ordinal(Number(s.monthDay) || 1) });
    else when = describeDays(s) + (Number(s.everyWeeks) > 1 ? t(', every {everyWeeks} weeks', { everyWeeks: s.everyWeeks }) : '');
    const time = s.allDay ? 'all day' : `${s.start}–${s.end}`;
    return [when + ', ' + time, describeInterval(s)].filter(Boolean).join(' · ');
  }
  function describePeriod(s) {
    if ((s.repeat || 'weekly') === 'once' || (!s.startDate && !s.endDate)) return '';
    const f = (k) => new Date(k + 'T12:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
    if (s.startDate && s.endDate) return t('Valid {v} – {v2}', { v: f(s.startDate), v2: f(s.endDate) });
    return s.startDate ? t('Valid from {v}', { v: f(s.startDate) }) : t('Valid until {v}', { v: f(s.endDate) });
  }

  function SchedulePage() {
    const start = weekStart(state.calWeekOffset);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
    const approved = state.displays.filter((d) => d.approved);
    // The filter can be one screen or a whole group ("g:<name>").
    const filterGroup = (state.calDisplay || '').startsWith('g:') ? state.calDisplay.slice(2) : null;
    const filterDisplay = filterGroup ? groupTarget(filterGroup) : asScheduled(byId(state.displays, state.calDisplay));
    const relevant = state.schedules.filter((s) => !filterDisplay || KevSchedule.appliesToDisplay(s, filterDisplay));
    const view = state.calView || 'calendar';

    const displaySel = h('select', { style: { width: 'auto' }, onchange: (e) => { state.calDisplay = e.target.value; renderPage(); } },
      h('option', { value: '' }, t('All displays')),
      state.groups.length ? h('optgroup', { label: t('Groups') }, state.groups.map((g) => h('option', { value: `g:${g.name}`, selected: `g:${g.name}` === state.calDisplay }, `▦ ${g.name}`))) : null,
      approved.length ? h('optgroup', { label: t('Screens') }, approved.map((d) => h('option', { value: d.id, selected: d.id === state.calDisplay }, d.name))) : null);
    const viewSel = segmented([['calendar', t('Calendar')], ['week', t('Week overview')]], view, (v) => { state.calView = v; renderPage(); });

    const used = [...new Set(relevant.map((s) => KevSchedule.contentKey(s)))].map((k) => ({ k, ...contentInfo(k) }));
    const fallback = filterDisplay ? byId(state.playlists, filterDisplay.defaultPlaylistId) : null;

    return [
      pageHead(t('Schedule'), view === 'week'
        ? t('What every screen plays, day by day. Click a bar to change it.')
        : t('Click and drag on the calendar to schedule something. Click a block to edit it.'),
        viewSel, displaySel,
        h('button', { class: 'btn primary', onclick: () => scheduleDialog({ targets: filterGroup ? { displays: [], groups: [filterGroup] } : { displays: filterDisplay ? [filterDisplay.id] : [], groups: [] } }) }, icon('plus'), t('Add to schedule'))),
      h('div', { class: 'row', style: { marginBottom: '12px' } },
        h('button', { class: 'btn sm', onclick: () => { state.calWeekOffset--; renderPage(); } }, icon('left')),
        h('button', { class: 'btn sm', onclick: () => { state.calWeekOffset = 0; renderPage(); } }, t('This week')),
        h('button', { class: 'btn sm', onclick: () => { state.calWeekOffset++; renderPage(); } }, icon('right')),
        h('b', { style: { marginLeft: '8px' } }, `${days[0].toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' })} – ${days[6].toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })}`)),
      view === 'week' ? weekOverview(days, filterDisplay || approved[0] || null, !filterDisplay && approved.length > 0) : calendarView(days, relevant, filterDisplay),
      h('div', { class: 'legend' },
        used.map((u) => h('span', {}, h('span', { class: 'swatch', style: { background: u.color } }), u.name, h('span', { class: 'muted small' }, ` (${u.kind})`))),
        filterDisplay ? h('span', { class: 'muted' }, t('Outside scheduled times “{name}” shows: ', { name: filterDisplay.name }), fallback ? h('b', {}, fallback.name) : t('the clock screen'), t(' (change under Displays)')) :
          h('span', { class: 'muted' }, t('Outside scheduled times each display shows its default playlist.'))),
      scheduleTable(relevant),
    ];
  }

  function calendarView(days, relevant, filterDisplay) {
    const today = dkey(new Date());
    const head = h('div', { class: 'cal-head' }, h('div'), days.map((d) =>
      h('div', { class: dkey(d) === today ? 'today' : '' }, DAYS[d.getDay()], h('small', {}, d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })))));
    const body = h('div', { class: 'cal-body' });
    body.append(h('div', { class: 'cal-hours' }, Array.from({ length: 24 }, (_, i) => h('div', {}, i ? `${pad(i)}:00` : ''))));
    days.forEach((d) => {
      const col = h('div', { class: `cal-day ${dkey(d) === today ? 'today' : ''} ${[0, 6].includes(d.getDay()) ? 'weekend' : ''}`, style: { height: `${24 * HOUR_PX}px` } });
      // Lay out overlapping blocks side-by-side.
      const blocks = [];
      relevant.forEach((s) => entryOnDate(s, d).forEach(([a, b]) => blocks.push({ s, a, b })));
      // Overlapping blocks share the width of their own cluster only.
      blocks.sort((x, y) => x.a - y.a || y.b - x.b);
      let cluster = [];
      let clusterEnd = -1;
      const flush = () => {
        const lanes = [];
        cluster.forEach((bk) => {
          let lane = lanes.findIndex((l) => l.every((o) => o.b <= bk.a || o.a >= bk.b));
          if (lane === -1) { lanes.push([]); lane = lanes.length - 1; }
          lanes[lane].push(bk);
          bk.lane = lane;
        });
        cluster.forEach((bk) => (bk.lanes = lanes.length));
        cluster = [];
      };
      blocks.forEach((bk) => {
        if (cluster.length && bk.a >= clusterEnd) flush();
        cluster.push(bk);
        clusterEnd = Math.max(clusterEnd, bk.b);
      });
      flush();
      blocks.forEach((bk) => {
        const c = contentInfo(bk.s);
        const w = 100 / Math.max(1, bk.lanes);
        const recurring = KevSchedule.hasInterval(bk.s);
        col.append(h('div', {
          class: `cal-block ${bk.s.enabled === false ? 'off' : ''} ${recurring ? 'recurring' : ''}`,
          title: `${c.name} (${c.kind}) · ${describeWhen(bk.s)}`,
          style: { top: `${(bk.a / 60) * HOUR_PX}px`, height: `${Math.max(18, ((bk.b - bk.a) / 60) * HOUR_PX - 2)}px`, background: c.color,
            left: `calc(${bk.lane * w}% + 3px)`, width: `calc(${w}% - 6px)`, right: 'auto' },
          onmousedown: (e) => e.stopPropagation(),
          onclick: (e) => { e.stopPropagation(); scheduleDialog(bk.s); },
        }, h('b', {}, (recurring ? '↻ ' : '') + (bk.s.name || c.name)),
        h('span', {}, recurring ? describeInterval(bk.s) : bk.s.allDay ? t('All day') : `${bk.s.start}–${bk.s.end}`),
        bk.s.priority >= 5 ? h('span', {}, ' · ⚑') : null));
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
          scheduleDialog({ days: [d.getDay()], start: minToHHMM(s), end: en >= 1440 ? '00:00' : minToHHMM(en), targets: targetsFor(filterDisplay) });
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
      body.append(col);
    });
    const scroll = h('div', { class: 'cal-scroll' }, body);
    setTimeout(() => { if (!scroll.dataset.done) { scroll.scrollTop = 7 * HOUR_PX; scroll.dataset.done = 1; } });
    return h('div', { class: 'card cal' }, head, scroll);
  }

  /** One row per day showing exactly what a display plays (schedule + default + recurring items). */
  function weekOverview(days, display, picked, label) {
    const today = dkey(new Date());
    const target = (display && display.id !== '__group' ? asScheduled(display) : display) || { id: '__none', groups: [], defaultPlaylistId: null };
    const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
    const pct = (m) => `${(m / 1440) * 100}%`;
    const rows = days.map((d) => {
      const segs = KevSchedule.dayTimeline(state.schedules, target, d, 5);
      const recurring = KevSchedule.intervalsOn(state.schedules, target, d);
      const track = h('div', { class: 'wk-track', title: t('Click to schedule something on this day'), onclick: () => scheduleDialog({ days: [d.getDay()], targets: targetsFor(display) }) });
      segs.forEach((sg) => {
        const c = !sg.key && target.id === '__group' ? { name: 'Each screen’s own default', color: '#94a3b8', kind: 'default' } : contentInfo(sg.key);
        const s = sg.scheduleId ? byId(state.schedules, sg.scheduleId) : null;
        track.append(h('div', {
          class: `wk-seg ${sg.scheduleId ? '' : 'default'} ${sg.key ? '' : 'idle'}`,
          style: { left: pct(sg.from), width: pct(sg.to - sg.from), background: c.color },
          title: `${minToHHMM(sg.from)}–${sg.to >= 1440 ? '24:00' : minToHHMM(sg.to)}  ${c.name}${sg.scheduleId ? '' : sg.key ? t(' (default playlist)') : ''}`,
          onclick: (e) => { e.stopPropagation(); if (s) scheduleDialog(s); else if (display && !display.id.startsWith('__')) displayDialog(display); },
        }, sg.to - sg.from >= 90 ? h('span', {}, (sg.scheduleId ? '' : '◦ ') + (s?.name || c.name)) : null));
      });
      if (dkey(d) === today) {
        const now = new Date();
        track.append(h('div', { class: 'wk-now', style: { left: pct(now.getHours() * 60 + now.getMinutes()) } }));
      }
      return h('div', { class: `wk-row ${dkey(d) === today ? 'today' : ''}` },
        h('div', { class: 'wk-day' }, h('b', {}, DAYS[d.getDay()]), h('small', {}, d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }))),
        h('div', {}, track,
          recurring.length ? h('div', { class: 'wk-recurring' }, recurring.map((s) => {
            const c = contentInfo(s);
            return h('button', { class: 'chip', style: { borderColor: c.color }, onclick: () => scheduleDialog(s) },
              h('span', { class: 'swatch', style: { background: c.color, display: 'inline-block', marginRight: '6px' } }),
              `↻ ${s.name || c.name}: ${describeInterval(s)}, ${s.allDay ? t('all day') : `${s.start}–${s.end}`}`);
          })) : null));
    });
    return h('div', { class: 'card wk' },
      label ? h('div', { class: 'wk-caption muted small' }, label) : null,
      h('div', { class: 'wk-head' }, h('div', { class: 'muted small' }, label ? '' : display ? (picked ? t('Showing: {name}', { name: display.name }) : display.name) : t('No displays yet')),
        h('div', { class: 'wk-ticks' }, ticks.map((t) => h('span', { style: { left: pct(t * 60) } }, `${pad(t)}:00`)))),
      rows,
      h('div', { class: 'wk-foot muted small' }, t('◦ = default playlist of the screen · ↻ = shown repeatedly within its time window, on top of the content above')));
  }

  const selectedEntries = new Set();

  /** Table of schedule entries with checkboxes: change many entries at once. */
  function scheduleTable(list, opts = {}) {
    if (!list.length) return h('div', { class: 'card empty', style: { marginTop: '16px' } }, h('h3', {}, t('Nothing scheduled yet')),
      h('p', {}, opts.emptyText || t('Drag on the calendar above, or set a default playlist for each display.')));
    for (const id of [...selectedEntries]) if (!state.schedules.some((x) => x.id === id)) selectedEntries.delete(id);
    const ids = list.map((x) => x.id).filter((id) => selectedEntries.has(id));
    const bulk = async (body, msg) => {
      try {
        await api('/schedules/bulk', { method: 'POST', body: { ids, ...body } });
        selectedEntries.clear(); await loadAll(); renderPage({ soft: true }); toast(msg, 'ok');
      } catch (e) { toast(e.message, 'err'); }
    };
    const bar = ids.length ? h('div', { class: 'bulk-bar card' },
      h('b', {}, t('{n} selected', { n: ids.length })),
      h('button', { class: 'btn sm', onclick: () => bulk({ action: 'enable' }, t('Enabled')) }, t('Enable')),
      h('button', { class: 'btn sm', onclick: () => bulk({ action: 'disable' }, t('Disabled')) }, t('Disable')),
      h('button', { class: 'btn sm', onclick: () => {
        const tx = { displays: [], groups: [] };
        modal({
          title: tn(ids.length, 'Change screens of {n} entry', 'Change screens of {n} entries'),
          body: [h('p', { class: 'muted', style: { margin: 0 } }, t('The selected entries will play on these screens and groups (replacing their current ones).')), targetChips(tx)],
          footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
            h('button', { class: 'btn primary', onclick: async () => { close(); await bulk({ action: 'setTargets', targets: tx }, t('Screens updated')); } }, t('Apply'))],
        });
      } }, t('Change screens…')),
      h('select', { style: { width: 'auto' }, onchange: (e) => { if (e.target.value !== '') bulk({ action: 'priority', priority: Number(e.target.value) }, t('Priority updated')); } },
        h('option', { value: '' }, t('Priority…')), [[0, t('Normal')], [5, t('High')], [10, t('Urgent')]].map(([v, l]) => h('option', { value: v }, l))),
      h('button', { class: 'btn sm danger', onclick: async () => {
        if (!(await confirmBox(t('Remove from schedule?'), tn(ids.length, '{n} entry is removed. The content itself is not deleted.', '{n} entries are removed. The content itself is not deleted.'), t('Remove')))) return;
        bulk({ action: 'delete' }, t('Removed'));
      } }, icon('trash'), t('Remove')),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn sm ghost', onclick: () => { selectedEntries.clear(); renderPage({ soft: true }); } }, t('Clear'))) : null;
    const allOn = list.every((x) => selectedEntries.has(x.id));
    return h('div', { style: { marginTop: '16px' } }, bar,
      h('div', { class: 'card', style: { overflowX: 'auto' } },
        h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {},
            h('th', { style: { width: '28px' } }, h('input', { type: 'checkbox', checked: allOn, title: t('Select all'), onchange: (e) => { list.forEach((x) => (e.target.checked ? selectedEntries.add(x.id) : selectedEntries.delete(x.id))); renderPage({ soft: true }); } })),
            ['', t('Content'), t('When'), t('Screens'), t('Priority'), t('On')].map((x) => h('th', {}, x)))),
          h('tbody', {}, list.map((s) => {
            const c = contentInfo(s);
            return h('tr', { class: `click ${selectedEntries.has(s.id) ? 'picked' : ''}`, onclick: () => scheduleDialog(s) },
              h('td', { onclick: (e) => e.stopPropagation() }, h('input', { type: 'checkbox', checked: selectedEntries.has(s.id), onchange: (e) => { e.target.checked ? selectedEntries.add(s.id) : selectedEntries.delete(s.id); renderPage({ soft: true }); } })),
              h('td', { style: { width: '20px' } }, h('span', { class: 'swatch', style: { background: c.color } })),
              h('td', {}, h('b', {}, s.name || c.name), h('div', { class: 'muted small' }, s.name ? `${c.name} · ${c.kind}` : c.kind,
                s.itemDuration ? t(' · {itemDuration} s per item', { itemDuration: s.itemDuration }) : '')),
              h('td', {}, describeWhen(s), describePeriod(s) ? h('div', { class: 'muted small' }, describePeriod(s)) : null),
              h('td', {}, describeTargets(s)),
              h('td', {}, s.priority >= 10 ? h('span', { class: 'badge err' }, t('Urgent')) : s.priority >= 5 ? h('span', { class: 'badge warn' }, t('High')) : h('span', { class: 'muted' }, t('Normal'))),
              h('td', { onclick: (e) => e.stopPropagation() }, h('input', { type: 'checkbox', checked: s.enabled !== false, onchange: async (e) => { await api(`/schedules/${s.id}`, { method: 'PUT', body: { ...s, enabled: e.target.checked } }); } })));
          })))));
  }

  function scheduleDialog(initial = {}) {
    const s = JSON.parse(JSON.stringify(Object.assign({
      name: '', playlistId: state.playlists[0]?.id || null, mediaId: null, itemDuration: 0,
      repeat: 'weekly', days: [1, 2, 3, 4, 5], everyWeeks: 1, monthDay: new Date().getDate(),
      start: '08:00', end: '17:00', allDay: false, priority: 0, enabled: true,
      targets: { displays: [], groups: [] }, startDate: null, endDate: null, interval: null,
    }, initial)));
    s.targets = s.targets || { displays: [], groups: [] };
    // Scheduling a playlist named after a group: aim it at that group.
    if (!initial.id && !initial.targets && s.playlistId) {
      const pl = byId(state.playlists, s.playlistId);
      if (pl) s.targets.groups = groupsForPlaylist(pl).map((g) => g.name);
    }
    const webPages = state.media.filter((m) => m.type === 'web');
    const mediaNow = s.mediaId ? byId(state.media, s.mediaId) : null;
    let what = s.mediaId ? (mediaNow?.type === 'web' ? 'web' : 'media') : (initial.what || 'playlist');
    if (what === 'playlist' && !state.playlists.length) what = webPages.length || !state.media.length ? 'web' : 'media';
    const err = h('div', { class: 'err-text' });

    // --- What should play? ------------------------------------------------------
    const newWeb = { url: '', name: '', zoom: 100, refreshSeconds: 0 };
    let webChoice = s.mediaId && mediaNow?.type === 'web' ? s.mediaId : webPages[0]?.id || '__new';
    const whatBox = h('div', { class: 'stack', style: { gap: '8px' } });
    const drawWhat = () => {
      if (what === 'playlist') {
        whatBox.replaceChildren(state.playlists.length
          ? h('select', { onchange: (e) => (s.playlistId = e.target.value) }, state.playlists.map((p) => h('option', { value: p.id, selected: p.id === s.playlistId }, p.name)))
          : h('div', { class: 'hint' }, t('No playlists yet. '), h('a', { href: '#/playlists' }, t('Create one')), t(', or schedule a web page or single item.')));
      } else if (what === 'media') {
        const items = state.media.filter((m) => m.type !== 'web');
        if (!s.mediaId || byId(state.media, s.mediaId)?.type === 'web') s.mediaId = items[0]?.id || null;
        whatBox.replaceChildren(items.length
          ? h('select', { onchange: (e) => (s.mediaId = e.target.value) }, items.map((m) => h('option', { value: m.id, selected: m.id === s.mediaId }, `${m.name} (${TYPE_LABEL[m.type]})`)))
          : h('div', { class: 'hint' }, t('No media yet. '), h('a', { href: '#/media' }, t('Upload some')), '.'));
      } else {
        const urlI = h('input', { value: newWeb.url, placeholder: 'https://example.org/departures', oninput: (e) => (newWeb.url = e.target.value) });
        const nameI = h('input', { value: newWeb.name, placeholder: t('e.g. Train departures'), oninput: (e) => (newWeb.name = e.target.value) });
        const newBox = h('div', { class: 'stack', style: { gap: '8px' } },
          h('div', { class: 'grid2' }, h('label', { class: 'field' }, t('Web address'), urlI), h('label', { class: 'field' }, t('Name'), nameI)),
          h('div', { class: 'row wrap', style: { gap: '16px' } },
            h('label', { class: 'row small' }, t('Zoom'), h('select', { style: { width: 'auto' }, onchange: (e) => (newWeb.zoom = Number(e.target.value)) },
              [50, 67, 75, 90, 100, 125, 150, 200].map((z) => h('option', { value: z, selected: z === newWeb.zoom }, `${z}%`)))),
            h('label', { class: 'row small' }, t('Reload every'), h('select', { style: { width: 'auto' }, onchange: (e) => (newWeb.refreshSeconds = Number(e.target.value)) },
              [[0, 'never'], [60, 'minute'], [300, '5 minutes'], [900, '15 minutes'], [3600, 'hour']].map(([v, l]) => h('option', { value: v, selected: v === newWeb.refreshSeconds }, t(l)))))),
          h('span', { class: 'hint' }, t('Departure boards, traffic info, dashboards… The KevCast Player app also shows sites that normally refuse to be embedded.')));
        newBox.hidden = webChoice !== '__new';
        whatBox.replaceChildren(
          h('select', { onchange: (e) => { webChoice = e.target.value; newBox.hidden = webChoice !== '__new'; if (webChoice !== '__new') s.mediaId = webChoice; } },
            webPages.map((m) => h('option', { value: m.id, selected: m.id === webChoice }, `${m.name} — ${m.url}`)),
            h('option', { value: '__new', selected: webChoice === '__new' }, t('+ New web page…'))),
          newBox);
        if (webChoice !== '__new') s.mediaId = webChoice;
      }
    };
    drawWhat();
    const durI = h('input', { type: 'number', min: 0, value: s.itemDuration || '', placeholder: 'default', style: { width: '110px' }, oninput: (e) => (s.itemDuration = Number(e.target.value) || 0) });

    // --- When? ------------------------------------------------------------------------
    const dayBox = h('div', { class: 'day-pick' });
    const drawDays = () => dayBox.replaceChildren(...[1, 2, 3, 4, 5, 6, 0].map((d) => h('button', { type: 'button', class: s.days.includes(d) ? 'on' : '', onclick: () => {
      s.days = s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d]; drawDays();
    } }, DAYS[d])));
    drawDays();
    const quick = (label, days) => h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { s.days = days; drawDays(); } }, label);
    const weeklyBox = h('div', { class: 'stack', style: { gap: '8px' } }, dayBox,
      h('div', { class: 'row wrap' }, quick(t('Weekdays'), [1, 2, 3, 4, 5]), quick(t('Weekend'), [0, 6]), quick(t('Every day'), [0, 1, 2, 3, 4, 5, 6]),
        h('div', { class: 'spacer' }),
        h('label', { class: 'row small' }, t('Repeat'), h('select', { style: { width: 'auto' }, onchange: (e) => (s.everyWeeks = Number(e.target.value)) },
          [[1, 'every week'], [2, 'every 2 weeks'], [3, 'every 3 weeks'], [4, 'every 4 weeks']].map(([v, l]) => h('option', { value: v, selected: v === (Number(s.everyWeeks) || 1) }, l))))));
    const monthlyBox = h('label', { class: 'row small' }, t('On day'), h('select', { style: { width: 'auto' }, onchange: (e) => (s.monthDay = Number(e.target.value)) },
      Array.from({ length: 31 }, (_, i) => i + 1).map((n) => h('option', { value: n, selected: n === Number(s.monthDay) }, ordinal(n)))), t('of every month'));
    const onceDate = h('input', { type: 'date', value: s.startDate || dkey(new Date()), style: { width: 'auto' }, oninput: (e) => (s.startDate = e.target.value || null) });
    const onceBox = h('label', { class: 'row small' }, t('On'), onceDate);
    const from = h('input', { type: 'date', value: s.startDate || '', oninput: () => (s.startDate = from.value || null) });
    const until = h('input', { type: 'date', value: s.endDate || '', oninput: () => (s.endDate = until.value || null) });
    const periodBox = h('div', { class: 'grid2' },
      h('label', { class: 'field' }, t('Valid from'), h('span', { class: 'hint' }, t('Empty = starting now')), from),
      h('label', { class: 'field' }, t('Valid until'), h('span', { class: 'hint' }, t('Empty = no end date')), until));
    const drawRepeat = () => {
      weeklyBox.hidden = s.repeat !== 'weekly';
      monthlyBox.hidden = s.repeat !== 'monthly';
      onceBox.hidden = s.repeat !== 'once';
      periodBox.hidden = s.repeat === 'once';
    };
    drawRepeat();

    const startI = h('input', { type: 'time', value: s.start, oninput: () => (s.start = startI.value) });
    const endI = h('input', { type: 'time', value: s.end, oninput: () => (s.end = endI.value) });
    const timeRow = h('div', { class: 'grid2' }, h('label', { class: 'field' }, t('From'), startI), h('label', { class: 'field' }, t('Until'), h('span', { class: 'hint' }, t('An earlier time means it runs past midnight')), endI));
    timeRow.hidden = s.allDay;
    const allDay = h('input', { type: 'checkbox', checked: s.allDay, onchange: () => { s.allDay = allDay.checked; timeRow.hidden = s.allDay; } });

    // Recurring within the window ("traffic info every 15 minutes for 1 minute").
    const iv = s.interval || { everyMinutes: 15, showSeconds: 60 };
    const ivOn = h('input', { type: 'checkbox', checked: !!s.interval });
    const ivEvery = h('input', { type: 'number', min: 1, value: iv.everyMinutes, style: { width: '80px' } });
    const ivShow = h('input', { type: 'number', min: 5, value: iv.showSeconds, style: { width: '90px' } });
    const ivBox = h('div', { class: 'row wrap small', style: { gap: '8px', marginLeft: '26px' } }, t('Every'), ivEvery, t('minutes, show it for'), ivShow, t('seconds, then return to the normal content.'));
    ivBox.hidden = !s.interval;
    ivOn.onchange = () => { ivBox.hidden = !ivOn.checked; };

    const name = h('input', { value: s.name, placeholder: t('e.g. Lunch menu (optional)'), oninput: () => (s.name = name.value) });
    const approved = state.displays.filter((d) => d.approved);

    modal({
      title: s.id ? t('Edit scheduled content') : t('Add to schedule'),
      wide: true,
      body: [
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('What should play?')),
          segmented([['playlist', t('Playlist')], ['web', t('Web page')], ['media', t('Single item')]], what, (v) => {
            what = v;
            if (v === 'playlist') { s.mediaId = null; s.playlistId = s.playlistId || state.playlists[0]?.id || null; }
            drawWhat();
          }),
          whatBox,
          h('label', { class: 'row small', style: { marginTop: '4px' } }, t('Show each item for'), durI, t('seconds'),
            h('span', { class: 'hint' }, t('(empty = the item’s own time; for PowerPoint this is per slide)')))),
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('Which screens?')), targetChips(s.targets),
          approved.length ? null : h('span', { class: 'hint' }, t('No displays connected yet — “All displays” will include them once added.'))),
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('When?')),
          segmented([['weekly', t('Weekly')], ['monthly', t('Monthly')], ['once', t('Once')]], s.repeat, (v) => { s.repeat = v; if (v === 'once' && !s.startDate) s.startDate = onceDate.value; drawRepeat(); }),
          weeklyBox, monthlyBox, onceBox),
        h('label', { class: 'check' }, allDay, t('All day')),
        timeRow,
        h('label', { class: 'check' }, ivOn, t('Repeat within this time (e.g. traffic info every 15 minutes)')),
        ivBox,
        periodBox,
        h('details', { open: !!(s.priority || s.name) },
          h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, t('More options')),
          h('div', { class: 'stack', style: { marginTop: '12px' } },
            h('label', { class: 'field' }, t('Label'), name),
            h('div', { class: 'field' }, h('b', { class: 'small' }, t('Priority')), h('span', { class: 'hint' }, t('When schedules overlap, the higher priority wins.')),
              segmented([[0, t('Normal')], [5, t('High')], [10, t('Urgent')]], s.priority >= 10 ? 10 : s.priority >= 5 ? 5 : 0, (v) => { s.priority = v; })))),
        err,
      ],
      footer: (close) => [
        s.id ? h('button', { class: 'btn danger', onclick: async () => {
          if (!(await confirmBox(t('Remove from schedule?'), t('The content itself is not deleted.'), t('Remove')))) return;
          await api(`/schedules/${s.id}`, { method: 'DELETE' }); close(); await loadAll(); renderPage();
        } }, icon('trash'), t('Remove')) : null,
        s.id ? h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: s.enabled !== false, onchange: (e) => (s.enabled = e.target.checked) }), t('Enabled')) : null,
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn primary', onclick: async () => {
          err.textContent = '';
          if (s.repeat === 'weekly' && !s.days.length) { err.textContent = t('Pick at least one day.'); return; }
          if (s.repeat === 'once') s.startDate = onceDate.value || null;
          if (!s.allDay && s.start === s.end) { err.textContent = t('Start and end time can’t be the same.'); return; }
          s.interval = ivOn.checked ? { everyMinutes: Number(ivEvery.value) || 15, showSeconds: Number(ivShow.value) || 60 } : null;
          try {
            if (what === 'playlist') {
              if (!s.playlistId) { err.textContent = t('Pick a playlist.'); return; }
              s.mediaId = null;
            } else if (what === 'web' && webChoice === '__new') {
              let u = newWeb.url.trim();
              if (!u) { err.textContent = t('Enter the web address.'); return; }
              if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
              const m = await api('/media', { method: 'POST', body: { type: 'web', url: u, name: newWeb.name.trim(), zoom: newWeb.zoom, refreshSeconds: newWeb.refreshSeconds } });
              s.mediaId = m.id;
              webChoice = m.id;
            }
            if (what !== 'playlist' && !s.mediaId) { err.textContent = t('Pick what should play.'); return; }
            if (what !== 'playlist') s.playlistId = null;
            await api(s.id ? `/schedules/${s.id}` : '/schedules', { method: s.id ? 'PUT' : 'POST', body: s });
            close(); await loadAll();
            if (route().page !== 'schedule') go('#/schedule'); else renderPage();
            toast(t('Schedule saved'), 'ok');
          } catch (e) { err.textContent = e.message; }
        } }, t('Save')),
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // Displays
  // ---------------------------------------------------------------------------
  function playlistSelect(value, onChange, emptyLabel = t('Nothing (show clock)')) {
    return h('select', { onchange: (e) => onChange(e.target.value || null) },
      h('option', { value: '' }, emptyLabel), state.playlists.map((p) => h('option', { value: p.id, selected: p.id === value }, p.name)));
  }

  function playerUrl() {
    return (state.overview?.playerUrls || [])[0] || `${location.origin}/player/`;
  }

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------
  const groupNames = () => state.groups.map((g) => g.name);
  const groupByName = (n) => state.groups.find((g) => g.name === n);
  const groupsOfDisplay = (d) => KevSchedule.groupsOf(d);
  const groupBadge = (n) => {
    const g = groupByName(n);
    return h('span', { class: 'badge', style: g ? { background: `${g.color}22`, color: g.color } : {} }, `▦ ${n}`);
  };

  /**
   * Toggle chips for choosing groups, with "+ New group" inline.
   * `selected` is an array of names that is updated in place.
   */
  function groupPicker(selected, onChange) {
    const box = h('div', { class: 'chips' });
    const draw = () => {
      const input = h('input', { placeholder: t('New group name'), style: { width: '170px', padding: '5px 10px', borderRadius: '999px' },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } } });
      const add = () => {
        const n = input.value.trim();
        if (!n) return;
        if (!selected.some((x) => x.toLowerCase() === n.toLowerCase())) selected.push(n);
        if (!groupByName(n)) state.groups.push({ id: `new-${n}`, name: n, color: '#64748b', members: 0, online: 0, schedules: 0, displayIds: [] });
        draw(); onChange && onChange();
      };
      box.replaceChildren(
        ...groupNames().map((n) => h('button', { type: 'button', class: `chip ${selected.includes(n) ? 'on' : ''}`, onclick: () => {
          const i = selected.indexOf(n);
          if (i >= 0) selected.splice(i, 1); else selected.push(n);
          draw(); onChange && onChange();
        } }, `▦ ${n}`)),
        h('span', { class: 'row', style: { gap: '4px' } }, input, h('button', { type: 'button', class: 'btn sm', onclick: add }, icon('plus'), t('Add'))));
    };
    draw();
    return box;
  }

  function GroupsPage(arg) {
    const g = state.groups.find((x) => x.id === arg);
    if (g) return groupDetail(g);
    return [
      pageHead(t('Groups'), t('Put screens in groups, then schedule or send content to the whole group at once. A screen can be in several groups.'),
        h('button', { class: 'btn primary', onclick: () => groupDialog() }, icon('plus'), t('New group'))),
      state.groups.length ? h('div', { class: 'grp-grid' }, state.groups.map((x) => {
        const members = state.displays.filter((d) => d.approved && groupsOfDisplay(d).includes(x.name));
        return h('a', { class: 'card grp-card', href: `#/groups/${x.id}`, style: { borderTopColor: x.color } },
          h('div', { class: 'row' }, h('h3', {}, x.name), h('div', { class: 'spacer' }),
            h('span', { class: 'small muted' }, t('{n}/{total} online', { n: members.filter((d) => d.online).length, total: members.length }))),
          x.description ? h('div', { class: 'muted small' }, x.description) : null,
          h('div', { class: 'chips' }, members.length ? members.slice(0, 8).map((d) => h('span', { class: 'chip', style: { cursor: 'inherit' } },
            h('span', { class: `dot ${d.online ? 'on' : ''}`, style: { marginRight: '6px' } }), d.name)) : h('span', { class: 'muted small' }, t('No screens yet')),
            members.length > 8 ? h('span', { class: 'muted small' }, t('+{v} more', { v: members.length - 8 })) : null),
          h('div', { class: 'muted small' }, tn(x.schedules, '{n} schedule entry', '{n} schedule entries')));
      })) : h('div', { class: 'card empty' }, h('h3', {}, t('No groups yet')),
        h('p', {}, t('Create groups like “Lobby”, “Canteen” or “Floor 2”, add screens, and schedule content for all of them at once.')),
        h('button', { class: 'btn primary', onclick: () => groupDialog() }, icon('plus'), t('Create your first group'))),
    ];
  }

  /** Create or edit a group (name, colour, description, members). */
  function groupDialog(existing) {
    const approved = state.displays.filter((d) => d.approved);
    const g = Object.assign({ name: '', color: '#0891b2', description: '' }, existing || {});
    const members = new Set(existing ? approved.filter((d) => groupsOfDisplay(d).includes(existing.name)).map((d) => d.id) : []);
    const err = h('div', { class: 'err-text' });
    const name = h('input', { value: g.name, placeholder: t('e.g. Canteen') });
    const color = h('input', { type: 'color', value: g.color });
    const desc = h('input', { value: g.description || '', placeholder: t('Optional, e.g. “All screens on the ground floor”') });
    modal({
      title: existing ? t('Edit group — {name}', { name: existing.name }) : t('New group'),
      body: [
        h('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-end' } }, h('label', { class: 'field', style: { flex: 1 } }, t('Name'), name), h('label', { class: 'field' }, t('Colour'), color)),
        h('label', { class: 'field' }, t('Description'), desc),
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('Screens in this group')),
          approved.length ? screenChecklist(approved, members) : h('span', { class: 'hint' }, t('No screens connected yet. You can add them later.'))),
        err,
      ],
      footer: (close) => [
        existing ? h('button', { class: 'btn danger', onclick: async () => {
          const n = state.schedules.filter((s) => (s.targets?.groups || []).includes(existing.name)).length;
          const text = n
            ? tn(n, 'The screens stay connected; they just leave “{name}”. {n} schedule entry aimed only at this group will be removed too.', 'The screens stay connected; they just leave “{name}”. {n} schedule entries aimed only at this group will be removed too.', { name: existing.name })
            : t('The screens stay connected; they just leave “{name}”.', { name: existing.name });
          if (!(await confirmBox(t('Delete group?'), text, t('Delete group')))) return;
          await api(`/groups/${existing.id}`, { method: 'DELETE' });
          close(); await loadAll(); go('#/groups'); renderPage(); toast(t('Group deleted'));
        } }, icon('trash'), t('Delete')) : null,
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn primary', onclick: async () => {
          try {
            let saved;
            if (existing) {
              saved = await api(`/groups/${existing.id}`, { method: 'PATCH', body: { name: name.value, color: color.value, description: desc.value } });
              const before = new Set(existing.displayIds || []);
              await api(`/groups/${existing.id}/members`, { method: 'POST', body: { add: [...members].filter((id) => !before.has(id)), remove: [...before].filter((id) => !members.has(id)) } });
            } else {
              saved = await api('/groups', { method: 'POST', body: { name: name.value, color: color.value, description: desc.value, displayIds: [...members] } });
            }
            close(); await loadAll();
            if (route().page === 'groups') go(`#/groups/${saved.id}`);
            renderPage(); toast(t('Group saved'), 'ok');
          } catch (e) { err.textContent = e.message; }
        } }, existing ? t('Save') : t('Create group')),
      ],
    });
  }

  /** Checkbox list of screens (with "select all"), updating a Set of ids. */
  function screenChecklist(list, selected) {
    const box = h('div', { class: 'screen-check' });
    const draw = () => box.replaceChildren(
      h('label', { class: 'check small', style: { gridColumn: '1 / -1' } },
        h('input', { type: 'checkbox', checked: list.every((d) => selected.has(d.id)), onchange: (e) => { list.forEach((d) => (e.target.checked ? selected.add(d.id) : selected.delete(d.id))); draw(); } }),
        h('b', {}, t('Select all'))),
      ...list.map((d) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: selected.has(d.id), onchange: (e) => { e.target.checked ? selected.add(d.id) : selected.delete(d.id); draw(); } }),
        h('span', { class: `dot ${d.online ? 'on' : ''}` }), d.name,
        groupsOfDisplay(d).length ? h('span', { class: 'muted small' }, ` · ${groupsOfDisplay(d).join(', ')}`) : null)));
    draw();
    return box;
  }

  function groupDetail(g) {
    const members = state.displays.filter((d) => d.approved && groupsOfDisplay(d).includes(g.name));
    const entries = state.schedules.filter((s) => (s.targets?.groups || []).includes(g.name));
    const sel = { group: g.name };
    const start = weekStart(state.calWeekOffset);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
    const others = state.groups.filter((x) => x.id !== g.id);
    return [
      pageHead(h('span', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'swatch', style: { background: g.color, width: '16px', height: '16px' } }), g.name),
        tn(members.length, '{n} screen · {n2} online{v}', '{n} screens · {n2} online{v}', { n2: members.filter((d) => d.online).length, v: g.description ? ` · ${g.description}` : '' }),
        h('a', { class: 'btn ghost', href: '#/groups' }, icon('left'), t('All groups')),
        h('button', { class: 'btn', onclick: () => groupDialog(g) }, icon('settings'), t('Edit group')),
        h('button', { class: 'btn primary', onclick: () => scheduleDialog({ targets: { displays: [], groups: [g.name] } }) }, icon('schedule'), t('Schedule for this group'))),
      h('div', { class: 'row wrap', style: { marginBottom: '16px' } },
        groupPlaylistFor(g.name)
          ? h('a', { class: 'btn sm', href: `#/playlists/${groupPlaylistFor(g.name).id}`, title: t('This playlist has the same name as the group, so the group plays it whenever nothing else is scheduled') }, icon('playlist'), t('Group playlist: {name}', { name: groupPlaylistFor(g.name).name }))
          : h('button', { class: 'btn sm', title: t('A playlist with the same name as the group plays on it whenever nothing else is scheduled'), onclick: async () => {
            const pl = await api('/playlists', { method: 'POST', body: { name: g.name } });
            await loadAll(); go(`#/playlists/${pl.id}`);
          } }, icon('plus'), t('Create playlist “{name}”', { name: g.name })),
        h('button', { class: 'btn sm', onclick: () => sendDialog({ targets: { displays: [], groups: [g.name] } }) }, icon('play'), t('Send to group')),
        groupPlaylistFor(g.name) ? null : h('button', { class: 'btn sm', onclick: () => bulkDefaultDialog({ group: g.name }, t('the {n} screens in “{name}”', { n: members.length, name: g.name })) }, t('Set default playlist')),
        h('button', { class: 'btn sm', onclick: () => groupCommand(sel, 'identify', t('Identify')) }, icon('eye'), t('Identify')),
        h('button', { class: 'btn sm', onclick: () => groupCommand(sel, 'reload', t('Reload')) }, icon('refresh'), t('Reload')),
        others.length && entries.length ? h('button', { class: 'btn sm', onclick: () => copyScheduleDialog(g, entries.length) }, icon('copy'), t('Copy schedule to…')) : null),
      h('div', { class: 'grp-detail' },
        h('div', { class: 'card' },
          h('div', { class: 'section-head' }, h('h3', {}, t('Screens')), h('div', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: () => groupDialog(g) }, icon('plus'), t('Add or remove'))),
          members.length ? members.map((d) => h('div', { class: 'list-row' },
            h('span', { class: `dot ${d.online ? 'on' : ''}` }),
            h('div', { style: { minWidth: 0 } }, h('b', {}, d.name), h('div', { class: 'muted small' }, d.online ? (d.nowPlaying ? t('Showing: {name}', { name: d.nowPlaying.name }) : t('Online')) : t('Offline · {v}', { v: ago(d.lastSeen) }))),
            h('div', { class: 'spacer' }),
            h('button', { class: 'btn icon ghost', title: t('Remove from {name}', { name: g.name }), onclick: async () => {
              await api(`/groups/${g.id}/members`, { method: 'POST', body: { remove: [d.id] } }); await loadAll(); renderPage();
            } }, '✕'))) :
            h('div', { class: 'empty small' }, t('No screens yet. '), h('a', { href: '#', onclick: (e) => { e.preventDefault(); groupDialog(g); } }, t('Add screens')))),
        h('div', { class: 'stack' },
          h('div', { class: 'row' }, h('h3', {}, t('What this group plays this week')), h('div', { class: 'spacer' }),
            h('button', { class: 'btn sm', onclick: () => { state.calWeekOffset--; renderPage(); } }, icon('left')),
            h('button', { class: 'btn sm', onclick: () => { state.calWeekOffset = 0; renderPage(); } }, t('This week')),
            h('button', { class: 'btn sm', onclick: () => { state.calWeekOffset++; renderPage(); } }, icon('right'))),
          weekOverview(days, groupTarget(g.name), false, groupPlaylistFor(g.name)
            ? t('Everything scheduled for “{name}”. When nothing is scheduled, the group plays the playlist “{name2}” (same name as the group). Schedules aimed at a single screen are not shown here.', { name: g.name, name2: groupPlaylistFor(g.name).name })
            : t('Everything scheduled for “{name}”. When nothing is scheduled, each screen shows its own default playlist. Tip: name a playlist “{name2}” and this group plays it automatically. Schedules aimed at a single screen are not shown here.', { name: g.name, name2: g.name })))),
      h('h3', { style: { margin: '18px 0 0' } }, t('Schedule entries for this group')),
      scheduleTable(entries, { emptyText: t('Nothing is scheduled for this group yet. Click “Schedule for this group”.') }),
    ];
  }

  function copyScheduleDialog(g, count) {
    const picked = new Set();
    const others = state.groups.filter((x) => x.id !== g.id);
    modal({
      title: t('Copy the schedule of “{name}”', { name: g.name }),
      body: [h('p', { class: 'muted', style: { margin: 0 } }, tn(count, 'The {n} schedule entry of this group are copied to the groups you pick. The copies can then be changed separately.', 'The {n} schedule entries of this group are copied to the groups you pick. The copies can then be changed separately.')),
        h('div', { class: 'screen-check' }, others.map((x) => h('label', { class: 'check' },
          h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? picked.add(x.id) : picked.delete(x.id)) }),
          h('span', { class: 'swatch', style: { background: x.color } }), x.name)))],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn primary', onclick: async () => {
          try {
            const r = await api(`/groups/${g.id}/copy-schedule`, { method: 'POST', body: { toGroupIds: [...picked] } });
            close(); await loadAll(); renderPage(); toast(tn(r.copied, 'Copied {n} schedule entry', 'Copied {n} schedule entries'), 'ok');
          } catch (e) { toast(e.message, 'err'); }
        } }, icon('copy'), t('Copy'))],
    });
  }

  /** Set the default playlist for many screens at once. */
  function bulkDefaultDialog(selection, label) {
    let pid = state.playlists[0]?.id || null;
    modal({
      title: t('Set default playlist'),
      body: [h('p', { class: 'muted', style: { margin: 0 } }, t('For {label}. It plays whenever nothing else is scheduled.', { label: label })),
        h('label', { class: 'field' }, t('Playlist'), playlistSelect(pid, (v) => (pid = v)))],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn primary', onclick: async () => {
          const r = await api('/displays/bulk', { method: 'PATCH', body: { ...selection, patch: { defaultPlaylistId: pid } } });
          close(); await loadAll(); renderPage(); toast(tn(r.updated, 'Updated {n} screen', 'Updated {n} screens'), 'ok');
        } }, t('Save'))],
    });
  }

  // ---------------------------------------------------------------------------
  // Displays
  // ---------------------------------------------------------------------------
  function pairDialog() {
    const code = h('input', { class: 'code-input', maxlength: 6, placeholder: 'ABC123', autocomplete: 'off' });
    const name = h('input', { placeholder: t('e.g. Reception TV') });
    const groups = [];
    let defPl = state.playlists[0]?.id || null;
    const err = h('div', { class: 'err-text' });
    modal({
      title: t('Add a display'),
      body: [
        h('ol', { style: { margin: 0, paddingLeft: '20px', lineHeight: 1.8 } },
          h('li', {}, t('Start the KevCast Player app on the screen, or open this page in its browser:'), h('div', { class: 'urlbox', style: { margin: '6px 0' } }, playerUrl())),
          h('li', {}, t('A 6-character code appears on the screen. Type it below.'))),
        h('label', { class: 'field' }, t('Code shown on the screen'), code),
        h('label', { class: 'field' }, t('Name'), name),
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('Groups')), h('span', { class: 'hint' }, t('Optional. Content scheduled for a group plays on all its screens.')), groupPicker(groups)),
        h('label', { class: 'field' }, t('Show by default'), h('span', { class: 'hint' }, t('Plays whenever nothing else is scheduled')), playlistSelect(defPl, (v) => (defPl = v))),
        err,
      ],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn primary', onclick: async () => {
          try {
            await api('/displays/pair', { method: 'POST', body: { code: code.value, name: name.value.trim(), groups, defaultPlaylistId: defPl } });
            close(); toast(t('Display connected!'), 'ok'); await loadAll(); renderPage();
          } catch (e) { err.textContent = e.message; }
        } }, t('Connect display'))],
    });
  }

  const isApp = (d) => /KevCastPlayer/.test(d.userAgent || '');

  async function groupCommand(sel, action, label) {
    const r = await api('/displays/command', { method: 'POST', body: { ...sel, action } });
    if (!r.targeted) return toast(t('No screens in this selection'), 'err');
    toast(r.delivered ? tn(r.targeted, '{label} sent to {delivered} of {n} screen', '{label} sent to {delivered} of {n} screens', { label, delivered: r.delivered }) : t('All screens in this selection are offline'), r.delivered ? '' : 'err');
  }

  const selectedDisplays = new Set();

  function DisplaysPage() {
    const approved = state.displays.filter((d) => d.approved);
    const pending = state.displays.filter((d) => !d.approved && Date.now() - new Date(d.lastSeen) < 120000);
    const filter = state.displayFilter || '';
    const shown = approved.filter((d) => !filter || (filter === '__none' ? !groupsOfDisplay(d).length : groupsOfDisplay(d).includes(filter)));
    for (const id of [...selectedDisplays]) if (!approved.some((d) => d.id === id)) selectedDisplays.delete(id);
    const ids = [...selectedDisplays];
    const n = ids.length;

    let bulk = null;
    if (n) {
      const addSel = h('select', { style: { width: 'auto' } }, h('option', { value: '' }, t('Add to group…')), groupNames().map((g) => h('option', { value: g }, g)), h('option', { value: '__new' }, t('+ New group…')));
      addSel.onchange = async () => {
        let g = addSel.value;
        addSel.value = '';
        if (!g) return;
        if (g === '__new') { g = (prompt(t('Name of the new group')) || '').trim(); if (!g) return; }
        await api('/displays/bulk', { method: 'PATCH', body: { ids, addGroups: [g] } });
        await loadAll(); renderPage(); toast(tn(n, 'Added {n} screen to “{g}”', 'Added {n} screens to “{g}”', { g: g }), 'ok');
      };
      const inSel = [...new Set(approved.filter((d) => selectedDisplays.has(d.id)).flatMap(groupsOfDisplay))];
      const remSel = h('select', { style: { width: 'auto' } }, h('option', { value: '' }, t('Remove from group…')), inSel.map((g) => h('option', { value: g }, g)));
      remSel.onchange = async () => {
        const g = remSel.value;
        remSel.value = '';
        if (!g) return;
        await api('/displays/bulk', { method: 'PATCH', body: { ids, removeGroups: [g] } });
        await loadAll(); renderPage(); toast(t('Removed from “{g}”', { g: g }), 'ok');
      };
      bulk = h('div', { class: 'card bulk-bar' },
        h('b', {}, tn(n, '{n} screen selected', '{n} screens selected')),
        addSel, inSel.length ? remSel : null,
        h('button', { class: 'btn sm', onclick: () => bulkDefaultDialog({ ids }, tn(n, '{n} selected screen', '{n} selected screens')) }, t('Set default playlist')),
        h('button', { class: 'btn sm', onclick: () => sendDialog({ targets: { displays: ids, groups: [] } }) }, icon('play'), t('Send to these')),
        h('button', { class: 'btn sm', onclick: () => scheduleDialog({ targets: { displays: ids, groups: [] } }) }, icon('schedule'), t('Schedule')),
        h('button', { class: 'btn sm', onclick: () => groupCommand({ ids }, 'identify', t('Identify')) }, icon('eye')),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn sm ghost', onclick: () => { selectedDisplays.clear(); renderPage(); } }, t('Clear selection')));
    }

    return [
      pageHead(t('Displays'), t('Tick screens to add them to a group or change many at once. Manage groups on the Groups page.'),
        approved.length ? h('button', { class: 'btn', onclick: () => sendDialog({}) }, icon('play'), t('Send to screens')) : null,
        h('button', { class: 'btn primary', onclick: pairDialog }, icon('plus'), t('Add display'))),
      pending.length ? h('div', { class: 'alert' }, h('b', {}, tn(pending.length, '{n} screen is waiting to be connected.', '{n} screens are waiting to be connected.'), ' '), t('Click “Add display” and enter the code shown on the screen.')) : null,
      approved.length ? [
        h('div', { class: 'toolbar' },
          h('div', { class: 'chips' },
            h('button', { class: `chip ${!filter ? 'on' : ''}`, onclick: () => { state.displayFilter = ''; renderPage(); } }, t('All ({n})', { n: approved.length })),
            state.groups.map((g) => {
              const c = approved.filter((d) => groupsOfDisplay(d).includes(g.name)).length;
              return h('button', { class: `chip ${filter === g.name ? 'on' : ''}`, onclick: () => { state.displayFilter = g.name; renderPage(); } }, `▦ ${g.name} (${c})`);
            }),
            approved.some((d) => !groupsOfDisplay(d).length) ? h('button', { class: `chip ${filter === '__none' ? 'on' : ''}`, onclick: () => { state.displayFilter = '__none'; renderPage(); } }, t('No group')) : null),
          h('div', { class: 'spacer' }),
          h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: shown.length && shown.every((d) => selectedDisplays.has(d.id)),
            onchange: (e) => { shown.forEach((d) => (e.target.checked ? selectedDisplays.add(d.id) : selectedDisplays.delete(d.id))); renderPage({ soft: true }); } }), t('Select all'))),
        bulk,
        h('div', { class: 'disp-grid' }, shown.map(displayCard)),
        connectHelp()] :
        h('div', { class: 'card empty' }, h('h3', {}, t('No displays yet')),
          h('p', {}, t('Install the KevCast Player app on the screen (it finds this server automatically), or open this address in its browser:')), h('div', { class: 'urlbox', style: { maxWidth: '420px', margin: '10px auto' } }, playerUrl()),
          h('button', { class: 'btn primary', onclick: pairDialog }, t('I see a code — add display'))),
    ];
  }

  /** How to connect another screen: app or browser, with the exact page a browser must open. */
  function connectHelp() {
    const urls = (state.overview?.playerUrls || []).length ? state.overview.playerUrls : [`${location.origin}/player/`];
    return h('div', { class: 'card pad stack', style: { marginTop: '8px' } },
      h('h2', {}, t('Connect another screen')),
      h('div', { class: 'grid2' },
        h('div', { class: 'stack', style: { gap: '6px' } },
          h('b', {}, t('With the KevCast Player app (recommended)')),
          h('span', { class: 'muted small' }, t('For Windows, macOS, Linux and Raspberry Pi. It finds this server automatically, starts with the computer, keeps playing offline and only closes with Alt+Q.'))),
        h('div', { class: 'stack', style: { gap: '6px' } },
          h('b', {}, t('With a web browser (smart TV, any PC)')),
          h('span', { class: 'muted small' }, t('Open this page on the screen and press F11 for full screen:')),
          urls.map((u) => h('div', { class: 'urlbox' }, h('span', { style: { flex: 1 } }, u),
            h('button', { class: 'btn sm', onclick: () => { navigator.clipboard?.writeText(u); toast(t('Copied')); } }, icon('copy')))))),
      h('span', { class: 'muted small' }, t('The screen then shows a 6-character code. Click “Add display” above and enter it.')));
  }

  function targetChips(targets, onChange) {
    const approved = state.displays.filter((d) => d.approved);
    const box = h('div', { class: 'chips' });
    const draw = () => {
      const all = !targets.displays.length && !targets.groups.length;
      box.replaceChildren(
        h('button', { type: 'button', class: `chip ${all ? 'on' : ''}`, onclick: () => { targets.displays = []; targets.groups = []; draw(); onChange && onChange(); } }, t('All displays')),
        ...state.groups.map((g) => h('button', { type: 'button', class: `chip ${targets.groups.includes(g.name) ? 'on' : ''}`, title: tn(g.members, '{n} screen', '{n} screens'), onclick: () => {
          targets.groups = targets.groups.includes(g.name) ? targets.groups.filter((x) => x !== g.name) : [...targets.groups, g.name]; draw(); onChange && onChange();
        } }, `▦ ${g.name}`)),
        ...approved.map((d) => h('button', { type: 'button', class: `chip ${targets.displays.includes(d.id) ? 'on' : ''}`, onclick: () => {
          targets.displays = targets.displays.includes(d.id) ? targets.displays.filter((x) => x !== d.id) : [...targets.displays, d.id]; draw(); onChange && onChange();
        } }, d.name)));
    };
    draw();
    return box;
  }

  /** "Send to screens": put a playlist on a group / selection of screens right now, temporarily, or on a schedule. */
  function sendDialog({ playlistId, targets }) {
    if (!state.playlists.length) { toast(t('Create a playlist first.'), 'err'); return go('#/playlists'); }
    const tx = JSON.parse(JSON.stringify(targets || { displays: [], groups: [] }));
    let pid = playlistId || state.playlists[0].id;
    if (!targets && byId(state.playlists, pid)) tx.groups = groupsForPlaylist(byId(state.playlists, pid)).map((g) => g.name);
    let mode = 'default';
    const count = h('span', { class: 'muted small' });
    const resolveIds = () => {
      const approved = state.displays.filter((d) => d.approved);
      if (!tx.displays.length && !tx.groups.length) return approved.map((d) => d.id);
      return approved.filter((d) => tx.displays.includes(d.id) || KevSchedule.groupsOf(d).some((g) => tx.groups.includes(g))).map((d) => d.id);
    };
    const updateCount = () => { const n = resolveIds().length; count.textContent = tn(n, '{n} screen selected', '{n} screens selected'); };
    updateCount();
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60000);
    const until = h('input', { type: 'time', value: `${pad(later.getHours())}:${pad(later.getMinutes())}`, style: { width: 'auto' } });
    const untilRow = h('label', { class: 'row small' }, t('Show until'), until, h('span', { class: 'muted' }, t('today, then go back to normal')));
    untilRow.hidden = true;
    const hint = h('p', { class: 'muted small', style: { margin: 0 } });
    const hints = {
      default: t('The playlist becomes the default content of these screens. Scheduled content still takes over at its scheduled times.'),
      now: t('Takes over these screens immediately (high priority), then they return to their normal content.'),
      schedule: t('Pick days and times in the next step.'),
    };
    hint.textContent = hints.default;
    modal({
      title: t('Send to screens'),
      body: [
        playlistId ? h('div', {}, h('b', {}, t('Playlist: ')), byId(state.playlists, pid)?.name) :
          h('label', { class: 'field' }, t('What should play?'), playlistSelect(pid, (v) => (pid = v), t('— choose —'))),
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('Which screens?')), targetChips(tx, updateCount), count),
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('How?')),
          segmented([['default', t('Make it the default')], ['now', t('Take over now')], ['schedule', t('Schedule…')]], mode, (v) => { mode = v; untilRow.hidden = v !== 'now'; hint.textContent = hints[v]; }),
          hint),
        untilRow,
      ],
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn primary', onclick: async () => {
          if (!pid) return toast(t('Choose a playlist'), 'err');
          const ids = resolveIds();
          if (!ids.length) return toast(t('No screens selected (or none connected yet).'), 'err');
          if (mode === 'schedule') { close(); return scheduleDialog({ playlistId: pid, targets: tx }); }
          if (mode === 'default') {
            await api('/displays/bulk', { method: 'PATCH', body: { ids, patch: { defaultPlaylistId: pid } } });
          } else {
            const d = new Date();
            const start = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            if (until.value <= start) return toast(t('Pick an end time later today.'), 'err');
            await api('/schedules', { method: 'POST', body: { name: `Now: ${byId(state.playlists, pid)?.name || ''}`, playlistId: pid, targets: tx, days: [d.getDay()], start, end: until.value, startDate: dkey(d), endDate: dkey(d), priority: 5 } });
          }
          close(); await loadAll(); renderPage();
          toast(tn(ids.length, 'Sent to {n} screen', 'Sent to {n} screens'), 'ok');
        } }, icon('play'), t('Send'))],
    });
  }

  function displayCard(d) {
    const scheduled = d.scheduledMediaId || d.scheduledPlaylistId ? contentInfo(d.scheduledMediaId ? `media:${d.scheduledMediaId}` : d.scheduledPlaylistId) : null;
    const np = d.nowPlaying;
    const npMedia = np && state.media.find((m) => m.name === np.name);
    const shot = d.screenshotAt && d.online ? `/api/displays/${d.id}/screenshot?t=${encodeURIComponent(d.screenshotAt)}` : null;
    const preview = shot ? h('img', { src: shot, title: t('Screenshot {v}', { v: ago(d.screenshotAt) }) }) :
      d.online && npMedia?.thumb ? h('img', { src: npMedia.type === 'presentation' && np.slide ? npMedia.slideUrls[np.slide - 1] : npMedia.thumb }) : icon('display');
    const picked = selectedDisplays.has(d.id);
    return h('div', { class: `card disp-card ${picked ? 'picked' : ''}` },
      h('div', { class: 'row' },
        h('input', { type: 'checkbox', checked: picked, title: t('Select (to add to a group or change many at once)'), onchange: (e) => { e.target.checked ? selectedDisplays.add(d.id) : selectedDisplays.delete(d.id); renderPage({ soft: true }); } }),
        h('span', { class: `dot ${d.online ? 'on' : ''}` }), h('h3', {}, d.name),
        h('span', { class: 'badge', title: isApp(d) ? t('KevCast Player app') : t('Web browser') }, isApp(d) ? t('App') : t('Browser')), h('div', { class: 'spacer' }),
        h('span', { class: 'small muted' }, d.online ? t('Online') : t('Offline · {v}', { v: ago(d.lastSeen) }))),
      KevSchedule.groupsOf(d).length ? h('div', { class: 'chips' }, KevSchedule.groupsOf(d).map((g) => {
        const gr = groupByName(g);
        return gr ? h('a', { href: `#/groups/${gr.id}`, style: { textDecoration: 'none' } }, groupBadge(g)) : groupBadge(g);
      })) : null,
      h('div', { class: 'disp-screen', style: d.orientation && d.orientation !== 'landscape' ? { aspectRatio: '9/16', maxHeight: '220px', margin: '0 auto' } : {} },
        preview,
        h('div', { class: 'np' }, d.online ? (np ? `▶ ${np.name}${np.slides ? t(' · slide {slide}/{slides}', { slide: np.slide, slides: np.slides }) : ''}` : t('Idle')) : t('Not connected'), shot ? h('span', { style: { float: 'right', opacity: 0.8 } }, `📷 ${ago(d.screenshotAt)}`) : null)),
      h('dl', { class: 'kv' },
        h('dt', {}, t('Now scheduled')), h('dd', {}, scheduled ? scheduled.name : '—', d.scheduleId ? '' : scheduled ? t(' (default)') : ''),
        h('dt', {}, t('Default')), h('dd', {}, d.groupPlaylistId
          ? h('a', { href: `#/playlists/${d.groupPlaylistId}`, title: t('A playlist with the same name as this screen’s group. Rename it to use the screen’s own default again.') }, t('▦ {v} (group)', { v: byId(state.playlists, d.groupPlaylistId)?.name || '' }))
          : playlistSelect(d.defaultPlaylistId, async (v) => { await api(`/displays/${d.id}`, { method: 'PATCH', body: { defaultPlaylistId: v } }); toast(t('Saved'), 'ok'); })),
        h('dt', {}, t('Screen')), h('dd', {}, d.resolution || '—', d.ip ? ` · ${d.ip.replace('::ffff:', '')}` : ''),
        d.cache ? h('dt', {}, t('Offline')) : null,
        d.cache ? h('dd', { title: t('Media stored on the device, so it keeps playing if the server goes down') },
          d.cache.total && d.cache.cached >= d.cache.total ? h('span', { class: 'badge ok' }, t('Ready')) : h('span', { class: 'badge warn' }, d.cache.downloading ? t('Downloading') : t('Partial')),
          t(' {cached}/{total} files · {v}', { cached: d.cache.cached, total: d.cache.total, v: fmtSize(d.cache.bytes || 0) })) : null),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn sm', onclick: () => displayDialog(d) }, icon('settings'), t('Settings')),
        h('button', { class: 'btn sm', title: t('Show the name on the screen for 10 seconds'), onclick: async () => { const r = await api(`/displays/${d.id}/identify`, { method: 'POST' }); toast(r.delivered ? t('Look at your screens!') : t('Display is offline'), r.delivered ? '' : 'err'); } }, icon('eye'), t('Identify')),
        h('button', { class: 'btn sm', onclick: async () => { const r = await api(`/displays/${d.id}/reload`, { method: 'POST' }); toast(r.delivered ? t('Reloading player…') : t('Display is offline'), r.delivered ? '' : 'err'); } }, icon('refresh'), t('Reload')),
        isApp(d) ? h('button', { class: 'btn sm', title: t('Take a screenshot of this screen'), onclick: async () => { const r = await api(`/displays/${d.id}/screenshot`, { method: 'POST' }); toast(r.delivered ? t('Screenshot requested — it appears in a few seconds') : t('Display is offline'), r.delivered ? '' : 'err'); } }, '📷') : null,
        h('a', { class: 'btn sm ghost', href: '#/schedule', onclick: () => { state.calDisplay = d.id; } }, icon('schedule'), t('Schedule'))));
  }

  function displayDialog(d) {
    const s = JSON.parse(JSON.stringify(d));
    s.ticker = Object.assign({ enabled: false, text: '', speed: 60, bg: '#111827', fg: '#ffffff' }, s.ticker || {});
    s.groups = [...KevSchedule.groupsOf(s)];
    const tickerBox = h('div', { class: 'stack' },
      h('label', { class: 'field' }, t('Ticker text'), h('span', { class: 'hint' }, t('Each line becomes a separate message')), h('textarea', { rows: 3, oninput: (e) => (s.ticker.text = e.target.value) }, s.ticker.text)),
      h('div', { class: 'row wrap', style: { gap: '16px' } },
        h('label', { class: 'row small' }, t('Speed'), segmented([[35, t('Slow')], [60, t('Normal')], [110, t('Fast')]], [35, 60, 110].includes(s.ticker.speed) ? s.ticker.speed : 60, (v) => (s.ticker.speed = v))),
        h('label', { class: 'row small' }, t('Background'), h('input', { type: 'color', value: s.ticker.bg, oninput: (e) => (s.ticker.bg = e.target.value) })),
        h('label', { class: 'row small' }, t('Text'), h('input', { type: 'color', value: s.ticker.fg, oninput: (e) => (s.ticker.fg = e.target.value) }))));
    tickerBox.hidden = !s.ticker.enabled;
    // Weekly restart (Player app): lets Windows install updates and keeps long-running screens fresh.
    s.maintenance = Object.assign({ weeklyRestart: true, day: 0, time: '03:00' }, s.maintenance || {});
    const restartDetail = h('div', { class: 'row wrap small', style: { gap: '8px', marginLeft: '26px' } },
      t('Every'), h('select', { style: { width: 'auto' }, onchange: (e) => (s.maintenance.day = Number(e.target.value)) },
        [0, 1, 2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: n === s.maintenance.day }, [t('Sunday'), t('Monday'), t('Tuesday'), t('Wednesday'), t('Thursday'), t('Friday'), t('Saturday')][n]))),
      t('at'), h('input', { type: 'time', value: s.maintenance.time, style: { width: 'auto' }, oninput: (e) => (s.maintenance.time = e.target.value || '03:00') }));
    restartDetail.hidden = !s.maintenance.weeklyRestart;
    const restartBox = h('div', { class: 'field' },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.maintenance.weeklyRestart, onchange: (e) => { s.maintenance.weeklyRestart = e.target.checked; restartDetail.hidden = !e.target.checked; } }),
        t('Weekly restart')),
      restartDetail,
      h('span', { class: 'hint', style: { marginLeft: '26px' } }, isApp(d)
        ? t('Windows restarts the computer so updates get installed; on macOS and Linux the player app restarts.')
        : t('Only for screens running the KevCast Player app (this one uses a browser).')));

    modal({
      title: t('Display settings — {name}', { name: d.name }),
      body: [
        h('label', { class: 'field' }, t('Name'), h('input', { value: s.name, oninput: (e) => (s.name = e.target.value) })),
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('Groups')), groupPicker(s.groups)),
        h('label', { class: 'field' }, t('Default playlist'), h('span', { class: 'hint' }, t('Plays whenever nothing else is scheduled')), playlistSelect(s.defaultPlaylistId, (v) => (s.defaultPlaylistId = v)),
          d.groupPlaylistId ? h('span', { class: 'hint', style: { color: 'var(--warn)' } }, t('This screen is in a group with its own playlist, “{v}”, so it plays that one instead.', { v: byId(state.playlists, d.groupPlaylistId)?.name })) : null),
        h('div', { class: 'grid2' },
          h('div', { class: 'field' }, h('b', { class: 'small' }, t('Orientation')), segmented([['landscape', t('Landscape')], ['portrait-left', t('Portrait ⟲')], ['portrait-right', t('Portrait ⟳')]], s.orientation || 'landscape', (v) => (s.orientation = v))),
          h('div', { class: 'field' }, h('b', { class: 'small' }, t('Image fit')), segmented([['contain', t('Fit (black bars)')], ['cover', t('Fill (crop)')]], s.fit || 'contain', (v) => (s.fit = v)))),
        h('div', { class: 'field' }, h('b', { class: 'small' }, t('Clock')), h('span', { class: 'hint' }, t('On the idle screen and the clock in the corner')),
          segmented([['auto', t('Automatic')], ['24', t('24-hour (14:30)')], ['12', t('12-hour (2:30 PM)')]], s.clockFormat || 'auto', (v) => (s.clockFormat = v))),
        h('div', { class: 'row wrap', style: { gap: '20px' } },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!s.showClock, onchange: (e) => (s.showClock = e.target.checked) }), t('Show clock')),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.ticker.enabled, onchange: (e) => { s.ticker.enabled = e.target.checked; tickerBox.hidden = !e.target.checked; } }), t('Show news ticker')),
          h('label', { class: 'row small' }, t('Background'), h('input', { type: 'color', value: s.background || '#000000', oninput: (e) => (s.background = e.target.value) }))),
        tickerBox,
        restartBox,
        h('label', { class: 'field' }, t('Notes'), h('input', { value: s.notes || '', placeholder: t('Location, hardware, contact…'), oninput: (e) => (s.notes = e.target.value) })),
      ],
      footer: (close) => [
        h('button', { class: 'btn danger', onclick: async () => {
          if (!(await confirmBox(t('Remove display?'), t('“{name}” will be disconnected and show a new pairing code.', { name: d.name }), t('Remove')))) return;
          await api(`/displays/${d.id}`, { method: 'DELETE' }); close(); await loadAll(); renderPage();
        } }, icon('trash'), t('Remove')),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn primary', onclick: async () => {
          await api(`/displays/${d.id}`, { method: 'PATCH', body: { name: s.name, groups: s.groups, defaultPlaylistId: s.defaultPlaylistId, orientation: s.orientation, fit: s.fit, showClock: s.showClock, clockFormat: s.clockFormat || 'auto', ticker: s.ticker, background: s.background, notes: s.notes, maintenance: s.maintenance } });
          close(); toast(t('Saved — the screen updates in a moment'), 'ok'); await loadAll(); renderPage();
        } }, t('Save')),
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  function rolloutCard(o) {
    const server = (o.serverUrls || [])[0] || location.origin;
    const json = () => JSON.stringify({ server, provisioningKey: o.provisioningKey, group: t('Reception'), playlist: state.playlists[0]?.name || t('Main') }, null, 2);
    const pre = h('pre', { class: 'urlbox', style: { whiteSpace: 'pre', overflowX: 'auto', margin: 0 } }, json());
    return h('div', { class: 'card pad stack' }, h('h2', {}, t('Roll out the Player app')),
      h('p', { class: 'muted', style: { margin: 0 } }, t('Install KevCast Player on each screen. On the same network it finds this server automatically and shows a pairing code. To deploy many screens without pairing (GPO, Intune, MDM, Ansible…), also place this file on each device:')),
      h('div', { class: 'small' },
        h('div', {}, h('b', {}, t('Windows: ')), h('code', {}, 'C:\\ProgramData\\KevCast\\player.json')),
        h('div', {}, h('b', {}, 'macOS: '), h('code', {}, '/Library/Application Support/KevCast/player.json')),
        h('div', {}, h('b', {}, 'Linux / Raspberry Pi: '), h('code', {}, '/etc/kevcast/player.json'))),
      pre,
      h('p', { class: 'muted small', style: { margin: 0 } }, t('Screens using the key are approved automatically, named after the device and put in the given group with the given default playlist. Keep the key private.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => { navigator.clipboard?.writeText(json()); toast(t('Copied')); } }, icon('copy'), t('Copy')),
        h('button', { class: 'btn sm danger', onclick: async () => {
          if (!(await confirmBox(t('Create a new key?'), t('Screens already connected keep working. New installs need the new key.'), t('New key')))) return;
          o.provisioningKey = (await api('/provisioning-key/rotate', { method: 'POST' })).provisioningKey;
          pre.textContent = json();
        } }, t('New key'))));
  }

  function userDialog(u) {
    const isNew = !u;
    const s = { username: u?.username || '', name: u?.name || '', role: u?.role || 'editor', studio: { powerpoint: !!u?.studio?.powerpoint, replaceFonts: u?.studio?.replaceFonts !== false } };
    const replaceBox = h('input', { type: 'checkbox', checked: s.studio.replaceFonts, disabled: !s.studio.powerpoint, onchange: (e) => (s.studio.replaceFonts = e.target.checked) });
    const pptBox = h('input', { type: 'checkbox', checked: s.studio.powerpoint, onchange: (e) => { s.studio.powerpoint = e.target.checked; replaceBox.disabled = !e.target.checked; } });
    const username = h('input', { value: s.username, autocomplete: 'off', disabled: !isNew, oninput: (e) => (s.username = e.target.value) });
    const name = h('input', { value: s.name, placeholder: t('e.g. Sam from Marketing'), oninput: (e) => (s.name = e.target.value) });
    const pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: isNew ? '' : t('Leave empty to keep the current password') });
    const role = h('select', { onchange: (e) => (s.role = e.target.value) },
      Object.entries(ROLE_LABEL).map(([v, l]) => h('option', { value: v, selected: v === s.role }, l)));
    modal({
      title: isNew ? t('Add a user') : t('Edit {name}', { name: u.name }),
      body: h('div', { class: 'stack' },
        h('div', { class: 'grid2' },
          h('label', { class: 'field' }, t('Username'), h('span', { class: 'hint' }, t('Used to sign in. No spaces.')), username),
          h('label', { class: 'field' }, t('Full name'), h('span', { class: 'hint' }, t('Optional')), name)),
        h('div', { class: 'grid2' },
          h('label', { class: 'field' }, isNew ? t('Password') : t('New password'), h('span', { class: 'hint' }, t('At least 6 characters')), pass),
          h('label', { class: 'field' }, t('Role'), role)),
        h('div', { class: 'muted small' },
          h('div', {}, h('b', {}, t('Editor: ')), t('media, playlists, schedules, displays and groups.')),
          h('div', {}, h('b', {}, t('Administrator: ')), t('everything, plus users, the organisation name, the roll-out key and backups.'))),
        h('div', { class: 'fonts-box stack' },
          h('b', {}, t('KevCast Studio on Windows')),
          h('label', { class: 'check' }, pptBox, h('span', {}, t('Convert PowerPoint files with PowerPoint on this user’s computer'),
            h('div', { class: 'muted small' }, t('Studio saves each PowerPoint as a PDF with the user’s own PowerPoint before uploading, so slides look exactly like the original and the server needs no fonts. Without PowerPoint on that computer, the server converts as usual.')))),
          h('label', { class: 'check', style: { marginLeft: '24px' } }, replaceBox, h('span', {}, t('Apply the font replacements first'),
            h('div', { class: 'muted small' }, t('The server’s font replacements (Settings → Server) are applied before PowerPoint converts the file.')))))),
      footer: (close) => [h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: close }, t('Cancel')),
        h('button', { class: 'btn primary', onclick: async () => {
          try {
            if (isNew) await api('/users', { method: 'POST', body: { username: s.username.trim(), name: s.name, role: s.role, password: pass.value, studio: s.studio } });
            else await api(`/users/${u.id}`, { method: 'PATCH', body: { name: s.name, role: s.role, password: pass.value, studio: s.studio } });
          } catch (e) { toast(e.message, 'err'); return; }
          close();
          toast(isNew ? t('{v} can now sign in', { v: s.name || s.username }) : t('Saved'), 'ok');
          if (u && u.id === state.session.user.id) state.session = await api('/session');
          await loadAll(); renderShell();
        } }, isNew ? t('Add user') : t('Save'))],
    });
  }

  function usersCard() {
    const me = state.session.user;
    return h('div', { class: 'card' },
      h('div', { class: 'section-head' }, h('h2', {}, t('Users')), h('div', { class: 'spacer' }),
        h('button', { class: 'btn sm primary', onclick: () => userDialog() }, icon('plus'), t('Add user'))),
      state.users.map((u) => h('div', { class: 'list-row' },
        h('div', { style: { minWidth: 0, flex: 1 } },
          h('b', {}, u.name), u.id === me.id ? h('span', { class: 'muted small' }, t(' (you)')) : null,
          h('div', { class: 'muted small' }, u.username, ' · ', u.lastLogin ? t('last signed in {v}', { v: ago(u.lastLogin) }) : t('never signed in'))),
        h('span', { class: `badge ${u.role === 'admin' ? '' : 'ok'}` }, ROLE_LABEL[u.role]),
        h('button', { class: 'btn sm', onclick: () => userDialog(u) }, t('Edit')),
        u.id === me.id ? null : h('button', { class: 'btn sm danger', title: t('Remove'), onclick: async () => {
          if (!(await confirmBox(t('Remove {name}?', { name: u.name }), t('{name} can no longer sign in. Their media, playlists and schedules stay.', { name: u.name }), t('Remove')))) return;
          try { await api(`/users/${u.id}`, { method: 'DELETE' }); } catch (e) { toast(e.message, 'err'); return; }
          await loadAll(); renderPage();
        } }, icon('trash')))));
  }

  /** Settings → Server: fonts LibreOffice should not use, with what to use instead. */
  function fontReplacementsRow(o) {
    const reps = o.fontReplacements || [];
    const known = [...new Set(state.media.flatMap((m) => m.fontsUsed || []))].filter((f) => !/^\+/.test(f)).sort();
    const from = h('input', { placeholder: t('Font name, e.g. Corporate Sans'), list: 'kc-fonts' });
    const to = h('input', { value: 'Arial', style: { width: '130px' } });
    const save = async (list) => {
      try {
        const r = await api('/font-replacements', { method: 'PUT', body: list });
        o.fontReplacements = r.replacements;
        if (r.reconverting) toast(tn(r.reconverting, 'Converting {n} presentation again…', 'Converting {n} presentations again…'), 'ok');
        renderPage({ soft: true });
      } catch (e) { toast(e.message, 'err'); }
    };
    return h('div', { class: 'list-row', style: { display: 'block' } },
      h('b', {}, t('Font replacements')),
      h('div', { class: 'muted small' }, t('For fonts that come out garbled or wrong: every PowerPoint uses the replacement instead.')),
      reps.length ? h('div', { class: 'font-list', style: { marginTop: '8px' } }, reps.map((r) => h('div', { class: 'font-row' },
        h('span', { class: 'font-name' }, r.from), '→', h('span', {}, r.to), h('div', { class: 'spacer' }),
        h('button', { class: 'btn sm ghost', title: t('Remove'), onclick: () => save(reps.filter((x) => x !== r)) }, icon('trash'))))) : null,
      h('datalist', { id: 'kc-fonts' }, known.map((f) => h('option', { value: f }))),
      h('div', { class: 'row', style: { marginTop: '8px' } }, from, '→', to,
        h('button', { class: 'btn sm', onclick: () => { if (from.value.trim()) save([...reps, { from: from.value.trim(), to: to.value.trim() || 'Arial' }]); } }, icon('plus'), t('Add'))));
  }

  function SettingsPage() {
    const o = state.overview;
    const me = state.session.user;
    const org = h('input', { value: state.session.orgName });
    const cur = h('input', { type: 'password', autocomplete: 'current-password' });
    const nxt = h('input', { type: 'password', autocomplete: 'new-password' });
    const cap = (ok, label, hint) => h('div', { class: 'list-row' }, h('span', { class: `badge ${ok ? 'ok' : 'warn'}` }, ok ? 'OK' : t('Missing')), h('div', {}, h('b', {}, label), h('div', { class: 'muted small' }, ok ? ok : hint)));
    return [
      pageHead(t('Settings'), null),
      h('div', { class: 'dash-cols', style: { marginTop: 0 } },
        h('div', { class: 'stack' },
          isAdmin() ? h('div', { class: 'card pad stack' }, h('h2', {}, t('General')),
            h('label', { class: 'field' }, t('Organisation name'), h('span', { class: 'hint' }, t('Shown on idle screens')), org),
            h('div', {}, h('button', { class: 'btn primary', onclick: async () => { await api('/settings', { method: 'PATCH', body: { orgName: org.value } }); state.session.orgName = org.value; toast(t('Saved'), 'ok'); } }, t('Save')))) : null,
          isAdmin() ? usersCard() : null,
          h('div', { class: 'card pad stack' }, h('h2', {}, t('Your account')),
            h('div', { class: 'muted' }, h('b', {}, me.name), ` (${me.username}) · ${ROLE_LABEL[me.role]}`),
            h('label', { class: 'field' }, t('Language'), h('span', { class: 'hint' }, t('Applies to this computer. Automatic follows the language of the computer.')),
              h('select', { onchange: (e) => { window.KevI18n.set(e.target.value); location.reload(); } },
                h('option', { value: 'auto', selected: window.KevI18n.choice === 'auto' }, t('Automatic ({language})', { language: window.KevI18n.names[window.KevI18n.detected] })),
                window.KevI18n.supported.map((code) => h('option', { value: code, selected: window.KevI18n.choice === code }, window.KevI18n.names[code])))),
            h('div', { class: 'grid2' }, h('label', { class: 'field' }, t('Current password'), cur), h('label', { class: 'field' }, t('New password'), nxt)),
            h('div', { class: 'row wrap' },
              h('button', { class: 'btn', onclick: async () => {
                try { await api('/password', { method: 'POST', body: { current: cur.value, next: nxt.value } }); cur.value = nxt.value = ''; toast(t('Password changed. Other devices are signed out.'), 'ok'); } catch (e) { toast(e.message, 'err'); }
              } }, t('Change password')),
              h('div', { class: 'spacer' }),
              h('button', { class: 'btn danger', onclick: async () => { await api('/logout', { method: 'POST' }); state.session.user = null; render(); } }, t('Sign out')))),
          h('div', { class: 'card pad stack' }, h('h2', {}, t('Connect a screen')),
            h('p', { class: 'muted', style: { margin: 0 } }, t('Open one of these addresses in the browser of the screen. For a kiosk setup see the install scripts in the install/player folder.')),
            (o.playerUrls.length ? o.playerUrls : [`${location.origin}/player/`]).map((u) => h('div', { class: 'urlbox' }, h('span', { style: { flex: 1 } }, u),
              h('button', { class: 'btn sm', onclick: () => { navigator.clipboard?.writeText(u); toast(t('Copied')); } }, icon('copy'))))),
        ),
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'section-head' }, h('h2', {}, t('Server'))),
            cap(o.capabilities.libreoffice, t('LibreOffice (PowerPoint conversion)'), t('Install LibreOffice on the server to convert .pptx files. Windows: winget install TheDocumentFoundation.LibreOffice · macOS: brew install --cask libreoffice · Linux: apt install libreoffice-impress')),
            cap(o.capabilities.pdftoppm || o.capabilities.ghostscript, t('Slide renderer (Poppler / Ghostscript)'), t('Windows: winget install oschwartz10612.Poppler · macOS: brew install poppler · Linux: apt install poppler-utils')),
            h('div', { class: 'list-row' }, h('dl', { class: 'kv' }, h('dt', {}, t('Version')), h('dd', {}, o.version), h('dt', {}, t('Platform')), h('dd', {}, o.platform), h('dt', {}, t('Data folder')), h('dd', { title: o.dataDir }, o.dataDir))),
            h('div', { class: 'list-row' }, h('div', { style: { flex: 1 } }, h('b', {}, t('Installed new fonts?')), h('div', { class: 'muted small' }, t('Convert every PowerPoint again so the slides use them.'))),
              h('button', { class: 'btn sm', onclick: async () => {
                const r = await api('/media/reconvert-all', { method: 'POST', body: {} });
                toast(tn(r.count, 'Converting {n} presentation again…', 'Converting {n} presentations again…'), 'ok');
              } }, icon('refresh'), t('Re-convert all'))),
            isAdmin() ? fontReplacementsRow(o) : null),
          isAdmin() ? rolloutCard(o) : null,
          isAdmin() ? h('div', { class: 'card pad stack' }, h('h2', {}, t('Backup')),
            h('p', { class: 'muted', style: { margin: 0 } }, t('The database without passwords or media files. For a full backup, copy the data folder.')),
            h('div', {}, h('a', { class: 'btn', href: '/api/backup' }, t('Download backup (JSON)')))) : null)),
    ];
  }

  start().catch((e) => {
    document.getElementById('app').replaceChildren(h('div', { class: 'auth-wrap' }, h('div', { class: 'card pad' }, t('Could not reach the KevCast server: '), e.message)));
  });
})();
