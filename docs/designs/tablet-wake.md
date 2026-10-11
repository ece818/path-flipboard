# Design: Tablet wall board + stay-awake fullscreen
Date: 2026-10-11 | Branch: main | Mode: builder (having fun)
Repo: ece818/path-flipboard | SLUG: ece818-path-flipboard

## Problem
> User: "I want this to work on tablets and stay open when in full screen mode so it doesn't go to sleep"

The board's theater/fullscreen mode is the wall-display mode, but two gaps block tablet wall use:
1. No tablet breakpoint. ≤700px has mobile rules; everything above falls into desktop spacing. Tablets (701–1100px, portrait + landscape) get desktop gaps and strip widths, so `fitTileStrips()` shrinks digits/tiles harder than needed.
2. No stay-awake. `toggleTheater()` in `public/app.js:796` enters fullscreen but never requests a screen wake lock, so the OS sleeps the wall board per its timeout even in fullscreen.

## Goal
Tablet as ambient wall/desk board: readable at distance in theater mode (portrait + landscape), screen stays on while wall-mounted, normal browsing keeps OS sleep.

## Agreed answers
- D1 tablet use → **Ambient wall board** (not handheld-first).
- D2 stay-awake scope → **Always optional**: auto wake-lock in theater + persistent keep-awake toggle available in the normal board too.
- D3 premises → Agree all. Second opinion skipped by user. Approach → **B Ideal toggle** ("your recommendation").

## Premises (agreed)
1. Tablet is an ambient wall/desk board readable at distance in theater mode, portrait and landscape.
2. Screen stays awake via Wake Lock API in theater automatically, plus an optional toggle in the normal board, with silent fallback where unsupported (iOS Safari <16.4, insecure context, denied permission).
3. No backend or distribution change. Static frontend only: `public/app.js` + `public/style.css` (+ `?v=` bump in `public/index.html`).
4. Tablet gap is 701–1100px getting desktop spacing today; it needs its own breakpoint between mobile (≤700px) and desktop.

## Approaches considered
### APPROACH A: Minimal theater lock (Effort S, Risk Low)
Theater-only `navigator.wakeLock.request('screen')` on enter, release on exit, re-acquire on `visibilitychange`. Plus 701–1100px breakpoint. Reuses `toggleTheater` + `fitTileStrips`.
- Pros: smallest diff, least battery risk.
- Cons: misses the always-optional ask (no stay-awake outside fullscreen).

### APPROACH B: Ideal toggle — RECOMMENDED (Effort M, Risk Low)
A + persistent "Keep awake" toggle in `.board-actions` (visible normal + theater via overlay), `localStorage path:keepAwake` (`'1'/'0'`, try/catch guard), status-pill lock-dot indicator, unsupported fallback silent-hide (toggle+dot hidden, no wording).
- Pros: meets both answers exactly; persistence matches existing `path:*` key pattern.
- Cons: extra toggle UI + indicator work.
- Reuses: `path:*` localStorage pattern (`AGENTS.md`), status pill, `toggleTheater`/`fullscreenchange` wiring.

### APPROACH C: Kiosk ambient (Effort L, Risk Med) — partially ACCEPTED as E1
B + `?theater=1` autostart for mount-and-forget (ACCEPTED E1). Reduced row count + night dimming not asked for (E2 DEFERRED).
- Pros: true wall product.
- Cons: dim logic not asked for (E2 deferred); kiosk autostart ACCEPTED as E1.

## Recommended design (B + accepted E1/E3/E4)
### Wake-lock truth table (`public/app.js`)
`keepAwake` persisted `path:keepAwake` (`'1'/'0'`, try/catch, default off).
Hold the lock while `document.visibilityState === 'visible'` AND (`body.theater` OR `keepAwake`):

| theater | keepAwake | visible | lock |
|---|---|---|---|
| on | * | yes | HELD (auto, toggle independent) |
| off | on | yes | HELD |
| off | off | yes | released |
| * | * | hidden | released by OS; re-acquire on visible per row 1–2 |

`releaseWake()` owner: `toggleTheater()` exit path + keepAwake checkbox handler. No other caller releases.

### Wake lock (`public/app.js`)
- `let wakeLock = null; let wakeLockUnsupported = false;`
- `async function acquireWake()` guards `navigator.wakeLock?.request`: try request; on success attach `wakeLock.addEventListener('release', onWakeRelease)`; catch (denied/unsupported/insecure) → `wakeLockUnsupported = true`, update toggle+indicator once.
- `onWakeRelease()`: if `document.visibilityState === 'visible' && (document.body.classList.contains('theater') || keepAwake)` → `acquireWake()` (covers OS revocation, the common tablet case). Else update indicator to off.
- `function releaseWake()`: `await wakeLock?.release()` guarded, `wakeLock = null`, update indicator.
- Wire: theater enter (click + `?theater` boot + `fullscreenchange` on) → `acquireWake()`; theater exit → hold iff `keepAwake`, else `releaseWake()`; `visibilitychange` visible → re-evaluate truth table; checkbox → persist + acquire/release.
- Anti-flicker contract untouched: wake code never runs inside `loadStation({ background: true })`; pill writes happen ONLY on wake-state transitions (enter/exit/acquire-fail/release), never on the 15s refresh path.
- Fallback (E6 SKIPPED → silent-hide everywhere): where `navigator.wakeLock` is missing or `wakeLockUnsupported`, hide the KEEP AWAKE toggle (`hidden` attribute) and hide the pill lock dot. No tap note, no extra wording. Verification expects silence, not explanation.

