import { game } from './data';
import { GameReview } from './pages/GameReview';
import { routeUrl, useRoute } from './utils/navigation';
import { downDistance, ballOn } from './utils/football';
import { SourceTag } from './components/SourceTag';

export function App() {
  const route=useRoute();
  const sourcePlay=game.drives.flatMap(d=>d.plays).find(p=>p.id===route.play);
  const selectedDrive=game.drives.find(d=>d.id===(sourcePlay?.driveId??route.drive));
  return <>
    <a className="skip-link" href="#main-content">Skip to game analysis</a>
    <header className="app-header">
      <a className="wordmark" href={routeUrl('review')} aria-label="BetterRoutes home"><svg width="25" height="26" viewBox="0 0 25 26" aria-hidden="true"><path d="M5 2v22M20 2v22M0 7h10M15 7h10M0 13h10M15 13h10M0 19h10M15 19h10" fill="none" stroke="currentColor" strokeWidth="2"/></svg>BETTERROUTES</a>
      <nav aria-label="Main navigation">{([['review','Game Review'],['coordinator','Offensive Coordinator'],['what-if','What-If Analysis']] as const).map(([section,label])=><a key={section} href={routeUrl(section,selectedDrive?.id,sourcePlay?.id)} aria-current={route.section===section?'page':undefined}>{label}</a>)}</nav>
      <span className="tagline">Analyze the game. Challenge the call.</span>
    </header>
    <main id="main-content">
      {route.section==='review'?<GameReview route={route}/>:<section className="placeholder">
        <p className="eyebrow">BetterRoutes / {route.section==='coordinator'?'02':'03'}</p>
        <h1>{route.section==='coordinator'?'Offensive Coordinator':'What-If Analysis'}</h1>
        <p>{route.section==='coordinator'?'Situation-based recommendations, ranked alternatives and schematic play diagrams will live here.':'Seeded hypothetical drives and actual-versus-modeled comparisons will live here.'}</p>
        <p className="muted">The statistical engines are ready. This workspace is not yet connected.</p>
        {sourcePlay&&<div className="carried-situation"><SourceTag/><h2>Situation loaded from Game Review</h2><p className="mono">Q{sourcePlay.quarter} {sourcePlay.clock} · {downDistance(sourcePlay)} · {ballOn(sourcePlay.yardline)}</p><p>{sourcePlay.description}</p><small>Source play: {sourcePlay.id}</small></div>}
        <a className="button" href={routeUrl('review',selectedDrive?.id,sourcePlay?.id)}>Return to Game Review</a>
      </section>}
    </main>
    <footer className="app-footer"><span>BETTERROUTES / FOOTBALL OFFENSIVE INTELLIGENCE &amp; DECISION ANALYSIS</span><span>2026 GAME ARCHIVE · LOCAL EDITION</span></footer>
  </>;
}
