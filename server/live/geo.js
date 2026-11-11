// Places and geometry for the weather and traffic slides.
const { getJson } = require('./http');

const toRad = (d) => (d * Math.PI) / 180;
/** Distance in metres between two { lat, lon } points. */
function distance(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Point in polygon (ray casting); ring = [[lat, lon], ...]. */
function inPolygon(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Shortest distance in metres from a point to a polyline [[lon, lat], ...] (good enough at city scale). */
function distanceToLine(p, line) {
  let best = Infinity;
  const kx = Math.cos(toRad(p.lat)) * 111320;
  const ky = 110540;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][0] - p.lon) * kx, ay = (line[i][1] - p.lat) * ky;
    const bx = (line[i + 1][0] - p.lon) * kx, by = (line[i + 1][1] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

// OpenStreetMap's place search (Nominatim): free, no account, at most one request per second.
let lastLookup = 0;
async function nominatim(path) {
  const wait = lastLookup + 1100 - Date.now();
  lastLookup = Date.now() + Math.max(0, wait);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return getJson(`https://nominatim.openstreetmap.org/${path}`);
}
const placeOf = (r) => ({
  name: r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || r.name || r.display_name.split(',')[0],
  label: r.display_name,
  lat: Number(Number(r.lat).toFixed(4)),
  lon: Number(Number(r.lon).toFixed(4)),
  country: (r.address?.country_code || '').toLowerCase(),
  region: r.address?.state || r.address?.province || r.address?.region || '',
});
/** Search places by name; lang = preferred language for names. */
async function search(q, lang = 'en') {
  const list = await nominatim(`search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=6&accept-language=${encodeURIComponent(lang)}`);
  return list.map(placeOf);
}

module.exports = { distance, inPolygon, distanceToLine, search };
