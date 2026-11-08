import { describe, expect, it } from 'vitest';
import { game } from '../src/data';
import type { GameSituation } from '../src/types';
import { advanceSituation, continueDrive, createSimulation, nextRandom, simulatePlay } from '../src/engine/sim';
import { buildEvidence, normalizeSituation } from '../src/engine/evidence';
import { recommend } from '../src/engine/recommend';
import type { Strategy } from '../src/engine/types';

const evidence=buildEvidence(game);
const s:GameSituation={down:4,distance:1,yardline:40,quarter:3,clock:'06:13',offensiveScore:3,defensiveScore:31,goalToGo:false};
describe('immutable drive simulator',()=>{
  it('converts a first down and resets the line to gain',()=>{
    const r=advanceSituation({...s,down:2,distance:5},{kind:'gain',yards:7});
    expect(r).toMatchObject({converted:true,result:null,situation:{down:1,distance:10,yardline:47,goalToGo:false}});
  });
  it('handles incompletions, negative runs, sacks and third-down failure',()=>{
    expect(advanceSituation({...s,down:1,distance:10},{kind:'incomplete',yards:0}).situation).toMatchObject({down:2,distance:10,yardline:40});
    expect(advanceSituation({...s,down:2,distance:5},{kind:'gain',yards:-3}).situation).toMatchObject({down:3,distance:8,yardline:37});
    expect(advanceSituation({...s,down:3,distance:5},{kind:'sack',yards:-7}).situation).toMatchObject({down:4,distance:12,yardline:33});
    expect(advanceSituation({...s,down:3,distance:5},{kind:'gain',yards:4})).toMatchObject({result:null,situation:{down:4,distance:1}});
  });
  it('ends on failed fourth down without generating fifth down',()=>{
    expect(advanceSituation(s,{kind:'gain',yards:0})).toMatchObject({result:'downs',situation:{down:4,distance:1}});
  });
  it('handles touchdowns with assumed PAT, safety, turnovers and boundaries',()=>{
    expect(advanceSituation({...s,yardline:98,distance:2,goalToGo:true},{kind:'gain',yards:10})).toMatchObject({result:'touchdown',situation:{yardline:100,offensiveScore:10}});
    expect(advanceSituation({...s,yardline:2},{kind:'sack',yards:-7})).toMatchObject({result:'safety',situation:{yardline:0,defensiveScore:33}});
    expect(advanceSituation(s,{kind:'turnover',yards:0}).result).toBe('turnover');
    expect(advanceSituation({...s,yardline:97,distance:3,goalToGo:true,down:1},{kind:'gain',yards:1}).situation).toMatchObject({distance:2,goalToGo:true,yardline:98,down:2});
    expect(advanceSituation({...s,yardline:85,distance:10,down:2},{kind:'gain',yards:10}).situation).toMatchObject({down:1,distance:5,goalToGo:true});
  });
  it('ends possession on punts and made/missed field goals, enforcing legality',()=>{
    expect(simulatePlay(createSimulation(s),'Punt',evidence)).toMatchObject({complete:true,driveResult:'punt'});
    expect(advanceSituation(s,{kind:'field-goal-made',yards:0})).toMatchObject({result:'field-goal-made',situation:{offensiveScore:6}});
    expect(advanceSituation(s,{kind:'field-goal-missed',yards:0}).result).toBe('field-goal-missed');
    const results=new Set(Array.from({length:100},(_,seed)=>simulatePlay(createSimulation({...s,yardline:65},'balanced',seed),'Field Goal',evidence).driveResult));
    expect(results).toEqual(new Set(['field-goal-made','field-goal-missed']));
    expect(()=>simulatePlay(createSimulation({...s,down:1}),'PUNT',evidence)).toThrow('Illegal');
    expect(()=>simulatePlay(createSimulation(s),'FIELD_GOAL',evidence)).toThrow('Illegal');
  });
  it('applies clock runoff across quarters and stops at halftime/fulltime',()=>{
    expect(advanceSituation({...s,quarter:1,clock:'00:10',down:1},{kind:'gain',yards:1}).situation).toMatchObject({quarter:2,clock:'14:40'});
    expect(advanceSituation({...s,quarter:2,clock:'00:10',down:1},{kind:'gain',yards:1}).result).toBe('half-end');
    expect(advanceSituation({...s,quarter:4,clock:'00:10',down:1},{kind:'gain',yards:1}).result).toBe('game-end');
    expect(advanceSituation({...s,quarter:2,clock:'00:25',down:1},{kind:'gain',yards:1},true)).toMatchObject({result:null,situation:{clock:'00:01'}});
  });
  it('is reproducible, immutable and can be replayed from the seed',()=>{
    const initial=createSimulation(s,'aggressive',42);const snapshot=JSON.stringify(initial);
    const a=continueDrive(initial,evidence);const b=continueDrive(createSimulation(s,'aggressive',42),evidence);
    expect(a).toEqual(b);expect(JSON.stringify(initial)).toBe(snapshot);expect(Object.isFrozen(a.plays)).toBe(true);
    expect(simulatePlay(a,'RUN',evidence)).toBe(a);
    expect(nextRandom(42)).toEqual(nextRandom(42));
  });
  it('can succeed and fail across fixed seeds and samples all outcome categories',()=>{
    const outcomes=new Set<string>();let converted=false;let failed=false;
    for (let seed=0;seed<1000;seed++) {
      const result=simulatePlay(createSimulation(s,'balanced',seed),seed%2?'PASS':'RUN',{plays:[]});
      outcomes.add(result.plays[0].outcome); converted ||= result.plays[0].converted; failed ||= result.driveResult==='downs';
    }
    expect(converted&&failed).toBe(true);expect(outcomes.has('turnover')).toBe(true);
    expect(outcomes.has('gain')).toBe(true);expect(outcomes.has('downs')).toBe(true);
  });
  it('continues using recommendation policy, bounds play count, and handles missing evidence',()=>{
    const initial=createSimulation({...s,down:1},'balanced',123);
    const next=continueDrive(initial,{plays:[]},1);
    expect(next.plays[0].concept).toBe(recommend(initial.currentSituation,'balanced',{plays:[]}).selected.concept);
    expect(next.complete).toBe(true);expect(next.plays).toHaveLength(1);
    expect(()=>continueDrive(initial,evidence,0)).toThrow();
    expect(()=>createSimulation(s,'balanced',NaN)).toThrow();
    expect(()=>advanceSituation(s,{kind:'gain',yards:NaN})).toThrow();
  });
  it('keeps thousands of random situations and seeded drives valid',()=>{
    let rng=73;
    const random=()=>{const r=nextRandom(rng);rng=r.state;return r.value;};
    const valid=(state:Readonly<GameSituation>)=>{
      expect(state.down>=1&&state.down<=4).toBe(true);expect(state.distance>=1).toBe(true);
      expect(state.yardline>=0&&state.yardline<=100).toBe(true);
      expect(state.goalToGo).toBe(state.distance===Math.max(1,100-state.yardline));
      if (state.goalToGo) expect(state.distance).toBe(Math.max(1,100-state.yardline));
      expect(state.clock).toMatch(/^\d{2}:[0-5]\d$/);
    };
    for (let i=0;i<3000;i++) {
      const input={...s,down:1+Math.floor(random()*4),distance:1+Math.floor(random()*50),yardline:Math.floor(random()*101),quarter:1+Math.floor(random()*4),clock:`${String(Math.floor(random()*15)).padStart(2,'0')}:30`,goalToGo:random()<0.2};
      const strategy=(['balanced','aggressive','conservative'] as Strategy[])[i%3];
      const initial=createSimulation(input,strategy,i);
      valid(initial.currentSituation);
      const result=i%10===0?continueDrive(initial,evidence):simulatePlay(initial,recommend(initial.currentSituation,strategy,evidence).selected.concept,evidence);
      for (const play of result.plays) {valid(play.before);valid(play.after);}
    }
    expect(normalizeSituation({...s,down:9,distance:-10,yardline:Infinity}).down).toBe(4);
  });
});
