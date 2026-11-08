import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseGame, sourceUrl, dukeUrl } from './parser';
import { validateGame } from '../src/data/validate';

const raw = new URL('./raw/', import.meta.url);
await mkdir(raw, { recursive:true });
const offline = process.argv.includes('--offline');
async function source(url: string, name: string) {
  const path = new URL(name,raw);
  if (offline) return readFile(path,'utf8');
  const response = await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 BetterRoutes local data ingestion'}});
  if (!response.ok) throw new Error(`Source HTTP ${response.status}: ${url}; use --offline with committed cache`);
  const html = await response.text();
  if (!html.includes('Total Offense')) throw new Error(`Source is not a box score: ${url}`);
  await writeFile(path,html);
  return html;
}
const [html,duke] = await Promise.all([source(sourceUrl,'gopack.html'),source(dukeUrl,'goduke.html')]);
const game = validateGame(parseGame(html,duke));
const output = new URL('../src/data/game.json',import.meta.url);
await writeFile(output,JSON.stringify(game,null,2)+'\n');
console.log(`Imported ${game.drives.filter(d=>d.offensiveTeam==='NCS').length} NC State drives / ${game.drives.flatMap(d=>d.plays).length} source rows to ${fileURLToPath(output)} (${offline?'offline cache':'downloaded official sources'})`);
