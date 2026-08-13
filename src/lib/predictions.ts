export type PredictionConfidence = 'low' | 'medium' | 'high';
export type RatingTrend = 'declining' | 'stable' | 'rising';

export interface ReadyPlayerPrediction {
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

export type PlayerPredictionResponse = ReadyPlayerPrediction | InsufficientHistoryPrediction;

export async function requestPlayerPrediction(playerId: string, opponentId?: string) {
  const searchParams = new URLSearchParams({ playerId });
  if (opponentId) searchParams.set('opponentId', opponentId);

  const response = await fetch(`/api/player-predictions?${searchParams.toString()}`);

  if (!response.ok) {
    let message = 'No se pudo consultar la predicción.';

    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === 'string') message = payload.error;
    } catch {
      // Preserve the stable fallback for invalid server responses.
    }

    throw new Error(message);
  }

  return (await response.json()) as PlayerPredictionResponse;
}
