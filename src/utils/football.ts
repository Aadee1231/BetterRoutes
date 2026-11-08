import type { HistoricalPlay } from '../types';
export const ballOn=(yardline:number|null)=>yardline===null?'—':yardline===50?'50':yardline<50?`NCS ${yardline}`:`DUK ${100-yardline}`;
export const signed=(yards:number)=>yards>0?`+${yards}`:`${yards}`;
export const downDistance=(play:HistoricalPlay)=>play.down===null?'—':`${play.down}${play.down===1?'st':play.down===2?'nd':play.down===3?'rd':'th'} & ${play.distance===100-(play.yardline??0)?'Goal':play.distance}`;
export function endPosition(play:HistoricalPlay):number {
  if (play.result==='blocked-fg-return-touchdown') return 0;
  if (play.offensivePlay) return Math.max(0,Math.min(100,(play.yardline??0)+play.yards));
  const matches=[...play.description.matchAll(/to (NCSU|DUKE)(\d+)/g)];
  const last=matches.at(-1);
  return last?(last[1]==='NCSU'?Number(last[2]):100-Number(last[2])):play.yardline??25;
}
export const resultLabel=(result:string)=>({FG:'Field goal',PUNT:'Punt',DOWNS:'Downs',FGA:'Blocked FG–TD','turnover-on-downs':'Downs','blocked-fg-return-touchdown':'Blocked FG–TD','field-goal-good':'FG good','drive-start':'Drive start','first-down':'First down','no-play':'No play'}[result]??result.replaceAll('-',' '));
