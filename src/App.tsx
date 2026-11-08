import { game } from './data';
import { GameReview } from './pages/GameReview';
import { Coordinator } from './pages/Coordinator';
import { WhatIf } from './pages/WhatIf';
import { routeUrl, useRoute } from './utils/navigation';
import { readWorkspace, workspaceUrl } from './utils/scenarios';

export function App() {
  const route=useRoute();
  const sourcePlay=game.drives.flatMap(d=>d.plays).find(p=>p.id===route.play);
  const selectedDrive=game.drives.find(d=>d.id===(sourcePlay?.driveId??route.drive));
  const workspace=readWorkspace(route);
  return <>
    <a className="skip-link" href="#main-content">Skip to game analysis</a>
    <header className="app-header">
      <a className="wordmark" href={routeUrl('review')} aria-label="BetterRoutes home"><svg width="25" height="26" viewBox="0 0 25 26" aria-hidden="true"><path d="M5 2v22M20 2v22M0 7h10M15 7h10M0 13h10M15 13h10M0 19h10M15 19h10" fill="none" stroke="currentColor" strokeWidth="2"/></svg>BETTERROUTES</a>
      <nav aria-label="Main navigation">{([['review','Game Review'],['coordinator','Offensive Coordinator'],['what-if','What-If Analysis']] as const).map(([section,label])=><a key={section} href={section==='review'?routeUrl(section,selectedDrive?.id,sourcePlay?.id):workspaceUrl(section,workspace)} aria-current={route.section===section?'page':undefined}>{label}</a>)}</nav>
      <span className="tagline">Analyze the game. Challenge the call.</span>
    </header>
    <main id="main-content">
      {route.section==='review'?<GameReview route={route}/>:route.section==='coordinator'?<Coordinator route={route}/>:<WhatIf route={route}/>}
    </main>
    <footer className="app-footer"><span>BETTERROUTES / FOOTBALL OFFENSIVE INTELLIGENCE &amp; DECISION ANALYSIS</span><span>2026 GAME ARCHIVE · LOCAL EDITION</span></footer>
  </>;
}
