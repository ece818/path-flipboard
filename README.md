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
   snapshot, then upgrades to true live data (via a CORS proxy) on every 15s
   refresh; countdowns keep ticking client-side between refreshes, and
   departed trains auto-hide. If live refresh fails and the snapshot is over
   10 min old, rows honestly show `STALE` instead of fake `00 BOARDING`.
   Note the scheduled refresh workflow gets throttled by GitHub to roughly
   every few hours rather than every 5 min — the live upgrade is what keeps
   the board fresh between deploys.

## Truly live data without third-party proxies (optional, 5 min, free)

Public CORS proxies are flaky, so for reliable auto-updates deploy your own
proxy (Cloudflare free tier, ~100k req/day):

1. https://dash.cloudflare.com → Workers & Pages → Create Worker → Deploy.
2. Edit code → paste in `worker.js` from this repo → Deploy.
3. Open the board once with the worker URL:
   `https://<you>.github.io/path-flipboard/?live=https://<worker>.<you>.workers.dev`
   It saves the URL and uses it on every refresh from then on — real live
   arrivals every 15s, no redeploys needed.

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


Pick a station from the dropdown (New Jersey + New York stations) → rows appear with:
- departure wall-clock in split-flap digits (left), destination in letter tiles (middle), live countdown in large flip digits (right)
- line chip tinted per line (NWK-WTC red, JSQ-33 orange, HOB-33 blue, HOB-WTC green); tap a destination to filter by it, tap a chip (or footer badge) to filter by line
- status under the countdown: `BOARDING` (≤30s), `APPROACHING` (<2 min), `STALE` when live is down and the snapshot is over 10 min old
- countdowns tick every second client-side from `lastUpdated + secondsToArrival`; departed trains auto-hide; auto-refresh every 15s (toggleable); times in `America/New_York`
- appearance: dark mode (default) with toggle in the ⚙ menu, 12/24-hour clock toggle

## Wall display (fullscreen theater)

Hit ⛶ (or open with `?theater=1` for mount-and-forget kiosk boot) for a fullscreen board that fills the viewport and scales rows to fit — built for a wall-mounted tablet:
- KEEP AWAKE toggle uses the screen Wake Lock API so the display never sleeps; entering fullscreen switches it on automatically, and it persists across visits. Where the API is missing (older browsers) the toggle hides itself silently.
- short viewports (rotated phones) show the next 3 trains so rows keep full height; tablets and wide screens get stepped-up digit sizes.
- if the GPU can't hold frame rate, the board trips a `lowfx` mode (instant digit swaps, no glow) automatically; `?diag=1` shows a field readout (beats, worst gap, fps, lock state).

## API (served by `server.js`)

- `GET /api/stations` → list NJ stations
- `GET /api/realtime?station=JSQ` → `{station, lastUpdated, destinations:[{label, labelDisplay, messages:[{target,headSign,lineColor,arrivalTimeMessage,secondsToArrival,line:{name,short,color}}]}]}`
- `GET /api/realtime/all` → raw PANYNJ JSON (debug)

Cache: 15s in-memory (`server.js:43`).

## Why a proxy?

`panynj.gov` does **not** send `Access-Control-Allow-Origin`, so direct `fetch()` from the browser is blocked by CORS. The Express server in `server.js:53` fetches the JSON server-side and adds CORS headers. If you deploy to GitHub Pages (static only) use a CORS proxy or deploy the Node server.

## Frontend

- `public/index.html` – station `<select>`, board frame, theater exit button, settings menu
- `public/app.js` – split-flap engine (`renderFlips`/`renderTiles`), wall-clock beat scheduler plus `requestAnimationFrame` countdown loop, 15s background auto-refresh, Wake Lock stay-awake, `?theater=1` / `?live=` / `?diag=1` params
- `public/style.css` – PATH-themed dark UI (+ light theme), mobile ≤700px rules, theater viewport-fill mode
- Verify frontend edits with `node --check public/app.js` (no test suite); bump `?v=` on both the `<link>` and `<script>` tags in `index.html` with every CSS/JS change

## Deploy

- Any Node host (Render, Fly, Codespaces): `PORT=3000 npm start`
- Static fallback: `public/` can be served alone; without a proxy the board paints the snapshot, shows `STALE` once it ages past 10 min, and lists typical weekday intervals in the fallback details until live data arrives.
