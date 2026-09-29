# AGENTS.md — path-flipboard

Static split-flap PATH board. No bundler, tests, linter, or typecheck.

## Layout

- `public/` — the app (vanilla JS): `index.html`, `app.js`, `style.css`, `data/realtime.json` (snapshot, refreshed at build).
- `server.js` — Express dev server + local CORS proxy for PANYNJ. Static serves `public/`.
- `worker.js` — Cloudflare Worker proxy (edge cache 15s) for reliable live data on static hosting.
- `scripts/fetch.mjs` — fetches PANYNJ → `public/data/realtime.json`; tolerates failure, keeps last good file.
- `.github/workflows/pages.yml` — on push to `main` + cron `3/5 * * * *`: runs fetch, publishes `public/` to Pages. GitHub throttles the schedule to roughly hours — live upgrade covers the gap.

## Commands

- `npm install && npm start` (aka `npm run dev`) → `http://localhost:3000` (`PORT` env respected).
- `node scripts/fetch.mjs` → refresh snapshot.
- Verify frontend edits: `node --check public/app.js`. No test suite — this check is the gate.
- API (local only): `GET /api/stations`, `GET /api/realtime?station=JSQ`, `GET /api/realtime/all`. Server cache 15s (`server.js`).

## Data flow (don't reorder)

Board paints snapshot first, then upgrades to live per refresh; countdowns tick client-side from `lastUpdated + secondsToArrivalNum` (`remainingSec()` in `app.js`).
Live chain in `loadLive()`: saved Worker URL (`?live=https://…` → `localStorage path:worker`) → relative `api/realtime?station=` (local dev) → `allorigins` CORS proxies → direct PANYNJ (CORS-blocked in browser, works server-side).

## Workflow (standing user instructions)

- Commit and push every change when done — don't leave work uncommitted.
- Every UI change must be verified in all three modes: dark (default), `body.light`, and mobile (≤700px).

## Gotchas

- **Cache-bust every CSS/JS change**: bump `?v=N` on BOTH the `<link>` and `<script>` tags in `public/index.html` (mobile caches aggressively).
- **Duplicated station/line maps**: `NJ_STATIONS` / `LINE_INFO` exist in both `server.js` and `public/app.js` — keep them in sync. `JSQ-33` badge intentionally also matches `JSQ-33 (via HOB)` via `lineMatches()`.
- **localStorage `path:*` keys**: `worker`, `njStation`, `autoRefresh`, `lineFilter`, `destFilter`, `clockFormat` (default `'12'`, validate `12|24`), `darkMode` (default dark, `'1'/'0'`). Guard reads with try/catch (private mode).
- **Anti-flicker contract** (regressed before, don't simplify):
  - Auto-refresh must call `loadStation(code, { background: true })` — background path touches NO status pill, meta line, alert box, or snapshot repaint.
  - Snapshot renders only on first paint / station change; background live failure = silent retry.
  - `buildBoard()` reconciles by departure-minute keys (`visibleKey`) and skips DOM rebuild when trains match; pass `{ force: true }` on filter, station, or clock-format changes.
- **Times are ET**: display with `timeZone: 'America/New_York'`; departures = `new Date(lastUpdated) + secondsToArrivalNum`, formatted per `clockFormat`. Stale threshold: snapshot >10 min + live down → `STALE`.
- **Themes + mobile**: new UI must work in dark (default) and `body.light` (CSS-var overrides) and at ≤700px. Keep the row sub-line visible on mobile (it carries the line since the flanks are times). Row layout: left = departure wall-clock, middle = destination tiles + route tiles (`LINE → DIR`) in one strip, right = countdown — all tiles/flips via shared `renderTiles()`/`renderFlips()` at uniform size. Spaces render as blank flaps (no transparent `.tile.space`); destinations/routes are `padEnd()`-ed to the longest visible row so strips align. Route tiles are tinted `--c` (line color, tappable line filter); destination tap filters by destination. Mobile stacks the middle strip (destination over route).
- Don't commit stray assets (e.g. screenshots) or `node_modules/`; snapshot JSON is a build artifact with a fallback copy in repo.
