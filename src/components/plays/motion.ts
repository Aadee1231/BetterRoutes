import type { PlayTemplate, TemplatePlayer } from './templates';
export type Point=readonly [number,number];
const fraction=(t:number)=>Math.max(0,Math.min(1,t));
export function along(points:readonly Point[],t:number):Point {
  if(t>=1)return points.at(-1)??[0,0];
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  let remaining=lengths.reduce((a,b)=>a+b,0)*fraction(t);
  for(let i=0;i<lengths.length;i++){
    if(remaining<=lengths[i]){const f=lengths[i]?remaining/lengths[i]:0;return [points[i][0]+(points[i+1][0]-points[i][0])*f,points[i][1]+(points[i+1][1]-points[i][1])*f];}
    remaining-=lengths[i];
  }
  return points.at(-1)??[0,0];
}
export function quadratic(a:Point,c:Point,b:Point,t:number):Point {
  const f=fraction(t);return [(1-f)**2*a[0]+2*(1-f)*f*c[0]+f*f*b[0],(1-f)**2*a[1]+2*(1-f)*f*c[1]+f*f*b[1]];
}
const spot=(template:PlayTemplate,position:string,fallback:Point):Point=>{const p=template.players.find(p=>p.position===position);return p?[p.x,p.y]:fallback;};
export const releaseTime=(template:PlayTemplate)=>template.concept==='Screen'||template.concept==='Play-Action Cross'?.5:.3;
export const CATCH_TIME=.8;
export function flightArc(template:PlayTemplate):readonly [Point,Point,Point] {
  if(template.kind==='kick')return [template.lane?.[0]??[-7,0],template.lane?.[1]??[10,-6],template.lane?.at(-1)??[30,0]];
  const target=template.players.find(p=>p.target);
  const start=spot(template,'QB',[-5,0]),end=target?.route?.at(-1)??start;
  return [start,[(start[0]+end[0])/2,Math.min(start[1],end[1])-6.5],end];
}
export function playerPosition(template:PlayTemplate,p:TemplatePlayer,t:number,project:(p:Point)=>Point=p=>p):Point {
  if(p.position==='RB'&&template.kind==='run')return along((template.lane??[[p.x,p.y]]).map(project),(t-.25)/.75);
  if(p.route){const end=p.route.at(-1)??[p.x,p.y];if(p.target&&template.kind==='pass'&&t>CATCH_TIME)return project([end[0]+5*(t-CATCH_TIME)/(1-CATCH_TIME),end[1]]);return along(([[p.x,p.y] as Point,...p.route]).map(project),p.target?t/CATCH_TIME:t);}
  return project([p.x,p.y]);
}
export function ballPosition(template:PlayTemplate,t:number,project:(p:Point)=>Point=p=>p):Point {
  const center=spot(template,'C',[-1,0]);
  const qb=spot(template,'QB',[-5,0]);
  const holder=template.kind==='kick'?flightArc(template)[0]:qb;
  if(t<=.1)return along([center,holder].map(project),t/.1);
  if(template.kind==='run'){
    const rb=template.lane?.[0]??spot(template,'RB',[-7,4]);
    return t<=.25?along([qb,rb].map(project),(t-.1)/.15):along((template.lane??[rb]).map(project),(t-.25)/.75);
  }
  const release=template.kind==='kick'?.3:releaseTime(template);
  if(t<release){
    if(template.concept==='Screen'||template.concept==='Play-Action Cross')return along([qb,[-6,2] as Point,qb].map(project),(t-.1)/(release-.1));
    return project(holder);
  }
  const arc=flightArc(template);
  const projected=[project(arc[0]),project(arc[1]),project(arc[2])] as const;
  if(template.kind==='kick')return quadratic(...projected,(t-release)/(1-release));
  const receiver=template.players.find(p=>p.target);
  return t<=CATCH_TIME?quadratic(...projected,(t-release)/(CATCH_TIME-release)):receiver?playerPosition(template,receiver,t,project):project(arc[2]);
}
