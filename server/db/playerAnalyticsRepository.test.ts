import { describe, expect, it, vi } from 'vitest';
import { PostgresPlayerAnalyticsRepository } from './playerAnalyticsRepository.ts';

describe('PostgresPlayerAnalyticsRepository', () => {
  it('combina actividad y puntuaciones anuales de PostgreSQL', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ year: 2024, tournaments: 8, wins: 21, average_score: 1542.34, best_score: 1601.12 }],
    });
    const repository = new PostgresPlayerAnalyticsRepository({ query } as never);

    await expect(repository.getYearStats('1354812', 1386, 'offline')).resolves.toEqual([
      { year: 2024, tournaments: 8, wins: 21, averageScore: 1542.34, bestScore: 1601.12 },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('tournaments.is_online'), [
      '1354812',
      1386,
      'offline',
    ]);
  });
});
