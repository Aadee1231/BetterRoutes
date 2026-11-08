import { useEffect, useMemo, useState } from 'react';
import { game } from '../data';
import { continueDrive, createSimulation, recommend, simulatePlay } from '../engine';
import { TacticalField } from '../components/field/TacticalField';
import { PLAY_TEMPLATES } from '../components/plays/templates';
import { SourceTag } from '../components/SourceTag';
import { SimulationTag } from '../components/SimulationTag';
import { ballOn, endPosition, resultLabel, signed } from '../utils/football';
import type { Route } from '../utils/navigation';
import { evidence, officialSituation, readWorkspace, situationText, workspaceUrl } from '../utils/scenarios';

function PositionTrack({positions,label,end}:{positions:number[];label:string;end:string}) {
  return <div className="position-track"><div><h3>{label}</h3><span>{end}</span></div><svg viewBox="0 0 1000 110" role="img" aria-label={`${label}: ${positions.map(n=>Math.round(n)).join(' to ')}`}><rect x="10" y="45" width="980" height="35" fill="#191d21"/>{[0,25,50,75,100].map(n=><g key={n}><path d={`M${10+n*9.8} 45v35`} stroke="#32383e"/><text x={Math.max(25,Math.min(975,10+n*9.8))} y="108" textAnchor="middle" style={{fontSize:24}}>{n}</text></g>)}<polyline points={positions.map(n=>`${10+n*9.8},65`).join(' ')} stroke="currentColor" strokeWidth="3" fill="none"/>{positions.map((n,i)=><g key={i}><line x1={10+n*9.8} x2={10+n*9.8} y1="53" y2="77" stroke="currentColor" strokeWidth={i===positions.length-1?5:3}/><text x={10+n*9.8} y={i%2?23:48} textAnchor="middle" style={{fontSize:24}}>{i===0?'S':i}</text></g>)}</svg></div>;
}
export function WhatIf({route}:{route:Route}) {
  const w=useMemo(()=>readWorkspace(route),[route]);
  const simulation=useMemo(()=>{
    let state=createSimulation(w.situation,w.strategy,w.seed);
    if(w.steps>0||w.end)state=simulatePlay(state,w.candidate,evidence);
    for(let i=1;i<w.steps&&!state.complete;i++)state=simulatePlay(state,recommend(state.currentSituation,w.strategy,evidence).selected.concept,evidence);
    return w.end?continueDrive(state,evidence):state;
  },[w]);
  const [index,setIndex]=useState(0);const [replaying,setReplaying]=useState(false);const [replayKey,setReplayKey]=useState(0);
  useEffect(()=>{setIndex(Math.max(0,simulation.plays.length-1));setReplaying(false);},[simulation]);
  const change=(patch:Partial<typeof w>)=>{window.location.hash=workspaceUrl('what-if',w,patch);};
  const reset=()=>{setReplaying(false);setReplayKey(k=>k+1);change({steps:0,end:false});};
  const replay=()=>{setIndex(0);setReplayKey(k=>k+1);setReplaying(true);};
  const play=simulation.plays[index];const first=simulation.plays[0];
  const shown=play?.before??w.situation;
  const drive=game.drives.find(d=>d.id===w.source?.driveId);
  const remaining=drive&&w.source?drive.plays.slice(drive.plays.findIndex(p=>p.id===w.source!.id)):[];
  const actualPositions=w.source?[w.source.yardline??drive!.startYardline,...remaining.filter(p=>p.offensivePlay||p.playType==='punt'||p.playType==='fg').map(endPosition)]:[];
  const actualEnding=drive?resultLabel(drive.result):'No historical source';
  const actualPoints=drive?drive.result==='FG'?3:0:null;
  const custom=w.source&&JSON.stringify(officialSituation(w.source))!==JSON.stringify(w.situation);
  const simEnding=simulation.driveResult?resultLabel(simulation.driveResult):simulation.plays.length?'In progress':'Not run';
  const rows:[string,string|number,string|number][]=[
    ['Call',w.source?`${w.source.playType} / ${w.source.participants[0]?.split(',')[0]??'official'}`:'—',w.candidate],
    ['First play result',w.source?`${signed(w.source.yards)} yd · ${resultLabel(w.source.result)}`:'—',first?`${signed(first.yards)} yd · ${resultLabel(first.outcome)}`:'Not run'],
    ['First play yards',w.source?.offensivePlay?signed(w.source.yards):'n/a',first?signed(first.yards):'—'],
    ['Yards difference','Reference',first&&w.source?.offensivePlay?`${signed(first.yards-w.source.yards)} yd versus actual`:'—'],
    ['Converted',w.source?.offensivePlay?(w.source.yards>=(w.source.distance??1)?'Yes':'No'):'n/a',first?(first.action==='RUN'||first.action==='PASS'?first.converted?'Yes':'No':'n/a'):'—'],
    ['Drive ending',actualEnding,simEnding],
    ['Drive points (NCS)',actualPoints??'—',simulation.runningScore.offense-w.situation.offensiveScore],
    ['Drive points (DUK)',drive?.result==='FGA'?7:drive?0:'—',simulation.runningScore.defense-w.situation.defensiveScore],
  ];
  const comparison=<section className="comparison-outcomes"><div className="panel-heading"><h2>Actual vs hypothetical</h2></div><table className="comparison-table"><thead><tr><th>Comparison</th><th><SourceTag/></th><th><SimulationTag/></th></tr></thead><tbody>{rows.map(([label,actual,sim])=><tr key={label}><th scope="row">{label}</th><td>{actual}</td><td>{sim}</td></tr>)}</tbody></table><p className="honesty-note">One sampled outcome from the model, not a prediction of what would have happened. One game is not causal evidence. Diagrams are schematic. TDs include an assumed PAT (+7). Different seeds can succeed or fail; no outcome is forced.</p></section>;
  return <div className="whatif-page"><div className="page-kicker"><span>Counterfactual lab / 03</span><span>One sample · not a prediction</span></div><div className="workspace-title"><h1>What-If Analysis</h1><a className="button" href={workspaceUrl('coordinator',w,{steps:0,end:false})}>Edit situation / alternative</a></div>
    <div className="experiment-strip"><SimulationTag/><span className="mono">Starting situation: {situationText(w.situation)}</span><span className="mono">{w.strategy} / seed {w.seed}</span></div>
    {custom&&<p className="context-warning">Custom starting situation: the official play below is a historical reference, not the same starting context. Differences are descriptive, not like-for-like estimates.</p>}
    <div className="whatif-grid"><div className="whatif-reference"><section className="actual-band" aria-label="Actual historical drive"><div className="panel-heading"><h2>What happened</h2><SourceTag/></div>{w.source?<><p className="actual-situation mono">{situationText(officialSituation(w.source))}</p><h3>Actual call / {w.source.playType}</h3><p className="official-description">{w.source.description}</p><PositionTrack positions={actualPositions} label="Actual drive · official" end={actualEnding}/><details><summary>Actual rest-of-drive / {remaining.filter(p=>p.offensivePlay).length} scrimmage plays</summary><ol className="official-rest">{remaining.map(p=><li key={p.id}><span className="mono">Q{p.quarter} {p.clock} / {ballOn(p.yardline)}</span><p>{p.description}</p></li>)}</ol></details></>:<div className="empty-reference"><p>No official source selected. All results on the right are hypothetical.</p><a className="button" href="#/review?drive=drive-13&play=drive-13-row-07">Choose a historical play</a></div>}</section>{comparison}</div>
    <section className="hypothetical-band" aria-label="Hypothetical drive"><div className="panel-heading"><h2>{play?`${play.order}. ${play.concept}`:w.candidate}</h2><SimulationTag/></div><div className="workspace-situation mono">MODEL: {situationText(shown)}</div><TacticalField ballYardline={shown.yardline} lineToGain={shown.yardline+shown.distance} goalToGo={shown.goalToGo} kick={PLAY_TEMPLATES[play?.concept??w.candidate].kind==='kick'} template={PLAY_TEMPLATES[play?.concept??w.candidate]} resultSource="model" playId={`${w.seed}-${play?.order??0}-${w.candidate}-${JSON.stringify(w.situation)}`} autoPlay={!!play} replayKey={replayKey} animatedResult={play?{endYardline:play.after.yardline,label:`${signed(play.yards)} YD · ${resultLabel(play.outcome).toUpperCase()}`}:undefined} onPlaybackEnd={()=>{if(replaying){if(index+1<simulation.plays.length)setIndex(i=>i+1);else setReplaying(false);}}}/>
      <div className="simulation-controls"><button className="button primary" disabled={simulation.plays.length>0} onClick={()=>change({steps:1,end:false})}>Run Hypothetical Play</button><button className="button" disabled={!simulation.plays.length||simulation.complete} onClick={()=>change({steps:simulation.plays.length+1,end:false})}>Continue Drive</button><button className="button" disabled={simulation.complete} onClick={()=>change({end:true})}>Sim to End</button><button className="button" disabled={!simulation.plays.length} onClick={replay}>Replay sequence</button><button className="button" onClick={reset}>Reset simulation</button><label>Seed<input aria-label="Seed" type="number" min="0" max="4294967295" value={w.seed} onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value))change({seed:value>>>0,steps:0,end:false});}}/></label><button className="button" onClick={()=>change({seed:crypto.getRandomValues(new Uint32Array(1))[0],steps:0,end:false})}>New seed</button></div>
      <div className="simulation-result" role="status" data-testid="simulation-result"><SimulationTag/><strong>{simEnding}</strong><span className="mono">{simulation.plays.length} plays / NCS {simulation.runningScore.offense} – DUK {simulation.runningScore.defense}</span>{replaying&&<span>Replaying same sampled sequence</span>}</div>
      <PositionTrack positions={[w.situation.yardline,...simulation.plays.map(p=>p.after.yardline)]} label="Hypothetical drive · model" end={simEnding}/>
      <div className="sim-log-scroll"><table className="simulation-log"><thead><tr><th>Play / concept</th><th>Before</th><th>Gain</th><th>Model outcome</th></tr></thead><tbody>{simulation.plays.map((p,i)=><tr key={p.order} className={index===i?'selected':''}><td><button aria-label={`Replay simulated play ${p.order}`} onClick={()=>{setIndex(i);setReplaying(false);setReplayKey(k=>k+1);}}>{p.order}. {p.concept}</button></td><td>{p.before.down}&amp;{p.before.distance} / {ballOn(p.before.yardline)}</td><td>{signed(p.yards)}</td><td>{resultLabel(p.outcome)}</td></tr>)}</tbody></table></div>
    </section></div>
  </div>;
}
