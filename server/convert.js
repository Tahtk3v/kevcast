// Turns PowerPoint / Impress / PDF files into one image per slide.
//   .pptx/.ppt/.pps/.ppsx/.odp --(LibreOffice headless)--> .pdf --(pdftoppm or Ghostscript)--> slide-001.jpg ...
// Players then only ever show plain images, so they work on any browser,
// smart TV or Raspberry Pi without needing Office installed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { windowsFontconfig } = require('./fonts');

const PRESENTATION_EXT = ['.pptx', '.ppt', '.pps', '.ppsx', '.pot', '.potx', '.odp', '.key'];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5 * 60 * 1000, windowsHide: true, ...opts }, (err, stdout, stderr) => {
      if (err) {
        err.message += `\n${stderr || ''}`;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

function existsOnPath(name) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const d of dirs) {
    for (const e of exts) {
      const p = path.join(d, name + e);
      try {
        if (fs.statSync(p).isFile()) return p;
      } catch {}
    }
  }
  return null;
}

function firstExisting(paths) {
  return paths.find((p) => p && fs.existsSync(p)) || null;
}

function findSoffice() {
  if (process.env.SOFFICE_PATH && fs.existsSync(process.env.SOFFICE_PATH)) return process.env.SOFFICE_PATH;
  const onPath = existsOnPath('soffice') || existsOnPath('libreoffice');
  if (onPath) return onPath;
  return firstExisting([
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/local/bin/soffice',
    '/usr/bin/soffice',
  ]);
}

function findPdftoppm() {
  if (process.env.PDFTOPPM_PATH && fs.existsSync(process.env.PDFTOPPM_PATH)) return process.env.PDFTOPPM_PATH;
  const onPath = existsOnPath('pdftoppm');
  if (onPath) return onPath;
  // Common Windows locations (winget / choco poppler) and Homebrew.
  const candidates = ['/opt/homebrew/bin/pdftoppm', '/usr/local/bin/pdftoppm', 'C:\\Program Files\\poppler\\Library\\bin\\pdftoppm.exe'];
  const local = process.env.LOCALAPPDATA;
  if (local) {
    const pkgs = path.join(local, 'Microsoft', 'WinGet', 'Packages');
    try {
      for (const d of fs.readdirSync(pkgs)) {
        if (!/poppler/i.test(d)) continue;
        const root = path.join(pkgs, d);
        for (const sub of fs.readdirSync(root)) candidates.push(path.join(root, sub, 'Library', 'bin', 'pdftoppm.exe'));
      }
    } catch {}
  }
  return firstExisting(candidates);
}

function findGhostscript() {
  return existsOnPath('gs') || existsOnPath('gswin64c') || existsOnPath('gswin32c');
}

function capabilities() {
  return {
    libreoffice: findSoffice(),
    pdftoppm: findPdftoppm(),
    ghostscript: findGhostscript(),
  };
}

async function toPdf(input, outDir) {
  const soffice = findSoffice();
  if (!soffice) {
    throw new Error('LibreOffice is not installed on the server, so PowerPoint files cannot be converted. Install LibreOffice (see README) or upload a PDF export instead.');
  }
  // A private profile dir avoids clashes with a desktop LibreOffice that is already open.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kevcast-lo-'));
  const profileUrl = 'file:///' + profile.replace(/\\/g, '/').replace(/^\//, '');
  try {
    await run(soffice, [`-env:UserInstallation=${profileUrl}`, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', outDir, input]);
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
  const pdf = path.join(outDir, path.basename(input, path.extname(input)) + '.pdf');
  if (!fs.existsSync(pdf)) throw new Error('LibreOffice did not produce a PDF. Is the file a valid presentation?');
  return pdf;
}

async function pdfToImages(pdf, outDir, width = 1920) {
  const pdftoppm = findPdftoppm();
  if (pdftoppm) {
    // Windows builds of Poppler need a fontconfig file to find fonts that aren't embedded in the PDF.
    const env = process.platform === 'win32' && !process.env.FONTCONFIG_FILE
      ? { ...process.env, FONTCONFIG_FILE: windowsFontconfig(path.join(os.tmpdir(), 'kevcast-fontconfig')) }
      : process.env;
    await run(pdftoppm, ['-jpeg', '-jpegopt', 'quality=90', '-scale-to', String(width), pdf, path.join(outDir, 'slide')], { env });
  } else {
    const gs = findGhostscript();
    if (!gs) throw new Error('No PDF rasteriser found. Install Poppler (pdftoppm) or Ghostscript on the server (see README).');
    await run(gs, ['-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=jpeg', '-dJPEGQ=90', '-r150',
      '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4', `-sOutputFile=${path.join(outDir, 'slide-%03d.jpg')}`, pdf]);
  }
  const files = fs.readdirSync(outDir)
    .filter((f) => /^slide-\d+\.jpg$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  if (!files.length) throw new Error('No slides could be rendered from this file.');
  return files;
}

/**
 * Convert `input` into slide images inside `outDir`.
 * Returns an array of file names (relative to outDir).
 */
async function convertPresentation(input, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const ext = path.extname(input).toLowerCase();
  const pdf = ext === '.pdf' ? input : await toPdf(input, outDir);
  return pdfToImages(pdf, outDir);
}

// Serialise conversions: LibreOffice and big PDFs are memory hungry.
let queue = Promise.resolve();
function enqueue(fn) {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
}

module.exports = { convertPresentation, capabilities, enqueue, PRESENTATION_EXT };
