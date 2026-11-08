# BetterRoutes — final implementation report

## Completed functionality

- Local Vite/React/TypeScript application, plain CSS, self-hosted IBM Plex fonts and a dense film-room/printed-box-score design. Three working, hash-routed screens; no credentials or backend required.
- Game Review: official linescore/team comparison, all NC State possessions, complete original play descriptions, selection and keyboard navigation, authoritative ball progression, Key Decisions and source-linked provenance.
- Offensive Coordinator: editable down/distance/field position/quarter/clock/scores/strategy, immediate recommendations, selectable alternatives, model explanations/details, official reset and custom-situation warnings. Schematic snap, handoff, fake, throw, catch/run and kick animations use shared geometry, not reconstructed player tracking.
- What-If: immutable seeded plays/drives, step/finish/replay/reset/new-seed controls, reload restoration, official rest-of-drive, readable position tracks with focusable tick details and legends, and consistently formatted comparisons. Actual and model numbers have distinct provenance tags.
- Deterministic, chunked 500-drive summaries for the selected first concept and actual call's category under the same model/start/strategy/seeds. Whole-percent ending rates, average NC State points and explicitly model-vs-model labeling. No historical result is presented as a population rate. Four paired trials run per chunk; input changes cancel stale work.
- Reproducible demo documented with seed 42 and alternate seeds 1 and 2026; portrait-crop guidance in `DEMO.md`.

## Sources successfully imported and historical coverage

- NC State: https://gopack.com/sports/football/stats/2026/duke/boxscore/24545
- Duke independent cross-check: https://goduke.com/sports/football/stats/2026/nc-state/boxscore/24830
- Factual postgame context: https://gopack.com/news/2026/11/7/football-wolfpack-offense-stalls-in-41-3-loss-to-duke

Both box-score HTML documents are committed in `scripts/raw/`; normalized, runtime-validated data is in `src/data/game.json`. Coverage includes all 11 NC State possessions, 85 source rows, 56 offensive plays, 70 Duke scrimmage plays, both official team-stat tables, NC State passing/rushing/receiving player tables, scoring summary and drive chart. Nine quarter-continuation Duke plays were recovered from the official embedded Nuxt records. Every detailed row retains source provenance. Duke wins 41–3; NC State has 217 offensive yards (185 passing + 32 rushing). Sack, penalty and drive-chart counting conventions are documented without fudging totals. This is a one-game archive, not a season dataset.

## Recommendation method; ML: **No**

`betterroutes-statistical-v1` scores broad RUN/PASS/PUNT/FIELD_GOAL actions, then selects a named concept by situation/playbook rules. NC State observations are bucketed by down group and short/medium/long distance; Duke evidence is downweighted by 0.35. Beta-binomial shrinkage uses `(successes + k × prior)/(n + k)`, with prior strength 12 and success thresholds of 50/70/100% of distance on first/second/third-or-fourth down. Conversion is separate. Strategy-specific success/yardage/risk/explosive utility and heuristic fourth-down field value affect ranking. Percentages are rounded to five-point estimates, and metrics identify observed/calculated/assumed provenance. Kick conversion is n/a; punt net and FG make chance are explicitly assumed.

No trained ML model: no CFBD API key was available, and one game would be insufficient for credible training. Priors, strategy weights and concept selection are transparent heuristic rules, not learned causal coaching policies. Concepts within one category share outcomes; identical RUN-versus-RUN batch rates are expected.

## Simulation assumptions and simplifications

Seeded Mulberry32 samples observed-plus-prior category distributions. First downs, goal-to-go, TD, safety, downs, punt, made/missed FG, clock expiry and play caps terminate/update state without mutating history. A TD assumes a successful PAT (+7). Run/sack/turnover runoff is 30 seconds, completed pass 24, incomplete pass and kicks 8. Maximum 30 modeled plays per drive. Simple FG distance/make and punt-net heuristics are not kicker-specific calibration. No defensive possessions, full-game prediction, timeouts, penalties, blocked-kick returns, injuries, tracking, weather or personnel matchups are modeled.

## Verification and results

Release command:

```sh
npm ci && npm run validate:data && npm test && npm run build
```

- Vitest: **6 test files, 58 tests passed**, covering source totals/chronology/provenance, recommendation legality/ranking/precision, seeded simulation rules/immutability and 3,000 random starts, UI controls/URL restoration, all 11 templates' ownership/flight/catch phases, batch reproducibility, cancellation/empty/error cases and paired summary UI invalidation.
- TypeScript and production build pass (`npm run build` runs `tsc -b && vite build`). Data integrity compares play totals with both official sources.
- Playwright verification: all three screens checked at **1280×800, 1440×900 and 1920×1080**; no document overflow or console errors. Quick Slant ball was within 0.04 SVG units of its rendered arc mid-flight. During each paired 500-run batch the browser rendered 80+ frames; no observed long task, comfortably avoiding a 300ms blocking operation. Total batch wall time is not promised to be below 300ms.
- Screenshots captured and inspected in `/home/ubuntu/shots/4/`, with viewport and full-page captures for `review`, `coordinator` (pass mid-flight) and `whatif` (finished seed-42 drive plus the 500-run summary), suffixed by width.
- `git diff --check` clean. Original `test.txt` is untouched.

## Known issues / honest limitations

One game's sparse data cannot establish causal alternatives, calibrated probabilities or season-wide effectiveness. Schematic animations are illustrations, never official route/tracking evidence. Only the local imported game is available. Desktop-first layouts use internal scrolling for dense play logs. A page reload restores scenario/sample progression, but not a transient animation frame or a completed batch table; rerunning the same batch reproduces it. Rounded category percentages may not sum to 100%; Other retains safety/clock-expiry/play-cap outcomes. Production builds retain non-blocking third-party Zod annotation and >500 kB bundle advisories. No deployment, authentication, trained ML, external API integration or opponent-possession simulator was implemented or claimed.

## Exact launch command

```sh
npm ci && npm run dev
```

Open the printed local Vite URL, normally `http://localhost:5173`. Start with Game Review and follow `DEMO.md`.
