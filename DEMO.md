# BetterRoutes recording flow

Run `npm run dev`, then open the local Vite address in Chrome. No credentials, network data requests or presentation-only mode are required.

1. In **Game Review**, show the official final linescore: Duke 41, NC State 3.
2. In **Key Decisions**, choose **The yard that never came**: `drive-13-row-07`, Q3 06:13, fourth-and-one at NCS40, trailing 31–3. The actual Gause rush gained zero and ended the drive on downs.
3. Click **Analyze This Play**. The Coordinator loads that official situation. Keep **Balanced**. Inside Zone is the top category-based recommendation; the priors are heuristic, not trained ML.
4. Click **View Quick Slant** to inspect the pass alternative. Click **Play**, pause mid-route to show schematic player movement and the intended-receiver arc. This is an illustration, not inferred tracking data. Select **View Inside Zone** again for the documented drive below.
5. Click **Simulate This Play**. The documented seed is **42**, preserved in the URL. Click **Run Hypothetical Play**: Inside Zone gains 5 yards and converts. Click **Continue Drive** for the next modeled call, or **Sim to End** to finish.
6. Show the clearly separated official and hypothetical bands, both position tracks and the comparison table. Seed 42 finishes in a punt after six modeled plays; it does not manufacture a touchdown. NC State remains at 3 points. The actual fourth-down play failed and ended on downs.
7. **Replay sequence** re-animates exactly those samples without drawing new outcomes. **Reset simulation** clears the samples but keeps the seed; repeating the controls reproduces the result. Seed **1** instead converts the first play for 12 yards, then turns the ball over on the next play. Both outcomes use the unchanged model.

Direct entry: `#/coordinator?play=drive-13-row-07&strategy=balanced&seed=42`. All situation fields, strategy, candidate, seed and simulation progression are encoded in the hash URL; reload restores the experiment. The canonical What-If path is `#/whatif`, with the earlier `#/what-if` spelling accepted as an alias.

If the starting situation is edited, the app labels it **Custom situation** and warns that the historical reference no longer has the same starting context. Use **Reset to official situation** before recording a like-for-like starting point.

One sampled outcome is not a prediction of what would have happened. Named concepts share category distributions. Success/conversion metrics are rounded; kick conversion is n/a, with assumed punt net or FG make chance shown instead. Touchdowns include an assumed PAT. No model parameters were changed for this demo.
