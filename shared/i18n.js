/*
 * KevCast translations. The English text is the key, so untranslated text simply stays English.
 *
 *   t('Upload files')                       → "Bestanden uploaden"
 *   t('Welcome to {orgName}', { orgName })  → placeholders in {braces}; {{ and }} are literal braces
 *   tn(n, '{n} screen', '{n} screens')      → singular/plural (n is available as {n})
 *
 * The language follows the computer: the browser's (or the KevCast app's) language list, which
 * follows the operating system. A choice made under Settings → Language overrides it on that
 * device. Languages: en, nl, de. Dictionaries live in /shared/lang/<lang>.js.
 */
(function (root) {
  var SUPPORTED = ['en', 'nl', 'de'];
  var NAMES = { en: 'English', nl: 'Nederlands', de: 'Deutsch' };
  var STORE = 'kevcast.lang';
  var dicts = {};

  function stored() {
    try { return localStorage.getItem(STORE) || 'auto'; } catch (e) { return 'auto'; }
  }
  function detect(list) {
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase().split(/[-_]/)[0];
      if (SUPPORTED.indexOf(code) !== -1) return code;
    }
    return 'en';
  }
  var nav = typeof navigator !== 'undefined' ? (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]) : [];
  var choice = stored();
  var lang = SUPPORTED.indexOf(choice) !== -1 ? choice : detect(nav);
  var forced = root.KEVCAST_LANG; // set by the page (e.g. a player.json "language")
  if (forced && SUPPORTED.indexOf(forced) !== -1) lang = forced;

  function fill(text, vars) {
    return text.replace(/\{\{|\}\}|\{(\w+)\}/g, function (m, k) {
      if (m === '{{') return '{';
      if (m === '}}') return '}';
      return vars && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m;
    });
  }
  function lookup(key) {
    var d = dicts[lang];
    if (!d || lang === 'en') return key;
    var trimmed = key.trim();
    var hit = d[trimmed];
    if (hit === undefined || hit === '') return key;
    if (trimmed === key) return hit;
    var lead = key.match(/^\s*/)[0];
    var tail = key.match(/\s*$/)[0];
    return lead + hit + tail;
  }
  function t(key, vars) { return fill(lookup(String(key)), vars); }
  function tn(n, one, other, vars) {
    var v = {};
    for (var k in vars || {}) v[k] = vars[k];
    v.n = n;
    return fill(lookup(Number(n) === 1 ? one : other), v); // nl and de pluralise like en
  }
  /** Translate static HTML: elements with data-i18n (text) or data-i18n-html (markup), plus title/placeholder. */
  function translatePage(scope) {
    if (lang === 'en' || typeof document === 'undefined') return;
    var els = (scope || document).querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-title],[data-i18n-placeholder]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute('data-i18n')) el.textContent = t(el.textContent);
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = t(el.innerHTML.trim());
      if (el.hasAttribute('data-i18n-title')) el.title = t(el.title);
      if (el.hasAttribute('data-i18n-placeholder')) el.placeholder = t(el.placeholder);
    }
  }

  var api = {
    lang: lang, choice: choice, detected: detect(nav), supported: SUPPORTED, names: NAMES,
    t: t, tn: tn, translatePage: translatePage,
    add: function (code, dict) { dicts[code] = Object.assign(dicts[code] || {}, dict); },
    set: function (code) {
      try { if (!code || code === 'auto') localStorage.removeItem(STORE); else localStorage.setItem(STORE, code); } catch (e) {}
    },
    locale: function () { return lang === 'en' ? undefined : lang; },
  };
  root.KevI18n = api;
  root.t = t;
  root.tn = tn;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    // Load the dictionary synchronously, before the app's own scripts run.
    if (lang !== 'en' && document.readyState === 'loading') document.write('<script src="/shared/lang/' + lang + '.js"><\/script>');
  }
})(typeof window !== 'undefined' ? window : globalThis);
