// Every text the Web Studio, the player and the start page show must have a Dutch and a German translation.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const unescape = (s) => s.replace(/\\(.)/g, (m, c) => (c === 'n' ? '\n' : c));

function keysInCode(src) {
  const keys = new Set();
  const lit = "'((?:[^'\\\\]|\\\\.)*)'";
  for (const m of src.matchAll(new RegExp(`(?<![\\w.$])(?:t|tr)\\(${lit}`, 'g'))) keys.add(unescape(m[1]).trim());
  for (const m of src.matchAll(new RegExp(`(?<![\\w.$])tn\\([^,]+,\\s*${lit},\\s*${lit}`, 'g'))) { keys.add(unescape(m[1]).trim()); keys.add(unescape(m[2]).trim()); }
  return keys;
}
function keysInHtml(src) {
  const keys = new Set();
  for (const m of src.matchAll(/<(\w+)[^>]*\sdata-i18n(-html)?(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/g)) keys.add(m[3].replace(/\s+/g, ' ').trim());
  return keys;
}
function dictionary(code) {
  const dicts = {};
  const ctx = { KevI18n: { add: (c, d) => { dicts[c] = d; } } };
  vm.runInNewContext(read(`shared/lang/${code}.js`), ctx);
  return dicts[code];
}

const used = new Set([
  ...keysInCode(read('public/admin/app.js')), ...keysInCode(read('public/player/player.js')), ...keysInCode(read('public/index.html')),
  ...keysInHtml(read('public/player/index.html')), ...keysInHtml(read('public/index.html')),
]);

for (const code of ['nl', 'de']) {
  test(`every interface text has a ${code} translation`, () => {
    const d = dictionary(code);
    const missing = [...used].filter((k) => k && !(k in d));
    assert.deepStrictEqual(missing, [], `Add these to shared/lang/${code}.js`);
  });
  test(`${code} translations keep placeholders and markup`, () => {
    const d = dictionary(code);
    const sig = (s) => [...(s.match(/\{\w+\}|<\/?\w+>/g) || [])].sort().join(' ');
    const wrong = Object.entries(d).filter(([k, v]) => sig(k) !== sig(v)).map(([k]) => k);
    assert.deepStrictEqual(wrong, []);
  });
}

test('language follows the browser, with a manual override', () => {
  const load = (languages, stored) => {
    const store = new Map(stored ? [['kevcast.lang', stored]] : []);
    const ctx = { navigator: { languages }, localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) } };
    ctx.globalThis = ctx;
    vm.runInNewContext(read('shared/i18n.js'), ctx);
    vm.runInNewContext(read('shared/lang/nl.js'), ctx);
    vm.runInNewContext(read('shared/lang/de.js'), ctx);
    return ctx.KevI18n;
  };
  assert.strictEqual(load(['nl-NL', 'en']).lang, 'nl');
  assert.strictEqual(load(['fr-FR', 'de-AT']).lang, 'de', 'first supported language wins');
  assert.strictEqual(load(['ja']).lang, 'en');
  assert.strictEqual(load(['nl-BE'], 'de').lang, 'de', 'the choice under Settings overrides the computer');
  const nl = load(['nl']);
  assert.strictEqual(nl.t('Upload files'), 'Bestanden uploaden');
  assert.strictEqual(nl.t('  Upload files '), '  Bestanden uploaden ', 'surrounding spaces are kept');
  assert.strictEqual(nl.t('Welcome to {orgName}', { orgName: 'Acme' }), 'Welkom bij Acme');
  assert.strictEqual(nl.tn(1, '{n} screen', '{n} screens'), '1 scherm');
  assert.strictEqual(nl.tn(3, '{n} screen', '{n} screens'), '3 schermen');
  assert.strictEqual(nl.t('Something new'), 'Something new', 'untranslated text stays English');
});
