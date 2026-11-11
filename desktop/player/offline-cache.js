// Local disk cache that keeps a KevCast Player running when the server is down.
//
// All http(s) requests from the player window to the KevCast server pass through
// `handle()` (registered with protocol.handle in main.js):
//
//   /media/...               cache-first. Files are immutable, so a cached copy is always valid.
//   /api/player/manifest     network-first; the last good copy is served when offline.
//   /player/*, /shared/*     network-first (the player app itself); cached copy when offline.
//   everything else          passed straight through (heartbeats, live events, web pages).
//
// Each time a new manifest arrives, every image, slide and video that any schedule or
// default playlist can show is downloaded in the background. Files nothing refers to
// any more are deleted. A screen can therefore play its whole schedule offline,
// including content it has never shown yet.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { net } = require('electron');

const SHELL = /^\/(player\/|shared\/|widgets\/)/;
const MANIFEST = '/api/player/manifest';
const NETWORK_TIMEOUT_MS = 8000;

class OfflineCache {
  constructor(dir, serverUrl, onStatus = () => {}) {
    this.dir = dir;
    this.filesDir = path.join(dir, 'files');
    this.indexFile = path.join(dir, 'index.json');
    this.origin = new URL(serverUrl).origin;
    this.onStatus = onStatus;
    fs.mkdirSync(this.filesDir, { recursive: true });
    try {
      this.index = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
    } catch {
      this.index = {};
    }
    this.status = { total: 0, cached: 0, bytes: 0, downloading: false, lastSync: null, offline: false };
    this.syncing = null;
    this.pendingManifest = null;
    this.recount();
  }

  // ---------------------------------------------------------------------------
  // Storage helpers
  // ---------------------------------------------------------------------------
  key(url) {
    const u = new URL(url);
    // Media files never change, so the query string does not matter. The token in
    // the manifest query does not either, because there is one display per player.
    const id = u.pathname.startsWith('/media/') || u.pathname === MANIFEST ? u.pathname : u.pathname + u.search;
    return crypto.createHash('sha1').update(id).digest('hex');
  }

