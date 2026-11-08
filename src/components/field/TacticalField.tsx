import { useEffect, useId, useRef, useState } from 'react';
import type { PlayTemplate } from '../plays/templates';
import { ballPosition, flightArc, playerPosition, type Point } from '../plays/motion';

export interface TacticalFieldProps {
  ballYardline:number;lineToGain?:number|null;goalToGo?:boolean;kick?:boolean;
  template?:PlayTemplate;animatedResult?:{endYardline:number;label:string};
  playId?:string;showDefense?:boolean;
  schematicMotion?:boolean;autoPlay?:boolean;replayKey?:number;onPlaybackEnd?:()=>void;resultSource?:'official'|'model';
}
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const x=(yardline:number)=>(clamp(yardline)+10)*10;

export function TacticalField({ballYardline,lineToGain,goalToGo=false,kick=false,template,animatedResult,playId,showDefense=false,schematicMotion=false,autoPlay=false,replayKey=0,onPlaybackEnd,resultSource='official'}:TacticalFieldProps) {
  const id=useId().replaceAll(':','');
  const [progress,setProgress]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const progressRef=useRef(0);
  const lastFrame=useRef<number|null>(null);
  const ended=useRef(onPlaybackEnd);ended.current=onPlaybackEnd;
  useEffect(()=>{setProgress(0);progressRef.current=0;setPlaying(autoPlay&&!!animatedResult);lastFrame.current=null;},[playId,ballYardline,animatedResult?.endYardline,replayKey,autoPlay]);
  useEffect(()=>{
    if (!playing) {lastFrame.current=null;return;}
    let frame:number;
    const tick=(time:number)=>{
      if (lastFrame.current!==null) progressRef.current=Math.min(1,progressRef.current+(time-lastFrame.current)*speed/3000);
      lastFrame.current=time;setProgress(progressRef.current);
      if (progressRef.current<1) frame=requestAnimationFrame(tick);else {setPlaying(false);ended.current?.();}
    };
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[playing,speed]);
  const reset=()=>{setPlaying(false);setProgress(0);progressRef.current=0;lastFrame.current=null;};
  const replay=()=>{progressRef.current=0;setProgress(0);lastFrame.current=null;setPlaying(true);};
  const end=animatedResult?.endYardline??ballYardline;
  const current=clamp(ballYardline+(end-ballYardline)*progress);
  const los=x(ballYardline);
  const routePoint=([dx,dy]:readonly [number,number])=>`${Math.max(16,Math.min(1184,los+dx*10))},${266.5+dy*10}`;
  const project=([dx,dy]:Point):Point=>[(Math.max(16,Math.min(1184,los+dx*10))-los)/10,dy];
  const ball=schematicMotion&&template?ballPosition(template,progress,project):[current-ballYardline,0];
  const ballX=schematicMotion?Math.max(16,Math.min(1184,los+ball[0]*10)):x(current);
  const ballY=schematicMotion?266.5+ball[1]*10:266.5;
  const calloutWidth=Math.min(1000,Math.max(280,(animatedResult?.label.length??0)*10+28));
  return <div className="field-player" data-play-id={playId} data-concept={template?.concept} data-progress={progress}>
    <svg className="tactical-field" viewBox="0 0 1200 533" role="img" aria-label={`Football field. Ball at ${ballYardline}, ${schematicMotion?'schematic illustration':animatedResult?`${resultSource} replay available`:'schematic illustration'}.`}>
      <defs><marker id={`${id}-route`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="none" stroke="#f1f0ec" strokeWidth="1.4"/></marker><marker id={`${id}-run`} markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 5 3 0 6" fill="#cc3039"/></marker></defs>
      <rect width="1200" height="533" fill="#244837"/>
      {Array.from({length:20},(_,i)=><rect key={i} x={100+i*50} y="0" width="50" height="533" fill={i%2?'#244837':'#294d3c'}/>)}
      <rect width="100" height="533" fill="#1c382c"/><rect x="1100" width="100" height="533" fill="#1c382c"/>
      <text x="50" y="266.5" transform="rotate(-90 50 266.5)" className="endzone-name">NC STATE</text><text x="1150" y="266.5" transform="rotate(90 1150 266.5)" className="endzone-name">DUKE</text>
      {Array.from({length:21},(_,i)=><line key={i} x1={100+i*50} x2={100+i*50} y1="0" y2="533" stroke="#d6e2d6" strokeOpacity={i%2?0.2:0.45} strokeWidth={i===0||i===20?3:1.2}/>)}
      {Array.from({length:101},(_,i)=><g key={i} stroke="#d6e2d6" strokeWidth="1.1" strokeOpacity="0.45">{[8,213,320,517].map(y=><line key={y} x1={100+i*10} x2={100+i*10} y1={y} y2={y+7}/>)}</g>)}
      {Array.from({length:9},(_,i)=>{const yard=(i+1)*10;const num=yard<=50?yard:100-yard;return <g key={yard} className="field-numbers"><text x={x(yard)} y="100">{num}</text><text x={x(yard)} y="440" transform={`rotate(180 ${x(yard)} 440)`}>{num}</text>{yard!==50&&<><path d={yard<50?`M${x(yard)+28} 91l9 -5v10z`:`M${x(yard)-28} 91l-9 -5v10z`} fill="#d6e2d6" opacity="0.6"/><path d={yard<50?`M${x(yard)+28} 433l9 -5v10z`:`M${x(yard)-28} 433l-9 -5v10z`} fill="#d6e2d6" opacity="0.6"/></>}</g>;})}
      <rect x="2" y="2" width="1196" height="529" fill="none" stroke="#d6e2d6" strokeWidth="3"/>
      {!goalToGo&&!kick&&lineToGain!==null&&lineToGain!==undefined&&<line data-testid="first-down-line" x1={x(lineToGain)} x2={x(lineToGain)} y1="0" y2="533" stroke="#e8c547" strokeWidth="3"/>}
      <line data-testid="line-of-scrimmage" x1={los} x2={los} y1="0" y2="533" stroke="#8daec5" strokeWidth="3"/>
      <g className="line-label"><rect x={los-23} y="5" width="46" height="24" fill="#8daec5"/><text x={los} y="23" textAnchor="middle">LOS</text></g>
      {!goalToGo&&!kick&&lineToGain!=null&&<g className="line-label"><rect x={x(lineToGain)-23} y="31" width="46" height="24" fill="#e8c547"/><text x={x(lineToGain)} y="49" textAnchor="middle">1ST</text></g>}
      {showDefense&&[-18,-9,-3,3,9,18].map((dy,i)=><path key={dy} d={`M${los+(i%2?35:65)-6} ${266.5+dy*10-6}l12 12m0 -12l-12 12`} stroke="#c2c9c5" strokeWidth="3"/>)}
      {template&&<g className="schematic">
        {template.players.filter(p=>p.route).map((p,i)=><path key={i} d={`M${routePoint([p.x,p.y])} ${p.route!.map(point=>'L'+routePoint(point)).join(' ')}`} fill="none" stroke="#f1f0ec" strokeOpacity={p.target?0.9:0.5} strokeWidth={p.target?3:2} markerEnd={`url(#${id}-route)`}/>)}
        {template.lane&&template.kind==='run'&&<path d={`M${template.lane.map(routePoint).join(' L')}`} fill="none" stroke="#cc3039" strokeWidth="8" markerEnd={`url(#${id}-run)`}/>}
        {(template.kind==='pass'||template.kind==='kick')&&(()=>{const [start,control,end]=flightArc(template);return <path data-testid="ball-flight-arc" d={`M${routePoint(start)} Q${routePoint(control)} ${routePoint(end)}`} fill="none" stroke="#d6c8b0" strokeDasharray="7 6" strokeWidth="2.5"/>;})()}
        {template.players.map((p,i)=><g key={i} data-player={p.position} transform={`translate(${routePoint(playerPosition(template,p,progress,project))})`}><circle r="11" fill="#cc3039" stroke="#f1f0ec" strokeWidth="1.2"/><text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="9" fontFamily="IBM Plex Sans Condensed">{p.position}</text></g>)}
      </g>}
      {progress>0&&!schematicMotion&&<line x1={los} x2={x(current)} y1="266.5" y2="266.5" stroke="#f1f0ec" strokeOpacity="0.65" strokeWidth="3" strokeDasharray="5 5"/>}
      <g data-testid="field-ball" data-yardline={ballYardline} data-current-yardline={current.toFixed(2)} transform={`translate(${ballX} ${ballY}) scale(1.5)`}><ellipse rx="9" ry="6" transform="rotate(-25)" fill="#d7b48a" stroke="#171b17" strokeWidth="2"/><path d="M-4 0h8m-2 -2v4m-2 -4v4m-2 -4v4" stroke="#fff" strokeWidth="1"/></g>
      <text x="1180" y="26" textAnchor="end" className="field-stamp">{template?'SCHEMATIC ILLUSTRATION':'OFFICIAL BALL POSITION · LEFT TO RIGHT'}</text>
      {progress>0&&animatedResult&&<g><rect x={600-calloutWidth/2} y="475" width={calloutWidth} height="36" fill="#101214"/><text x="600" y="499" textAnchor="middle" className="field-callout">{animatedResult.label}</text></g>}
    </svg>
    <div className="field-controls"><div className="transport"><button onClick={()=>{if(progress>=1)replay();else setPlaying(!playing);}} disabled={!animatedResult}>{playing?'Pause':'Play'}</button><button onClick={replay} disabled={!animatedResult}>Replay</button><button onClick={reset} disabled={!animatedResult}>Reset</button></div><label>Speed <select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><span className="replay-status" aria-live="polite">{playing?'REPLAYING':progress>=1?'COMPLETE':'READY'} <span className="mono">{Math.round(progress*100)}%</span></span></div>
    <div className="field-legend"><span><i className="los-key"/>Line of scrimmage</span>{!goalToGo&&!kick&&<span><i className="gain-key"/>Line to gain</span>}<span>Offense →</span><span>{schematicMotion?'Illustrative motion, not a sampled outcome.':animatedResult?`Ball motion follows the ${resultSource==='model'?'model sample':'official result'}.`:'Routes are illustrative, not tracking data.'}</span></div>
  </div>;
}
