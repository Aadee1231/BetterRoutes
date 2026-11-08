import { z } from 'zod';

export const sourceSchema = z.object({ url: z.string().url(), reference: z.string().min(1) });
const clockSchema = z.string().regex(/^\d{2}:[0-5]\d$/);
const positionSchema = z.number().min(0).max(100);
export const situationSchema = z.object({
  down: z.number().int().min(1).max(4), distance: z.number().positive(),
  yardline: positionSchema, quarter: z.number().int().min(1).max(4),
  clock: clockSchema, offensiveScore: z.number().nonnegative(), defensiveScore: z.number().nonnegative(), goalToGo: z.boolean(),
});
export const historicalPlaySchema = z.object({
  id: z.string(), driveId: z.string(), order: z.number().int().positive(),
  quarter: z.number().int().min(1).max(4), clock: clockSchema,
  down: z.number().int().min(1).max(4).nullable(), distance: z.number().nonnegative().nullable(), yardline: positionSchema.nullable(),
  playType: z.enum(['rush','pass','sack','penalty','punt','fg','kickoff','pat','kneel','timeout','period','drive-start','no-play']),
  description: z.string().min(1), situationText: z.string(), yards: z.number(),
  participants: z.array(z.string()), result: z.string(), counts: z.boolean(), nullified: z.boolean(),
  offensivePlay: z.boolean(), penaltyYards: z.number(),
  scoreBefore: z.object({ NCS: z.number(), DUK: z.number() }), source: sourceSchema,
});
export const driveSchema = z.object({
  id: z.string(), offensiveTeam: z.enum(['NCS','DUK']), startQuarter: z.number().int().min(1).max(4), startClock: clockSchema,
  startYardline: positionSchema, endYardline: positionSchema, endClock: clockSchema,
  result: z.string(), officialPlays: z.number(), netYards: z.number(), timeOfPossession: clockSchema,
  plays: z.array(historicalPlaySchema), source: sourceSchema,
});
export const teamStatsSchema = z.object({
  team: z.enum(['NCS','DUK']), firstDowns: z.number(), rushingYards: z.number(), rushingAttempts: z.number(),
  passingYards: z.number(), passingAttempts: z.number(), completions: z.number(), totalYards: z.number(), offensivePlays: z.number(),
  thirdDownConversions: z.number(), thirdDownAttempts: z.number(), punts: z.number(), fieldGoalsMade: z.number(), fieldGoalAttempts: z.number(), touchdowns: z.number(),
  officialRows: z.record(z.string(), z.string()), source: sourceSchema,
});
export const playerStatsSchema = z.object({
  name: z.string(), category: z.enum(['passing','rushing','receiving']), stats: z.record(z.string(),z.number()), source: sourceSchema,
});
export const scoringSchema = z.object({ quarter: z.number(), clock: clockSchema, team: z.enum(['NCS','DUK']), description: z.string(), score: z.object({ NCS:z.number(), DUK:z.number() }), source: sourceSchema });
export const gameSchema = z.object({
  id:z.string(), date:z.string(), homeTeam:z.literal('NCS'), awayTeam:z.literal('DUK'),
  teams:z.object({NCS:z.string(),DUK:z.string()}), score:z.object({NCS:z.number(),DUK:z.number()}),
  stadium:z.string(), attendance:z.number().nullable(), sources:z.array(sourceSchema),
  teamStats:z.array(teamStatsSchema), playerStats:z.array(playerStatsSchema), scoring:z.array(scoringSchema), drives:z.array(driveSchema),
  verification:z.object({score:z.object({NCS:z.number(),DUK:z.number()}),teamStats:z.array(teamStatsSchema), source:sourceSchema}),
  notes:z.array(z.string()),
});
export type Game = z.infer<typeof gameSchema>;
export type Drive = z.infer<typeof driveSchema>;
export type HistoricalPlay = z.infer<typeof historicalPlaySchema>;
export type TeamStats = z.infer<typeof teamStatsSchema>;
export type PlayerStats = z.infer<typeof playerStatsSchema>;
export type GameSituation = z.infer<typeof situationSchema>;
