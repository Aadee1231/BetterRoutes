import { useEffect } from 'react';
import { game } from '../data';
import type { Drive, HistoricalPlay, TeamStats } from '../types';
import { SourceTag } from '../components/SourceTag';
import { TacticalField } from '../components/field/TacticalField';
import { ballOn, downDistance, endPosition, resultLabel, signed } from '../utils/football';
import { type Route, routeUrl } from '../utils/navigation';
import { decisions, DEMO_SEED, readWorkspace, workspaceUrl } from '../utils/scenarios';

const reportUrl='https://gopack.com/news/2026/11/7/football-wolfpack-offense-stalls-in-41-3-loss-to-duke';
const ncDrives=game.drives.filter(d=>d.offensiveTeam==='NCS');
function Linescore() {
  const quarters={NCS:[0,0,0,0],DUK:[0,0,0,0]};
  let before={NCS:0,DUK:0};
  for (const s of game.scoring) {
    for (const team of ['NCS','DUK'] as const) quarters[team][s.quarter-1]+=s.score[team]-before[team];
    before=s.score;
  }
  return <section className="linescore-panel" aria-label="Official final linescore">
    <div className="panel-heading"><h1>Duke at NC State</h1><span className="final-label">Final</span><SourceTag/></div>
    <table className="linescore"><thead><tr><th scope="col">November 07, 2026</th>{['Q1','Q2','Q3','Q4','T'].map(q=><th scope="col" key={q}>{q}</th>)}</tr></thead><tbody>{(['DUK','NCS'] as const).map(team=><tr key={team}><th scope="row"><span className={`team-rule ${team.toLowerCase()}`}/>{team==='NCS'?'NC STATE':'DUKE'}<small>{team==='NCS'?'WOLFPACK':'BLUE DEVILS'}</small></th>{quarters[team].map((points,i)=><td key={i}>{points}</td>)}<td className="total-score" data-testid={`score-${team}`}>{game.score[team]}</td></tr>)}</tbody></table>
    <div className="game-location">{game.stadium} <span> / </span> Raleigh, NC <span> / </span> Att. {game.attendance?.toLocaleString('en-US')}</div>
    <p className="report-summary">Seven punts. No touchdowns. NC State crossed into Duke territory on only four drives. <a href={reportUrl} target="_blank" rel="noreferrer">Postgame report ↗</a></p>
  </section>;
}
function TeamComparison() {
  const ncs=game.teamStats.find(t=>t.team==='NCS')!;
  const duke=game.teamStats.find(t=>t.team==='DUK')!;
  const turnovers=(t:TeamStats)=>Number(t.officialRows['Passing/Comp.-Att.-Int.'].split('-')[2])+Number(t.officialRows['Total Offense/Fumbles - Lost'].split('-')[1]);
  const stats:[string,(t:TeamStats)=>string|number][]=[['Total yards',t=>t.totalYards],['Passing',t=>t.passingYards],['Rushing',t=>t.rushingYards],['Offensive plays',t=>t.offensivePlays],['First downs',t=>t.firstDowns],['Third downs',t=>`${t.thirdDownConversions}/${t.thirdDownAttempts}`],['Punts',t=>t.punts],['Giveaways (INT + FL)',turnovers],['Possession',t=>t.officialRows['Miscellaneous/Poss. Time']]];
  return <section className="comparison-panel" aria-label="Official team statistics"><div className="panel-heading"><h2>By the numbers</h2><SourceTag/></div><table className="stats-table"><thead><tr><th scope="col">Team comparison</th><th scope="col">NCS</th><th scope="col">DUKE</th><th scope="col"><span className="sr-only">Provenance</span></th></tr></thead><tbody>{stats.map(([label,value])=><tr key={label}><th scope="row">{label}</th><td>{value(ncs)}</td><td>{value(duke)}</td><td className="official-cell">Official</td></tr>)}</tbody></table></section>;
}
function Possessions({selected,onSelect}:{selected:Drive;onSelect:(drive:Drive)=>void}) {
  return <section className="possession-panel"><div className="panel-heading"><h2>Possession chart</h2><span className="count-label">11 DRIVES</span></div><SourceTag/>
    <div className="chart-scale"><span>Own goal</span><span>50</span><span>Opp. goal →</span></div>
    <table className="drive-table"><thead><tr><th># / Q</th><th>Start</th><th><span className="sr-only">Field position progression</span></th><th>Plays</th><th>Net</th><th>End</th></tr></thead><tbody>{ncDrives.map((d,i)=>{
      const start=5+d.startYardline*0.9,end=5+d.endYardline*0.9;
      return <tr key={d.id} className={selected.id===d.id?'selected':''} onClick={()=>onSelect(d)}><td><button aria-label={`Select drive ${i+1}, quarter ${d.startQuarter}, ${resultLabel(d.result)}`} aria-pressed={selected.id===d.id} onClick={e=>{e.stopPropagation();onSelect(d);}}><b>{String(i+1).padStart(2,'0')}</b><span>Q{d.startQuarter}</span></button></td><td>{ballOn(d.startYardline).replace(' ','')}</td><td className="drive-map"><svg viewBox="0 0 100 18" aria-hidden="true"><path d="M5 0v18M27.5 0v18M50 0v18M72.5 0v18M95 0v18" stroke="#32383e" strokeWidth="0.7"/><line x1={start} x2={end} y1="9" y2="9" stroke={d.result==='FGA'?'#cc3039':'#a2a7ad'} strokeWidth="3"/><circle cx={start} cy="9" r="2" fill="#f1f0ec"/>{d.result==='DOWNS'?<path d={`M${end-3} 5l6 8m0 -8l-6 8`} stroke="#f1f0ec" strokeWidth="1.5"/>:d.result==='FGA'?<rect x={end-3} y="5" width="7" height="8" fill="#cc3039"/>:<circle cx={end} cy="9" r="3.5" fill={d.result==='FG'?'#f1f0ec':'#191d21'} stroke="#f1f0ec" strokeWidth="1"/>}</svg></td><td>{d.officialPlays}</td><td>{signed(d.netYards)}</td><td className={`drive-result ${d.result==='FGA'?'red-text':''}`}>{resultLabel(d.result)}</td></tr>;
    })}</tbody></table>
    <div className="drive-legend"><span>● FG</span><span>○ Punt</span><span>× Downs</span><span className="red-text">■ Blocked FG–TD</span></div><p className="micro-note">Offense moves left → right. Net includes penalties. Plays use the official drive chart.</p>
  </section>;
}
function KeyDecisions({selected,onSelect}:{selected:HistoricalPlay;onSelect:(play:HistoricalPlay)=>void}) {
  return <section className="decisions-panel"><div className="panel-heading"><h2>Key decisions</h2><span className="count-label">FILM INDEX</span></div><SourceTag/><ol>{decisions.map((decision,i)=>{
    const play=ncDrives.flatMap(d=>d.plays).find(p=>p.id===decision.id)!;
    return <li key={decision.id}><button onClick={()=>onSelect(play)} aria-pressed={selected.id===play.id}><span className="decision-index">{String(i+1).padStart(2,'0')}</span><span><strong>{decision.title}</strong><span className="decision-note">Q{play.quarter} {play.clock} / {decision.note}</span></span></button></li>;
  })}</ol></section>;
}
export function GameReview({route}:{route:Route}) {
  const requestedPlay=ncDrives.flatMap(d=>d.plays).find(p=>p.id===route.play);
  const drive=ncDrives.find(d=>d.id===(requestedPlay?.driveId??route.drive))??ncDrives[0];
  const selected=requestedPlay??drive.plays.find(p=>p.offensivePlay)??drive.plays[0];
  const index=drive.plays.findIndex(p=>p.id===selected.id);
  const selectPlay=(play:HistoricalPlay)=>{window.location.hash=routeUrl('review',play.driveId,play.id,{seed:String(DEMO_SEED)});};
  const selectDrive=(d:Drive)=>selectPlay(d.plays.find(p=>p.offensivePlay)??d.plays[0]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if (event.altKey||event.ctrlKey||event.metaKey||(event.target instanceof Element&&event.target.closest('input,select,textarea,.field-controls'))) return;
      if (event.key!=='ArrowLeft'&&event.key!=='ArrowRight') return;
      const next=index+(event.key==='ArrowRight'?1:-1);
      if (drive.plays[next]) {event.preventDefault();selectPlay(drive.plays[next]);}
    };
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
  },[drive,index]);
  const isKick=['fg','punt','kickoff','pat'].includes(selected.playType);
  const replayable=selected.counts&&(selected.offensivePlay||isKick);
  const end=endPosition(selected);
  const isGoal=selected.distance===100-(selected.yardline??0);
  const replayLabel=selected.result==='blocked-fg-return-touchdown'?'100-YD BLOCKED FG RETURN · TD':isKick?`${resultLabel(selected.result).toUpperCase()} · BALL TO ${ballOn(end)}`:`${signed(selected.yards)} YARDS · ${resultLabel(selected.result).toUpperCase()}`;
  return <div className="review-page">
    <div className="page-kicker"><span>2026 SEASON <span className="slash">/</span> GAME 09 <span className="slash">/</span> ACC</span><span>GAME REVIEW <span className="slash">/</span> NC STATE OFFENSE</span></div>
    <div className="game-overview"><Linescore/><TeamComparison/></div>
    <div className="review-workspace">
      <aside className="review-sidebar"><Possessions selected={drive} onSelect={selectDrive}/><KeyDecisions selected={selected} onSelect={selectPlay}/></aside>
      <div className="review-main">
        <section className="replay-panel" aria-label="Selected play replay">
          <div className="panel-heading"><h2>Possession {String(ncDrives.indexOf(drive)+1).padStart(2,'0')} <span className="muted">/</span> Official replay</h2><SourceTag url={selected.source.url}/></div>
          <div className="replay-layout"><div className="field-module">
          <div className="situation-strip"><div><span>Situation</span><strong>{downDistance(selected)}</strong></div><div><span>Ball on</span><strong>{ballOn(selected.yardline)}</strong></div><div><span>Game clock</span><strong>Q{selected.quarter} {selected.clock}</strong></div><div><span>Score before</span><strong>DUK {selected.scoreBefore.DUK} <span className="muted">/</span> NCS {selected.scoreBefore.NCS}</strong></div><div className="direction-label">NC STATE OFFENSE →</div></div>
          <TacticalField ballYardline={selected.yardline??drive.startYardline} lineToGain={selected.yardline!==null&&selected.distance!==null?selected.yardline+selected.distance:null} goalToGo={isGoal} kick={isKick||!selected.offensivePlay} playId={selected.id} animatedResult={replayable?{endYardline:end,label:replayLabel}:undefined}/>
          </div><div className="play-context"><div className="context-heading"><span>SELECTED PLAY</span><span className="mono">{String(index+1).padStart(2,'0')} / {drive.plays.length}</span></div>
          <div className="selected-description"><span className={`result-tag ${selected.result==='turnover-on-downs'||selected.result==='blocked-fg-return-touchdown'?'critical':''}`}>{resultLabel(selected.result)}</span><p>{selected.description}</p></div>
          <dl className="play-facts"><div><dt>Official gain</dt><dd>{selected.offensivePlay?`${signed(selected.yards)} yards`:'Special teams / admin'}</dd></div><div><dt>Drive ended</dt><dd>{resultLabel(drive.result)}</dd></div><div><dt>Evidence</dt><dd>{selected.nullified?'Nullified — no play':selected.offensivePlay?'Counted scrimmage play':selected.counts?'Special teams':'Administrative row'}</dd></div></dl>
          <div className="analysis-action"><span className="micro-note">{selected.result==='blocked-fg-return-touchdown'?'Return ends at the NC State goal. Kick flight and return path are not modeled.':!selected.offensivePlay?'Special teams and administrative rows are retained for context.':'Historical ball progression only. No inferred routes or player tracking.'}</span>{selected.offensivePlay?<a className="button primary" href={workspaceUrl('coordinator',readWorkspace({section:'coordinator',drive:drive.id,play:selected.id}))}>Analyze This Play <span aria-hidden="true">→</span></a>:<button className="button" disabled>Analysis: scrimmage plays only</button>}</div>
          </div></div>
        </section>
        <section className="pbp-panel" aria-label="Official play-by-play"><div className="panel-heading"><h2>Drive log <span className="muted">/</span> Q{drive.startQuarter} {drive.startClock} · {ballOn(drive.startYardline)} · {drive.officialPlays} plays · {signed(drive.netYards)} yd · {resultLabel(drive.result)}</h2><div className="play-navigation"><button aria-label="Previous play" disabled={index===0} onClick={()=>selectPlay(drive.plays[index-1])}>←</button><span className="mono">{index+1}/{drive.plays.length}</span><button aria-label="Next play" disabled={index===drive.plays.length-1} onClick={()=>selectPlay(drive.plays[index+1])}>→</button></div></div><div className="pbp-provenance"><SourceTag/><span>← / → to step through plays</span></div>
          <div className="play-scroll"><table className="play-table"><thead><tr><th>Q / Clock</th><th>Down &amp; dist.</th><th>Ball on</th><th>Type</th><th>Yds</th><th>Result / official description</th></tr></thead><tbody>{drive.plays.map(play=><tr key={play.id} className={`${play.id===selected.id?'selected ':''}${!play.counts?'non-counting':''}`} onClick={()=>selectPlay(play)} aria-current={play.id===selected.id?'true':undefined}><td><button className="play-select" aria-label={`Select play ${play.order}, Q${play.quarter} ${play.clock}, ${downDistance(play)}`} onClick={e=>{e.stopPropagation();selectPlay(play);}}><span className="muted">Q{play.quarter}</span> {play.clock}</button></td><td>{downDistance(play)}</td><td>{ballOn(play.yardline)}</td><td>{play.playType}<small>{!play.counts?(play.nullified?'NULLIFIED':'NOT COUNTED'):!play.offensivePlay?'SPECIAL TEAMS':''}</small></td><td>{play.offensivePlay?signed(play.yards):'—'}</td><td><span className={`result-tag ${play.result==='turnover-on-downs'?'critical':''}`}>{resultLabel(play.result)}</span><p>{play.description}</p></td></tr>)}</tbody></table></div>
          <div className="source-reference">SOURCE ROW <span className="mono">{selected.source.reference}</span></div>
        </section>
      </div>
    </div>
  </div>;
}
