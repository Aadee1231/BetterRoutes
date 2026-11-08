import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { game } from '../src/data';
import { validateGame } from '../src/data/validate';
import { dataIntegrityErrors, observedTotals } from '../src/data/integrity';
import { parseGame, parseTeamStats, sourceUrl, yardline } from '../scripts/parser';

const html = readFileSync(new URL('../scripts/raw/gopack.html',import.meta.url),'utf8');
const duke = readFileSync(new URL('../scripts/raw/goduke.html',import.meta.url),'utf8');
describe('official game dataset',()=>{
  it('reproduces the committed dataset from both raw official pages',()=>{
    expect(validateGame(parseGame(html,duke))).toEqual(game);
  });
  it('matches both official team tables and parsed play sums',()=>{
    expect(dataIntegrityErrors(game)).toEqual([]);
    expect(observedTotals(game)).toEqual({totalYards:217,passingYards:185,rushingYards:32,offensivePlays:56,firstDowns:12,thirdDownConversions:3,thirdDownAttempts:14,punts:7,fieldGoalsMade:1,touchdowns:0});
  });
  it('has complete source rows for all 11 possessions with verbatim descriptions',()=>{
    const $=load(html);
    const drives=game.drives.filter(d=>d.offensiveTeam==='NCS');
    expect(drives).toHaveLength(11);
    for (const p of drives.flatMap(d=>d.plays)) {
      const node=$(p.source.reference);
      expect(node).toHaveLength(1);
      expect(node.children('span').eq(1).text()).toBe(p.description);
      expect(node.children('span').eq(0).text()).toBe(p.situationText);
      expect(p.participants.every(n=>node.text().includes(n))).toBe(true);
    }
    expect(drives.flatMap(d=>d.plays)).toHaveLength(85);
  });
  it('includes the failed fourth-and-one at the own 40 and blocked FG touchdown',()=>{
    const plays=game.drives.filter(d=>d.offensiveTeam==='NCS').flatMap(d=>d.plays);
    expect(plays.find(p=>p.quarter===3&&p.down===4&&p.distance===1&&p.yardline===40)).toMatchObject({yards:0,result:'turnover-on-downs',scoreBefore:{NCS:3,DUK:31}});
    expect(plays.find(p=>p.result==='blocked-fg-return-touchdown')).toMatchObject({playType:'fg',scoreBefore:{NCS:3,DUK:24}});
    expect(game.scoring.find(s=>s.description.includes('blocked field goal return'))).toMatchObject({quarter:2,clock:'00:00',score:{NCS:3,DUK:31}});
  });
  it('retains nullified rows but excludes them from offensive totals and accounts for sacks as rushes',()=>{
    const plays=game.drives.filter(d=>d.offensiveTeam==='NCS').flatMap(d=>d.plays);
    expect(plays.filter(p=>p.nullified)).toHaveLength(2);
    expect(plays.filter(p=>p.nullified).every(p=>!p.counts&&!p.offensivePlay)).toBe(true);
    expect(plays.filter(p=>p.playType==='sack').reduce((s,p)=>s+p.yards,0)).toBe(-17);
    expect(plays.filter(p=>p.offensivePlay&&p.playType==='rush').reduce((s,p)=>s+p.yards,0)).toBe(49);
  });
  it('parses the actual date, venue, attendance and NC State player totals',()=>{
    expect(game).toMatchObject({date:'2026-11-07',stadium:'Carter-Finley Stadium',attendance:56919});
    expect(game.playerStats.filter(p=>p.category==='passing').reduce((s,p)=>s+p.stats['Yds.'],0)).toBe(185);
    expect(game.playerStats.filter(p=>p.category==='rushing').reduce((s,p)=>s+p.stats.Net,0)).toBe(32);
    expect(game.playerStats.filter(p=>p.category==='receiving').reduce((s,p)=>s+p.stats['Yds.'],0)).toBe(185);
  });
  it('recovers all Duke scrimmage plays including quarter-spanning structured continuations',()=>{
    const $=load(html);
    const nuxt=JSON.parse($('#__NUXT_DATA__').text());
    const plays=game.drives.filter(d=>d.offensiveTeam==='DUK').flatMap(d=>d.plays).filter(p=>p.offensivePlay);
    expect(plays).toHaveLength(70);
    expect(plays.reduce((s,p)=>s+p.yards,0)).toBe(461);
    expect(plays.filter(p=>p.playType==='pass').reduce((s,p)=>s+p.yards,0)).toBe(223);
    const embedded=plays.filter(p=>p.source.reference.includes('JSON['));
    expect(embedded).toHaveLength(9);
    for (const play of embedded) {
      const index=Number(/JSON\[(\d+)\]/.exec(play.source.reference)![1]);
      expect(nuxt[nuxt[index].text]).toBe(play.description);
      expect(Number(nuxt[nuxt[index].down])).toBe(play.down);
      expect(Number(nuxt[nuxt[index].toGo])).toBe(play.distance);
    }
    expect(embedded.some(p=>p.quarter===4)).toBe(true);
    expect(embedded.some(p=>p.quarter===2)).toBe(true);
  });
  it('rejects empty or structurally invalid data and missing official tables',()=>{
    expect(()=>validateGame({})).toThrow();
    expect(()=>validateGame({...game,drives:[{...game.drives[0],startYardline:101}]})).toThrow();
    expect(()=>parseGame('',duke)).toThrow();
    expect(()=>parseTeamStats('',sourceUrl)).toThrow();
  });
  it('detects altered historical totals and membership',()=>{
    const bad=structuredClone(game);
    bad.drives[1].plays[1].yards+=1;
    bad.drives[1].plays[1].driveId='wrong';
    expect(dataIntegrityErrors(bad)).toContain('Wrong drive: drive-02-row-02');
    expect(dataIntegrityErrors(bad).some(s=>s.includes('Parsed plays totalYards'))).toBe(true);
  });
  it('converts field positions without ambiguous orientation',()=>{
    expect(yardline('NCS25')).toBe(25); expect(yardline('DUK34')).toBe(66);
    expect(yardline('NCSU40','DUK')).toBe(60); expect(yardline('DUKE18','DUK')).toBe(18);
    expect(()=>yardline('???')).toThrow();
  });
});
