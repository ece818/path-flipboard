/* Split-flap departure board engine */
const stationSelect = document.getElementById('stationSelect');
const scheduleEl = document.getElementById('schedule');
const metaLine = document.getElementById('metaLine');
const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');
const alertBox = document.getElementById('alertBox');
const refreshBtn = document.getElementById('refreshBtn');
const autoRefresh = document.getElementById('autoRefresh');
const clockEl = document.getElementById('stationClock');
const clockDate = document.getElementById('clockDate');

const STATION_NAMES = { NWK:'NEWARK', HAR:'HARRISON', JSQ:'JOURNAL SQUARE', GRV:'GROVE STREET', EXP:'EXCHANGE PLACE', NEW:'NEWPORT', HOB:'HOBOKEN' };

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
function statusFor(sec, arrivalMsg) {
  if (sec <= 30) return { cls: 'due', label: 'BOARDING' };
  if (sec < 120) return { cls: 'approach', label: 'APPROACHING' };
  return { cls: '', label: arrivalMsg.toUpperCase() };
}

/* ---------- board render ---------- */
let trains = [];   // flat sorted list
let rowRefs = [];  // [{flipsEl, statusEl, msg}]

function buildBoard(data) {
  scheduleEl.innerHTML = '';
  rowRefs = [];
  trains = data.destinations.flatMap(d => d.messages.map(m => ({ ...m, dir: d.label })));
  // Drop trains that departed a while ago (snapshot may be minutes old).
  trains = trains.filter(m => remainingSec(m) > -120);
  trains.sort((a, b) => remainingSec(a) - remainingSec(b));

  if (!trains.length) {
    scheduleEl.innerHTML = `<div class="empty">— NO TRAINS REPORTED —</div>`;
    return;
  }
  for (const m of trains.slice(0, 10)) {
    const sec = remainingSec(m);
    const st = statusFor(sec, m.arrivalTimeMessage);
    const row = document.createElement('div');
    row.className = `row ${st.cls}`;
    const dirTag = m.dir === 'ToNY' ? '→ NEW YORK' : m.dir === 'ToNJ' ? '→ NEW JERSEY' : m.dir.toUpperCase();
    row.innerHTML = `
      <div><div class="row-dir">${dirTag}</div><div class="flips"></div><div class="row-status">${st.label}</div></div>
      <div><div class="dest"></div><div class="row-sub">TO ${m.target} • ${m.line.name.toUpperCase()}</div></div>
      <div class="status">${m.arrivalTimeMessage.toUpperCase()}<small>LAST UPDATE ${new Date(m.lastUpdated).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small><br><span class="line-chip" style="--c:${m.line.color}">${m.line.short}</span></div>`;
    renderFlips(row.querySelector('.flips'), flipString(sec));
    renderTiles(row.querySelector('.dest'), m.headSign);
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
    const st = statusFor(sec, r.msg.arrivalTimeMessage);
    r.row.classList.toggle('approach', st.cls === 'approach');
    r.row.classList.toggle('due', st.cls === 'due');
    if (r.statusEl.textContent !== st.label) r.statusEl.textContent = st.label;
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
async function fetchStation(code) {
  try {
    const res = await fetch('data/realtime.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`static ${res.status}`);
    return shapeStationData(code, await res.json(), 'static snapshot');
  } catch {
    const res = await fetch(`/api/realtime?station=${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { ...data, fetchedVia: 'live proxy' };
  }
}
function setStatus(state, text) {
  statusPill.className = 'board-signal ' + state;
  statusText.textContent = text;
}
let timer = null;
async function loadStation(code) {
  const normalized = code.toUpperCase();
  setStatus('loading', 'SYNC');
  alertBox.classList.add('hidden');
  metaLine.textContent = `SYNCING ${STATION_NAMES[normalized] || normalized}…`;
  try {
    const data = await fetchStation(normalized);
    buildBoard(data);
    const lastUpd = data.lastUpdated
      ? new Date(data.lastUpdated).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })
      : 'now';
    metaLine.textContent = `${STATION_NAMES[normalized]} BOARD • SYNCED ${lastUpd} • ${data.fetchedVia?.toUpperCase()} • AUTO ${autoRefresh.checked ? 'ON 15s' : 'OFF'}`;
    setStatus('', 'LIVE');
  } catch (e) {
    console.error(e);
    alertBox.textContent = `SIGNAL LOST: ${e.message}. Run the local server (npm start) — the browser cannot reach panynj.gov directly (CORS).`;
    alertBox.classList.remove('hidden');
    setStatus('error', 'OFFLINE');
    scheduleEl.innerHTML = `<div class="empty">— SIGNAL LOST —</div>`;
  }
}
function scheduleAuto() {
  if (timer) clearInterval(timer);
  if (autoRefresh.checked) timer = setInterval(() => loadStation(stationSelect.value), 15000);
}

stationSelect.addEventListener('change', () => { localStorage.setItem('path:njStation', stationSelect.value); loadStation(stationSelect.value); });
refreshBtn.addEventListener('click', () => loadStation(stationSelect.value));
autoRefresh.addEventListener('change', () => { localStorage.setItem('path:autoRefresh', autoRefresh.checked ? '1' : '0'); scheduleAuto(); });

const saved = localStorage.getItem('path:njStation');
if (saved && STATION_NAMES[saved]) stationSelect.value = saved;
const savedAuto = localStorage.getItem('path:autoRefresh');
if (savedAuto !== null) autoRefresh.checked = savedAuto === '1';

loadStation(stationSelect.value);
scheduleAuto();
