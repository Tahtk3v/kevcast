// Weather slide data: forecast from MET Norway (api.met.no, free, no account, CC BY 4.0) and official weather
// warnings from MeteoAlarm (the European warnings feed, e.g. KNMI for the Netherlands, DWD for Germany).
const { getJson, cached } = require('./http');
const { inPolygon } = require('./geo');

// MeteoAlarm feed name per country code.
const METEOALARM = {
  nl: 'netherlands', be: 'belgium', de: 'germany', lu: 'luxembourg', fr: 'france', at: 'austria', ch: 'switzerland',
  dk: 'denmark', no: 'norway', se: 'sweden', fi: 'finland', ie: 'ireland', gb: 'united-kingdom', es: 'spain', pt: 'portugal',
  it: 'italy', pl: 'poland', cz: 'czechia', sk: 'slovakia', hu: 'hungary', si: 'slovenia', hr: 'croatia', gr: 'greece',
  cy: 'cyprus', mt: 'malta', ee: 'estonia', lv: 'latvia', lt: 'lithuania', ro: 'romania', bg: 'bulgaria', rs: 'serbia',
  ba: 'bosnia-herzegovina', me: 'montenegro', mk: 'republic-of-north-macedonia', md: 'moldova', il: 'israel', is: 'iceland',
};

const forecastCache = cached(30 * 60 * 1000);
const warningsCache = cached(10 * 60 * 1000);

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const round1 = (n) => Math.round(n * 10) / 10;

/** Today, hour by hour, and the next days from MET Norway's compact forecast. Times in the server's time zone. */
function summarise(met, now = new Date()) {
  const series = (met.properties?.timeseries || []).map((t) => ({ time: new Date(t.time), data: t.data }));
  const first = series.find((t) => t.time >= new Date(now.getTime() - 60 * 60 * 1000)) || series[0];
  if (!first) throw new Error('No forecast data');
  const det = (t) => t.data.instant.details;
  const sym = (t) => (t.data.next_1_hours || t.data.next_6_hours || t.data.next_12_hours)?.summary?.symbol_code || null;
  const precipOf = (t) => t.data.next_1_hours?.details?.precipitation_amount ?? null;
  const current = {
    temperature: round1(det(first).air_temperature),
    symbol: sym(first),
    windSpeed: round1(det(first).wind_speed ?? 0),
    windFrom: Math.round(det(first).wind_from_direction ?? 0),
    humidity: Math.round(det(first).relative_humidity ?? 0),
  };
  const hourly = series.filter((t) => t.time >= first.time && t.data.next_1_hours).slice(0, 12).map((t) => ({
    time: t.time.toISOString(), temperature: round1(det(t).air_temperature), symbol: sym(t), precipitation: precipOf(t) ?? 0,
  }));
  // Days: min/max of the hourly (or 6-hourly) temperatures, precipitation summed without double counting.
  const days = new Map();
  for (let i = 0; i < series.length; i++) {
    const t = series[i];
    const k = dayKey(t.time);
    const d = days.get(k) || { date: k, min: Infinity, max: -Infinity, precipitation: 0, symbols: [], covered: 0 };
    const temp = det(t).air_temperature;
    d.min = Math.min(d.min, temp);
    d.max = Math.max(d.max, temp);
    const next = series[i + 1];
    const stepHours = next ? (next.time - t.time) / 3600000 : 1;
    if (stepHours <= 1 && t.data.next_1_hours) d.precipitation += t.data.next_1_hours.details?.precipitation_amount || 0;
    else if (t.data.next_6_hours) d.precipitation += t.data.next_6_hours.details?.precipitation_amount || 0;
    const hour = t.time.getHours();
    const s6 = t.data.next_6_hours?.summary?.symbol_code;
    if (s6 && hour >= 6 && hour <= 14) d.symbols.push({ hour, s: s6 });
    d.covered++;
    days.set(k, d);
  }
  const daily = [...days.values()].filter((d) => d.covered >= 2).map((d) => ({
    date: d.date,
    min: round1(d.min),
    max: round1(d.max),
    precipitation: round1(d.precipitation),
    // The symbol for the daytime: the 6-hour period starting closest to noon.
    symbol: (d.symbols.sort((a, b) => Math.abs(a.hour - 12) - Math.abs(b.hour - 12))[0] || {}).s || null,
  }));
  return { current, hourly, daily: daily.slice(0, 6) };
}

// 1 = green: KNMI uses it for notices such as "locally dense fog"; shown as plain information.
const LEVELS = { 1: 'info', 2: 'yellow', 3: 'orange', 4: 'red' };
/** Active warnings for a point from a MeteoAlarm feed: yellow/orange/red, in the preferred language. */
function warningsFor(feed, place, lang = 'en', now = new Date()) {
  const out = [];
  const seen = new Set();
  for (const w of feed.warnings || []) {
    const infos = w.alert?.info || [];
    if (!infos.length) continue;
    const pick = infos.find((i) => (i.language || '').toLowerCase().startsWith(lang)) || infos.find((i) => (i.language || '').startsWith('en')) || infos[0];
    const levelParam = (pick.parameter || []).find((p) => p.valueName === 'awareness_level');
    const level = Number(String(levelParam?.value || '').split(';')[0]);
    if (!LEVELS[level]) continue;
    if (level === 1 && !/\S/.test(pick.headline || '')) continue; // "no warnings" placeholders
    const expires = new Date(pick.expires || 0);
    if (!(expires > now)) continue;
    const areas = pick.area || [];
    const hit = areas.some((a) => {
      const rings = (a.polygon || []).map((poly) => poly.trim().split(/\s+/).map((pt) => pt.split(',').map(Number)));
      if (rings.length) return rings.some((r) => inPolygon(place, r));
      // No polygon: compare the region name (e.g. the province) with the area description.
      return !!place.region && String(a.areaDesc || '').toLowerCase().includes(place.region.toLowerCase());
    });
    if (!hit) continue;
    const item = {
      level: LEVELS[level],
      event: pick.event || '',
      headline: pick.headline || pick.event || '',
      description: pick.description || '',
      onset: pick.onset || pick.effective || null,
      expires: pick.expires,
      sender: pick.senderName || '',
    };
    const key = `${item.level}|${item.event}|${item.onset}|${item.expires}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  const rank = { red: 4, orange: 3, yellow: 2, info: 1 };
  return out.sort((a, b) => rank[b.level] - rank[a.level] || String(a.onset).localeCompare(String(b.onset)));
}

/** Everything the weather slide shows for a configured location { name, lat, lon, country, region }. */
async function weather(place, lang = 'en') {
  const lat = Number(place.lat).toFixed(4); // MET Norway asks for at most 4 decimals
  const lon = Number(place.lon).toFixed(4);
  const met = await forecastCache(`${lat},${lon}`, async () => ({ data: await getJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`), fetched: new Date().toISOString() }));
  const feedName = METEOALARM[place.country];
  let warnings = [];
  let warningsError = null;
  if (feedName) {
    try {
      const feed = await warningsCache(feedName, () => getJson(`https://feeds.meteoalarm.org/api/v1/warnings/feeds-${feedName}`));
      warnings = warningsFor(feed, place, lang);
    } catch (e) {
      warningsError = e.message;
    }
  }
  return {
    place: { name: place.name, lat: Number(lat), lon: Number(lon) },
    ...summarise(met.data),
    warnings,
    warningsAvailable: !!feedName && !warningsError,
    updated: met.fetched,
    stale: !!met.stale,
    sources: ['MET Norway', ...(feedName ? ['MeteoAlarm'] : [])],
  };
}

module.exports = { weather, summarise, warningsFor, METEOALARM };
