# Continuing MarketEye

This repository is the durable project record. No Codex conversation is needed to run or extend it.

## Start here

1. Read the README, then `docs/MARKEYE_BRIEF.md` for the complete product vision.
2. Use Node 24.14+ (24.x), run `npm ci`, then `npm start`, or double-click `Start-MarketEye.cmd` on Windows.
3. The default desk is the market terminal. Try NVDA and “why is gas up.” F2 Globe opens the original company intelligence workspace; use the historical Taiwan replay to exercise exposure investigation.
4. Run `npm run test:marketeye`, `npm test`, `npm run build` and, with the server running, both `npm run qa:marketeye` and `npm run qa:terminal`.

## Architectural boundaries

- `src/marketeye.js` owns selected company, snapshot and interaction state. Company changes invalidate pending source refreshes and cancel tours.
- `src/ui/marketTerminal.js` owns the price/news terminal and browser-persisted watchlist. `src/markets/normalize.js` must never treat a multi-month chart baseline as the previous session close. Quote and chart requests have independent ranges.
- `server/marketProxy.js` provides fixed-host Yahoo chart and Google RSS adapters, bounded caching, request coalescing and explicit stale/unavailable states. They are indicative public feeds, not exchange-grade subscriptions.
- `src/markets/drivers.js` classifies headlines into possible transmission channels. Preserve the distinction between observed quote direction, headline evidence and unverified causation. Region matches are approximate, not geocoded accident sites.
- Keep scores in `src/exposure/engine.js`. Preserve deterministic arithmetic, source confidence and freshness. Never replace the engine with model-generated risk numbers.
- Curated company facts belong in `data/companies/*.json`, with public provenance and explicit distinction between direct relationships, supplier-campus context and unrelated nearby infrastructure.
- `src/analyst/tools.js` is the bounded command surface. The optional AI endpoint routes requests to these tools and never executes arbitrary code or writes company facts.
- `src/globe/marketGlobe.js` reuses upstream `MapStackController`, render governor and attribution. `contextLayers.js` reuses `DataLayerManager` and lazy-loaded upstream modules.
- Legacy simulator code is retained for reuse. Legacy markup tests read the archived shell fixture; MarketEye browser QA is separate and exercises the real entrypoint.

## Next valuable work

1. Revalidate and expand company data using current annual reports and official supplier disclosures. Add original document dates, review expiry, and independent relationship confidence versus coordinate confidence.
2. Add reliable official hazard alerts and operating-status evidence. Keep weather model estimates separate from official warnings. Add facility polygons and defensible hazard footprints before interpreting damage.
3. Introduce production server adapters with authentication, bounded caches, rate limits and secrets; do not expose Vite's development configuration publicly.
4. Expand AI from one-call tool routing to a bounded multi-step investigation agent with validated tool results, cancellation, cost limits and evidence citations.
5. Expand the implemented headline triage with official incident feeds and operator notices. Do not infer a company's shipment from a vessel or flight near its supplier.
6. Expand comparison coverage across a union of company weather locations before interpreting relative rankings.
7. Extend the existing browser-persisted watchlists with optional synced user storage once a production identity model is chosen.

## Current checks and constraints

- Keyless live USGS and Open-Meteo requests worked in browser validation on 2026-09-11.
- Real Yahoo quotes/charts and Google News RSS worked on 2026-09-11. Both market and globe browser suites passed, including mobile and simulated provider outages. Ordinary unit suite: 2,842 passed, 5 skipped, plus two Node-24-only allocation checks excluded locally.
- Historical replay uses the USGS `us7000m9g4` record and a one-hour-after-event analysis clock, applied to today's curated footprint.
- Live optional paid AI/Google/AIS/FIRMS paths require user credentials; do not imply they were validated with paid provider calls.
- Local Node 22 ran the ordinary suite successfully, but use Node 24 for the upstream allocation calibration gate.
- Optional WebMCP APIs are feature-detected; full runtime validation requires a supporting browser.
- The large geoid asset is inherited and lazy-loaded for optional spatial layers. A bundle-size warning is expected; avoid importing it eagerly.
- Keep `origin` pointing at `armanbabazadeh6/MarketEye` and `upstream` pointing at `bilawalsidhu/gods-eye-view`. Pass `-R armanbabazadeh6/MarketEye` to GitHub CLI commands because GitHub may otherwise prefer the upstream repository.

Commit and push each coherent working stage. Never commit credentials, logs, build outputs or generated temporary browser profiles.
