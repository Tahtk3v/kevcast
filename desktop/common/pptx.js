// Copy of server/pptx.js (the desktop apps are packaged on their own). test/pptx.test.js checks both stay identical.
// Prepares a PowerPoint file for LibreOffice, on a temporary copy (the upload itself is never changed).
//
// PowerPoint can embed fonts in a .pptx, often only the characters used ("subset"). LibreOffice prefers
// such an embedded copy over the font installed on the server and frequently draws subset fonts wrongly:
// letters come out chopped and overlapping. So, per presentation (media.fontMode):
//   auto     – drop embedded fonts the server has installed itself (default)
//   installed – drop all embedded fonts; LibreOffice uses installed fonts or its replacements
//   arial    – also set every text font to Arial, which every system has (or a metric-compatible copy)
// On top of that, the server-wide font replacements (Settings → Server, e.g. "Corporate Sans → Arial") apply to
// every presentation: for fonts that LibreOffice can't draw properly.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const OOXML = ['.pptx', '.potx', '.ppsx', '.pptm'];
const MODES = ['auto', 'installed', 'arial'];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** All entries of a zip, with their raw (still compressed) data. */
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Damaged zip directory');
    const e = {
      flags: buf.readUInt16LE(p + 8) & ~0x0008, // sizes are written up front, no data descriptor
      method: buf.readUInt16LE(p + 10),
      time: buf.readUInt16LE(p + 12),
      date: buf.readUInt16LE(p + 14),
      crc: buf.readUInt32LE(p + 16),
      csize: buf.readUInt32LE(p + 20),
      usize: buf.readUInt32LE(p + 24),
    };
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    e.nameBuf = buf.subarray(p + 46, p + 46 + nameLen);
    e.name = e.nameBuf.toString('utf8');
    if (e.csize === 0xffffffff || local === 0xffffffff) throw new Error('Zip64 files are not supported');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    e.raw = buf.subarray(start, start + e.csize);
    entries.push(e);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
function text(e) {
  return (e.method === 8 ? zlib.inflateRawSync(e.raw) : e.raw).toString('utf8');
}
function setText(e, s) {
  const data = Buffer.from(s, 'utf8');
  e.raw = zlib.deflateRawSync(data);
  e.method = 8;
  e.crc = crc32(data);
  e.csize = e.raw.length;
  e.usize = data.length;
}
function writeZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(e.flags, 6); lh.writeUInt16LE(e.method, 8);
    lh.writeUInt16LE(e.time, 10); lh.writeUInt16LE(e.date, 12); lh.writeUInt32LE(e.crc, 14); lh.writeUInt32LE(e.csize, 18);
    lh.writeUInt32LE(e.usize, 22); lh.writeUInt16LE(e.nameBuf.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(e.flags, 8); ch.writeUInt16LE(e.method, 10);
    ch.writeUInt16LE(e.time, 12); ch.writeUInt16LE(e.date, 14); ch.writeUInt32LE(e.crc, 16); ch.writeUInt32LE(e.csize, 20);
    ch.writeUInt32LE(e.usize, 24); ch.writeUInt16LE(e.nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    parts.push(lh, e.nameBuf, e.raw);
    central.push(ch, e.nameBuf);
    offset += 30 + e.nameBuf.length + e.raw.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

const EMBEDDED = /<p:embeddedFont>[\s\S]*?<\/p:embeddedFont>/g;
const typefaceOf = (block) => (block.match(/<p:font\b[^>]*\btypeface="([^"]*)"/) || [])[1] || '';

/** Fonts embedded in a .pptx (names), or [] for other files. */
function embeddedFonts(file) {
  if (!OOXML.includes(path.extname(file).toLowerCase())) return [];
  try {
    const pres = readZip(fs.readFileSync(file)).find((e) => e.name === 'ppt/presentation.xml');
    return pres ? [...text(pres).matchAll(EMBEDDED)].map((m) => typefaceOf(m[0])).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * A copy of `file` prepared for conversion according to `mode`, or null when nothing needs changing.
 * `installed(name)` says whether the server has a font; `replace` maps lower-case font names to replacements.
 * Returns { file, dir, dropped, replaced, arial }; delete `dir` afterwards.
 */
function prepare(file, mode, installed, replace = {}) {
  if (!OOXML.includes(path.extname(file).toLowerCase())) return null;
  mode = MODES.includes(mode) ? mode : 'auto';
  const entries = readZip(fs.readFileSync(file));
  const dropped = [];
  let changed = false;
  const pres = entries.find((e) => e.name === 'ppt/presentation.xml');
  if (pres) {
    const xml = text(pres);
    let out = xml.replace(EMBEDDED, (block) => {
      const name = typefaceOf(block);
      if (mode === 'auto' && !(name && (installed(name) || replace[name.toLowerCase()]))) return block;
      dropped.push(name);
      return '';
    });
    out = out.replace(/<p:embeddedFontLst>\s*<\/p:embeddedFontLst>|<p:embeddedFontLst\/>/g, '');
    if (out !== xml) { setText(pres, out); changed = true; }
  }
  const replaced = new Set();
  if (mode === 'arial' || Object.keys(replace).length) {
    // Text fonts only: bullets and symbols (<a:sym>, <a:buFont>) keep their own font.
    const re = /(<a:(?:latin|ea|cs)\b[^>]*?\btypeface=")([^"]*)(")/g;
    for (const e of entries) {
      if (!/^ppt\/(slides|slideLayouts|slideMasters|theme|notesMasters|notesSlides)\/[^/]+\.xml$/.test(e.name)) continue;
      const xml = text(e);
      const out = xml.replace(re, (m, a, name, b) => {
        if (!name || name.startsWith('+')) return m; // theme references
        const to = mode === 'arial' ? 'Arial' : replace[name.toLowerCase()];
        if (!to || to === name) return m;
        replaced.add(name);
        return a + to.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`) + b;
      });
      if (out !== xml) { setText(e, out); changed = true; }
    }
  }
  if (!changed) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kevcast-prep-'));
  const copy = path.join(dir, path.basename(file)); // same name, so LibreOffice's PDF gets the expected name
  fs.writeFileSync(copy, writeZip(entries));
  return { file: copy, dir, dropped, replaced: [...replaced], arial: mode === 'arial' };
}

module.exports = { prepare, embeddedFonts, readZip, writeZip, crc32, MODES };
