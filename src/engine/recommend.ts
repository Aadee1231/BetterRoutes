import type { GameSituation } from '../types';
import { distanceBucket, downGroup, freeze, normalizeSituation, successThreshold } from './evidence';
import { PRIORS } from './priors';
import type { Action, Candidate, Concept, Evidence, Metric, PlayRecommendation, Strategy, WeightedOutcome } from './types';

export const MODEL_VERSION = 'betterroutes-statistical-v1';
export const percent = (value:number,source:Metric['source']='calculated'): Metric => ({value,display:`~${Math.round(value*20)*5}%`,source});
const yardsMetric = (value:number,source:Metric['source']='calculated'): Metric => ({value:Math.round(value),display:`~${Math.round(value)} yd`,source});
export function pickConcept(action:Action,s:GameSituation,strategy:Strategy): Concept {
  if (action==='PUNT') return 'Punt';
  if (action==='FIELD_GOAL') return 'Field Goal';
  if (action==='RUN') {
    if (s.distance<=3) return strategy==='aggressive'?'Power':'Inside Zone';
    if (s.distance>=7&&s.down>=2) return 'Draw';
    return s.yardline<50?'Outside Zone':'Inside Zone';
  }
  if (s.distance<=3) return 'Quick Slant';
  if (s.distance>=7&&strategy==='aggressive'&&s.yardline<80) return 'Deep Shot';
  if (s.distance>=7&&strategy==='conservative') return 'Screen';
  if (s.down===1&&s.distance>=7) return 'Play-Action Cross';
  return 'Mesh';
}
export function legalActions(s:GameSituation,strategy:Strategy): Action[] {
  const actions: Action[]=['RUN','PASS'];
  if (s.down!==4) return actions;
  if (s.yardline<PRIORS.punt.value.noPuntBeyond||strategy==='conservative') actions.push('PUNT');
  if (100-s.yardline+PRIORS.fieldGoal.value.snapOffset<=PRIORS.fieldGoal.value.maxDistance) actions.push('FIELD_GOAL');
  return actions;
}
export function fieldGoalChance(yardline:number):number {
  const p=PRIORS.fieldGoal.value;
  return Math.max(p.min,Math.min(p.max,p.base-Math.max(0,100-yardline+p.snapOffset-p.declineStarts)*p.declinePerYard));
}
export const puntNet = (yardline:number) => Math.max(0,Math.min(PRIORS.punt.value.net,100-PRIORS.punt.value.touchbackSpot-yardline));

