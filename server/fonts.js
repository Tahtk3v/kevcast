// Which fonts does a presentation use, and which of them are missing on this server?
// PowerPoint files are rendered with the server's fonts, so a missing font is the most common
// reason why slides look different (wrong font, text that wraps differently, misaligned boxes).
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFile } = require('child_process');

/** Read selected entries from a .zip (pptx/odp) without dependencies. */
function readZipEntries(file, wanted) {
  const buf = fs.readFileSync(file);
  // End of central directory: signature 0x06054b50 within the last 64 KB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return {};
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name) || size > 50 * 1024 * 1024) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    try {
      out[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    } catch {}
  }
  return out;
}

/** Font family names used by a .pptx/.potx/.ppsx (Office Open XML) or .odp file. */
function fontsUsed(file) {
  const ext = path.extname(file).toLowerCase();
  const names = new Set();
  try {
    if (ext === '.odp') {
      const xml = readZipEntries(file, (n) => n === 'content.xml' || n === 'styles.xml');
      for (const s of Object.values(xml)) for (const m of s.matchAll(/style:font-face style:name="([^"]+)"[^>]*svg:font-family="([^"]+)"/g)) names.add(m[2].replace(/^['"&apos;]+|['"&apos;]+$/g, '').replace(/&apos;/g, ''));
    } else if (['.pptx', '.potx', '.ppsx', '.pptm'].includes(ext)) {
      const xml = readZipEntries(file, (n) => /^ppt\/(slides|slideLayouts|slideMasters|theme)\/[^/]+\.xml$/.test(n));
      // Latin text fonts only: themes also list fallback fonts for other scripts (<a:font script=…>, <a:ea>, <a:cs>)
      // that Western slides never use.
      for (const s of Object.values(xml)) for (const m of s.matchAll(/<a:latin\b[^>]*\btypeface="([^"]*)"/g)) names.add(m[1]);
    }
  } catch {}
  return [...names]
    .map((n) => n.replace(/&amp;/g, '&').trim())
    .filter((n) => n && !n.startsWith('+')); // "+mj-lt" etc. point at the theme fonts, which are listed too
}

// Fonts LibreOffice replaces with a metrically identical free font, so the layout stays the same.
const COMPATIBLE = {
  calibri: 'carlito', cambria: 'caladea', arial: 'liberation sans', helvetica: 'liberation sans',
  'times new roman': 'liberation serif', times: 'liberation serif', 'courier new': 'liberation mono',
  'arial narrow': 'liberation sans narrow', symbol: 'opensymbol',
};

let cache = { at: 0, families: null };
function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 60000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => resolve(err ? null : stdout));
  });
}

/** Installed font families as seen by this server process (lower case), or null if unknown. */
async function installedFamilies() {
  if (cache.families && Date.now() - cache.at < 60 * 1000) return cache.families;
  let out = null;
  if (process.platform === 'win32') {
    // What the service account (SYSTEM) can see: machine-wide fonts only.
    out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }']);
  } else {
    out = await run('fc-list', [':', 'family']);
  }
  if (!out) return null;
  const set = new Set();
  for (const line of out.split(/\r?\n/)) for (const f of line.split(',')) if (f.trim()) set.add(f.trim().toLowerCase());
  cache = { at: Date.now(), families: set };
  return set;
}

/** Whether `have` (from installedFamilies) contains the font, or a metric-compatible replacement. */
function isInstalled(have, name) {
  const has = (n) => have.has(n) || [...have].some((f) => f.startsWith(n + ' ')); // "Segoe UI" vs "Segoe UI Semibold"
  const k = String(name).toLowerCase();
  return has(k) || !!(COMPATIBLE[k] && has(COMPATIBLE[k]));
}

/** Fonts used by `file` that this server doesn't have (no metric-compatible replacement either). */
async function missingFonts(file) {
  const used = fontsUsed(file);
  if (!used.length) return [];
  const have = await installedFamilies();
  if (!have) return [];
  return used.filter((n) => !isInstalled(have, n)).sort((a, b) => a.localeCompare(b));
}

/**
 * Windows: Poppler's pdftoppm looks fonts up with fontconfig, which has no configuration on
 * Windows unless we give it one. Without it, fonts that aren't embedded in the PDF come out as
 * garbled glyphs. List the machine fonts plus every user's own fonts folder.
 */
function windowsFontconfig(cacheDir) {
  const dirs = [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')];
  const users = path.join(process.env.SystemDrive || 'C:', 'Users');
  try {
    for (const u of fs.readdirSync(users)) {
      const d = path.join(users, u, 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts');
      if (fs.existsSync(d)) dirs.push(d);
    }
  } catch {}
  fs.mkdirSync(cacheDir, { recursive: true });
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const conf = `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n${dirs.map((d) => `  <dir>${esc(d)}</dir>`).join('\n')}\n  <cachedir>${esc(path.join(cacheDir, 'cache'))}</cachedir>\n</fontconfig>\n`;
  const file = path.join(cacheDir, 'fonts.conf');
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== conf) fs.writeFileSync(file, conf);
  return file;
}

module.exports = { fontsUsed, missingFonts, installedFamilies, isInstalled, windowsFontconfig, readZipEntries, _resetCache: () => { cache = { at: 0, families: null }; } };
