import { useEffect, useState } from 'react';
export type Section = 'review'|'coordinator'|'what-if';
export interface Route { section:Section;drive:string|null;play:string|null;search?:string; }
export function parseRoute(hash:string):Route {
  const [path,query='']=hash.replace(/^#\/?/,'').split('?');
  const params=new URLSearchParams(query);
  return {section:path==='coordinator'||path==='what-if'||path==='whatif'?(path==='whatif'?'what-if':path):'review',drive:params.get('drive'),play:params.get('play'),...(query?{search:query}:{})};
}
export function routeUrl(section:Section,drive?:string|null,play?:string|null,extra:Record<string,string>={}):string {
  const params=new URLSearchParams(extra);
  if (drive) params.set('drive',drive);
  if (play) params.set('play',play);
  return `#/${section==='what-if'?'whatif':section}${params.size?'?'+params:''}`;
}
export function useRoute():Route {
  const [route,setRoute]=useState(()=>parseRoute(window.location.hash));
  useEffect(()=>{const changed=()=>setRoute(parseRoute(window.location.hash));window.addEventListener('hashchange',changed);return ()=>window.removeEventListener('hashchange',changed);},[]);
  return route;
}
