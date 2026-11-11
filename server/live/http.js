// Small fetch helpers for the live data slides (weather, traffic). The server fetches all outside data;
// screens only ever talk to the KevCast server.
const zlib = require('zlib');
const pkg = require('../../package.json');

// Public data services ask apps to identify themselves (MET Norway and OpenStreetMap require it).
const USER_AGENT = `KevCast/${pkg.version} (+https://github.com/tahtk3v/kevcast)`;

async function get(url, { timeout = 20000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    return res;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${new URL(url).host} did not answer in time`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
const getJson = async (url, opts) => (await get(url, opts)).json();
/** Text of a (possibly gzipped) download. */
async function getText(url, opts) {
  const buf = Buffer.from(await (await get(url, opts)).arrayBuffer());
  return (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString('utf8');
}

/**
 * Cache with a time-to-live that keeps the last good value: if a refresh fails, callers get the old data
 * (marked stale) instead of an error, so screens keep showing something sensible during an outage.
 */
function cached(ttlMs) {
  const store = new Map();
  return async function (key, load) {
    const hit = store.get(key);
    if (hit && hit.failed && Date.now() - hit.failedAt < 60000) throw hit.failed;
    if (hit && hit.failed) store.delete(key);
    if (hit && hit.value !== undefined && Date.now() - hit.at < ttlMs) return hit.value;
    if (hit && hit.pending) return hit.pending;
    const pending = load().then((value) => {
      store.set(key, { value, at: Date.now() });
      return value;
    }).catch((err) => {
      if (hit && hit.value !== undefined) {
        store.set(key, { ...hit, pending: null, at: Date.now() - ttlMs + 60000 }); // retry in a minute
        return { ...hit.value, stale: true, error: err.message };
      }
      // Remember the failure for a minute, so a source that is down doesn't make every request wait for it.
      store.set(key, { failed: err, failedAt: Date.now() });
      throw err;
    });
    store.set(key, { ...(hit || {}), pending });
    return pending;
  };
}

module.exports = { get, getJson, getText, cached, USER_AGENT };
