import { describe, expect, it } from 'vitest';
import { ballPosition, CATCH_TIME, flightArc, playerPosition, quadratic, releaseTime } from '../src/components/plays/motion';
import { PLAY_TEMPLATES } from '../src/components/plays/templates';
import { runBatch } from '../src/engine/batch';
import { evidence, historicalPlay, officialSituation } from '../src/utils/scenarios';
import { resultLabel } from '../src/utils/football';

describe('schematic ball ownership and flight',()=>{
  for(const template of Object.values(PLAY_TEMPLATES))it(`${template.concept}: snap, transfer, flight/lane and finish remain synchronized`,()=>{
    expect(ballPosition(template,0)).toEqual([-1,0]);
    if(template.kind==='pass'){
      expect(ballPosition(template,.1)).toEqual([-5,0]);
      const release=releaseTime(template),t=(release+CATCH_TIME)/2;
      ballPosition(template,t).forEach((value,i)=>expect(value).toBeCloseTo(quadratic(...flightArc(template),.5)[i]));
      const receiver=template.players.find(p=>p.target)!;
      for(const t of [CATCH_TIME,.9,1])expect(ballPosition(template,t)).toEqual(playerPosition(template,receiver,t));
      if(release===.5)expect(ballPosition(template,.3)).not.toEqual([-5,0]);
    }else if(template.kind==='run'){
      expect(ballPosition(template,.1)).toEqual([-5,0]);
      const rb=template.players.find(p=>p.position==='RB')!;
      for(const t of [.25,.5,1])expect(ballPosition(template,t)).toEqual(playerPosition(template,rb,t));
    }else{
      expect(ballPosition(template,.1)).toEqual(flightArc(template)[0]);
      ballPosition(template,.65).forEach((value,i)=>expect(value).toBeCloseTo(quadratic(...flightArc(template),.5)[i]));
      expect(ballPosition(template,1)).toEqual(flightArc(template)[2]);
    }
    for(let i=0;i<=100;i++)expect(ballPosition(template,i/100).every(Number.isFinite)).toBe(true);
    const project=([x,y]:readonly [number,number]):readonly [number,number]=>[Math.max(-10,Math.min(9,x)),y];
    if(template.kind==='pass'||template.kind==='kick'){
      const arc=flightArc(template).map(project);
      const release=template.kind==='kick'?.3:releaseTime(template),end=template.kind==='kick'?1:CATCH_TIME;
      const midpoint=ballPosition(template,(release+end)/2,project);
      const expected=quadratic(arc[0],arc[1],arc[2],.5);
      midpoint.forEach((value,i)=>expect(value).toBeCloseTo(expected[i]));
    }
    const carrier=template.players.find(p=>template.kind==='run'?p.position==='RB':p.target);
    if(carrier)expect(ballPosition(template,.9,project)).toEqual(playerPosition(template,carrier,.9,project));
  });
  it('formats historical and simulated drive endings consistently',()=>{
    expect(resultLabel('PUNT')).toBe(resultLabel('punt'));expect(resultLabel('DOWNS')).toBe(resultLabel('downs'));
    expect(resultLabel('field-goal-made')).toBe('Field goal');expect(resultLabel('field-goal-missed')).toBe('Missed FG');
  });
});
describe('chunked model-versus-model batches',()=>{
  const situation=officialSituation(historicalPlay('drive-13-row-07')!);
  it('runs 500 reproducible paired seeds with equal category outcomes and yields between chunks',async()=>{
    let yields=0;
    const options={yieldControl:async()=>{yields++;}};
    const a=await runBatch(situation,'balanced',['Inside Zone','RUN'],42,evidence,options);
    const b=await runBatch(situation,'balanced',['Inside Zone','RUN'],42,evidence,options);
    expect(a).toEqual(b);expect(a[0]).toEqual(a[1]);expect(yields).toBe(250);
    expect(Object.values(a[0].counts).reduce((a,b)=>a+b,0)).toBe(500);
    expect(a[0].averagePoints).toBeGreaterThanOrEqual(0);
  });
  it('handles empty choices, cancellation and illegal calls without fabricated results',async()=>{
    expect(await runBatch(situation,'balanced',[],42,evidence)).toEqual([]);
    await expect(runBatch(situation,'balanced',['RUN'],42,evidence,{count:0})).rejects.toThrow('1–500');
    const controller=new AbortController();controller.abort();
    await expect(runBatch(situation,'balanced',['RUN'],42,evidence,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
    await expect(runBatch({...situation,down:1},'balanced',['PUNT'],42,evidence)).rejects.toThrow('Illegal action');
  });
});
