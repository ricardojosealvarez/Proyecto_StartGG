import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createPlayerAnalyticsHandler } from './playerAnalyticsPlugin.ts';

describe('createPlayerAnalyticsHandler', () => {
  it('devuelve las estadísticas de la base de datos', async () => {
    const repository = {
      getYearStats: vi
        .fn()
        .mockResolvedValue([
          { year: 2024, tournaments: 8, wins: 21, setsPlayed: 30, averageScore: 1542, bestScore: 1601 },
        ]),
    };
    const response = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    await createPlayerAnalyticsHandler(repository)(
      {
        method: 'GET',
        url: '/api/player-analytics?playerId=10&videogameId=1386&tournamentMode=online',
      } as IncomingMessage,
      response,
      vi.fn()
    );

    expect(response.statusCode).toBe(200);
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"source":"database"'));
    expect(repository.getYearStats).toHaveBeenCalledWith('10', 1386, 'online');
  });
});
