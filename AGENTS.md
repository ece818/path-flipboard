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

## Subagent orchestration (always graph it out)

- Default to a subagent graph for any non-trivial task: decompose into a DAG, fan-out independent branches, fan-in merge in the parent. Direct `read`/`grep`/`glob` only for 1–3 known files or a single pattern lookup.
- `explore` for read-only search ("how does X work", multi-hop finds); `general` only when the branch must write files or run commands.
- Parallel dispatch = multiple `subagent` calls in ONE message, max 3–5 branches. Separate messages run serially. If B needs A's output, chain sequentially — never force parallel on dependent tasks.
- Reads fan out, writes serialize: parallel branches are read-only with disjoint scopes. One writer per file set per wave; parent does all merges (this repo: never parallel-write `server.js` + `public/app.js` `NJ_STATIONS`/`LINE_INFO`, or `public/index.html` `?v=` bumps).
- Stateless handoff: every prompt carries goal + exact file scope + read-only vs write + return format (`file:line` evidence, short summary, no dumps). Repeat load-bearing constraints verbatim — do not assume `AGENTS.md` inheritance. Subagents never spawn sub-subagents; coordination goes through the parent.
- Explicit fan-in: dedupe, resolve conflicts, check coverage gaps, state partial-failure call (retry / proceed-partial / block). No blind concatenation.

## Graph mentality (research synthesis, arxiv:2506.18019v1 + GraphRAG + LangGraph)

- **Workflow AS graph:** `StateGraph(State) + nodes (LLM/tool fn) + edges (deterministic/conditional) + checkpointer`. This is the orchestration model above — cycles, retries, interrupt/resume, audit trails. Prefer over prompt-spaghetti for multi-step work.
- **Task decomposition AS DAG:** subtasks = nodes, dependencies = edges (Task Dependency Graph, must stay acyclic). Plan paths/subgraphs with LLM, RL, or GNN — never execute with dead loops.
- **Reasoning AS graph:** CoT (linear) → Tree-of-Thoughts (branch + evaluate) → Graph-of-Thoughts (merge/split thoughts). Use for planning search with pruning.
- **Memory/knowledge AS graph:** episodic (events) + semantic (entities) + procedural (workflows) as triples. Read = entity-link + 2–4 hop traverse; Write = timestamped nodes/edges. Prefer over raw vector chunks for multi-hop reasoning.
- **GraphRAG pipeline:** query processor (NER → nodes/edges) → retriever (BFS/DFS + community summaries) → organizer (prune/rerank) → generator (LLM). Use for global/complex queries; vector RAG for single-hop similarity only.

## Gotchas

- **Cache-bust every CSS/JS change**: bump `?v=N` on BOTH the `<link>` and `<script>` tags in `public/index.html` (mobile caches aggressively).
- **Duplicated station/line maps**: `NJ_STATIONS` / `LINE_INFO` exist in both `server.js` and `public/app.js` — keep them in sync. `JSQ-33` badge intentionally also matches `JSQ-33 (via HOB)` via `lineMatches()`.
- **localStorage `path:*` keys**: `worker`, `njStation`, `autoRefresh`, `lineFilter`, `destFilter`, `clockFormat` (default `'12'`, validate `12|24`), `darkMode` (default dark, `'1'/'0'`). Guard reads with try/catch (private mode).
- **Anti-flicker contract** (regressed before, don't simplify):
  - Auto-refresh must call `loadStation(code, { background: true })` — background path touches NO status pill, meta line, alert box, or snapshot repaint.
  - Snapshot renders only on first paint / station change; background live failure = silent retry.
  - `buildBoard()` never wipes the board: it matches live rows to the new train list by `visibleKey` (dir + destination + departure minute, order-insensitive — the line is deliberately excluded so a line change flaps in place), recycles unmatched rows as shells, then repaints each row through the flip engines (`renderFlips` / `renderTiles` / `renderStatus`) so only characters that changed move. Filter, station and clock-format changes just call `buildBoard(lastData)` — no options.
- **Times are ET**: display with `timeZone: 'America/New_York'`; departures = `new Date(lastUpdated) + secondsToArrivalNum`, formatted per `clockFormat`. Stale threshold: snapshot >10 min + live down → `STALE`.
- **Themes + mobile**: new UI must work in dark (default) and `body.light` (CSS-var overrides) and at ≤700px. Keep the row sub-line visible on mobile (it carries the line since the flanks are times). Row layout: left = departure wall-clock, middle = destination tiles + route tiles (`LINE → DIR`) in one strip, right = countdown — all tiles/flips via shared `renderTiles()`/`renderFlips()` at uniform size. Word spaces render as blank flaps (authentic split-flap); every destination strip pads to the longest visible row, so a new train swaps letters into fixed slots. Route tiles are tinted `--c` (line color, tappable line filter); destination tap filters by destination. Mobile stacks the middle strip (destination over route). Theater/fullscreen fills the viewport (`100dvh` column, `grid-auto-rows:1fr`) with flip/tile sizes in `vmin` clamps so wall displays scale up — keep theater overrides above mobile specificity (`body.theater …` beats it). Theater flank digits fill row height via container units (rows are `container-type:size`, flips `52cqh` / colons `43cqh` with px/vmin/vw bounds); theater tiles use the same row unit at `36cqh` so digit/tile strip heights stay ~equal at any row count — the two share one width budget, so growing one means shrinking the other; older browsers fall back to the preceding `vmin` clamp declaration. Theater strips touch the countdown via `justify-content:space-between` on `body.theater .col-dest` (route packs right, `flex:0 0 auto` on `.dest`/`.route`); when the strip is wider than the middle (tablet/phone), `fitTileStrips()` in `app.js` measures and sets `--tile-fit`/`--flip-fit`/`--colon-fit` together — one scale for the whole row so digits shrink with tiles (flanks narrow, digit/tile heights stay proportional). Called from `buildBoard()`, both theater toggles, and a debounced `resize` (rotation). Rotated phones (`max-width:700px` + `orientation:landscape`) get horizontal strips in theater; portrait phones keep the stacked layout.
- Don't commit stray assets (e.g. screenshots) or `node_modules/`; snapshot JSON is a build artifact with a fallback copy in repo.