  saveIndex() {
    const tmp = this.indexFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.index));
    fs.renameSync(tmp, this.indexFile);
  }

  entry(url) {
    const e = this.index[this.key(url)];
    if (!e) return null;
    if (!fs.existsSync(path.join(this.filesDir, e.file))) {
      delete this.index[this.key(url)];
      return null;
    }
    return e;
  }

  store(url, buffer, contentType) {
    const k = this.key(url);
    fs.writeFileSync(path.join(this.filesDir, k), buffer);
    this.index[k] = { file: k, url: new URL(url).pathname, type: contentType || 'application/octet-stream', size: buffer.length, savedAt: Date.now() };
    this.saveIndex();
  }

  /** Serve a cached file, with HTTP Range support so videos can stream and seek. */
  serve(e, request, extraHeaders = {}) {
    const file = path.join(this.filesDir, e.file);
    const size = fs.statSync(file).size;
    const headers = { 'Content-Type': e.type, 'Accept-Ranges': 'bytes', 'X-KevCast-Cache': 'hit', ...extraHeaders };
    const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
    if (range && size > 0) {
      let start = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
      let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(end, size - 1);
      if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      const body = Readable.toWeb(fs.createReadStream(file, { start, end }));
      return new Response(body, { status: 206, headers: { ...headers, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}` } });
    }
    return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
  }

  network(request, timeout) {
    const opts = { bypassCustomProtocolHandlers: true };
    if (timeout) opts.signal = AbortSignal.timeout(timeout);
    return net.fetch(request, opts);
  }

  /**
   * Other http sites (web-page items) bypass webRequest because this handler serves them,
   * so drop the "do not embed me" headers here as well (see allowEmbeddingWebPages in main.js).
   */
  async passThroughEmbeddable(request) {
    const res = await this.network(request);
    const headers = new Headers(res.headers);
    headers.delete('x-frame-options');
    const csp = headers.get('content-security-policy');
    if (csp) headers.set('content-security-policy', csp.split(';').filter((d) => !/^\s*frame-ancestors/i.test(d)).join(';'));
    const noBody = [101, 204, 205, 304].includes(res.status);
    return new Response(noBody ? null : res.body, { status: res.status, statusText: res.statusText, headers });
  }

  setOffline(offline) {
    if (this.status.offline !== offline) {
      this.status.offline = offline;
      this.onStatus(this.getStatus());
    }
  }

  // ---------------------------------------------------------------------------
  // Request handler
  // ---------------------------------------------------------------------------
  async handle(request) {
    const url = new URL(request.url);
    if (url.origin !== this.origin) return this.passThroughEmbeddable(request);
    if (request.method !== 'GET') return this.network(request);
    const p = url.pathname;

    if (p.startsWith('/media/')) {
      const e = this.entry(request.url);
      if (e) return this.serve(e, request);
      // Not cached yet: stream it from the server now. The background sync stores it.
      return this.network(request);
    }

    if (p === MANIFEST || SHELL.test(p)) {
      try {
        const res = await this.network(request, NETWORK_TIMEOUT_MS);
        this.setOffline(false);
        if (res.status !== 200) return res;
        const buf = Buffer.from(await res.arrayBuffer());
        const type = res.headers.get('content-type');
        this.store(request.url, buf, type);
        if (p === MANIFEST) this.sync(JSON.parse(buf.toString('utf8')));
        return new Response(buf, { status: 200, headers: { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' } });
      } catch (err) {
        this.setOffline(true);
        const e = this.entry(request.url);
        if (e) return this.serve(e, request, { 'X-KevCast-Offline': '1', 'Cache-Control': 'no-store' });
        throw err;
      }
    }

    return this.network(request);
  }

  // ---------------------------------------------------------------------------
  // Background download of everything the schedule may play
  // ---------------------------------------------------------------------------
  mediaUrls(manifest) {
    const urls = new Set();
    for (const pl of Object.values(manifest.playlists || {})) {
      for (const it of pl.items || []) {
        if ((it.type === 'image' || it.type === 'video') && typeof it.url === 'string' && it.url.startsWith('/media/')) {
          urls.add(this.origin + it.url);
        }
      }
    }
    return [...urls];
  }

  sync(manifest) {
    // If a sync is already running, remember only the newest manifest and run it next.
    if (this.syncing) {
      this.pendingManifest = manifest;
      return this.syncing;
    }
    this.syncing = this.runSync(manifest).finally(() => {
      this.syncing = null;
      if (this.pendingManifest) {
        const next = this.pendingManifest;
        this.pendingManifest = null;
        this.sync(next);
      }
    });
    return this.syncing;
  }

  async runSync(manifest) {
    const urls = this.mediaUrls(manifest);
    this.status.total = urls.length;
    this.status.downloading = true;
    this.recount(urls);
    let failed = 0;
    for (const url of urls) {
      if (this.entry(url)) continue;
      try {
        await this.download(url);
      } catch (e) {
        failed++;
        console.warn('[cache] download failed', url, e.message);
      }
      this.recount(urls);
    }
    // Only prune once everything referenced is safely on disk.
    if (!failed) this.prune(urls);
    this.status.downloading = false;
    this.status.lastSync = new Date().toISOString();
    this.recount(urls);
  }

  async download(url) {
    const res = await net.fetch(url, { bypassCustomProtocolHandlers: true });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const k = this.key(url);
    const tmp = path.join(this.filesDir, `${k}.part`);
    // Stream to disk so large videos never have to fit in memory.
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmp);
      Readable.fromWeb(res.body).on('error', reject).pipe(out).on('finish', resolve).on('error', reject);
    });
    fs.renameSync(tmp, path.join(this.filesDir, k));
    this.index[k] = { file: k, url: new URL(url).pathname, type: res.headers.get('content-type') || 'application/octet-stream', size: fs.statSync(path.join(this.filesDir, k)).size, savedAt: Date.now() };
    this.saveIndex();
  }

  prune(keepUrls) {
    const keep = new Set(keepUrls.map((u) => this.key(u)));
    for (const [k, e] of Object.entries(this.index)) {
      if (!e.url.startsWith('/media/') || keep.has(k)) continue;
      fs.rmSync(path.join(this.filesDir, e.file), { force: true });
      delete this.index[k];
    }
    for (const f of fs.readdirSync(this.filesDir)) {
      if (f.endsWith('.part')) fs.rmSync(path.join(this.filesDir, f), { force: true });
    }
    this.saveIndex();
  }

  recount(urls) {
    let bytes = 0;
    for (const e of Object.values(this.index)) bytes += e.size || 0;
    this.status.bytes = bytes;
    if (urls) this.status.cached = urls.filter((u) => this.index[this.key(u)]).length;
    this.onStatus(this.getStatus());
  }

  getStatus() {
    return { ...this.status };
  }
}

module.exports = { OfflineCache };
