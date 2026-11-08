# BetterRoutes

**Football Offensive Intelligence & Decision Analysis**
Analyze the game. Challenge the call.

React + TypeScript + Vite application with verified local game data, repeatable ingestion, an interactive Game Review, a statistical recommendation engine and a seeded immutable drive simulator. Coordinator and What-If screens are explicitly labeled placeholders for the next stage. This is a Data-Assisted Coordinator project, not a trained ML model.

## Commands

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run build
npm run validate:data
npm run ingest             # downloads both official sources, refreshes raw cache and JSON
npm run ingest -- --offline # rebuilds JSON using committed raw HTML; no network needed
```

The browser uses `src/data/index.ts`, which runtime-validates the local JSON with Zod. No credentials or remote requests are needed to launch the app. The ingestion parser and Cheerio are development-only and are not imported by React. Shared schemas/types are in `src/types/`; source parsing is in `scripts/parser.ts`, independent from rendering. `src/data/integrity.ts` compares play-derived totals against both official team tables.

## Game Review workspace

Hash routes require no server routing configuration. Open `#/review?drive=drive-13&play=drive-13-row-07` to restore the real fourth-and-one selection. Drive rows, play rows and Key Decisions select the replay; left/right arrows step through the selected drive. Analyze This Play carries the source play ID into the Coordinator placeholder.

The SVG field animates official start-to-end ball progression, not reconstructed player tracking. Play/pause, replay, reset and 0.5×/1×/2× controls are local. The field and situation strip form a self-contained responsive block. All 11 schematic playbook templates are reusable data in `src/components/plays/templates.ts`; any displayed template is stamped as an illustration. Historical panels link to the official source. IBM Plex fonts are self-hosted through Fontsource.

## Source coverage and conventions

