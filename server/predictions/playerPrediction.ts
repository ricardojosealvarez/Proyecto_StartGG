import { predictWinProbability } from '../ratings/glicko2.ts';
import type { PlayerRating } from '../ratings/glicko2.ts';

const MINIMUM_HISTORY_SIZE = 3;
const STABLE_RATING_DELTA = 15;

export interface RatingSnapshot extends PlayerRating {
  periodEndAt: Date;
}

export type PredictionConfidence = 'low' | 'medium' | 'high';
export type RatingTrend = 'declining' | 'stable' | 'rising';

export interface PlayerPrediction {
  status: 'ready';
  playerId: string;
  currentRating: number;
  projectedRating: number;
  ratingDeviation: number;
  volatility: number;
  ratingDelta: number;
  trend: RatingTrend;
  confidence: PredictionConfidence;
  historySize: number;
  opponentWinProbability?: number;
}

export interface InsufficientHistoryPrediction {
  status: 'insufficient_history';
  playerId: string;
  historySize: number;
  requiredHistorySize: number;
}

function getConfidence(deviation: number): PredictionConfidence {
  if (deviation <= 75) return 'high';
  if (deviation <= 150) return 'medium';
  return 'low';
}

function getTrend(ratingDelta: number): RatingTrend {
  if (ratingDelta > STABLE_RATING_DELTA) return 'rising';
  if (ratingDelta < -STABLE_RATING_DELTA) return 'declining';
  return 'stable';
}

function calculateWeightedPeriodDelta(history: RatingSnapshot[]) {
  let weightedDelta = 0;
  let totalWeight = 0;

  for (let index = 1; index < history.length; index += 1) {
    const weight = index;
    weightedDelta += (history[index].rating - history[index - 1].rating) * weight;
    totalWeight += weight;
  }

  return totalWeight === 0 ? 0 : weightedDelta / totalWeight;
}

export function buildPlayerPrediction(
  playerId: string,
  snapshots: RatingSnapshot[],
  opponent?: PlayerRating
): PlayerPrediction | InsufficientHistoryPrediction {
  const history = [...snapshots].sort(
    (snapshotA, snapshotB) => snapshotA.periodEndAt.getTime() - snapshotB.periodEndAt.getTime()
  );

  if (history.length < MINIMUM_HISTORY_SIZE) {
    return {
      status: 'insufficient_history',
      playerId,
      historySize: history.length,
      requiredHistorySize: MINIMUM_HISTORY_SIZE,
    };
  }

  const first = history[0];
  const current = history[history.length - 1];
  const ratingDelta = current.rating - first.rating;
  const projectedRating = current.rating + calculateWeightedPeriodDelta(history);

  return {
    status: 'ready',
    playerId,
    currentRating: current.rating,
    projectedRating,
    ratingDeviation: current.deviation,
    volatility: current.volatility,
    ratingDelta,
    trend: getTrend(ratingDelta),
    confidence: getConfidence(current.deviation),
    historySize: history.length,
    opponentWinProbability: opponent ? predictWinProbability(current, opponent) : undefined,
  };
}
