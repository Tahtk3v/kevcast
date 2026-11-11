// Traffic slide data: travel times from a location to (big) cities.
//  - Route and normal travel time: OSRM (router.project-osrm.org, OpenStreetMap data, free, no account).
//  - Live jams and accidents in the Netherlands: NDW open data (opendata.ndw.nu, the national road data portal,
//    free, no account). Jams on a route add their delay to its travel time.
const { getJson, getText, cached } = require('./http');
const { distance, distanceToLine } = require('./geo');

// Big cities per country, offered as destinations (and the default: the nearest ones).
const CITIES = {
  nl: [['Amsterdam', 52.3728, 4.8936], ['Rotterdam', 51.9225, 4.4792], ['Den Haag', 52.0705, 4.3007], ['Utrecht', 52.0907, 5.1214],
    ['Eindhoven', 51.4416, 5.4697], ['Groningen', 53.2194, 6.5665], ['Tilburg', 51.5555, 5.0913], ['Almere', 52.3508, 5.2647],
    ['Breda', 51.5719, 4.7683], ['Nijmegen', 51.8126, 5.8372], ['Arnhem', 51.9851, 5.8987], ['Zwolle', 52.5168, 6.083],
    ['Maastricht', 50.8514, 5.691], ['Schiphol', 52.3105, 4.7683], ['Amersfoort', 52.1561, 5.3878], ['Den Bosch', 51.6978, 5.3037]],
  be: [['Brussel', 50.8503, 4.3517], ['Antwerpen', 51.2194, 4.4025], ['Gent', 51.0543, 3.7174], ['Brugge', 51.2093, 3.2247],
    ['Leuven', 50.8798, 4.7005], ['Luik', 50.6326, 5.5797], ['Charleroi', 50.4108, 4.4446], ['Hasselt', 50.9307, 5.3325]],
  de: [['Berlin', 52.52, 13.405], ['Hamburg', 53.5511, 9.9937], ['München', 48.1351, 11.582], ['Köln', 50.9375, 6.9603],
    ['Frankfurt am Main', 50.1109, 8.6821], ['Düsseldorf', 51.2277, 6.7735], ['Dortmund', 51.5136, 7.4653], ['Essen', 51.4556, 7.0116],
    ['Stuttgart', 48.7758, 9.1829], ['Hannover', 52.3759, 9.732], ['Bremen', 53.0793, 8.8017], ['Münster', 51.9607, 7.6261]],
}.valueOf();
const citiesFor = (country) => (CITIES[country] || []).map(([name, lat, lon]) => ({ name, lat, lon }));

/** The nearest big cities (not the one you are in). */
function defaultDestinations(origin, count = 5) {
  return citiesFor(origin.country)
    .map((c) => ({ ...c, d: distance(origin, c) }))
    .filter((c) => c.d > 8000)
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ d, ...c }) => c);
}

