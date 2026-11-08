// Generic football heuristics, not measured NC State/season statistics. Values are sensitivity assumptions.
const assumed = <T>(value: T, rationale: string) => ({ value, source: 'assumption' as const, rationale });
export const PRIORS = {
  strength: assumed(12, 'Twelve pseudo-plays stabilize sparse situation buckets.'),
  opponentWeight: assumed(0.35, 'Duke offensive samples are downweighted, not treated as NC State ability.'),
  run: assumed([
    {yards:0,kind:'turnover',probability:0.02}, {yards:-2,kind:'gain',probability:0.15},
    {yards:0,kind:'gain',probability:0.12}, {yards:2,kind:'gain',probability:0.26},
    {yards:5,kind:'gain',probability:0.28}, {yards:12,kind:'gain',probability:0.14}, {yards:25,kind:'gain',probability:0.03},
  ] as const, 'Generic run mixture: fumble, loss, no gain, short, medium and explosive gains.'),
  pass: assumed([
    {yards:0,kind:'turnover',probability:0.03}, {yards:-7,kind:'sack',probability:0.08},
    {yards:0,kind:'incomplete',probability:0.34}, {yards:3,kind:'gain',probability:0.12},
    {yards:8,kind:'gain',probability:0.21}, {yards:16,kind:'gain',probability:0.16}, {yards:32,kind:'gain',probability:0.06},
  ] as const, 'Generic pass mixture: interception, sack, incompletion and completed-pass gains.'),
  fieldGoal: assumed({base:0.97, declinePerYard:0.018, declineStarts:20, min:0.15, max:0.97, maxDistance:60, snapOffset:17}, 'Linear distance-based make curve; no kicker calibration or block-return modeling.'),
  punt: assumed({net:38, touchbackSpot:20, noPuntBeyond:65}, 'Expected net 38 yards, capped to opponent 20 near the end zone; normally no punts inside opponent 35.'),
  points: assumed({touchdown:7, safety:2, fieldGoal:3, fieldValueBase:1, fieldValueScale:25}, 'Simplified expected-points-ish field value; touchdown includes assumed successful PAT.'),
  risk: assumed({varianceScale:150, turnoverWeight:3, sackWeight:0.8, medium:0.2, high:0.48}, 'Dimensionless risk from yardage variance plus turnover and sack rates.'),
  weights: assumed({
    balanced:{success:2,yards:0.055,risk:0.9,explosive:0.15,go:0,kick:0},
    aggressive:{success:1.8,yards:0.09,risk:0.4,explosive:0.7,go:0.75,kick:-0.2},
    conservative:{success:2.2,yards:0.025,risk:1.8,explosive:0,go:-0.6,kick:1},
  }, 'Strategy preferences are utility weights, not learned coaching policies.'),
  situation: assumed({lateTrailingBoost:1.3, trailingBoost:0.3, leadProtection:0.4, redZoneBoost:0.25}, 'Score, quarter and field position adjust utility; not causal estimates.'),
  runoff: assumed({run:30,complete:24,incomplete:8,kick:8}, 'Fixed seconds per play, no timeouts, possession or defensive clock modeling.'),
  playCap: assumed(30, 'A drive stops after 30 simulated plays to bound continuation.'),
};