- [NC State official box score](https://gopack.com/sports/football/stats/2026/duke/boxscore/24545)
- [Duke official box score](https://goduke.com/sports/football/stats/2026/nc-state/boxscore/24830)
- Raw HTML: `scripts/raw/gopack.html`, `scripts/raw/goduke.html`.
- Normalized dataset: `src/data/game.json`. November 7, 2026, Carter-Finley Stadium, attendance 56,919.
- All 11 NC State possessions, 85 original panel rows, 56 counted offensive plays. All 70 Duke scrimmage plays are available as separately labeled opponent evidence; nine quarter-spanning plays come from embedded Nuxt records because their rendered panels omit continuations. Duke totals cross-check exactly: 461 yards = 223 pass + 238 rush. Includes both official teams' statistics, NC State passing/rushing/receiving player tables and the complete scoring summary.
- IDs follow the full-game drive chart order, so NC State drive IDs are not consecutive. Every detailed row retains a URL plus a CSS selector into the cached source; original description and down/distance text are preserved separately.
- Field positions use offense-own-goal = 0, opponent-goal = 100. `NCS25` becomes 25 and `DUK34` becomes 66 for NC State.
- Sacks are rushing attempts/yards in NCAA totals. All 56 offensive plays sum exactly to 217 yards (185 passing + 32 rushing). Two nullified rows are retained but excluded from offensive totals. Accepted penalties are separate from play yardage.
- Official drive-chart play counts include field-goal attempts but exclude punts and nullified rows. Thus the opening drive has 9 official plays but 8 offensive scrimmage plays; the last first-half drive has 5 official plays but 4 offensive scrimmage plays. Drive net yardage includes penalties: drive-06 has 40 offensive yards minus 5 penalty yards; drive-10 has 27 + 15; drive-17 has 4 + 15. No totals are fudged.
- First downs include two awarded by penalty. Third-down conversions are calculated from counted offensive yardage versus distance (3/14).
- The failed fourth-and-one is `drive-13-row-07`: Q3 06:13, NCS40, Gause rush for zero, turnover on downs. The official drive ends at 06:09.
- The blocked field goal is `drive-10-row-10`: Q2 00:01. The PBP says NO GOOD followed by a 100-yard touchdown return; the scoring summary explicitly identifies a blocked field goal. Duke's subsequent PAT is retained separately.
- Every panel row is retained, including drive headers, timeouts, kickoff, PAT and period marker. Administrative rows inherit the preceding clock when no clock is supplied. The first-half source says “End of game”; this is preserved verbatim in quarter 2, not interpreted as the end of the actual game.
- Score-before is recovered from the official scoring timeline. Participants are names extracted verbatim from descriptions, not inferred tracking or route data. Display player names from official player tables retain that table's capitalization.

## Statistical engine

Pure TypeScript public exports live in `src/engine/index.ts`:

```ts
const evidence = buildEvidence(game);
const recommendation = recommend(situation, 'balanced', evidence);
const initial = createSimulation(situation, 'balanced', 42);
const next = simulatePlay(initial, recommendation.selected.concept, evidence);
const completed = continueDrive(next, evidence);
```

`GameSituation.distance` means yards to go. `yardline` is offense-relative. Recommendation returns `selected`, `ranked`, `alternatives`, metric provenance, explanations, model details and `MODEL_VERSION`. Simulation state and evidence are deeply frozen copies; historical game records are not mutated. Reset/replay by recreating the initial state with the same seed and settings.

### Evidence and priors

Stage one ranks broad RUN, PASS, PUNT and FIELD_GOAL actions; stage two chooses a named playbook concept by situation and strategy. Named routes have no measured concept-specific advantage. RUN includes NCAA rushing sacks only in official totals; for tactical recommendations sacks are assigned to PASS. Kneels remain observed RUN outcomes. Only counted, non-nullified scrimmage plays enter evidence.

Samples are bucketed into downs 1–2 versus 3–4 and distances ≤3, 4–6, 7+. NC State observations have weight 1; Duke offense is secondary opponent evidence with weight 0.35. Beta-binomial posterior success is `(weighted successes + 12 × prior)/(weighted n + 12)`. Success uses 50% of distance on first down, 70% on second, 100% on third/fourth; conversion is tracked separately. Observed success/conversion use each historical play's original distance inside its bucket. Prior rates are computed for the requested distance. Simulator yardage samples use the same weighted observed/prior mixture; realized conversion at the exact current distance may differ from the bucketed historical rate.

Every heuristic constant is tagged `source: 'assumption'` in `src/engine/priors.ts`. Generic priors cover turnovers, sacks, incompletions, losses and short/medium/explosive gains. They are not measured season rates. Shrinkage is an exploratory statistical baseline, not causal inference or trained ML. Missing evidence uses priors only. Display probabilities are rounded to 5%, yards to integers; internal calculation retains precision.

Utility combines success, expected yards, variance/turnover/sack risk, explosive rate and score/quarter/field-position terms. Strategy changes real weights and fourth-down willingness. Fourth-down comparisons add an assumed field-value/expected-points-ish heuristic, not a validated EP model. Punts and FG are legal only on fourth down. FG distance is yards to goal + 17, maximum 60; a generic declining distance curve estimates make probability. Punt net is assumed 38 yards capped at the opponent 20; punts inside opponent 35 are only available in conservative mode. Kick success/conversion displays are `n/a`; render `primaryMetric` instead: assumed net punt yards or assumed field-goal make chance. Internal probabilities remain available for simulation and ranking.

### Simulation assumptions

Mulberry32 provides one deterministic draw per play with PRNG state saved in `SimulationState`. RUN/PASS sample the shrunk outcome mixture, not guaranteed favorable scripts. Concepts within the same category share outcome evidence. Turnovers end possession; no opponent drive is simulated. Touchdowns add 7 including an assumed made PAT; safeties add 2 to the defense. First downs reset to ten or goal-to-go, with goal-to-go preserved through losses. Coordinates clamp to 0–100 and terminal states retain legal down/distance (at least one yard even at the goal-line sentinel).

Run/sack/turnover runoff is 30 seconds, completed pass 24, incomplete pass 8 and kicks 8. No timeouts, penalties, kickoffs or defensive possessions are simulated; blocked FG returns are historical-only. Drives cross Q1→Q2 and Q3→Q4 but stop at halftime/fulltime, possession change or a configurable play cap (default 30 total plays). Score on the final play takes precedence over the clock ending. Seed, starting situation, strategy, evidence and selected calls must all match for replay.

## Tooling

Vitest is upgraded to stable major 5. Vite prints harmless third-party Zod comment-annotation warnings during the production build.
