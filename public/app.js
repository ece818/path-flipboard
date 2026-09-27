/* Split-flap departure board engine */
const stationSelect = document.getElementById('stationSelect');
const scheduleEl = document.getElementById('schedule');
const metaLine = document.getElementById('metaLine');
const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');
const alertBox = document.getElementById('alertBox');
const refreshBtn = document.getElementById('refreshBtn');
const fsBtn = document.getElementById('fsBtn');
const autoRefresh = document.getElementById('autoRefresh');
const clockEl = document.getElementById('stationClock');
const clockDate = document.getElementById('clockDate');

const STATION_NAMES = { NWK:'NEWARK', HAR:'HARRISON', JSQ:'JOURNAL SQUARE', GRV:'GROVE STREET', EXP:'EXCHANGE PLACE', NEW:'NEWPORT', HOB:'HOBOKEN', WTC:'WORLD TRADE CENTER', CHR:'CHRISTOPHER ST', '09S':'9TH STREET', '14S':'14TH STREET', '23S':'23RD STREET', '33S':'33RD STREET' };

/* ---------- split-flap digit ---------- */
function makeFlip(char = '0') {
  const el = document.createElement('span');
  el.className = 'flip';
  el.dataset.v = char;
  el.innerHTML = `<span class="f-top">${char}</span><span class="f-bottom">${char}</span><span class="f-leaf f-leaf-top">${char}</span><span class="f-leaf f-leaf-bottom">${char}</span>`;
  return el;
}
function setFlip(el, v) {
  if (el.dataset.v === v) return;
  const old = el.dataset.v ?? v;
  el.dataset.v = v;
  el.querySelector('.f-top').textContent = v;
  el.querySelector('.f-bottom').textContent = v;
  el.querySelector('.f-leaf-top').textContent = old;
  el.querySelector('.f-leaf-bottom').textContent = v;
  el.classList.remove('flip-go');
  void el.offsetWidth; // restart animation
  el.classList.add('flip-go');
}
function makeColon() {
  const c = document.createElement('span');
  c.className = 'colon';
  c.textContent = ':';
  return c;
}
/* Render a digit string like "04:37" into a container, reusing flips */
function renderFlips(container, str) {
  const want = [...str].filter(ch => ch !== ' ').join('');
  let flips = [...container.querySelectorAll('.flip, .colon')];
  const current = flips.map(f => f.classList.contains('colon') ? ':' : f.dataset.v).join('');
  if (current.length !== want.length || [...want].some((ch,i)=> (ch===':') !== (current[i]===':'))) {
    container.innerHTML = '';
    for (const ch of want) container.appendChild(ch === ':' ? makeColon() : makeFlip(ch));
    return;
  }
  let fi = 0;
  for (const ch of want) {
    if (ch === ':') { fi++; continue; }
    setFlip(flips[fi], ch);
    fi++;
  }
}

/* ---------- destination letter tiles ---------- */
function renderTiles(container, text) {
  container.innerHTML = '';
  const upper = text.toUpperCase().slice(0, 26);
  [...upper].forEach((ch, i) => {
    const t = document.createElement('span');
    t.className = 'tile' + (ch === ' ' ? ' space' : '');
    t.textContent = ch === ' ' ? '\u00A0' : ch;
    t.style.animationDelay = `${Math.min(i * 18, 450)}ms`;
    container.appendChild(t);
  });
}

