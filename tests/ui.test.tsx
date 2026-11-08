// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { TacticalField } from '../src/components/field/TacticalField';
import { PLAY_TEMPLATES } from '../src/components/plays/templates';
import { parseRoute } from '../src/utils/navigation';
import { endPosition } from '../src/utils/football';
import { game } from '../src/data';

beforeEach(()=>{window.history.replaceState(null,'','/#/review');});
afterEach(cleanup);
const route=async(hash:string)=>{await act(async()=>{window.location.hash=hash;window.dispatchEvent(new HashChangeEvent('hashchange'));});};
describe('Game Review workspace',()=>{
  it('renders the official final linescore and complete team totals',()=>{
    render(<App/>);
    expect(screen.getByTestId('score-DUK').textContent).toBe('41');
    expect(screen.getByTestId('score-NCS').textContent).toBe('3');
    const stats=screen.getByRole('region',{name:'Official team statistics'});
    expect(within(stats).getByText('217')).toBeTruthy();expect(within(stats).getByText('185')).toBeTruthy();
    expect(within(stats).getByText('32')).toBeTruthy();expect(within(stats).getByText('56')).toBeTruthy();
    expect(screen.getByTestId('field-ball').getAttribute('data-yardline')).toBe('25');
    expect(screen.getAllByRole('button',{name:/Select drive/})).toHaveLength(11);
  });
  it('navigates all three functional sections',async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole('link',{name:'Offensive Coordinator'}));
    await waitFor(()=>expect(screen.getByRole('heading',{name:'Offensive Coordinator'})).toBeTruthy());
    expect(screen.getByRole('region',{name:'Situation editor'})).toBeTruthy();
    fireEvent.click(screen.getByRole('link',{name:'What-If Analysis'}));
    await waitFor(()=>expect(screen.getByRole('heading',{name:'What-If Analysis'})).toBeTruthy());
    fireEvent.click(screen.getByRole('link',{name:'Game Review'}));
    await waitFor(()=>expect(screen.getByTestId('score-DUK').textContent).toBe('41'));
  });
  it('selects a key decision, updates the field, and carries its source situation to coordinator',async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:/The yard that never came/}));
    await waitFor(()=>expect(screen.getByTestId('field-ball').getAttribute('data-yardline')).toBe('40'));
    expect(screen.getByTestId('first-down-line').getAttribute('x1')).toBe('510');
    expect(window.location.hash).toContain('drive-13-row-07');
    fireEvent.click(screen.getByRole('link',{name:/Analyze This Play/}));
    await waitFor(()=>expect(screen.getByRole('heading',{name:'Offensive Coordinator'})).toBeTruthy());
    expect(screen.getByText('Source play: drive-13-row-07')).toBeTruthy();
    expect(screen.getByText(/Q3 06:13 · 4th & 1 · NCS 40/)).toBeTruthy();
  });
  it('restores selection from URL on remount and supports keyboard stepping',async()=>{
    await route('#/review?drive=drive-13&play=drive-13-row-06');
    const view=render(<App/>);
    expect(screen.getByTestId('field-ball').getAttribute('data-yardline')).toBe('40');
    fireEvent.keyDown(window,{key:'ArrowRight'});
    await waitFor(()=>expect(window.location.hash).toContain('drive-13-row-07'));
    view.unmount();render(<App/>);
    expect(screen.getByRole('button',{name:'Next play'}).hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(window,{key:'ArrowLeft'});
    await waitFor(()=>expect(window.location.hash).toContain('drive-13-row-06'));
  });
  it('updates ball position by selecting table rows and drive rows',async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:'Select play 3, Q1 13:30, 1st & 10'}));
    await waitFor(()=>expect(screen.getByTestId('field-ball').getAttribute('data-yardline')).toBe('46'));
    fireEvent.click(screen.getByRole('button',{name:/Select drive 2, quarter 1/}));
    await waitFor(()=>expect(screen.getByTestId('field-ball').getAttribute('data-yardline')).toBe('6'));
  });
  it('handles absent and invalid URL state with safe defaults',async()=>{
    expect(parseRoute('')).toEqual({section:'review',drive:null,play:null});
    await route('#/bad-route?drive=missing&play=unknown');render(<App/>);
    expect(screen.getByTestId('field-ball').getAttribute('data-yardline')).toBe('25');
    expect(screen.getByTestId('score-NCS').textContent).toBe('3');
  });
  it('de-emphasizes nullified rows, disables non-scrimmage analysis and hides kick line to gain',async()=>{
    await route('#/review?play=drive-10-row-10');render(<App/>);
    expect(screen.queryByTestId('first-down-line')).toBeNull();
    expect(screen.getByRole('button',{name:'Analysis: scrimmage plays only'}).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('NULLIFIED')).toBeTruthy();
    const blocked=game.drives.flatMap(d=>d.plays).find(p=>p.id==='drive-10-row-10')!;
    expect(endPosition(blocked)).toBe(0);
  });
});
describe('composable tactical field',()=>{
  it('has schematic templates for all concepts, hides goal-to-go line and handles no replay data',()=>{
    expect(Object.keys(PLAY_TEMPLATES)).toHaveLength(11);
    const {rerender}=render(<TacticalField ballYardline={95} lineToGain={100} goalToGo template={PLAY_TEMPLATES.Mesh}/>);
    expect(screen.queryByTestId('first-down-line')).toBeNull();
    expect(screen.getByText('SCHEMATIC ILLUSTRATION')).toBeTruthy();
    expect(screen.getByRole('button',{name:'Play'}).hasAttribute('disabled')).toBe(true);
    for (const template of Object.values(PLAY_TEMPLATES)) {
      rerender(<TacticalField ballYardline={40} lineToGain={50} template={template}/>);
      expect(screen.getByTestId('field-ball').getAttribute('data-yardline')).toBe('40');
    }
  });
});