### Theater-visible placement (E3 indicator + toggle)
Constraint: `body.theater .board-topbar{display:none}` (`style.css:229-235`) hides `.board-actions` (toggle) and `#statusPill` in exactly the mode that needs them.
Decision: keep chrome out of layout flow (no viewport-budget change per `AGENTS.md:40`):
- Exempt ONLY the toggle + pill from the theater hide: `body.theater .board-topbar{display:flex; position:absolute; top:8px; right:8px; ...}` as a floating overlay (absolute → zero layout-budget impact, `fitTileStrips()` math unchanged). All other topbar children stay hidden.
- Pill lock dot: `<span class="lockdot">` inside `#statusPill`, lit when lock held, hidden otherwise and always hidden where unsupported. Writes only on wake transitions (see above).
- Toggle stays operable in theater via the same overlay. Alternative (separate theater overlay duplicating controls) rejected: duplicates state, larger diff.

### Kiosk autostart E1 (`?theater=1`)
- Parse on boot alongside existing `?live=` handling: `new URLSearchParams(location.search).get('theater') === '1'` → after first `loadStation()` paint, call `toggleTheater()`; `requestFullscreen` failure (no gesture — the expected kiosk path) falls into the existing catch → CSS-only `body.theater` + `fitTileStrips()`. Wake is still acquired on the CSS-only fallback path (theater class present → truth table row 1). Coexists with `?live=` (independent params).
- No new row policy; standard theater rows.

### Idle chrome fade E4 (`public/style.css` + 15-line timer in `app.js`)
- `body.theater.idle .exit-theater, body.theater.idle .board-topbar { opacity:0; pointer-events:none; }` + `body.theater{cursor:none}` under `.idle`; transition 400ms.
- Timer: 4s after last `touchstart/mousemove/keydown` in theater → add `.idle`; any such event → remove + reset. Overlay is absolute so fade changes no layout.
- Exit button remains keyboard-focusable when visible; fade never traps (touch restores). Note: the pill lock-dot fades with the chrome by design at ambient idle; any touch restores proof instantly.

### Tablet breakpoint (`public/style.css`) — REVERTED 2026-10-11 after field report
Field finding (S24 Ultra rotated landscape = 832×384 CSS px): fixed sizes
22/34/22/14px across 701–1100px shrank digits ~35% vs the fluid desktop
clamps (38/45/28/18px at 832px) — the normal-mode breakpoint solved a
non-problem and regressed landscape phones. Removed the block entirely;
normal mode is fluid clamps at every width ≥701px again. Theater tablet
behavior was never affected (theater selectors outrank) and is unchanged.
- New UI works in dark (default) and `body.light`; row sub-line stays visible (carries line).

### Toggle UI (`public/index.html`)
- Add `<label class="auto"><input type="checkbox" id="keepAwake"> KEEP AWAKE</label>` next to AUTO 15s. Bump `?v=N` on both `<link>` and `<script>` per AGENTS.md.

### Verification
- `node --check public/app.js` (gate per `AGENTS.md`).
- `?v=` bump on BOTH `<link>` and `<script>` in `public/index.html`.
- Dark, `body.light`, mobile ≤700px + tablet 701–1100px portrait/landscape + desktop theater.
- Wake matrix: enter theater → HELD; ESC/exit with toggle off → released; toggle on outside theater → HELD; tab hide/show → re-acquired; OS `release` while wall-active → re-acquired; unsupported browser → toggle+dot hidden silently, zero errors.
- Stale/empty states unchanged; background refresh never touches pill (transition-only writes).

## NOT in scope
- E2 overnight dimming + E5 hero row (deferred to TODOS.md, see below).

## What I noticed (builder signals: 3)
- Agency: wall-mounting a live board and asking for stay-awake is building, not planning.
- Taste: fullscreen-already-exists means the ask is a tight gap-close, not a rewrite.
- Domain sense: "stay open in fullscreen" names the exact OS behavior (sleep vs fullscreen are independent).

## The Assignment
Mount the board on the tablet in theater mode for one full evening commute window (e.g. 5–7pm ET) with keep-awake on. Note: (1) readable distance in portrait + landscape, (2) any dim/sleep event with OS + browser version, (3) whether you ever wanted the toggle outside theater. Report those three; they decide whether kiosk autostart is worth a follow-up.

## Second opinion
Skipped at user request ("No proceed"). Landscape search skipped ("Skip private").

---
Status: ACTIVE (amended post-spec-review-1: E1/E3/E4 designed, silent-hide fallback, theater overlay placement) | Design doc for branch main.
Builder profile before this session: PROFILE_READ=failed SESSION_TIER=introduction PRIOR_SESSION_COUNT=0 LAST_PROJECT= CROSS_PROJECT=false