/* ---------- countdown helpers ---------- */
function remainingSec(m) {
  const elapsed = Math.floor((Date.now() - new Date(m.lastUpdated).getTime()) / 1000);
  return Math.max(0, m.secondsToArrivalNum - elapsed);
}
function flipString(sec) {
  const s = Math.max(0, sec);
  if (s >= 3600) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return `${h}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
  }
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}
function statusFor(sec) {
  if (isStale) return { cls: '', label: 'STALE' }; // snapshot too old to trust — say so
  if (sec <= 30) return { cls: 'due', label: 'BOARDING' };
  if (sec < 120) return { cls: 'approach', label: 'APPROACHING' };
  return { cls: '', label: '' }; // normal: countdown flips say it all, no duplicate text
}

/* Shorten long headsigns so tile rows never wrap */
function shortDest(text) {
  return text.toUpperCase()
    .replace('33RD STREET VIA HOBOKEN', '33RD VIA HOB')
    .replace('STREET', 'ST')
    .replace('VIA HOBOKEN', 'VIA HOB')
    .replace('JOURNAL SQUARE', 'JOURNAL SQ')
    .replace('WORLD TRADE CENTER', 'WORLD TRADE')
    .slice(0, 20);
}

/* ---------- board render ---------- */
let trains = [];   // flat sorted list
let rowRefs = [];  // [{flipsEl, statusEl, msg}]
let lastData = null;
let isStale = false;
let loading = false;
let lineFilter = localStorage.getItem('path:lineFilter') || null; // e.g. 'NWK-WTC' or 'JSQ-33'
let destFilter = localStorage.getItem('path:destFilter') || null; // e.g. 'NEWARK' (raw headSign upper)

const filterBar = document.getElementById('filterBar');
const filterText = document.getElementById('filterText');
const clearFilterBtn = document.getElementById('clearFilter');

function lineMatches(m, f) {
  if (!f) return true;
  if (f === 'JSQ-33') return m.line.short.startsWith('JSQ-33'); // badge covers JSQ-33 + via HOB
  return m.line.short === f;
}
function applyFilters(list) {
  return list.filter(m => {
    if (lineFilter && !lineMatches(m, lineFilter)) return false;
    if (destFilter && m.headSign.toUpperCase() !== destFilter) return false;
    return true;
  });
}
function updateFilterUI() {
  const label = lineFilter || destFilter;
  const kind = lineFilter ? 'LINE' : destFilter ? 'DEST' : null;
  filterBar.classList.toggle('hidden', !label);
  if (label) filterText.textContent = `SHOWING ${kind}: ${label} — TAP AGAIN TO CLEAR`;
  document.querySelectorAll('.badge').forEach(b => {
    b.classList.toggle('active', !!lineFilter && b.dataset.line === lineFilter);
  });
  localStorage.setItem('path:lineFilter', lineFilter || '');
  localStorage.setItem('path:destFilter', destFilter || '');
}
function setLineFilter(value) {
  lineFilter = (lineFilter === value) ? null : value;
  if (lineFilter) destFilter = null;
  updateFilterUI();
  if (lastData) buildBoard(lastData);
}
function setDestFilter(value) {
  destFilter = (destFilter === value) ? null : value;
  if (destFilter) lineFilter = null;
  updateFilterUI();
  if (lastData) buildBoard(lastData);
}
function clearFilter() {
  lineFilter = null;
  destFilter = null;
  updateFilterUI();
  if (lastData) buildBoard(lastData);
}

function buildBoard(data) {
  lastData = data;
  scheduleEl.innerHTML = '';
  rowRefs = [];
  trains = data.destinations.flatMap(d => d.messages.map(m => ({ ...m, dir: d.label })));
  // Drop trains that departed a while ago (snapshot may be minutes old).
  trains = trains.filter(m => remainingSec(m) > -120);
  trains.sort((a, b) => remainingSec(a) - remainingSec(b));
  const visible = applyFilters(trains).slice(0, 10);

  if (!trains.length) {
    scheduleEl.innerHTML = `<div class="empty">— NO TRAINS REPORTED —</div>`;
    return;
  }
  if (!visible.length) {
    const label = lineFilter || destFilter || 'FILTER';
    scheduleEl.innerHTML = `<div class="empty tappable">— NO ${label} TRAINS — TAP TO CLEAR —</div>`;
    scheduleEl.querySelector('.empty').addEventListener('click', clearFilter);
    return;
  }
  for (const m of visible) {
    const sec = remainingSec(m);
    const st = statusFor(sec);
    const row = document.createElement('div');
    row.className = `row ${st.cls}`;
    const dirTag = m.dir === 'ToNY' ? '→ NEW YORK' : m.dir === 'ToNJ' ? '→ NEW JERSEY' : m.dir.toUpperCase();
    // One countdown (flips), one destination, one sub-line. No duplicates.
    row.innerHTML = `
      <div class="col-time"><div class="flips"></div><div class="row-status">${st.label}</div></div>
      <div class="col-dest"><div class="dest"></div><div class="row-sub">${dirTag} <span class="sub-sep">•</span> <span class="sub-line">${m.line.short}</span></div></div>
      <div class="status col-line"><span class="line-chip" style="--c:${m.line.color}">${m.line.short}</span></div>`;
    renderFlips(row.querySelector('.flips'), flipString(sec));
    renderTiles(row.querySelector('.dest'), shortDest(m.headSign));
    // tap destination → filter to that destination; tap chip → filter to that line
    const destEl = row.querySelector('.dest');
    destEl.title = `Show only ${m.headSign}`;
    if (destFilter === m.headSign.toUpperCase()) destEl.classList.add('active');
    destEl.addEventListener('click', () => setDestFilter(m.headSign.toUpperCase()));
    const chipEl = row.querySelector('.line-chip');
    chipEl.title = `Show only ${m.line.short}`;
    if (lineFilter && lineMatches(m, lineFilter)) chipEl.classList.add('active');
    chipEl.addEventListener('click', (e) => { e.stopPropagation(); setLineFilter(m.line.short); });
    scheduleEl.appendChild(row);
    rowRefs.push({ flipsEl: row.querySelector('.flips'), statusEl: row.querySelector('.row-status'), row, msg: m });
  }
}

/* Tick every second: flip only changed digits, update status text */
setInterval(() => {
  for (const r of rowRefs) {
    const sec = remainingSec(r.msg);
    if (sec <= -120) { r.row.style.display = 'none'; continue; } // departed since render
    renderFlips(r.flipsEl, flipString(sec));
    const st = statusFor(sec);
    r.row.classList.toggle('approach', st.cls === 'approach');
    r.row.classList.toggle('due', st.cls === 'due');
    if (r.statusEl.textContent !== st.label) {
      r.statusEl.textContent = st.label;
      r.statusEl.classList.toggle('hidden', !st.label);
    }
  }
}, 1000);

/* ---------- station clock ---------- */
function tickClock() {
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  renderFlips(clockEl, `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`);
  clockDate.textContent = now.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }).toUpperCase() + ' • ET';
}
setInterval(tickClock, 1000);
tickClock();

/* Data source: static snapshot (GitHub Pages) first, local proxy fallback.
   Static file is refreshed every 5 min by .github/workflows/pages.yml.
   Countdowns stay accurate because remainingSec() counts from lastUpdated. */
const NJ_STATIONS = {
  NWK: { code: 'NWK', name: 'Newark', full: 'Newark' },
  HAR: { code: 'HAR', name: 'Harrison', full: 'Harrison' },
  JSQ: { code: 'JSQ', name: 'Journal Square', full: 'Journal Square' },
  GRV: { code: 'GRV', name: 'Grove Street', full: 'Grove Street (Jersey City)' },
  NEW: { code: 'NEW', name: 'Newport', full: 'Newport (Jersey City)' },
  EXP: { code: 'EXP', name: 'Exchange Place', full: 'Exchange Place (Jersey City)' },
  HOB: { code: 'HOB', name: 'Hoboken', full: 'Hoboken' },
  WTC: { code: 'WTC', name: 'World Trade Center', full: 'World Trade Center (New York)' },
  CHR: { code: 'CHR', name: 'Christopher St', full: 'Christopher Street (New York)' },
  '09S': { code: '09S', name: '9th Street', full: '9th Street (New York)' },
  '14S': { code: '14S', name: '14th Street', full: '14th Street (New York)' },
  '23S': { code: '23S', name: '23rd Street', full: '23rd Street (New York)' },
  '33S': { code: '33S', name: '33rd Street', full: '33rd Street (New York)' },
};
const LINE_INFO = {
  'D93A30': { name: 'Newark - World Trade Center', short: 'NWK-WTC', color: '#D93A30' },
  'FF9900': { name: 'Journal Square - 33rd Street', short: 'JSQ-33', color: '#FF9900' },
  '65C100': { name: 'Hoboken - World Trade Center', short: 'HOB-WTC', color: '#65C100' },
  '4D92FB': { name: 'Hoboken - 33rd Street', short: 'HOB-33', color: '#4D92FB' },
  '4D92FB,FF9900': { name: 'Journal Square - 33rd via Hoboken', short: 'JSQ-33 (via HOB)', color: '#FF9900' },
};
function shapeStationData(code, raw, fetchedVia) {
  const stationData = raw.results.find(r => r.consideredStation === code);
  if (!stationData) return { station: NJ_STATIONS[code], lastUpdated: raw.fetchedAt || new Date().toISOString(), destinations: [], fetchedVia };
  return {
    station: NJ_STATIONS[code],
    lastUpdated: stationData.destinations.flatMap(d => d.messages).map(m => m.lastUpdated)[0] || new Date().toISOString(),
    fetchedVia,
    destinations: stationData.destinations.map(dest => ({
      label: dest.label,
      labelDisplay: dest.label === 'ToNY' ? 'To New York' : dest.label === 'ToNJ' ? 'To New Jersey' : dest.label,
      messages: dest.messages.map(m => {
        const info = LINE_INFO[m.lineColor.toUpperCase()] || { name: m.headSign, short: m.headSign, color: `#${m.lineColor.split(',')[0]}` };
        return { ...m, line: info, secondsToArrivalNum: parseInt(m.secondsToArrival, 10) };
      }).sort((a, b) => a.secondsToArrivalNum - b.secondsToArrivalNum),
    })),
  };
}
async function loadSnapshot(code) {
  const res = await fetch('data/realtime.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`static ${res.status}`);
  const raw = await res.json();
  const ageMin = (Date.now() - new Date(raw.fetchedAt || 0).getTime()) / 60000;
  return { ...shapeStationData(code, raw, 'static snapshot'), live: false, ageMin };
}
async function loadLive(code) {
  // local dev proxy first (fast, no CORS issues when running node server.js)
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    try {
      const res = await fetch(`/api/realtime?station=${encodeURIComponent(code)}`, { signal: c.signal });
      if (res.ok) {
        const data = await res.json();
        if (!data.error) return { ...data, fetchedVia: 'live proxy', live: true, ageMin: 0 };
      }
    } finally {
      clearTimeout(t);
    }
  } catch { /* static hosts 404 here — try PANYNJ below */ }
  // PANYNJ blocks browser CORS, so go via public CORS proxies
  const raw = await fetchLiveRaw();
  raw.fetchedAt = raw.fetchedAt || new Date().toISOString();
  return { ...shapeStationData(code, raw, 'live'), live: true, ageMin: 0 };
}
const PANYNJ_URL = 'https://www.panynj.gov/bin/portauthority/ridepath.json';
async function fetchWithTimeout(url, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const res = await fetch(url, { signal: c.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}
async function fetchLiveRaw() {
  const url = `${PANYNJ_URL}?timeStamp=${Date.now()}`;
  const attempts = [
    ['direct', () => fetchWithTimeout(url)],
    ['allorigins-raw', () => fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)],
    ['allorigins-get', async () => {
      const w = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      const inner = typeof w.contents === 'string' ? JSON.parse(w.contents) : w.contents;
      if (!Array.isArray(inner.results)) throw new Error('unexpected payload shape');
      return inner;
    }],
    ['codetabs', () => fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`)],
    ['cors.lol', () => fetchWithTimeout(`https://api.cors.lol/?url=${encodeURIComponent(url)}`)],
  ];
  const errors = [];
  for (const [name, run] of attempts) {
    try {
      const j = await run();
      if (Array.isArray(j.results)) return j;
      throw new Error('unexpected payload shape');
    } catch (e) {
      errors.push(`${name}: ${e?.name === 'AbortError' ? 'timeout' : (e?.message || e)}`);
    }
  }
  const err = new Error('live fetch failed');
  err.details = errors;
  throw err;
}
let lastLiveFail = 0;
let lastLiveErrors = [];
function setStatus(state, text) {
  statusPill.className = 'board-signal ' + state;
  statusText.textContent = text;
}
let timer = null;
async function loadStation(code) {
  if (loading) return;
  loading = true;
  const normalized = code.toUpperCase();
  setStatus('loading', 'SYNC');
  alertBox.classList.add('hidden');
  metaLine.textContent = `SYNCING ${STATION_NAMES[normalized] || normalized}…`;
  try {
    // fast paint from the static snapshot, then upgrade to live data in place
    renderData(await loadSnapshot(normalized), normalized);
    if (!lastLiveFail || Date.now() - lastLiveFail > 45000) {
      try {
        renderData(await loadLive(normalized), normalized);
        lastLiveFail = 0;
        lastLiveErrors = [];
      } catch (e) {
        lastLiveFail = Date.now();
        lastLiveErrors = e?.details || [e?.message || String(e)];
        console.warn('live upgrade failed:', lastLiveErrors.join(' | '));
        if (isStale) alertBox.dataset.diag = lastLiveErrors.join(' | ');
      }
    }
  } catch (e) {
    console.error(e);
    alertBox.textContent = `SIGNAL LOST: ${e.message}. Retrying automatically.`;
    alertBox.classList.remove('hidden');
    setStatus('error', 'OFFLINE');
    scheduleEl.innerHTML = `<div class="empty">— SIGNAL LOST —</div>`;
  } finally {
    loading = false;
  }
}
function renderData(data, normalized) {
  isStale = !data.live && (data.ageMin || 0) > 10;
  buildBoard(data);
  const lastUpd = data.lastUpdated
    ? new Date(data.lastUpdated).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
    : 'now';
  const src = data.live ? 'LIVE' : `SNAPSHOT ${Math.max(1, Math.round(data.ageMin || 0))}M OLD`;
  metaLine.textContent = `${STATION_NAMES[normalized]} • UPDATED ${lastUpd} • ${src} • AUTO ${autoRefresh.checked ? 'ON' : 'OFF'}`;
  if (isStale) {
    setStatus('error', 'STALE');
    alertBox.textContent = `STALE DATA: live refresh failed and the snapshot is ${Math.round(data.ageMin)} min old — countdowns may read 00 / STALE. Check connection; retrying automatically.`;
    alertBox.classList.remove('hidden');
  } else {
    delete alertBox.dataset.diag;
    delete alertBox.dataset.showDiag;
    delete alertBox.dataset.short;
    alertBox.classList.add('hidden');
    setStatus('', 'LIVE');
  }
}
function scheduleAuto() {
  if (timer) clearInterval(timer);
  if (autoRefresh.checked) timer = setInterval(() => loadStation(stationSelect.value), 15000);
}

stationSelect.addEventListener('change', () => {
  localStorage.setItem('path:njStation', stationSelect.value);
  // a filter from the old station (e.g. NEWARK) would hide most of the new
  // station's trains, looking like "future trains missing" — reset it
  lineFilter = null;
  destFilter = null;
  updateFilterUI();
  loadStation(stationSelect.value);
});
refreshBtn.addEventListener('click', () => loadStation(stationSelect.value));
autoRefresh.addEventListener('change', () => { localStorage.setItem('path:autoRefresh', autoRefresh.checked ? '1' : '0'); scheduleAuto(); });
/* Fullscreen focus mode — just the flipboards */
async function toggleTheater() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // Fullscreen API unavailable (e.g. iframe) — fall back to CSS-only focus
    const on = document.body.classList.toggle('theater');
    fsBtn.textContent = on ? '✕' : '⛶';
    fsBtn.title = on ? 'Exit focus mode' : 'Fullscreen — just the board';
  }
}
document.addEventListener('fullscreenchange', () => {
  const on = !!document.fullscreenElement;
  document.body.classList.toggle('theater', on);
  fsBtn.textContent = on ? '✕' : '⛶';
  fsBtn.title = on ? 'Exit focus mode' : 'Fullscreen — just the board';
});
fsBtn.addEventListener('click', toggleTheater);
document.getElementById('exitTheater').addEventListener('click', toggleTheater);
clearFilterBtn.addEventListener('click', clearFilter);
alertBox.style.cursor = 'pointer';
alertBox.addEventListener('click', () => {
  const d = alertBox.dataset.diag;
  if (!d) return;
  if (alertBox.dataset.showDiag) {
    delete alertBox.dataset.showDiag;
    alertBox.textContent = alertBox.dataset.short || alertBox.textContent;
  } else {
    alertBox.dataset.showDiag = '1';
    alertBox.dataset.short = alertBox.textContent;
    alertBox.textContent = 'DIAG: ' + d + ' — tap to hide';
  }
});
document.querySelectorAll('.badge').forEach(b => {
  b.addEventListener('click', () => setLineFilter(b.dataset.line));
});

const saved = localStorage.getItem('path:njStation');
if (saved && STATION_NAMES[saved]) stationSelect.value = saved;
const savedAuto = localStorage.getItem('path:autoRefresh');
if (savedAuto !== null) autoRefresh.checked = savedAuto === '1';
// drop stale filters saved as empty strings
if (!lineFilter) lineFilter = null;
if (!destFilter) destFilter = null;
updateFilterUI();

loadStation(stationSelect.value);
scheduleAuto();
