/* Shared code for KevCast's own slides (weather, traffic). The player shows them in an iframe and passes
 * ?id=<media id>&lang=<screen language>&clock=auto|24|12. Data comes from the KevCast server only; the last
 * good data is kept on the device, so the slide still shows something when the server or internet is down. */
(function () {
  const qs = new URLSearchParams(location.search);
  const id = qs.get('id');
  const clock = qs.get('clock') || 'auto';
  const lang = (window.KevI18n && window.KevI18n.lang) || 'en';
  const locale = lang === 'en' ? undefined : lang;
  const t = (window.KevI18n && window.KevI18n.t) || ((s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));
  const tn = (window.KevI18n && window.KevI18n.tn) || ((n, a, b, v) => t(n === 1 ? a : b, { ...(v || {}), n }));
  const timeOpts = clock === '12' ? { hour12: true } : clock === '24' ? { hourCycle: 'h23' } : {};
  const fmtTime = (d) => new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', ...timeOpts });
  const fmtHour = (d) => new Date(d).toLocaleTimeString(locale, { hour: clock === '12' ? 'numeric' : '2-digit', minute: clock === '12' ? undefined : '2-digit', ...timeOpts });
  const fmtDay = (iso, long) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: long ? 'long' : 'short' });
  const el = (tag, cls, ...kids) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  };
  const svg = (markup, cls) => { const s = el('span', `icon ${cls || ''}`); s.innerHTML = markup; return s; };

  // Weather icons for MET Norway symbol codes (clearsky_day, lightrainshowers_night, heavysnow, fog, …).
  function weatherIcon(code, cls) {
    code = code || 'cloudy';
    const night = /_night/.test(code);
    const has = (w) => code.includes(w);
    const sunny = has('clearsky') || has('fair') || has('partlycloudy') || has('showers');
    const cloudy = !has('clearsky');
    const darkCloud = has('heavy') || has('thunder') || (has('rain') && !has('showers')) || has('sleet') || has('snow') && !has('showers');
    let s = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">';
    const cx = cloudy ? 24 : 32, cy = cloudy ? 22 : 32, r = cloudy ? 10 : 14;
    if (sunny && !night) {
      s += `<g stroke="#fbbf24" stroke-width="3" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const x1 = cx + Math.cos((a * Math.PI) / 180) * (r + 4), y1 = cy + Math.sin((a * Math.PI) / 180) * (r + 4);
        const x2 = cx + Math.cos((a * Math.PI) / 180) * (r + 9), y2 = cy + Math.sin((a * Math.PI) / 180) * (r + 9);
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
      }).join('')}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fbbf24"/>`;
    } else if (sunny && night) {
      s += `<path d="M${cx + 4} ${cy - r - 2}a${r + 2} ${r + 2} 0 1 0 ${r - 2} ${r + 8} ${r - 1} ${r - 1} 0 0 1 -${r - 2} -${r + 8}z" fill="#e2e8f0" transform="translate(-6 0)"/>`;
    }
    if (has('fog')) {
      s += '<g stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"><line x1="10" y1="24" x2="54" y2="24"/><line x1="6" y1="34" x2="50" y2="34"/><line x1="14" y1="44" x2="58" y2="44"/></g>';
    } else if (cloudy) {
      const fill = darkCloud ? '#94a3b8' : '#e2e8f0';
      const y = sunny ? 4 : 0;
      s += `<path d="M18 ${44 + y}h28a10 10 0 0 0 0-20 13 13 0 0 0-25-3 9 9 0 0 0-3 23z" fill="${fill}"/>`;
    }
    const wet = has('rain') || has('sleet') || has('snow');
    if (wet) {
      const n = has('heavy') ? 3 : has('light') ? 1 : 2;
      const xs = [24, 34, 44].slice(0, n);
      for (const x of xs) {
        if (has('snow') || (has('sleet') && x === 34)) s += `<g stroke="#f8fafc" stroke-width="2.5" stroke-linecap="round"><line x1="${x}" y1="51" x2="${x}" y2="61"/><line x1="${x - 4.5}" y1="53.5" x2="${x + 4.5}" y2="58.5"/><line x1="${x - 4.5}" y1="58.5" x2="${x + 4.5}" y2="53.5"/></g>`;
        else s += `<line x1="${x + 2}" y1="51" x2="${x - 2}" y2="61" stroke="#60a5fa" stroke-width="3.5" stroke-linecap="round"/>`;
      }
    }
    if (has('thunder')) s += '<path d="M33 44l-6 11h6l-3 9 10-13h-6l4-7z" fill="#facc15"/>';
    return svg(s + '</svg>', cls);
  }

  const SYMBOL_TEXT = {
    clearsky: 'Clear sky', fair: 'Fair', partlycloudy: 'Partly cloudy', cloudy: 'Cloudy', fog: 'Fog',
    lightrain: 'Light rain', rain: 'Rain', heavyrain: 'Heavy rain', lightrainshowers: 'Light rain showers', rainshowers: 'Rain showers', heavyrainshowers: 'Heavy rain showers',
    lightsleet: 'Light sleet', sleet: 'Sleet', heavysleet: 'Heavy sleet', lightsleetshowers: 'Sleet showers', sleetshowers: 'Sleet showers', heavysleetshowers: 'Sleet showers',
    lightsnow: 'Light snow', snow: 'Snow', heavysnow: 'Heavy snow', lightsnowshowers: 'Snow showers', snowshowers: 'Snow showers', heavysnowshowers: 'Snow showers',
  };
  const symbolText = (code) => {
    const base = String(code || '').replace(/_(day|night|polartwilight)$/, '');
    if (base.includes('thunder')) return t('Thunderstorms');
    return t(SYMBOL_TEXT[base] || 'Cloudy');
  };

  /** Load the slide's data, keep a copy on the device, and call render(data) now and every `everyMs`. */
  function run(render, everyMs) {
    const key = `kevcast.widget.${id}`;
    const status = document.getElementById('status');
    const say = (text) => { if (status) { status.textContent = text; status.hidden = false; } };
    let shown = false;
    let retry = null;
    async function load() {
      clearTimeout(retry);
      let data = null;
      let problem = null;
      try {
        const res = await fetch(`/api/widgets/${encodeURIComponent(id)}?lang=${encodeURIComponent(lang)}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (res.status === 202) {
          // The server is still fetching (first time): ask again soon.
          if (!shown) say(t('Loading…'));
          retry = setTimeout(load, 4000);
          return;
        }
        if (!res.ok) throw new Error(json.error || String(res.status));
        data = json;
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* storage full or blocked */ }
      } catch (e) {
        problem = e.message;
        try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { data = null; }
        if (data) data.stale = true;
      }
      if (data) {
        if (status) status.hidden = true;
        shown = true;
        render(data);
      } else {
        say(`${t('No data yet — the KevCast server needs internet access for this slide.')}${problem ? `\n\n(${problem})` : ''}`);
        retry = setTimeout(load, 30000);
      }
    }
    load();
    setInterval(load, everyMs);
  }

  window.KevWidget = { id, lang, locale, clock, t, tn, el, fmtTime, fmtHour, fmtDay, weatherIcon, symbolText, run };
})();
