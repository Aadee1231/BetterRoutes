import { game } from '../data';
import { buildEvidence, normalizeSituation, recommend, type Concept, type Strategy } from '../engine';
import type { GameSituation, HistoricalPlay } from '../types';
import { type Route, type Section, routeUrl } from './navigation';

export const DEMO_SEED=42;
export const decisions=[
  {id:'drive-13-row-07',title:'The yard that never came',note:'4th & 1 · NCS 40 · 0 yards'},
  {id:'drive-10-row-10',title:'The kick that came back',note:'50-yard FG blocked · return TD'},
  {id:'drive-11-row-04',title:'An empty start to the second half',note:'3rd & 2 · NCS 33 · incomplete'},
  {id:'drive-17-row-09',title:'The pocket closes',note:'3rd & 14 · NCS 33 · sack, −9'},
  {id:'drive-21-row-07',title:'One last fourth down',note:'4th & 2 · DUK 18 · incomplete'},
];
export const evidence=buildEvidence(game);
export const historicalPlay=(id:string|null)=>game.drives.filter(d=>d.offensiveTeam==='NCS').flatMap(d=>d.plays).find(p=>p.id===id);
export function officialSituation(p:HistoricalPlay):GameSituation {
  return normalizeSituation({down:p.down??1,distance:p.distance??10,yardline:p.yardline??25,quarter:p.quarter,clock:p.clock,offensiveScore:p.scoreBefore.NCS,defensiveScore:p.scoreBefore.DUK,goalToGo:false});
}
export interface Workspace { source?:HistoricalPlay;situation:GameSituation;strategy:Strategy;candidate:Concept;seed:number;steps:number;end:boolean; }
export function readWorkspace(route:Route):Workspace {
  const params=new URLSearchParams(route.search);
  const source=historicalPlay(route.play);
  const base=source?officialSituation(source):{down:1,distance:10,yardline:25,quarter:1,clock:'15:00',offensiveScore:0,defensiveScore:0,goalToGo:false};
  const number=(key:string,fallback:number)=>{const n=Number(params.get(key));return params.has(key)&&params.get(key)!==''&&Number.isFinite(n)?n:fallback;};
  const situation=normalizeSituation({...base,down:number('down',base.down),distance:number('toGo',base.distance),yardline:number('yardline',base.yardline),quarter:number('quarter',base.quarter),clock:params.get('clock')??base.clock,offensiveScore:number('ncs',base.offensiveScore),defensiveScore:number('duke',base.defensiveScore),goalToGo:false});
  const mode=params.get('strategy');const strategy:Strategy=mode==='aggressive'||mode==='conservative'?mode:'balanced';
  const ranked=recommend(situation,strategy,evidence).ranked;
  const candidate=ranked.find(c=>c.concept===params.get('candidate'))?.concept??ranked[0].concept;
  return {source,situation,strategy,candidate,seed:number('seed',DEMO_SEED)>>>0,steps:Math.max(0,Math.min(100,Math.floor(number('steps',0)))),end:params.get('end')==='1'};
}
export function workspaceUrl(section:Section,w:Workspace,patch:Partial<Workspace>={}):string {
  const next={...w,...patch};const s=next.situation;
  return routeUrl(section,next.source?.driveId,next.source?.id,{down:String(s.down),toGo:String(s.distance),yardline:String(s.yardline),quarter:String(s.quarter),clock:s.clock,ncs:String(s.offensiveScore),duke:String(s.defensiveScore),strategy:next.strategy,candidate:next.candidate,seed:String(next.seed),steps:String(next.steps),end:next.end?'1':'0'});
}
export function situationText(s:GameSituation):string {return `Q${s.quarter} ${s.clock} · ${s.down}${s.down===1?'st':s.down===2?'nd':s.down===3?'rd':'th'} & ${s.goalToGo?'Goal':s.distance} · ${s.yardline<=50?'NCS '+s.yardline:'DUK '+(100-s.yardline)} · NCS ${s.offensiveScore} / DUK ${s.defensiveScore}`;}
