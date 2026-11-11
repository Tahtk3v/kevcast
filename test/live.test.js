// Weather and traffic slides: data handling, tested offline with small fixtures shaped like the real feeds.
const test = require('node:test');
const assert = require('node:assert');
const weather = require('../server/live/weather');
const traffic = require('../server/live/traffic');
const geo = require('../server/live/geo');

const at = (iso, temp, sym1, rain1, sym6, rain6) => ({
  time: iso,
  data: {
    instant: { details: { air_temperature: temp, wind_speed: 5, wind_from_direction: 270, relative_humidity: 80 } },
    ...(sym1 ? { next_1_hours: { summary: { symbol_code: sym1 }, details: { precipitation_amount: rain1 } } } : {}),
    ...(sym6 ? { next_6_hours: { summary: { symbol_code: sym6 }, details: { precipitation_amount: rain6 } } } : {}),
  },
});

test('weather: now, hour by hour and daily summaries', () => {
  const series = [];
  const start = new Date(2026, 10, 11, 8, 0, 0); // local time
  for (let h = 0; h < 20; h++) {
    const d = new Date(start.getTime() + h * 3600000);
    series.push(at(d.toISOString(), 4 + h / 2, h === 1 ? 'lightrain' : 'cloudy', h === 1 ? 0.4 : 0, 'cloudy', 0));
  }
  for (let day = 2; day <= 7; day++) for (const hour of [0, 6, 12, 18]) {
    const d = new Date(2026, 10, 11 + day, hour);
    series.push(at(d.toISOString(), hour === 12 ? 10 + day : 2, null, 0, hour === 12 ? 'clearsky_day' : 'rain', hour === 12 ? 0 : 1.5));
  }
  const s = weather.summarise({ properties: { timeseries: series } }, start);
  assert.strictEqual(s.current.temperature, 4);
  assert.strictEqual(s.current.symbol, 'cloudy');
  assert.strictEqual(s.hourly.length, 12);
  assert.strictEqual(s.hourly[1].precipitation, 0.4);
  assert.strictEqual(s.daily[0].max, 11.5, 'today: 08:00–23:00');
  assert.strictEqual(s.daily[2].symbol, 'clearsky_day', 'the daytime symbol (6-hour period nearest noon)');
  assert.strictEqual(s.daily[2].max, 12);
  assert.strictEqual(s.daily[2].precipitation, 4.5, '6-hourly amounts summed once each');
});

test('weather warnings: by polygon, by region name, level and language', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  const warn = (level, lang, poly, areaDesc, expires = '2026-11-11T20:00:00+00:00') => ({
    alert: { info: [lang, 'en-GB'].map((l) => ({
      language: l, event: 'Wind', headline: `${l} headline`, onset: '2026-11-11T10:00:00+00:00', expires,
      parameter: [{ valueName: 'awareness_level', value: `${level}; x; y` }],
      area: [{ areaDesc, ...(poly ? { polygon: [poly] } : {}) }],
    })) },
  });
  const square = '52.0,5.0 52.0,5.4 52.2,5.4 52.2,5.0 52.0,5.0';
  const feed = { warnings: [
    warn(2, 'nl-NL', square, 'Utrecht'),
    warn(3, 'nl-NL', null, 'Provincie Utrecht'),
    warn(4, 'nl-NL', '53,6 53,7 54,7 54,6 53,6', 'Groningen'),
    warn(2, 'nl-NL', square, 'Utrecht', '2026-11-11T11:00:00+00:00'),
    warn(1, 'nl-NL', square, 'Utrecht'),
  ] };
  const w = weather.warningsFor(feed, { lat: 52.1, lon: 5.2, region: 'Utrecht' }, 'nl', now);
  assert.deepStrictEqual(w.map((x) => x.level), ['orange', 'yellow', 'info'], 'sorted by severity; elsewhere and expired left out');
  assert.strictEqual(w[1].headline, 'nl-NL headline', 'the screen language');
  assert.strictEqual(weather.warningsFor(feed, { lat: 52.1, lon: 5.2, region: 'Utrecht' }, 'fr', now)[1].headline, 'en-GB headline', 'English otherwise');
});

