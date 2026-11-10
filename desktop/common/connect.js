const $ = (id) => document.getElementById(id);
let info = {};
// Translations come from the main process (desktop/common/i18n.js).
const T = (key, vars) => ((info.strings || {})[key] || key).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m));

async function connect(url) {
  $('err').textContent = '';
  const btns = document.querySelectorAll('button');
  btns.forEach((b) => (b.disabled = true));
  const r = await window.kevcast.connect(url);
  btns.forEach((b) => (b.disabled = false));
  if (!r.ok) $('err').textContent = r.error || T('Could not connect');
}

async function scan() {
  const box = $('servers');
  box.innerHTML = '<div class="muted"><span class="spin"></span></div>';
  box.firstChild.append(T('Searching…'));
  const found = await window.kevcast.discover();
  box.replaceChildren();
  if (!found.length) {
    box.innerHTML = '<div class="muted"></div>';
    box.firstChild.textContent = T('No servers found automatically. Enter the address below (shown on the server when it starts).');
    return found;
  }
  for (const s of found) {
    const b = document.createElement('button');
    b.className = 'server';
    const txt = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = s.name || T('KevCast server');
    const url = document.createElement('span');
    url.className = 'muted';
    url.textContent = `${s.url} · v${s.version}`;
    txt.append(name, url);
    const go = document.createElement('span');
    go.className = 'go';
    go.textContent = T('Connect →');
    b.append(txt, go);
    b.onclick = () => connect(s.url);
    box.append(b);
  }
  box.querySelector('button').focus();
  return found;
}

$('manual').onsubmit = (e) => {
  e.preventDefault();
  connect($('url').value);
};
$('rescan').onclick = scan;
$('cancel').onclick = () => window.kevcast.cancel();

(async () => {
  info = await window.kevcast.info();
  document.documentElement.lang = info.lang || 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T(el.textContent); });
  $('url').placeholder = T($('url').placeholder);
  document.title = info.appName;
  $('appName').textContent = info.appName;
  $('intro').textContent = info.intro;
  $('hint').textContent = info.hint || '';
  if (info.current) $('current').textContent = T('Current: {url}', { url: info.current });
  $('url').value = info.current || '';
  $('cancel').hidden = !info.canCancel;
  const found = await scan();
  // Zero-touch: a fresh player with exactly one server on the network connects by itself.
  if (info.autoConnect && found.length === 1) connect(found[0].url);
})();
