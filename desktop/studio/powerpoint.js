// Converts PowerPoint files to PDF with Microsoft PowerPoint on this computer (Windows), before KevCast Studio
// uploads them. PowerPoint lays the slides out exactly as the author sees them and embeds the fonts in the PDF,
// so the server never needs the fonts and LibreOffice is skipped. Enabled per user by an administrator.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const EXT = ['.pptx', '.ppt', '.pps', '.ppsx', '.pot', '.potx', '.pptm'];
const TIMEOUT = 3 * 60 * 1000;

// Uses PowerPoint through COM. If PowerPoint is already open with the user's own presentations it is left
// running; otherwise it is closed again afterwards. 32 = ppSaveAsPDF, -1/0 = msoTrue/msoFalse.
const SCRIPT = `param([string]$In, [string]$Out)
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$hadOpen = $app.Presentations.Count
try {
  $p = $app.Presentations.Open($In, -1, 0, 0)
  try { $p.SaveAs($Out, 32) } finally { $p.Close() }
} finally {
  if ($hadOpen -eq 0 -and $app.Presentations.Count -eq 0) { $app.Quit() }
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}
if (-not (Test-Path -LiteralPath $Out)) { throw 'PowerPoint did not create a PDF' }
`;

function run(cmd, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        err.message = (stderr || '').trim().split(/\r?\n/).filter(Boolean).pop() || err.message;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

let available = null;
/** Whether Microsoft PowerPoint is installed (Windows only). */
async function isAvailable() {
  if (available !== null) return available;
  if (process.platform !== 'win32') return (available = false);
  try {
    await run('reg.exe', ['query', 'HKCR\\PowerPoint.Application\\CLSID'], 15000);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

const isPowerPoint = (file) => EXT.includes(path.extname(file).toLowerCase());

/**
 * Converts `input` to `<outDir>/<same name>.pdf` with PowerPoint and returns the PDF's path.
 * Conversions run one at a time: PowerPoint is a single application.
 */
let queue = Promise.resolve();
function toPdf(input, outDir) {
  const job = queue.then(async () => {
    if (!(await isAvailable())) throw new Error('Microsoft PowerPoint is not installed on this computer');
    const out = path.join(outDir, path.basename(input, path.extname(input)) + '.pdf');
    const script = path.join(outDir, 'kevcast-to-pdf.ps1');
    fs.writeFileSync(script, '﻿' + SCRIPT); // BOM: Windows PowerShell 5 reads the file as UTF-8
    try {
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-In', path.resolve(input), '-Out', out], TIMEOUT);
    } finally {
      fs.rmSync(script, { force: true });
    }
    if (!fs.existsSync(out)) throw new Error('PowerPoint did not create a PDF');
    return out;
  });
  queue = job.catch(() => {});
  return job;
}

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kevcast-ppt-'));

module.exports = { isAvailable, isPowerPoint, toPdf, tempDir, SCRIPT };
