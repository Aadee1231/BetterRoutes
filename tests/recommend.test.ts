import { describe, expect, it } from 'vitest';
import { game } from '../src/data';
import type { GameSituation } from '../src/types';
import { buildEvidence, freeze, distanceBucket } from '../src/engine/evidence';
import { fieldGoalChance, MODEL_VERSION, pickConcept, recommend } from '../src/engine/recommend';
import { PRIORS } from '../src/engine/priors';
import type { Action, Strategy } from '../src/engine/types';

const evidence=buildEvidence(game);
const situation:GameSituation={down:4,distance:1,yardline:40,quarter:3,clock:'06:13',offensiveScore:3,defensiveScore:31,goalToGo:false};
describe('statistical coordinator',()=>{
  it('imports separately labeled, immutable NC State and opponent scrimmage evidence',()=>{
    const original=JSON.stringify(game);
    expect(evidence.plays.filter(p=>p.team==='NCS')).toHaveLength(56);
    expect(evidence.plays.filter(p=>p.team==='DUK')).toHaveLength(70);
    expect(Object.isFrozen(evidence.plays[0])).toBe(true);
    recommend(situation,'balanced',evidence);
    expect(JSON.stringify(game)).toBe(original);
  });
  it('changes ranking and utility with real strategy weights and game context',()=>{
    const results=(['balanced','aggressive','conservative'] as Strategy[]).map(s=>recommend(situation,s,evidence));
    expect(new Set(results.map(r=>r.ranked.map(c=>c.action).join(','))).size).toBeGreaterThan(1);
    expect(results[0].selected.utility).not.toBe(results[1].selected.utility);
    expect(recommend({...situation,down:1,distance:10},'balanced',evidence).selected.concept).not.toBe(results[0].selected.concept);
    expect(recommend({...situation,offensiveScore:35,defensiveScore:3},'balanced',evidence).ranked.find(c=>c.action==='RUN')!.utility).toBeLessThan(results[0].ranked.find(c=>c.action==='RUN')!.utility);
  });
  it('filters illegal kicks and documents field-position restrictions',()=>{
    for (const down of [1,2,3]) expect(recommend({...situation,down,yardline:90},'balanced',evidence).ranked.map(c=>c.action)).toEqual(expect.arrayContaining(['RUN','PASS']));
    expect(recommend({...situation,down:2},'balanced',evidence).ranked).toHaveLength(2);
    expect(recommend(situation,'balanced',evidence).ranked.some(c=>c.action==='FIELD_GOAL')).toBe(false);
    expect(recommend({...situation,yardline:80},'balanced',evidence).ranked.map(c=>c.action)).not.toContain('PUNT');
    expect(recommend({...situation,yardline:80},'conservative',evidence).ranked.map(c=>c.action)).toContain('PUNT');
  });
  it('uses bucketed beta-binomial shrinkage with explicit metric provenance',()=>{
    const r=recommend(situation,'balanced',evidence);
    for (const c of r.ranked.filter(c=>c.action==='RUN'||c.action==='PASS')) {
      const e=c.evidence;
      expect(c.success.value).toBeCloseTo(((e.observedRate?.value??0)*e.weightedN+PRIORS.strength.value*e.prior.value)/(e.weightedN+PRIORS.strength.value));
      expect(e.weight.value).toBeCloseTo(e.weightedN/(e.weightedN+12));
      expect(e.weightedN).toBeCloseTo(e.n+0.35*e.opponentN);
      expect(c.distribution.reduce((s,o)=>s+o.probability,0)).toBeCloseTo(1);
      expect(c.success.source).toBe('calculated'); expect(e.prior.source).toBe('assumed'); expect(e.observedRate?.source).toBe('observed');
    }
    expect(distanceBucket(3)).toBe('short');expect(distanceBucket(4)).toBe('medium');expect(distanceBucket(7)).toBe('long');
  });
  it('survives empty evidence and labels heuristic-only kicks honestly',()=>{
    const r=recommend({...situation,yardline:80},'balanced',{plays:[]});
    expect(r.details.sampleSizes).toEqual({NCS:0,opponent:0});
    for (const c of r.ranked) {expect(Number.isFinite(c.utility)).toBe(true);expect(c.evidence.observedRate).toBeNull();}
    const fg=r.ranked.find(c=>c.action==='FIELD_GOAL')!;
    expect(fg.success.source).toBe('assumed');expect(fg.success.value).toBe(fieldGoalChance(80));
    expect(fieldGoalChance(90)).toBeGreaterThan(fieldGoalChance(60));
  });
  it('rounds all displayed probabilities to 5% without fabricated decimal precision',()=>{
    for (const c of recommend(situation,'balanced',evidence).ranked) {
      for (const m of [c.success,c.conversion,c.evidence.prior,c.evidence.weight,c.evidence.observedRate].filter(m=>m!==null)) {
        expect(m.display).toMatch(/^~\d+%$/);expect(Number(m.display.slice(1,-1))%5).toBe(0);
      }
      expect(Number.isInteger(c.yards.value)).toBe(true);
    }
  });
  it('explains actual inputs and the top-ranked category without concept-level statistical claims',()=>{
    const r=recommend(situation,'aggressive',evidence);
    expect(r.explanation).toContain('4th and 1 at own 40');expect(r.explanation).toContain('Q3 06:13');
    expect(r.explanation).toContain(r.selected.concept);expect(r.explanation).toContain(r.selected.action);
    expect(r.explanation).toContain(r.selected.success.display);expect(r.explanation).toContain(r.selected.utility.toFixed(2));
    expect(r.modelVersion).toBe(MODEL_VERSION);expect(r.details.limitations.join(' ')).toContain('not measured concept effectiveness');
    expect(r.ranked.map(c=>c.utility)).toEqual([...r.ranked.map(c=>c.utility)].sort((a,b)=>b-a));
  });
  it('selects every playbook concept by situational rules independently of broad-action evidence',()=>{
    const concepts=new Set<string>();
    for (const action of ['RUN','PASS','PUNT','FIELD_GOAL'] as Action[]) for (const strategy of ['balanced','aggressive','conservative'] as Strategy[]) for (const down of [1,2,3,4]) for (const distance of [1,5,10]) for (const yardline of [30,70]) concepts.add(pickConcept(action,{...situation,down,distance,yardline},strategy));
    expect(concepts.size).toBe(11);
    expect(()=>recommend(situation,'invalid' as Strategy,evidence)).toThrow();
    expect(()=>{(freeze(structuredClone(evidence)).plays as unknown[]).push({});}).toThrow();
  });
});
