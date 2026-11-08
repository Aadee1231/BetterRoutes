import { gameSchema, type Game } from '../types';
export function validateGame(data: unknown): Game {
  return gameSchema.parse(data);
}
