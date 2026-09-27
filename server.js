import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// NJ stations mapping to PANYNJ codes
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

// Map lineColor to human route info
const LINE_INFO = {
  'D93A30': { name: 'Newark - World Trade Center', short: 'NWK-WTC', color: '#D93A30' },
  'FF9900': { name: 'Journal Square - 33rd Street', short: 'JSQ-33', color: '#FF9900' },
  '65C100': { name: 'Hoboken - World Trade Center', short: 'HOB-WTC', color: '#65C100' },
  '4D92FB': { name: 'Hoboken - 33rd Street', short: 'HOB-33', color: '#4D92FB' },
  '4D92FB,FF9900': { name: 'Journal Square - 33rd via Hoboken', short: 'JSQ-33 (via HOB)', color: '#FF9900' },
};

const PANYNJ_URL = 'https://www.panynj.gov/bin/portauthority/ridepath.json';

// Simple in-memory cache (15s)
let cache = { data: null, ts: 0 };
const CACHE_TTL = 15 * 1000;

async function fetchRealtime() {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) return cache.data;
  const url = `${PANYNJ_URL}?timeStamp=${now}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`PANYNJ fetch failed ${res.status}`);
  const json = await res.json();
  cache = { data: json, ts: now };
  return json;
}

// GET /api/stations - list NJ stations
app.get('/api/stations', (req, res) => {
  res.json(Object.values(NJ_STATIONS));
});

// GET /api/realtime?station=NWK - get filtered station data
app.get('/api/realtime', async (req, res) => {
  const stationCode = (req.query.station || '').toString().toUpperCase();
  if (!stationCode || !NJ_STATIONS[stationCode]) {
    return res.status(400).json({ error: 'Invalid or missing station. Use one of: ' + Object.keys(NJ_STATIONS).join(', ') });
  }
  try {
    const data = await fetchRealtime();
    const stationData = data.results.find(r => r.consideredStation === stationCode);
    if (!stationData) {
      return res.json({ station: NJ_STATIONS[stationCode], destinations: [], lastUpdated: new Date().toISOString(), raw: data });
    }
    // Enrich messages with line info and countdown
    const enriched = {
      station: NJ_STATIONS[stationCode],
      lastUpdated: stationData.destinations.flatMap(d => d.messages).map(m => m.lastUpdated)[0] || new Date().toISOString(),
      destinations: stationData.destinations.map(dest => ({
        label: dest.label, // ToNY / ToNJ
        labelDisplay: dest.label === 'ToNY' ? 'To New York' : dest.label === 'ToNJ' ? 'To New Jersey' : dest.label,
        messages: dest.messages.map(m => {
          const lineKey = m.lineColor.toUpperCase();
          const info = LINE_INFO[lineKey] || { name: m.headSign, short: m.headSign, color: `#${lineKey.split(',')[0]}` };
          return {
            ...m,
            line: info,
            secondsToArrivalNum: parseInt(m.secondsToArrival, 10),
            isApproaching: parseInt(m.secondsToArrival, 10) < 120,
          };
        }).sort((a,b) => a.secondsToArrivalNum - b.secondsToArrivalNum),
      })),
      // also provide all stations for debug
    };
    res.json(enriched);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Failed to fetch realtime data', details: e.message });
  }
});

// GET /api/realtime/all - get all stations (debug)
app.get('/api/realtime/all', async (req, res) => {
  try {
    const data = await fetchRealtime();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ NJ PATH schedule server running at http://localhost:${PORT}`);
  console.log(`   → NJ stations: ${Object.keys(NJ_STATIONS).join(', ')}`);
});
