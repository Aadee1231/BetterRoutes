import { useEffect, useRef, useState } from 'react';
import { legalActions, type Action } from '../engine';
import { ENDING_GROUPS, runBatch, type BatchResult } from '../engine/batch';
import { evidence, type Workspace } from '../utils/scenarios';
import { SimulationTag } from './SimulationTag';
export function BatchSummary({workspace:w}:{workspace:Workspace}) {
  const actual:Action|undefined=w.source?.offensivePlay?(w.source.playType==='pass'||w.source.playType==='sack'?'PASS':'RUN'):w.source?.playType==='punt'?'PUNT':w.source?.playType==='fg'?'FIELD_GOAL':undefined;
  const validActual=actual&&legalActions(w.situation,w.strategy).includes(actual)?actual:undefined;
  const key=JSON.stringify([w.situation,w.strategy,w.candidate,w.seed,validActual]);
  const [results,setResults]=useState<BatchResult[]>();const [running,setRunning]=useState(false);const [progress,setProgress]=useState(0);const [error,setError]=useState('');const controller=useRef<AbortController|null>(null);
  useEffect(()=>{controller.current?.abort();setResults(undefined);setRunning(false);setError('');return ()=>controller.current?.abort();},[key]);
  const run=async()=>{
    const current=new AbortController();controller.current=current;setRunning(true);setProgress(0);setError('');
    try {const result=await runBatch(w.situation,w.strategy,validActual?[w.candidate,validActual]:[w.candidate],w.seed,evidence,{signal:current.signal,onProgress:setProgress});if(!current.signal.aborted)setResults(result);}
    catch(error){if(!current.signal.aborted)setError(error instanceof Error?error.message:'Unable to run simulations');}
    finally{if(!current.signal.aborted)setRunning(false);}
  };
  return <section className="batch-summary" aria-label="500-run model comparison"><div className="panel-heading"><h2>500-run model comparison</h2><SimulationTag/></div><p>Same starting situation, strategy and 500 deterministically derived seeds per row. Only the first call differs; later calls use the coordinator. This is model vs model, not a historical success rate. Concepts share category distributions.</p><button className="button" disabled={running} onClick={run}>{running?`Running ${progress}/500…`:'Run 500 simulations'}</button>{error&&<p role="alert">{error}</p>}{results&&<><table className="batch-table"><thead><tr><th>Model's first call</th>{ENDING_GROUPS.map(g=><th key={g}>{g}</th>)}<th>Avg NCS points</th></tr></thead><tbody>{results.map((r,i)=><tr key={i}><th>{i===0?`Alternative: ${w.candidate}`:`Actual call category: ${validActual} (model)`}</th>{ENDING_GROUPS.map(g=><td key={g}>{Math.round(r.counts[g]/r.count*100)}%</td>)}<td>{r.averagePoints.toFixed(1)}</td></tr>)}</tbody></table><p className="batch-note">500 drives per row · percentages rounded to whole % (may not total 100%) · Other includes safety, clock expiry and play cap. Points include assumed PATs.</p></>}{!validActual&&<p className="batch-note">Actual call category unavailable or illegal in this starting situation; no model reference row is fabricated.</p>}</section>;
}
