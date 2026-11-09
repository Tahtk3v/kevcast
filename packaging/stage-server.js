#!/usr/bin/env node
// Stages a self-contained KevCast Server for an installer:
//   <out>/app/      server, shared, public, package.json, production node_modules
//   <out>/node/     a bundled Node.js runtime (no Node install needed on the target)
//   <out>/poppler/  (Windows only) Poppler binaries for rendering slides
//
// Usage: node packaging/stage-server.js --platform win|linux|darwin --arch x64|arm64 --out <dir> [--node-major 26] [--skip-poppler]
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
const PLATFORM = args.platform;
const ARCH = args.arch || 'x64';
const OUT = path.resolve(args.out || `packaging-out/server-${PLATFORM}-${ARCH}`);
const NODE_MAJOR = args['node-major'] || '26';
const ROOT = path.resolve(__dirname, '..');

if (!['win', 'linux', 'darwin'].includes(PLATFORM)) {
  console.error('Usage: stage-server.js --platform win|linux|darwin --arch x64|arm64 --out <dir>');
  process.exit(1);
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'kevcast-packager' } });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function stageApp() {
  const app = path.join(OUT, 'app');
  for (const item of ['server', 'shared', 'public', 'package.json', 'package-lock.json', 'LICENSE']) {
    fs.cpSync(path.join(ROOT, item), path.join(app, item), { recursive: true });
  }
  // Pure-JS dependencies only, so staging on one OS works for every target.
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: app, stdio: 'inherit', shell: process.platform === 'win32' });
  // The installer icons travel with the server (used for shortcuts).
  fs.cpSync(path.join(ROOT, 'packaging', 'assets'), path.join(OUT, 'assets'), { recursive: true });
}

async function stageNode() {
  const index = await (await fetch('https://nodejs.org/dist/index.json')).json();
  const version = index.find((r) => r.version.startsWith(`v${NODE_MAJOR}.`)).version;
  console.log(`Bundling Node.js ${version} (${PLATFORM}-${ARCH})`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kevcast-node-'));
  const shasums = await (await fetch(`https://nodejs.org/dist/${version}/SHASUMS256.txt`)).text();
  const expect = (name) => {
    const line = shasums.split('\n').find((l) => l.trim().endsWith(`  ${name}`));
    if (!line) throw new Error(`No checksum for ${name}`);
    return line.split(/\s+/)[0];
  };
  const nodeDir = path.join(OUT, 'node');
  fs.mkdirSync(nodeDir, { recursive: true });

  if (PLATFORM === 'win') {
    const name = `win-${ARCH}/node.exe`;
    const file = await download(`https://nodejs.org/dist/${version}/${name}`, path.join(nodeDir, 'node.exe'));
    if (sha256(file) !== expect(name)) throw new Error('node.exe checksum mismatch');
  } else {
    const base = `node-${version}-${PLATFORM}-${ARCH}`;
    const name = `${base}.tar.${PLATFORM === 'linux' ? 'xz' : 'gz'}`;
    const file = await download(`https://nodejs.org/dist/${version}/${name}`, path.join(tmp, name));
    if (sha256(file) !== expect(name)) throw new Error(`${name} checksum mismatch`);
    execFileSync('tar', ['-xf', file, '-C', tmp]);
    fs.mkdirSync(path.join(nodeDir, 'bin'), { recursive: true });
    fs.copyFileSync(path.join(tmp, base, 'bin', 'node'), path.join(nodeDir, 'bin', 'node'));
    fs.chmodSync(path.join(nodeDir, 'bin', 'node'), 0o755);
    fs.copyFileSync(path.join(tmp, base, 'LICENSE'), path.join(nodeDir, 'LICENSE'));
  }
  fs.writeFileSync(path.join(nodeDir, 'VERSION'), version + '\n');
  fs.rmSync(tmp, { recursive: true, force: true });
}

async function stagePoppler() {
  // Windows has no package manager we can rely on at install time, so ship Poppler (pdftoppm).
  let rel = {};
  try {
    rel = await (await fetch('https://api.github.com/repos/oschwartz10612/poppler-windows/releases/latest', {
      headers: { 'User-Agent': 'kevcast-packager', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
    })).json();
  } catch {}
  let asset = (rel.assets || []).find((a) => /\.zip$/i.test(a.name));
  if (!asset) {
    // API unavailable or rate-limited: fall back to a known-good release.
    const tag = 'v24.08.0-0';
    asset = { name: `Release-${tag.slice(1)}.zip`, browser_download_url: `https://github.com/oschwartz10612/poppler-windows/releases/download/${tag}/Release-${tag.slice(1)}.zip` };
    rel.tag_name = tag;
  }
  console.log(`Bundling Poppler ${rel.tag_name}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kevcast-poppler-'));
  const zip = await download(asset.browser_download_url, path.join(tmp, asset.name));
  execFileSync('tar', ['-xf', zip, '-C', tmp]);
  const find = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isFile() && e.name.toLowerCase() === 'pdftoppm.exe') return dir;
      if (e.isDirectory()) { const r = find(p); if (r) return r; }
    }
    return null;
  };
  const bin = find(tmp);
  if (!bin) throw new Error('pdftoppm.exe not found in the Poppler archive');
  fs.cpSync(bin, path.join(OUT, 'poppler'), { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  await stageApp();
  await stageNode();
  if (PLATFORM === 'win' && !process.argv.includes('--skip-poppler')) await stagePoppler();
  console.log(`Staged KevCast Server in ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
