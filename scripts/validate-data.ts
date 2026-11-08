import { readFile } from 'node:fs/promises';
import { validateGame } from '../src/data/validate';
import { dataIntegrityErrors, observedTotals } from '../src/data/integrity';

const game = validateGame(JSON.parse(await readFile(new URL('../src/data/game.json',import.meta.url),'utf8')));
const errors = dataIntegrityErrors(game);
if (errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
else {
  console.log('PASS: Duke 41–3 NC State; both official sources and parsed plays agree on all required totals.');
  console.log(JSON.stringify(observedTotals(game)));
  console.log('PASS: chronological rows, drive membership, field positions, source references and participant text.');
  console.table(game.drives.filter(d=>d.offensiveTeam==='NCS').map(d=>({drive:d.id,quarter:d.startQuarter,start:d.startYardline,plays:d.officialPlays,net:d.netYards,result:d.result})));
}
