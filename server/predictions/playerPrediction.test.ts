import { describe, expect, it } from 'vitest';
import { PlayerRating } from '../ratings/glicko2';
import { buildPlayerPrediction, RatingSnapshot } from './playerPrediction';

function createSnapshot(rating: number, periodEndAt: string, deviation = 70): RatingSnapshot {
  return {
    playerId: 'player',
    rating,
    deviation,
    volatility: 0.06,
    matchesPlayed: 10,
    periodEndAt: new Date(periodEndAt),
  };
}

describe('buildPlayerPrediction', () => {
  it('proyecta el siguiente periodo ponderando más los cambios recientes', () => {
    const prediction = buildPlayerPrediction('player', [
      createSnapshot(1560, '2026-03-01T00:00:00Z'),
      createSnapshot(1500, '2026-01-01T00:00:00Z'),
      createSnapshot(1520, '2026-02-01T00:00:00Z'),
    ]);

    expect(prediction.status).toBe('ready');
    if (prediction.status !== 'ready') return;

    expect(prediction.currentRating).toBe(1560);
    expect(prediction.projectedRating).toBeCloseTo(1593.33, 2);
    expect(prediction.ratingDelta).toBe(60);
    expect(prediction.trend).toBe('rising');
    expect(prediction.confidence).toBe('high');
  });

  it('no predice con menos de tres periodos', () => {
    const prediction = buildPlayerPrediction('player', [
      createSnapshot(1500, '2026-01-01T00:00:00Z'),
      createSnapshot(1510, '2026-02-01T00:00:00Z'),
    ]);

    expect(prediction).toEqual({
      status: 'insufficient_history',
      playerId: 'player',
      historySize: 2,
      requiredHistorySize: 3,
    });
  });

  it('añade la probabilidad contra un rival cuando existe su rating', () => {
    const opponent: PlayerRating = {
      playerId: 'opponent',
      rating: 1400,
      deviation: 80,
      volatility: 0.06,
      matchesPlayed: 20,
    };
    const prediction = buildPlayerPrediction(
      'player',
      [
        createSnapshot(1500, '2026-01-01T00:00:00Z'),
        createSnapshot(1520, '2026-02-01T00:00:00Z'),
        createSnapshot(1540, '2026-03-01T00:00:00Z'),
      ],
      opponent
    );

    expect(prediction.status).toBe('ready');
    if (prediction.status !== 'ready') return;

    expect(prediction.opponentWinProbability).toBeGreaterThan(0.5);
    expect(prediction.opponentWinProbability).toBeLessThan(1);
  });
});
