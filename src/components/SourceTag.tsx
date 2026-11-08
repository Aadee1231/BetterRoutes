import { game } from '../data';
export function SourceTag({url=game.sources[0].url}:{url?:string}) {
  return <a className="source-tag" href={url} target="_blank" rel="noreferrer">Actual — official game data <span aria-hidden="true">↗</span></a>;
}
