import type { Game, GameSituation } from '../types';
import type { Evidence, EvidencePlay } from './types';

export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function buildEvidence(game: Game): Evidence {
  const plays: EvidencePlay[] = game.drives.flatMap(d=>d.plays.filter(p=>p.counts&&!p.nullified&&p.offensivePlay&&p.down!==null&&p.distance!==null).map(p=>({
    id:p.id,team:d.offensiveTeam,down:p.down!,distance:p.distance!,yards:p.yards,
    action:(p.playType==='pass'||p.playType==='sack'?'PASS':'RUN') as 'RUN'|'PASS',
    incomplete:p.result==='incomplete',sack:p.playType==='sack',turnover:/intercepted|fumble.*(?:recovered by|lost)/i.test(p.description),
  })));
  return freeze({plays});
}
export const distanceBucket = (distance:number) => distance<=3?'short':distance<=6?'medium':'long';
export const downGroup = (down:number) => down<=2?'early':'late';
export const successThreshold = (s:Pick<GameSituation,'down'|'distance'>) => s.distance*(s.down===1?0.5:s.down===2?0.7:1);

const finite = (n:number,fallback:number) => Number.isFinite(n)?n:fallback;
const clamp = (n:number,min:number,max:number) => Math.max(min,Math.min(max,n));
export function normalizeSituation(input: GameSituation): GameSituation {
  const yardline = clamp(Math.round(finite(input.yardline,25)),0,100);
  const goal = Math.max(1,100-yardline);
  const distance = clamp(Math.round(finite(input.distance,10)),1,goal);
  const clock = /^\d{2}:[0-5]\d$/.test(input.clock)?input.clock:'15:00';
  const seconds = Math.min(900,Number(clock.slice(0,2))*60+Number(clock.slice(3)));
  return {down:clamp(Math.round(finite(input.down,1)),1,4),distance,yardline,
    quarter:clamp(Math.round(finite(input.quarter,1)),1,4),clock:formatClock(seconds),
    offensiveScore:Math.max(0,Math.round(finite(input.offensiveScore,0))),defensiveScore:Math.max(0,Math.round(finite(input.defensiveScore,0))),
    goalToGo:input.goalToGo||distance===goal,
    ...(input.goalToGo?{distance:goal}:{}),
  };
}
export const formatClock = (seconds:number) => `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
