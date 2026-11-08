import type { GameSituation } from '../types';
import { continueDrive, createSimulation, nextRandom, simulatePlay } from './sim';
import type { Action, Concept, DriveResult, Evidence, Strategy } from './types';
export const ENDING_GROUPS=['Touchdown','Field goal','Punt','Downs','Turnover','Missed FG','Other'] as const;
export type EndingGroup=typeof ENDING_GROUPS[number];
export interface BatchResult { count:number;counts:Record<EndingGroup,number>;averagePoints:number; }
const group=(result:DriveResult|null):EndingGroup=>result==='touchdown'?'Touchdown':result==='field-goal-made'?'Field goal':result==='punt'?'Punt':result==='downs'?'Downs':result==='turnover'?'Turnover':result==='field-goal-missed'?'Missed FG':'Other';
export async function runBatch(situation:GameSituation,strategy:Strategy,choices:readonly (Action|Concept)[],seed:number,evidence:Evidence,options:{count?:number;signal?:AbortSignal;yieldControl?:()=>Promise<void>;onProgress?:(completed:number)=>void}={}):Promise<BatchResult[]> {
  const count=options.count??500;
  if(!Number.isInteger(count)||count<1||count>500)throw new Error('Batch count must be 1–500');
  if(!choices.length)return [];
  const results=choices.map(()=>({count,counts:Object.fromEntries(ENDING_GROUPS.map(g=>[g,0])) as Record<EndingGroup,number>,averagePoints:0}));
  const yieldControl=options.yieldControl??(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));
  let derivedSeed=seed>>>0;
  for(let i=0;i<count;i++){
    if(options.signal?.aborted)throw new DOMException('Batch cancelled','AbortError');
    derivedSeed=nextRandom(derivedSeed).state;
    choices.forEach((choice,j)=>{
      const state=continueDrive(simulatePlay(createSimulation(situation,strategy,derivedSeed),choice,evidence),evidence);
      results[j].counts[group(state.driveResult)]++;
      results[j].averagePoints+=(state.runningScore.offense-situation.offensiveScore)/count;
    });
    if((i+1)%4===0){options.onProgress?.(i+1);await yieldControl();}
  }
  return results;
}
