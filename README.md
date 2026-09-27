# NJ PATH – Upcoming Trains (Select NJ Station)

Split-flap departure board showing **real-time** upcoming PATH trains for any New Jersey station.

NJ stations supported:
- `NWK` Newark
- `HAR` Harrison
- `JSQ` Journal Square (default)
- `GRV` Grove Street — Jersey City
- `EXP` Exchange Place — Jersey City
- `NEW` Newport — Jersey City
- `HOB` Hoboken

Data source: **Port Authority** live endpoint that powers panynj.gov/path:
`https://www.panynj.gov/bin/portauthority/ridepath.json?timeStamp=...`

## Host on GitHub Pages (free, public link)

GitHub Pages serves static files only, so the board reads a snapshot at
`public/data/realtime.json`, refreshed automatically:

1. Push this repo to GitHub (default branch `main`).
2. Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push (or wait ~5 min for the schedule). The `deploy-pages` workflow
   (`.github/workflows/pages.yml`) fetches fresh PANYNJ data, then publishes
   `public/` to `https://<you>.github.io/<repo>/`.
4. Done — share the link. In the browser the board paints instantly from the
   snapshot, then upgrades to true live data via CORS proxies on every 15s
   refresh; countdowns keep ticking client-side between refreshes, and
   departed trains auto-hide. If live refresh fails and the snapshot is over
   10 min old, rows honestly show `STALE` instead of fake `00 BOARDING`.

Notes:
- Scheduled workflows pause after 60 days of repo inactivity; any new push or
  manual **Run workflow** re-arms them.
- No secrets needed. The snapshot is committed nowhere — it is fetched fresh
  at each build (a fallback copy lives in `public/data/realtime.json`).

## Quick start (local, true live data)

```bash
npm install
npm start
# open http://localhost:3000
```

Locally the page prefers the static snapshot if present, otherwise it uses the
built-in proxy (`server.js`), which fetches PANYNJ server-side to avoid CORS
and adds 15s caching.


Pick a station from the dropdown → cards for **To New York** and **To New Jersey** appear with:
- headsign / line color (NWK-WTC red, JSQ-33 orange, HOB-33 blue, HOB-WTC green, JSQ-33 via HOB orange/blue)
- countdown (`4m 12s`, `Due`) ticking every second
- `arrivalTimeMessage` from PANYNJ + `secondsToArrival`
- auto-refresh every 15s (toggleable), last updated in `America/New_York`

## API (served by `server.js`)

- `GET /api/stations` → list NJ stations
- `GET /api/realtime?station=JSQ` → `{station, lastUpdated, destinations:[{label, labelDisplay, messages:[{target,headSign,lineColor,arrivalTimeMessage,secondsToArrival,line:{name,short,color}}]}]}`
- `GET /api/realtime/all` → raw PANYNJ JSON (debug)

Cache: 15s in-memory (`server.js:43`).

## Why a proxy?

`panynj.gov` does **not** send `Access-Control-Allow-Origin`, so direct `fetch()` from the browser is blocked by CORS. The Express server in `server.js:53` fetches the JSON server-side and adds CORS headers. If you deploy to GitHub Pages (static only) use a CORS proxy or deploy the Node server.

## Frontend

- `public/index.html:16` – station `<select>`
- `public/app.js:36` – `render()` + `formatCountdown()` + 1s ticker
- `public/style.css` – PATH-themed dark UI

## Deploy

- Any Node host (Render, Fly, Codespaces): `PORT=3000 npm start`
- Static fallback: `public/` can be served alone, but realtime will show offline message and fallback timetable until you point it at a proxy.
