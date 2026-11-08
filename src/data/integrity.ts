import type { Game } from '../types';

export function observedTotals(game: Game) {
  const plays = game.drives.filter(d=>d.offensiveTeam==='NCS').flatMap(d=>d.plays);
  const offense = plays.filter(p=>p.offensivePlay);
  const third = offense.filter(p=>p.down===3);
  return {
    totalYards: offense.reduce((s,p)=>s+p.yards,0),
    passingYards: offense.filter(p=>p.playType==='pass').reduce((s,p)=>s+p.yards,0),
    rushingYards: offense.filter(p=>['rush','sack','kneel'].includes(p.playType)).reduce((s,p)=>s+p.yards,0),
    offensivePlays: offense.length,
    firstDowns: plays.filter(p=>/1ST DOWN/.test(p.description)).length,
    thirdDownConversions: third.filter(p=>p.yards >= p.distance!).length,
    thirdDownAttempts: third.length,
    punts: plays.filter(p=>p.counts&&p.playType==='punt').length,
    fieldGoalsMade: plays.filter(p=>p.result==='field-goal-good').length,
    touchdowns: offense.filter(p=>/TOUCHDOWN/.test(p.description)).length,
  };
}

export function dataIntegrityErrors(game: Game): string[] {
  const errors: string[] = [];
  const check = (condition:boolean,message:string) => { if (!condition) errors.push(message); };
  check(game.score.NCS===3&&game.score.DUK===41,'Final score must be Duke 41, NC State 3');
  check(JSON.stringify(game.score)===JSON.stringify(game.verification.score),'Independent official scoreboard mismatch');
  const expected = { totalYards:217, passingYards:185, rushingYards:32, offensivePlays:56, firstDowns:12, thirdDownConversions:3, thirdDownAttempts:14, punts:7, fieldGoalsMade:1, touchdowns:0 };
  const calculated = observedTotals(game);
  const official = game.teamStats.find(t=>t.team==='NCS');
  const verification = game.verification.teamStats.find(t=>t.team==='NCS');
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    check(official?.[key]===expected[key],`Official ${key}: ${official?.[key]} != ${expected[key]}`);
    check(verification?.[key]===expected[key],`Duke official ${key}: ${verification?.[key]} != ${expected[key]}`);
    check(calculated[key]===expected[key],`Parsed plays ${key}: ${calculated[key]} != ${expected[key]}`);
  }
  for (const team of game.teamStats) {
    const other = game.verification.teamStats.find(t=>t.team===team.team);
    for (const key of Object.keys(team) as (keyof typeof team)[]) {
      if (key!=='source'&&key!=='officialRows') check(team[key]===other?.[key],`Cross-source mismatch ${team.team}/${key}`);
    }
    if (team.team==='DUK') {
      const plays=game.drives.filter(d=>d.offensiveTeam==='DUK').flatMap(d=>d.plays).filter(p=>p.offensivePlay);
      check(plays.length===team.offensivePlays,'Duke parsed offensive-play count mismatch');
      check(plays.reduce((s,p)=>s+p.yards,0)===team.totalYards,'Duke parsed total yards mismatch');
      check(plays.filter(p=>p.playType==='pass').reduce((s,p)=>s+p.yards,0)===team.passingYards,'Duke parsed pass yards mismatch');
      check(plays.filter(p=>p.playType!=='pass').reduce((s,p)=>s+p.yards,0)===team.rushingYards,'Duke parsed rush yards mismatch');
    }
  }
  let previousDrive = -1;
  const elapsed = (q:number,c:string) => (q-1)*900+900-Number(c.slice(0,2))*60-Number(c.slice(3));
  const ids = new Set<string>();
  for (const drive of game.drives) {
    const start = elapsed(drive.startQuarter,drive.startClock);
    check(start>=previousDrive,`Drives not chronological: ${drive.id}`);
    previousDrive=start;
    let previous = start;
    for (const [index,play] of drive.plays.entries()) {
      check(!ids.has(play.id),`Duplicate play: ${play.id}`); ids.add(play.id);
      check(play.driveId===drive.id,`Wrong drive: ${play.id}`);
      check(play.order===index+1,`Invalid play order: ${play.id}`);
      check(play.source.reference.length>0&&play.source.url.startsWith('https://'),`Missing source: ${play.id}`);
      check(play.participants.every(name=>play.description.includes(name)),`Unsourced player: ${play.id}`);
      const time = elapsed(play.quarter,play.clock);
      check(time>=previous,`Plays not chronological: ${play.id}`); previous=time;
      check(play.down!==null&&play.down>=1&&play.down<=4,`Invalid down: ${play.id}`);
      check(play.distance!==null&&play.distance>=0&&play.distance<=100,`Invalid distance: ${play.id}`);
      check(play.yardline!==null&&play.yardline>=0&&play.yardline<=100,`Invalid yardline: ${play.id}`);
      check(!(play.nullified&&play.counts),`Nullified play counted: ${play.id}`);
    }
    if (drive.offensiveTeam==='NCS') {
      const net = drive.plays.reduce((s,p)=>s+(p.offensivePlay?p.yards:0)+p.penaltyYards,0);
      check(net===drive.netYards,`Drive yardage mismatch: ${drive.id} ${net}/${drive.netYards}`);
      check(drive.endYardline-drive.startYardline===net,`Drive position mismatch: ${drive.id}`);
    }
  }
  return errors;
}
