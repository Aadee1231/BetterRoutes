import React from 'react';
import { createRoot } from 'react-dom/client';
import { game } from './data';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><main><p>BETTERROUTES / GAME ARCHIVE</p><h1>BetterRoutes</h1><p>Football Offensive Intelligence &amp; Decision Analysis</p><h2>Duke {game.score.DUK} — NC State {game.score.NCS}</h2><p>Analyze the game. Challenge the call.</p><p>{game.drives.filter(d => d.offensiveTeam === 'NCS').length} verified NC State possessions · Data-Assisted Coordinator</p></main></React.StrictMode>,
);
