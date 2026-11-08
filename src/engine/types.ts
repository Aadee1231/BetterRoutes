import type { GameSituation } from '../types';

export type Strategy = 'balanced' | 'aggressive' | 'conservative';
export type Action = 'RUN' | 'PASS' | 'PUNT' | 'FIELD_GOAL';
export type Concept = 'Inside Zone' | 'Outside Zone' | 'Power' | 'Draw' | 'Quick Slant' | 'Mesh' | 'Screen' | 'Play-Action Cross' | 'Deep Shot' | 'Punt' | 'Field Goal';
export type Provenance = 'observed' | 'calculated' | 'assumed';
export interface Metric { readonly value: number; readonly display: string; readonly source: Provenance }
export interface EvidencePlay {
  readonly id: string; readonly team: 'NCS' | 'DUK'; readonly down: number; readonly distance: number;
  readonly yards: number; readonly action: 'RUN' | 'PASS'; readonly incomplete: boolean;
  readonly sack: boolean; readonly turnover: boolean;
}
export interface Evidence { readonly plays: readonly EvidencePlay[] }
export interface WeightedOutcome {
  readonly yards: number; readonly kind: 'gain' | 'incomplete' | 'sack' | 'turnover'; readonly probability: number;
}
export interface Candidate {
  readonly action: Action; readonly concept: Concept;
  readonly success: Metric; readonly conversion: Metric; readonly yards: Metric;
  readonly primaryMetric: { readonly label: string; readonly metric: Metric };
  readonly risk: 'low' | 'med' | 'high'; readonly riskValue: number; readonly riskSource: Provenance;
  readonly evidence: { readonly n: number; readonly opponentN: number; readonly weightedN: number; readonly observedRate: Metric | null; readonly prior: Metric; readonly weight: Metric };
  readonly utility: number; readonly utilitySource: Provenance; readonly expectedPoints: Metric;
  readonly distribution: readonly WeightedOutcome[];
  readonly explanation: string;
}
export interface PlayRecommendation {
  readonly selected: Candidate; readonly alternatives: readonly Candidate[]; readonly ranked: readonly Candidate[];
  readonly situation: Readonly<GameSituation>; readonly strategy: Strategy; readonly explanation: string;
  readonly modelVersion: string;
  readonly details: { readonly sampleSizes: { readonly NCS: number; readonly opponent: number }; readonly assumptions: readonly string[]; readonly limitations: readonly string[]; readonly estimationMethod: string };
}
export type DriveResult = 'touchdown' | 'safety' | 'turnover' | 'downs' | 'punt' | 'field-goal-made' | 'field-goal-missed' | 'half-end' | 'game-end' | 'play-cap';
export interface SimulatedPlay {
  readonly order: number; readonly action: Action; readonly concept: Concept;
  readonly before: Readonly<GameSituation>; readonly after: Readonly<GameSituation>;
  readonly yards: number; readonly outcome: string; readonly converted: boolean;
}
export interface SimulationState {
  readonly startingSituation: Readonly<GameSituation>; readonly currentSituation: Readonly<GameSituation>;
  readonly strategy: Strategy; readonly seed: number; readonly rngState: number;
  readonly plays: readonly SimulatedPlay[]; readonly runningScore: { readonly offense: number; readonly defense: number };
  readonly driveResult: DriveResult | null; readonly complete: boolean;
}