function estimate(action:Action,s:GameSituation,evidence:Evidence): Omit<Candidate,'concept'|'utility'|'utilitySource'|'expectedPoints'|'explanation'> {
  if (action==='PUNT'||action==='FIELD_GOAL') {
    const probability=action==='PUNT'?1:fieldGoalChance(s.yardline);
    return {action,success:percent(probability,'assumed'),conversion:percent(0,'assumed'),yards:yardsMetric(action==='PUNT'?puntNet(s.yardline):0,'assumed'),
      risk:'med',riskValue:action==='PUNT'?0.1:1-probability,riskSource:'assumed',
      evidence:{n:0,opponentN:0,weightedN:0,observedRate:null,prior:percent(probability,'assumed'),weight:percent(0,'calculated')},distribution:[]};
  }
  const sample=evidence.plays.filter(p=>p.action===action&&downGroup(p.down)===downGroup(s.down)&&distanceBucket(p.distance)===distanceBucket(s.distance));
  const n=sample.filter(p=>p.team==='NCS').length;
  const opponentN=sample.length-n;
  const weight=(team:string)=>team==='NCS'?1:PRIORS.opponentWeight.value;
  const weightedN=n+opponentN*PRIORS.opponentWeight.value;
  const prior=action==='RUN'?PRIORS.run.value:PRIORS.pass.value;
  const k=PRIORS.strength.value;
  const priorSuccess=prior.reduce((sum,o)=>sum+(o.kind!=='turnover'&&o.yards>=successThreshold(s)?o.probability:0),0);
  const observedSuccess=sample.reduce((sum,p)=>sum+(!p.turnover&&p.yards>=successThreshold(p)?weight(p.team):0),0);
  const conversionSuccess=sample.reduce((sum,p)=>sum+(!p.turnover&&p.yards>=p.distance?weight(p.team):0),0);
  const priorConversion=prior.reduce((sum,o)=>sum+(o.kind!=='turnover'&&o.yards>=s.distance?o.probability:0),0);
  const distribution:WeightedOutcome[] = [
    ...prior.map(o=>({...o,probability:k*o.probability/(weightedN+k)})),
    ...sample.map(p=>({yards:p.yards,kind:(p.turnover?'turnover':p.sack?'sack':p.incomplete?'incomplete':'gain') as WeightedOutcome['kind'],probability:weight(p.team)/(weightedN+k)})),
  ];
  const mean=distribution.reduce((sum,o)=>sum+o.yards*o.probability,0);
  const variance=distribution.reduce((sum,o)=>sum+(o.yards-mean)**2*o.probability,0);
  const turnover=distribution.filter(o=>o.kind==='turnover').reduce((sum,o)=>sum+o.probability,0);
  const sack=distribution.filter(o=>o.kind==='sack').reduce((sum,o)=>sum+o.probability,0);
  const r=PRIORS.risk.value;
  const riskValue=Math.min(1,variance/r.varianceScale+turnover*r.turnoverWeight+sack*r.sackWeight);
  return {action,success:percent((observedSuccess+k*priorSuccess)/(weightedN+k)),conversion:percent((conversionSuccess+k*priorConversion)/(weightedN+k)),
    yards:yardsMetric(mean),risk:riskValue>=r.high?'high':riskValue>=r.medium?'med':'low',riskValue,riskSource:'calculated',
    evidence:{n,opponentN,weightedN,observedRate:weightedN?percent(observedSuccess/weightedN,'observed'):null,prior:percent(priorSuccess,'assumed'),weight:percent(weightedN/(weightedN+k))},distribution};
}
export function recommend(input:GameSituation,strategy:Strategy,evidence:Evidence={plays:[]}): PlayRecommendation {
  const s=normalizeSituation(input);
  const w=PRIORS.weights.value[strategy];
  if (!w) throw new Error(`Unknown strategy: ${strategy}`);
  const fieldValue=(position:number)=>PRIORS.points.value.fieldValueBase+position/PRIORS.points.value.fieldValueScale;
  const ranked=legalActions(s,strategy).map(action=>{
    const c=estimate(action,s,evidence);
    const kick=action==='PUNT'||action==='FIELD_GOAL';
    const scoringChance=c.distribution.filter(o=>o.kind!=='turnover'&&s.yardline+o.yards>=100).reduce((sum,o)=>sum+o.probability,0);
    const explosive=c.distribution.filter(o=>o.yards>=15).reduce((sum,o)=>sum+o.probability,0);
    let ep=action==='FIELD_GOAL'?c.success.value*3-(1-c.success.value)*fieldValue(100-s.yardline):action==='PUNT'?-fieldValue(100-s.yardline-puntNet(s.yardline)):
      c.conversion.value*fieldValue(Math.min(100,s.yardline+c.yards.value))-(1-c.conversion.value)*fieldValue(100-s.yardline);
    if (scoringChance) ep+=scoringChance*PRIORS.points.value.touchdown;
    let utility = w.success*c.success.value+w.yards*c.yards.value-w.risk*c.riskValue+w.explosive*explosive;
    if (s.down===4) utility+=ep+(kick?w.kick:w.go);
    const trailing=s.offensiveScore<s.defensiveScore;
    if (trailing&&!kick) utility+=s.quarter>=3?PRIORS.situation.value.lateTrailingBoost:PRIORS.situation.value.trailingBoost;
    if (!trailing&&s.quarter===4&&kick) utility+=PRIORS.situation.value.leadProtection;
    if (s.yardline>=80&&!kick) utility+=PRIORS.situation.value.redZoneBoost*scoringChance;
    const concept=pickConcept(action,s,strategy);
    const explanation=`${action} / ${concept}: ${c.success.display} ${action==='FIELD_GOAL'?'make':'success'}, ${c.conversion.display} conversion, ${c.yards.display}, ${c.risk} risk; ${c.evidence.n} NC State + ${c.evidence.opponentN} downweighted opponent samples; utility ${utility.toFixed(2)} (heuristic).`;
    return {...c,concept,utility,utilitySource:'assumed' as const,expectedPoints:{value:ep,display:`~${Math.round(ep)} EP-ish`,source:'assumed' as const},explanation};
  }).sort((a,b)=>b.utility-a.utility);
  const selected=ranked[0];
  return freeze({selected,alternatives:ranked.slice(1),ranked,situation:s,strategy,modelVersion:MODEL_VERSION,
    explanation:`${s.down}${s.down===1?'st':s.down===2?'nd':s.down===3?'rd':'th'} and ${s.goalToGo?'Goal':s.distance} at ${s.yardline<=50?'own '+s.yardline:'opponent '+(100-s.yardline)}, Q${s.quarter} ${s.clock}, score ${s.offensiveScore}–${s.defensiveScore}; ${strategy}. Ranked ${selected.concept} (${selected.action}) first. ${selected.explanation}`,
    details:{sampleSizes:{NCS:evidence.plays.filter(p=>p.team==='NCS').length,opponent:evidence.plays.filter(p=>p.team==='DUK').length},
      estimationMethod:'Beta-binomial shrinkage: (weighted observed successes + 12 × heuristic prior)/(weighted n + 12). Down groups 1–2 / 3–4; distance buckets ≤3 / 4–6 / 7+. Conversion is separate from 50/70/100% success.',
      assumptions:Object.values(PRIORS).map(p=>p.rationale),
      limitations:['One game is not causal evidence or a season model; no trained ML.','Named concepts are situation-based schematic choices, not measured concept effectiveness.','Duke offense is secondary opponent-observed evidence at 0.35 weight, not NC State offensive performance.','Sparse buckets and heuristic priors dominate; displayed percentages round to 5%.','Punt and field goal only on fourth down; FG limited to 60 yards; punt inside opponent 35 only for conservative strategy.','Expected-points-ish utility is an assumed field-value comparison, not a validated EP model.']}});
}
