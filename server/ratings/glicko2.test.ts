import { describe, expect, it } from 'vitest';
import { calculateRatingPeriod, PlayerRating, predictWinProbability } from './glicko2';

function createRating(playerId: string, rating: number, deviation: number): PlayerRating {
  return {
    playerId,
    rating,
    deviation,
    volatility: 0.06,
    matchesPlayed: 0,
  };
}

describe('calculateRatingPeriod', () => {
  it('reproduce el ejemplo numérico oficial de Glicko-2', () => {
    const ratings = [
      createRating('player', 1500, 200),
      createRating('opponent-1', 1400, 30),
      createRating('opponent-2', 1550, 100),
      createRating('opponent-3', 1700, 300),
    ];

    const result = calculateRatingPeriod(ratings, [
      { winnerPlayerId: 'player', loserPlayerId: 'opponent-1' },
      { winnerPlayerId: 'opponent-2', loserPlayerId: 'player' },
      { winnerPlayerId: 'opponent-3', loserPlayerId: 'player' },
    ]);
    const player = result.find((rating) => rating.playerId === 'player');

    expect(Math.abs((player?.rating ?? 0) - 1464.06)).toBeLessThan(0.01);
    expect(player?.deviation).toBeCloseTo(151.52, 2);
    expect(Math.abs((player?.volatility ?? 0) - 0.05999)).toBeLessThan(0.00001);
    expect(player?.matchesPlayed).toBe(3);
  });

  it('crea ratings iniciales para jugadores nuevos', () => {
    const result = calculateRatingPeriod(
      [],
      [{ winnerPlayerId: 'winner', loserPlayerId: 'loser' }]
    );

    expect(result).toHaveLength(2);
    expect(result.find((rating) => rating.playerId === 'winner')?.rating).toBeGreaterThan(1500);
    expect(result.find((rating) => rating.playerId === 'loser')?.rating).toBeLessThan(1500);
  });

  it('rechaza enfrentamientos contra el mismo jugador', () => {
    expect(() =>
      calculateRatingPeriod([], [{ winnerPlayerId: 'same', loserPlayerId: 'same' }])
    ).toThrow('Un jugador no puede enfrentarse contra sí mismo.');
  });
});

describe('predictWinProbability', () => {
  it('calcula la probabilidad esperada del enfrentamiento', () => {
    const probability = predictWinProbability(
      createRating('player', 1500, 100),
      createRating('opponent', 1300, 100)
    );

    expect(probability).toBeCloseTo(0.74, 2);
  });
});