test('traffic: NDW jams, matched to a route in the same direction', () => {
  const xml = `<x><sit:situationRecord xsi:type="sit:AbnormalTraffic" id="1"><com:overallStartTime>2026-11-11T07:00:00Z</com:overallStartTime>
    <sit:delayTimeValue>480.0</sit:delayTimeValue><sit:queueLength>2500</sit:queueLength>
    <loc:posList>52.000 5.000 52.000 5.010 52.000 5.020</loc:posList></sit:situationRecord>
    <sit:situationRecord xsi:type="sit:Accident" id="2"><com:overallStartTime>2026-11-11T07:30:00Z</com:overallStartTime>
    <loc:latitude>52.0001</loc:latitude><loc:longitude>5.03</loc:longitude></sit:situationRecord>
    <sit:situationRecord xsi:type="sit:AbnormalTraffic" id="3"><com:overallStartTime>2026-11-12T07:00:00Z</com:overallStartTime>
    <loc:posList>52.000 5.000 52.000 5.010</loc:posList></sit:situationRecord>
    <sit:situationRecord xsi:type="sit:RoadOrCarriagewayOrLaneManagement" id="4"><loc:posList>52 5 52 5.1</loc:posList></sit:situationRecord></x>`;
  const jams = traffic.parseNdw(xml, new Date('2026-11-11T08:00:00Z'));
  assert.deepStrictEqual(jams.map((j) => [j.kind, j.delay, j.length]), [['jam', 480, 2500], ['accident', 0, 0]], 'future and other records skipped');
  const route = { line: [[4.99, 52.0], [5.05, 52.0]], steps: [{ ref: 'A12', name: '', line: [[4.99, 52.0], [5.05, 52.0]], distance: 4000 }] };
  assert.deepStrictEqual(traffic.jamsOnRoute(route, jams).map((j) => [j.kind, j.road]), [['jam', 'A12'], ['accident', 'A12']]);
  const back = { line: [[5.05, 52.0], [4.99, 52.0]], steps: [{ ref: 'A12', line: [[5.05, 52.0], [4.99, 52.0]], distance: 4000 }] };
  assert.deepStrictEqual(traffic.jamsOnRoute(back, jams).map((j) => j.kind), ['accident'], 'a jam on the other carriageway is not on this route');
});

test('traffic: default destinations and main roads', () => {
  const near = traffic.defaultDestinations({ lat: 52.0907, lon: 5.1214, country: 'nl' }, 3).map((c) => c.name);
  assert.ok(!near.includes('Utrecht'), 'not the city you are in');
  assert.strictEqual(near.length, 3);
  assert.deepStrictEqual(traffic.defaultDestinations({ lat: 0, lon: 0, country: 'xx' }), []);
  const roads = traffic.mainRoads({ steps: [{ ref: 'A12', distance: 30000 }, { ref: 'A2;E25', distance: 20000 }, { ref: 'N201', distance: 2500 }, { ref: '', distance: 5000 }] });
  assert.deepStrictEqual(roads, ['A12', 'A2'], 'short stretches are left out');
});

test('geometry', () => {
  assert.ok(Math.abs(geo.distance({ lat: 52.09, lon: 5.12 }, { lat: 52.37, lon: 4.9 }) - 34400) < 600);
  assert.ok(geo.inPolygon({ lat: 52.1, lon: 5.2 }, [[52, 5], [52, 5.4], [52.2, 5.4], [52.2, 5]]));
  assert.ok(!geo.inPolygon({ lat: 53, lon: 5.2 }, [[52, 5], [52, 5.4], [52.2, 5.4], [52.2, 5]]));
  assert.ok(geo.distanceToLine({ lat: 52.0, lon: 5.01 }, [[5.0, 52.0], [5.02, 52.0]]) < 1);
});
