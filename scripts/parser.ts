import { load, type CheerioAPI } from 'cheerio';
import type { Drive, Game, HistoricalPlay, TeamStats, PlayerStats } from '../src/types';

export const sourceUrl = 'https://gopack.com/sports/football/stats/2026/duke/boxscore/24545';
export const dukeUrl = 'https://goduke.com/sports/football/stats/2026/nc-state/boxscore/24830';
const ref = (url: string, reference: string) => ({ url, reference });
function rows($: CheerioAPI, table: number): string[][] {
  return $('table').eq(table).find('tr').toArray().map(r => $(r).find('th,td').toArray().map(c => $(c).text().trim().replace(/\s+/g, ' ')));
}
export function yardline(text: string, offense = 'NCS'): number {
  const match = /^(NCSU?|DUKE?)(\d+)$/.exec(text.replace(/\s/g, ''));
  if (!match) throw new Error(`Unknown field position: ${text}`);
  const team = match[1].startsWith('NCS') ? 'NCS' : 'DUK';
  return team === offense ? Number(match[2]) : 100 - Number(match[2]);
}
export function parseTeamStats(html: string, url: string): TeamStats[] {
  const $ = load(html);
  const table = rows($, 5);
  if (!table[0]?.includes('NCS')) throw new Error('Missing official team stats table');
  return (['NCS', 'DUK'] as const).map(team => {
    const col = table[0].indexOf(team);
    let section = '';
    const values: Record<string,string> = {};
    for (const r of table.slice(1)) {
      if (r.length === 1) section = r[0];
      else values[`${section}/${r[0]}`] = r[col];
    }
    const get = (key: string) => {
      if (values[key] === undefined) throw new Error(`Missing team stat ${key}`);
      return values[key];
    };
    const n = (key: string) => Number(get(key));
    const third = get('Miscellaneous/3rd. Down Conv.').split(' of ').map(Number);
    const pass = get('Passing/Comp.-Att.-Int.').split('-').map(Number);
    const fg = get('Miscellaneous/Field Goals: Total - Made').split('-').map(Number);
    return { team, firstDowns:n('First Downs/Total'), rushingYards:n('Rushing/Total (Net)'), rushingAttempts:n('Rushing/Attempts'),
      passingYards:n('Passing/Total (Net)'), passingAttempts:pass[1], completions:pass[0], totalYards:n('Total Offense/Yards'), offensivePlays:n('Total Offense/Plays'),
      thirdDownConversions:third[0], thirdDownAttempts:third[1], punts:Number(get('Punting/Punts - Yds.').split('-')[0]),
      fieldGoalsMade:fg[0], fieldGoalAttempts:fg[1], touchdowns:n('Rushing/Rushing TDs')+n('Passing/TDs'), officialRows:values, source:ref(url,'table[5]') };
  });
}
export function parseScore(html: string): { NCS:number; DUK:number } {
  const $ = load(html);
  const table = rows($,0);
  const score = (name: string) => {
    const r = table.find(r => r[0] === name);
    if (!r) throw new Error(`Missing scoreboard: ${name}`);
    return Number(r.at(-1));
  };
  return {NCS:score('NC State'),DUK:score('Duke')};
}
function classify(text: string): HistoricalPlay['playType'] {
  if (/drive start/i.test(text)) return 'drive-start';
  if (/^Timeout/.test(text)) return 'timeout';
  if (/^(End of|Start of)/i.test(text)) return 'period';
  if (/field goal attempt/.test(text)) return 'fg';
  if (/kickoff/.test(text)) return 'kickoff';
  if (/kick attempt/.test(text)) return 'pat';
  if (/ punt /.test(text)) return 'punt';
  if (/sacked/.test(text)) return 'sack';
  if (/kneel/i.test(text)) return 'kneel';
  if (/ pass /.test(text)) return 'pass';
  if (/ rush /.test(text)) return 'rush';
  if (/PENALTY/.test(text)) return 'penalty';
  if (/NO PLAY/.test(text)) return 'no-play';
  throw new Error(`Unrecognized PBP row: ${text}`);
}
function playYards(text: string, type: HistoricalPlay['playType']): number {
  if (!['rush','pass','sack','kneel'].includes(type) || /incomplete|NO PLAY/.test(text)) return 0;
  const match = /for (?:loss of )?(\d+) yards?(?: (gain|loss))?/.exec(text);
  if (!match) throw new Error(`Missing play yardage: ${text}`);
  return Number(match[1]) * (/for loss of/.test(text) || match[2] === 'loss' ? -1 : 1);
}
function participants(text: string): string[] {
  return [...new Set([...text.matchAll(/([\p{L}][\p{L}'’-]*(?: (?:Jr\.|III|II))?,[\p{L}][\p{L}'’-]*(?: ["“][\p{L}]+["”])?)/gu)].map(m=>m[1]))];
}
export function parseGame(html: string, verificationHtml: string): Game {
  const $ = load(html);
  const scoring: Game['scoring'] = rows($,1).filter(r => r.length === 7 && /^\d/.test(r[1])).map((r,i) => ({
    quarter:Number(r[1][0]), clock:r[3], team:r[2] as 'NCS'|'DUK', description:r[4], score:{DUK:Number(r[5]),NCS:Number(r[6])}, source:ref(sourceUrl,`table[1] scoring-row[${i}]`),
  }));
  const drives: Drive[] = rows($,2).filter(r=>r.length===10 && ['NCS','DUK'].includes(r[0])).map((r,i) => {
    const count = /^(\d+)-(-?\d+)$/.exec(r[8]);
    if (!count) throw new Error(`Invalid drive summary: ${r}`);
    return {id:`drive-${String(i+1).padStart(2,'0')}`,offensiveTeam:r[0] as 'NCS'|'DUK',startQuarter:Number(r[1]),startYardline:yardline(r[2],r[0]),startClock:r[3],endYardline:yardline(r[5],r[0]),endClock:r[6],result:r[7],officialPlays:Number(count[1]),netYards:Number(count[2]),timeOfPossession:r[9],plays:[],source:ref(sourceUrl,`table[2] drive-row[${i}]`)};
  });
  const panels = $('.s-expansion-panel__content').toArray().filter(p=>/NC State drive start|Duke drive start/.test($(p).text()));
  if (panels.length !== drives.length) throw new Error(`Drive/PBP mismatch ${panels.length}/${drives.length}`);
  panels.forEach((panel,index)=>{
    const drive = drives[index];
    let clock = drive.startClock;
    let quarter = drive.startQuarter;
    $(panel).find('div.my-0 > div').each((rowIndex,row)=>{
      const spans = $(row).children('span');
      const situationText = spans.eq(0).text();
      const description = spans.eq(1).text();
      if (!description) throw new Error(`Missing description ${drive.id}/${rowIndex}`);
      const situation = /^(\d)(?:st|nd|rd|th) and (\d+|Goal) at (\w+) - /.exec(situationText);
      const clockMatch = /^\((\d{2}:\d{2})\)|clock (\d{2}:\d{2})|start at (\d{2}:\d{2})/.exec(description);
      if (clockMatch) {
        const nextClock = clockMatch[1] ?? clockMatch[2] ?? clockMatch[3];
        if (nextClock > clock) quarter += 1;
        clock = nextClock;
      }
      const playType = classify(description);
      const nullified = /NO PLAY/.test(description);
      const counts = !nullified && !['drive-start','timeout','period','penalty','no-play'].includes(playType);
      const offensivePlay = counts && ['rush','pass','sack','kneel'].includes(playType);
      const field = situation ? yardline(situation[3],drive.offensiveTeam) : null;
      const prior = scoring.filter(s=>s.quarter<quarter || (s.quarter===quarter && (s.clock>clock||(s.clock===clock&&s.team!==drive.offensiveTeam&&playType!=='fg')))).at(-1);
      let scoreBefore = prior?.score ?? {NCS:0,DUK:0};
      if (playType==='kickoff' || playType==='pat' || playType==='period') {
        const same = scoring.find(s=>s.quarter===quarter && s.clock===clock);
        if (same) scoreBefore = playType==='pat' ? {...same.score,DUK:same.score.DUK-1} : same.score;
      }
      const penalty = /PENALTY (NCSU|DUKE).*? (\d+) yards from/.exec(description);
      const penaltyYards = penalty ? Number(penalty[2]) * ((penalty[1]==='NCSU'?'NCS':'DUK')===drive.offensiveTeam?-1:1) : 0;
      let result: string = playType;
      if (nullified) result='no-play';
      else if (/TURNOVER ON DOWNS/.test(description)) result='turnover-on-downs';
      else if (playType==='fg') result=/return 100 yards.*TOUCHDOWN/.test(description)?'blocked-fg-return-touchdown':/NO GOOD/.test(description)?'field-goal-missed':'field-goal-good';
      else if (/incomplete/.test(description)) result='incomplete';
      else if (/TOUCHDOWN/.test(description)) result='touchdown';
      else if (/1ST DOWN/.test(description)) result='first-down';
      else if (offensivePlay) result=playYards(description,playType)<0?'loss':'gain';
      drive.plays.push({id:`${drive.id}-row-${String(rowIndex+1).padStart(2,'0')}`,driveId:drive.id,order:rowIndex+1,quarter,clock,down:situation?Number(situation[1]):null,distance:situation?(situation[2]==='Goal'?100-field!:Number(situation[2])):null,yardline:field,playType,description,situationText,yards:playYards(description,playType),participants:participants(description),result,counts,nullified,offensivePlay,penaltyYards,scoreBefore:{...scoreBefore},source:ref(sourceUrl,`#${$(panel).attr('id')} div.my-0 > div:nth-of-type(${rowIndex+1})`)});
      if (/TOUCHDOWN/.test(description)) clock=/clock (\d{2}:\d{2})/.exec(description)?.[1]??clock;
    });
  });
  const nuxt = JSON.parse($('#__NUXT_DATA__').text()) as unknown[];
  const deref = (index:unknown) => typeof index==='number'&&index>=0?nuxt[index]:undefined;
  for (const [index,value] of nuxt.entries()) {
    if (!value||typeof value!=='object'||Array.isArray(value)) continue;
    const row=value as Record<string,unknown>;
    const description=deref(row.text);
    const playId=deref(row.playId);
    if (typeof description!=='string'||typeof playId!=='string'||!/ pass | rush |sacked|kneel/i.test(description)) continue;
    const drive=drives[Number(playId.split(',')[0])-1];
    if (!drive||drive.offensiveTeam!=='DUK'||drive.plays.some(p=>p.description===description)) continue;
    const clock=/\((\d{2}:\d{2})\)/.exec(description)?.[1];
    const spot=deref(row.spot);
    if (!clock||typeof spot!=='string') throw new Error(`Incomplete embedded Duke play ${index}`);
    const down=Number(deref(row.down));
    const distance=Number(deref(row.toGo));
    const quarter=drive.startQuarter+(clock>drive.startClock?1:0);
    const playType=classify(description);
    const nullified=description.includes('NO PLAY');
    const prior=scoring.filter(s=>s.quarter<quarter||(s.quarter===quarter&&s.clock>clock)).at(-1);
    drive.plays.push({id:`${drive.id}-embedded-${index}`,driveId:drive.id,order:0,quarter,clock,down,distance,yardline:yardline(spot,'DUK'),playType,description,
      situationText:`${down} and ${distance} at ${spot}`,yards:playYards(description,playType),participants:participants(description),
      result:nullified?'no-play':description.includes('TOUCHDOWN')?'touchdown':description.includes('incomplete')?'incomplete':description.includes('1ST DOWN')?'first-down':'gain',
      counts:!nullified,nullified,offensivePlay:!nullified,penaltyYards:0,scoreBefore:{...(prior?.score??{NCS:0,DUK:0})},source:ref(sourceUrl,`#__NUXT_DATA__ JSON[${index}]`)});
  }
  for (const drive of drives.filter(d=>d.offensiveTeam==='DUK')) {
    drive.plays.sort((a,b)=>a.quarter-b.quarter||b.clock.localeCompare(a.clock));
    drive.plays.forEach((p,i)=>{p.order=i+1;});
  }
  const playerStats: PlayerStats[] = [];
  for (const [table,category] of [[7,'passing'],[9,'rushing'],[11,'receiving']] as const) {
    const data = rows($,table);
    for (const [i,r] of data.slice(1).entries()) {
      if (r[0]==='Totals') continue;
      playerStats.push({name:r[0],category,stats:Object.fromEntries(r.slice(1).map((v,j)=>[data[0][j+1],Number(v)])),source:ref(sourceUrl,`table[${table}] player-row[${i}]`)});
    }
  }
  const pageText = $('body').text();
  const date = /Date:\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(pageText);
  if (!date) throw new Error('Missing official game date');
  const attendance = /Attendance:\s*(\d+)/.exec(pageText);
  if (!pageText.includes('Carter-Finley Stadium')) throw new Error('Missing stadium');
  return {id:'duke-ncstate-2026-11-07',date:`${date[3]}-${date[1]}-${date[2]}`,homeTeam:'NCS',awayTeam:'DUK',teams:{NCS:'NC State',DUK:'Duke'},score:parseScore(html),stadium:'Carter-Finley Stadium',attendance:attendance?Number(attendance[1]):null,
    sources:[ref(sourceUrl,'Official box score, team/player stats, drive chart and play-by-play'),ref(dukeUrl,'Independent official box score cross-check')],teamStats:parseTeamStats(html,sourceUrl),playerStats,scoring,drives,
    verification:{score:parseScore(verificationHtml),teamStats:parseTeamStats(verificationHtml,dukeUrl),source:ref(dukeUrl,'table[0] and table[5]')},
    notes:['All 11 NC State possessions retain every panel row. All 70 Duke scrimmage plays are imported as secondary opponent evidence. Nine Duke plays in quarter-spanning drives are recovered from embedded structured Nuxt records because rendered drive panels omit continuations.',
      'NCAA sacks count as rushing attempts and negative rushing yards. Nullified plays are excluded from offensive totals. Penalty yards are separate from play yards.',
      'Official drive chart counts differ from offensive-play counts: field goal attempts are included, while punts and nullified plays are excluded. Drive net yards include accepted penalties.',
      'The blocked field goal is described as NO GOOD plus a 100-yard touchdown return in play-by-play, and explicitly as a blocked field goal in the scoring summary.',
      'The source labels the first-half end as End of game; that row is preserved verbatim and belongs to quarter 2. Non-timed administrative rows inherit the preceding clock.',
      'Date is the official game date November 7, 2026. Field position is offense-own-goal=0, opponent-goal=100. Official descriptions preserve source text; schematic routes are not tracking data.'],
  };
}
