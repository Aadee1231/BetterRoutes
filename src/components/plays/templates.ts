import type { Concept } from '../../engine';

export interface TemplatePlayer { position:string;x:number;y:number;route?:readonly [number,number][];target?:boolean; }
export interface PlayTemplate { concept:Concept;kind:'run'|'pass'|'kick';players:readonly TemplatePlayer[];lane?:readonly [number,number][]; }
const line:TemplatePlayer[]=[{position:'LT',x:-1,y:-5},{position:'LG',x:-1,y:-2.5},{position:'C',x:-1,y:0},{position:'RG',x:-1,y:2.5},{position:'RT',x:-1,y:5}];
const skill:TemplatePlayer[]=[{position:'QB',x:-5,y:0},{position:'RB',x:-7,y:4},{position:'X',x:0,y:-19},{position:'Y',x:0,y:9},{position:'Z',x:0,y:19}];
function run(concept:Concept,lane:readonly [number,number][]):PlayTemplate {return {concept,kind:'run',players:[...line,...skill],lane};}
function pass(concept:Concept,routes:Partial<Record<string,readonly [number,number][]>>,target:string):PlayTemplate {
  return {concept,kind:'pass',players:[...line,...skill.map(p=>({...p,route:routes[p.position],target:p.position===target}))]};
}
export const PLAY_TEMPLATES:Readonly<Record<Concept,PlayTemplate>>={
  'Inside Zone':run('Inside Zone',[[-7,4],[-3,2],[4,1],[10,0]]),
  'Outside Zone':run('Outside Zone',[[-7,4],[-4,9],[1,14],[9,15]]),
  Power:run('Power',[[-7,4],[-3,4],[2,3],[9,3]]),
  Draw:run('Draw',[[-7,4],[-6,1],[-2,0],[9,-2]]),
  'Quick Slant':pass('Quick Slant',{X:[[4,-19],[10,-10]],Y:[[5,9],[5,15]],Z:[[12,19]]},'X'),
  Mesh:pass('Mesh',{X:[[5,-19],[5,12]],Y:[[7,9],[7,-14]],Z:[[15,19]]},'X'),
  Screen:pass('Screen',{RB:[[-4,8],[-2,13],[5,13]],X:[[12,-19]],Y:[[4,9],[4,15]],Z:[[9,19]]},'RB'),
  'Play-Action Cross':pass('Play-Action Cross',{X:[[12,-19],[19,8]],Y:[[8,9],[14,-9]],Z:[[22,19]],RB:[[-3,2],[2,3]]},'X'),
  'Deep Shot':pass('Deep Shot',{X:[[30,-19]],Y:[[12,9],[20,0]],Z:[[28,19]]},'X'),
  Punt:{concept:'Punt',kind:'kick',players:[...line,{position:'P',x:-13,y:0},{position:'G',x:0,y:-20},{position:'G',x:0,y:20}],lane:[[-13,0],[7,-4],[27,0]]},
  'Field Goal':{concept:'Field Goal',kind:'kick',players:[...line,{position:'H',x:-7,y:0},{position:'K',x:-10,y:3}],lane:[[-7,0],[12,-3],[27,0]]},
};
