// The PowerPoint rewriter (server/pptx.js): embedded fonts, Arial for all text, font replacements.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const pptx = require('../server/pptx');

function makePptx(dir, files) {
  const entries = Object.entries(files).map(([name, text]) => {
    const data = Buffer.from(text);
    const raw = zlib.deflateRawSync(data);
    return { flags: 0, method: 8, time: 0, date: 33, crc: pptx.crc32(data), csize: raw.length, usize: data.length, nameBuf: Buffer.from(name), name, raw };
  });
  const file = path.join(dir, 'original.pptx');
  fs.writeFileSync(file, pptx.writeZip(entries));
  return file;
}
const read = (file, name) => {
  const e = pptx.readZip(fs.readFileSync(file)).find((x) => x.name === name);
  const data = e.method === 8 ? zlib.inflateRawSync(e.raw) : e.raw;
  assert.strictEqual(pptx.crc32(data), e.crc, `${name}: checksum`);
  return data.toString();
};

const PRES = '<p:presentation><p:sldIdLst/><p:notesSz cx="1" cy="1"/><p:embeddedFontLst>' +
  '<p:embeddedFont><p:font typeface="Corporate Sans"/><p:regular r:id="rId9"/></p:embeddedFont>' +
  '<p:embeddedFont><p:font typeface="Other Font"/><p:regular r:id="rId10"/></p:embeddedFont></p:embeddedFontLst></p:presentation>';
const SLIDE = '<p:sld><a:rPr><a:latin typeface="Corporate Sans"/><a:sym typeface="Wingdings"/></a:rPr><a:latin typeface="+mn-lt"/><a:buFont typeface="Wingdings"/><a:ea typeface="Other Font"/></p:sld>';

test('fonts embedded in the file are listed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-pptx-'));
  try {
    const f = makePptx(dir, { 'ppt/presentation.xml': PRES, 'ppt/slides/slide1.xml': SLIDE });
    assert.deepStrictEqual(pptx.embeddedFonts(f), ['Corporate Sans', 'Other Font']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('automatic: embedded copies of installed fonts are dropped, others kept', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-pptx-'));
  try {
    const f = makePptx(dir, { 'ppt/presentation.xml': PRES, 'ppt/slides/slide1.xml': SLIDE });
    const r = pptx.prepare(f, 'auto', (n) => n === 'Corporate Sans');
    assert.deepStrictEqual(r.dropped, ['Corporate Sans']);
    assert.strictEqual(path.basename(r.file), 'original.pptx', 'same name, so the PDF gets the expected name');
    const xml = read(r.file, 'ppt/presentation.xml');
    assert.ok(!xml.includes('Corporate Sans') && xml.includes('Other Font'));
    assert.strictEqual(read(r.file, 'ppt/slides/slide1.xml'), SLIDE, 'slides are untouched');
    assert.strictEqual(read(f, 'ppt/presentation.xml'), PRES, 'the upload itself is never changed');
    fs.rmSync(r.dir, { recursive: true, force: true });
    assert.strictEqual(pptx.prepare(f, 'auto', () => false), null, 'nothing to change → no copy');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Arial for all text, and server-wide replacements', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-pptx-'));
  try {
    const f = makePptx(dir, { 'ppt/presentation.xml': PRES, 'ppt/slides/slide1.xml': SLIDE, 'docProps/app.xml': '<a:latin typeface="Corporate Sans"/>' });
    let r = pptx.prepare(f, 'arial', () => false);
    let slide = read(r.file, 'ppt/slides/slide1.xml');
    assert.ok(slide.includes('<a:latin typeface="Arial"/>') && slide.includes('<a:ea typeface="Arial"/>'));
    assert.ok(slide.includes('<a:sym typeface="Wingdings"/>') && slide.includes('<a:buFont typeface="Wingdings"/>'), 'symbols and bullets keep their font');
    assert.ok(slide.includes('typeface="+mn-lt"'), 'theme references stay');
    assert.ok(!read(r.file, 'ppt/presentation.xml').includes('embeddedFont'), 'embedded fonts dropped');
    assert.ok(read(r.file, 'docProps/app.xml').includes('Corporate Sans'), 'only slide parts are changed');
    fs.rmSync(r.dir, { recursive: true, force: true });

    r = pptx.prepare(f, 'auto', () => false, { 'corporate sans': 'Arial' });
    slide = read(r.file, 'ppt/slides/slide1.xml');
    assert.ok(slide.includes('<a:latin typeface="Arial"/>') && slide.includes('<a:ea typeface="Other Font"/>'));
    assert.deepStrictEqual(r.replaced, ['Corporate Sans']);
    assert.ok(!read(r.file, 'ppt/presentation.xml').includes('Corporate Sans'), 'a replaced font is not loaded from the file either');
    fs.rmSync(r.dir, { recursive: true, force: true });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('other formats are left alone', () => {
  assert.strictEqual(pptx.prepare('/nonexistent/file.ppt', 'arial', () => false), null);
  assert.deepStrictEqual(pptx.embeddedFonts('/nonexistent/file.pdf'), []);
});

test('KevCast Studio has an identical copy of the rewriter', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'pptx.js'), 'utf8');
  const desktop = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'common', 'pptx.js'), 'utf8');
  assert.strictEqual(desktop.split('\n').slice(1).join('\n'), server, 'copy server/pptx.js to desktop/common/pptx.js (keep its first comment line)');
});

test('PowerPoint conversion in Studio: script and availability', async () => {
  const ppt = require('../desktop/studio/powerpoint');
  assert.ok(ppt.SCRIPT.includes('SaveAs($Out, 32)'), 'ppSaveAsPDF');
  assert.ok(ppt.SCRIPT.includes('$hadOpen -eq 0'), 'leaves a PowerPoint the user has open alone');
  assert.ok(ppt.isPowerPoint('Deck.PPTX') && ppt.isPowerPoint('a.ppsx') && !ppt.isPowerPoint('a.pdf') && !ppt.isPowerPoint('a.odp'));
  if (process.platform !== 'win32') {
    assert.strictEqual(await ppt.isAvailable(), false);
    await assert.rejects(ppt.toPdf('x.pptx', os.tmpdir()), /not installed/);
  }
});
