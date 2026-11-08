import type { GameSituation } from '../types';
import { formatClock, freeze, normalizeSituation } from './evidence';
import { PRIORS } from './priors';
import { legalActions, pickConcept, recommend } from './recommend';
import type { Action, Concept, DriveResult, Evidence, SimulationState, Strategy, WeightedOutcome } from './types';

export const PLAYBOOK: Readonly<Record<Concept,Action>> = Object.freeze({
  'Inside Zone':'RUN','Outside Zone':'RUN',Power:'RUN',Draw:'RUN','Quick Slant':'PASS',Mesh:'PASS',Screen:'PASS','Play-Action Cross':'PASS','Deep Shot':'PASS',Punt:'PUNT','Field Goal':'FIELD_GOAL',
});
export function nextRandom(state:number): {value:number;state:number} {
  const next=(state+0x6D2B79F5)>>>0;
  let t=next;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return {state:next,value:((t^(t>>>14))>>>0)/4294967296};
}
export function createSimulation(situation:GameSituation,strategy:Strategy='balanced',seed=1):SimulationState {
  if (!Number.isFinite(seed)) throw new Error('Seed must be finite');
  const s=normalizeSituation(situation);
  return freeze({startingSituation:{...s},currentSituation:{...s},strategy,seed:seed>>>0,rngState:seed>>>0,plays:[],runningScore:{offense:s.offensiveScore,defense:s.defensiveScore},driveResult:null,complete:false});
}
export interface ResolvedOutcome { readonly yards:number; readonly kind:WeightedOutcome['kind']|'punt'|'field-goal-made'|'field-goal-missed' }

export function advanceSituation(input:GameSituation,outcome:ResolvedOutcome,completedPass=false): {situation:GameSituation;result:DriveResult|null;converted:boolean;runoff:number} {
  if (!Number.isFinite(outcome.yards)) throw new Error('Outcome yardage must be finite');
  const before=normalizeSituation(input);
  const s={...before};
  const raw=before.yardline+Math.round(outcome.yards);
  const converted=outcome.kind==='gain'&&outcome.yards>=before.distance;
  let result:DriveResult|null=null;
  s.yardline=Math.max(0,Math.min(100,raw));
  if (outcome.kind==='punt') result='punt';
  else if (outcome.kind==='field-goal-made') {result='field-goal-made';s.offensiveScore+=PRIORS.points.value.fieldGoal;}
  else if (outcome.kind==='field-goal-missed') result='field-goal-missed';
  else if (outcome.kind==='turnover') result='turnover';
  else if (raw>=100) {result='touchdown';s.offensiveScore+=PRIORS.points.value.touchdown;}
  else if (raw<=0) {result='safety';s.defensiveScore+=PRIORS.points.value.safety;}
  else if (converted) {s.down=1;s.distance=Math.min(10,100-s.yardline);s.goalToGo=s.distance===100-s.yardline;}
  else if (s.down===4) result='downs';
  else {s.down+=1;s.distance=Math.max(1,before.distance-outcome.yards);}
  const runoff=outcome.kind==='punt'||outcome.kind.startsWith('field-goal')?PRIORS.runoff.value.kick:
    outcome.kind==='incomplete'?PRIORS.runoff.value.incomplete:completedPass?PRIORS.runoff.value.complete:PRIORS.runoff.value.run;
  const seconds=Number(before.clock.slice(0,2))*60+Number(before.clock.slice(3));
  let remaining=seconds-runoff;
  if (remaining<=0) {
    if (s.quarter===2||s.quarter===4) {result??=s.quarter===2?'half-end':'game-end';remaining=0;}
    else {s.quarter+=1;remaining=900+remaining;}
  }
  s.clock=formatClock(Math.max(0,remaining));
  return {situation:normalizeSituation(s),result,converted,runoff};
}
function sample(distribution:readonly WeightedOutcome[],value:number):ResolvedOutcome {
  let cumulative=0;
  for (const o of distribution) {
    cumulative+=o.probability;
    if (value<cumulative) return {yards:o.yards,kind:o.kind};
  }
  const last=distribution.at(-1);
  if (!last) throw new Error('Empty outcome distribution');
  return {yards:last.yards,kind:last.kind};
}
export function simulatePlay(state:SimulationState,choice:Action|Concept,evidence:Evidence={plays:[]}):SimulationState {
  if (state.complete) return state;
  const action:Action = choice in PLAYBOOK?PLAYBOOK[choice as Concept]:choice as Action;
  if (!legalActions(state.currentSituation,state.strategy).includes(action)) throw new Error(`Illegal action ${choice} on down ${state.currentSituation.down}`);
  const concept:Concept=choice in PLAYBOOK?choice as Concept:pickConcept(action,state.currentSituation,state.strategy);
  const recommendation=recommend(state.currentSituation,state.strategy,evidence);
  const candidate=recommendation.ranked.find(c=>c.action===action)!;
  const random=nextRandom(state.rngState);
  const outcome:ResolvedOutcome=action==='PUNT'?{kind:'punt',yards:candidate.yards.value}:action==='FIELD_GOAL'?
    {kind:random.value<candidate.success.value?'field-goal-made':'field-goal-missed',yards:0}:sample(candidate.distribution,random.value);
  const transition=advanceSituation({...state.currentSituation},outcome,action==='PASS'&&outcome.kind==='gain');
  const after=transition.situation;
  const play={order:state.plays.length+1,action,concept,before:{...state.currentSituation},after:{...after},yards:outcome.yards,outcome:transition.result??outcome.kind,converted:transition.converted};
  return freeze({...state,currentSituation:{...after},rngState:random.state,plays:[...state.plays,play],runningScore:{offense:after.offensiveScore,defense:after.defensiveScore},driveResult:transition.result,complete:transition.result!==null});
}
export function continueDrive(state:SimulationState,evidence:Evidence={plays:[]},playCap:number=PRIORS.playCap.value):SimulationState {
  if (!Number.isInteger(playCap)||playCap<1||playCap>1000) throw new Error('Play cap must be an integer between 1 and 1000');
  let next=state;
  while (!next.complete&&next.plays.length<playCap) next=simulatePlay(next,recommend(next.currentSituation,next.strategy,evidence).selected.concept,evidence);
  return next.complete?next:freeze({...next,driveResult:'play-cap' as const,complete:true});
}
