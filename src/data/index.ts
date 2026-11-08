import data from './game.json';
import { validateGame } from './validate';
export const game = validateGame(data);