const routeCache = cached(24 * 60 * 60 * 1000); // roads don't change often; the demo server asks for light use
let lastRoute = 0;
async function route(from, to) {
  const key = `${from.lat},${from.lon}>${to.lat},${to.lon}`;
  return routeCache(key, async () => {
    const wait = lastRoute + 1100 - Date.now(); // at most one request per second
    lastRoute = Date.now() + Math.max(0, wait);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const j = await getJson(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`);
    const r = j.routes && j.routes[0];
    if (!r) throw new Error('No route found');
    return {
      duration: r.duration,
      distance: r.distance,
      line: r.geometry.coordinates, // [lon, lat]
      steps: r.legs[0].steps.filter((s) => s.distance > 200).map((s) => ({ ref: s.ref || '', name: s.name || '', line: s.geometry.coordinates, distance: s.distance })),
    };
  });
}

// --- NDW live traffic (Netherlands) ------------------------------------------------------------------
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`)); return m ? m[1] : null; };
/** Jams, accidents and other obstructions in effect now, from NDW's DATEX II "actueel beeld". */
function parseNdw(xml, now = new Date()) {
  const out = [];
  const records = xml.split('<sit:situationRecord ').slice(1);
  for (const rec of records) {
    const type = (rec.match(/^xsi:type="sit:(\w+)"/) || [])[1];
    if (!['AbnormalTraffic', 'Accident', 'VehicleObstruction', 'GeneralObstruction'].includes(type)) continue;
    const start = new Date(tag(rec, 'com:overallStartTime') || 0);
    const end = tag(rec, 'com:overallEndTime');
    if (start > now || (end && new Date(end) < now)) continue;
    let points = [];
    const pos = tag(rec, 'loc:posList');
    if (pos) {
      const n = pos.trim().split(/\s+/).map(Number);
      for (let i = 0; i + 1 < n.length; i += 2) points.push([n[i + 1], n[i]]); // → [lon, lat]
    } else {
      const lat = tag(rec, 'loc:latitude');
      const lon = tag(rec, 'loc:longitude');
      if (lat && lon) points.push([Number(lon), Number(lat)]);
    }
    if (!points.length) continue;
    out.push({
      kind: type === 'AbnormalTraffic' ? 'jam' : type === 'Accident' ? 'accident' : 'obstruction',
      delay: Number(tag(rec, 'sit:delayTimeValue')) || 0, // seconds
      length: Number(tag(rec, 'sit:queueLength')) || 0, // metres
      points,
    });
  }
  return out;
}
const ndwCache = cached(3 * 60 * 1000);
const ndwJams = () => ndwCache('ndw', async () => ({ jams: parseNdw(await getText('https://opendata.ndw.nu/actueel_beeld.xml.gz', { timeout: 30000 })), fetched: new Date().toISOString() }));

const bearing = (a, b) => (Math.atan2((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 180) / Math.PI;
const angleDiff = (x, y) => Math.abs(((x - y + 540) % 360) - 180);
/** Jams that lie on the route, driving the same direction, with the road they are on. */
function jamsOnRoute(r, jams) {
  const found = [];
  for (const j of jams) {
    const near = j.points.filter(([lon, lat]) => distanceToLine({ lat, lon }, r.line) < 60);
    if (!near.length || near.length < Math.ceil(j.points.length * 0.6)) continue;
    // Same direction: compare the jam's direction with the route at that spot.
    if (j.points.length >= 2) {
      const jb = bearing(j.points[0], j.points[j.points.length - 1]);
      const mid = j.points[Math.floor(j.points.length / 2)];
      let best = 0, bestD = Infinity;
      for (let i = 0; i < r.line.length - 1; i++) {
        const d = distanceToLine({ lat: mid[1], lon: mid[0] }, [r.line[i], r.line[i + 1]]);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (angleDiff(jb, bearing(r.line[best], r.line[best + 1])) > 60) continue;
    }
    const mid = j.points[Math.floor(j.points.length / 2)];
    const step = r.steps.reduce((acc, s) => {
      const d = distanceToLine({ lat: mid[1], lon: mid[0] }, s.line);
      return d < acc.d ? { d, s } : acc;
    }, { d: Infinity, s: null }).s;
    found.push({ ...j, road: step ? step.ref.split(';')[0] || step.name : '' });
  }
  return found;
}

/** The roads a route mainly uses, e.g. ["A2", "A10"]. */
function mainRoads(r) {
  const byRef = new Map();
  for (const s of r.steps) {
    const ref = (s.ref || '').split(';')[0].trim();
    if (/^[AN]\d+$|^E\d+$/i.test(ref) || (/^\w?\d+$/.test(ref) && s.distance > 3000)) byRef.set(ref, (byRef.get(ref) || 0) + s.distance);
  }
  // Only roads that carry a real share of the trip: OSRM sometimes leaves the number off a motorway stretch,
  // and a short side road shouldn't then look like "the" route.
  const total = r.steps.reduce((s, x) => s + x.distance, 0) || 1;
  return [...byRef.entries()].filter(([, d]) => d > 2000 && d / total >= 0.15).map(([ref]) => ref).slice(0, 3);
}

/** Travel times from origin { name, lat, lon, country } to each destination. */
async function traffic(origin, destinations) {
  const list = destinations && destinations.length ? destinations : defaultDestinations(origin);
  let live = null;
  let liveError = null;
  if (origin.country === 'nl') {
    try { live = await ndwJams(); } catch (e) { liveError = e.message; }
  }
  const routes = [];
  for (const d of list.slice(0, 8)) {
    try {
      const r = await route(origin, d);
      // Stranded vehicles and the like only count when they cause a delay.
      const jams = live ? jamsOnRoute(r, live.jams).filter((j) => j.kind !== 'obstruction' || j.delay > 0) : [];
      const delay = jams.reduce((s, j) => s + j.delay, 0);
      routes.push({
        name: d.name,
        distanceKm: Math.round(r.distance / 1000),
        normalMin: Math.round(r.duration / 60),
        delayMin: Math.round(delay / 60),
        totalMin: Math.round((r.duration + delay) / 60),
        via: mainRoads(r),
        jams: jams.map((j) => ({ kind: j.kind, road: j.road, delayMin: Math.round(j.delay / 60), lengthKm: Math.round(j.length / 100) / 10 })),
      });
    } catch (e) {
      routes.push({ name: d.name, error: e.message });
    }
  }
  return {
    origin: { name: origin.name },
    routes,
    live: !!live,
    liveAvailable: origin.country === 'nl',
    liveError,
    updated: live ? live.fetched : new Date().toISOString(),
    stale: !!(live && live.stale),
    sources: ['OpenStreetMap / OSRM', ...(origin.country === 'nl' ? ['NDW'] : [])],
  };
}

module.exports = { traffic, parseNdw, jamsOnRoute, defaultDestinations, citiesFor, mainRoads, CITIES };
