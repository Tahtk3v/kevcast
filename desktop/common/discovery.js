// Finds KevCast servers on the local network by UDP broadcast (see startDiscovery in server/index.js).
const dgram = require('dgram');
const os = require('os');
const { t: tr } = require('./i18n');

const DISCOVERY_PORT = 41234;

function broadcastAddresses() {
  const out = new Set(['255.255.255.255']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal || !a.netmask) continue;
      const ip = a.address.split('.').map(Number);
      const mask = a.netmask.split('.').map(Number);
      out.add(ip.map((b, i) => (b & mask[i]) | (~mask[i] & 255)).join('.'));
    }
  }
  return [...out];
}

/** Resolves to [{ url, name, version }] for every server that answered within `timeoutMs`. */
function discover(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const found = new Map();
    let sock;
    try {
      sock = dgram.createSocket('udp4');
    } catch {
      return resolve([]);
    }
    sock.on('error', () => {});
    sock.on('message', (msg, rinfo) => {
      try {
        const info = JSON.parse(msg.toString());
        if (!info.kevcast) return;
        // The address the reply came from is one we can definitely reach.
        const url = `http://${rinfo.address}:${info.port}`;
        const key = info.id || url;
        const prev = found.get(key);
        // One entry per server; prefer its LAN address over loopback so the saved
        // address also makes sense to other machines.
        if (!prev || (prev.url.includes('://127.') && !url.includes('://127.'))) {
          found.set(key, { url, name: info.name, version: info.version });
        }
      } catch {}
    });
    sock.bind(0, () => {
      sock.setBroadcast(true);
      const msg = Buffer.from('KEVCAST_DISCOVER');
      const send = () => {
        for (const addr of broadcastAddresses()) sock.send(msg, DISCOVERY_PORT, addr, () => {});
        sock.send(msg, DISCOVERY_PORT, '127.0.0.1', () => {});
      };
      send();
      setTimeout(send, 700); // UDP may drop a packet; ask twice
    });
    setTimeout(() => {
      try { sock.close(); } catch {}
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

/** Normalise user input like "192.168.1.10" into "http://192.168.1.10:8080". */
function normaliseUrl(input) {
  let s = String(input || '').trim().replace(/\/+$/, '');
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  try {
    const u = new URL(s);
    if (!u.port && u.protocol === 'http:' && !/[a-z]/i.test(u.hostname.replace(/\./g, ''))) u.port = '8080';
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Checks that `url` is a KevCast server. Resolves to { ok, name, version, error }. */
async function check(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${url}/api/session`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = await res.json();
    if (!j || !j.version) throw new Error(tr('Not a KevCast server'));
    return { ok: true, name: j.orgName, version: j.version };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? tr('No answer from this address') : e.message };
  }
}

module.exports = { discover, normaliseUrl, check };
