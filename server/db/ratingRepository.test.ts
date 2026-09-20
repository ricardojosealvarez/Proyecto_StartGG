import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PostgresRatingRepository } from './ratingRepository.ts';

describe('PostgresRatingRepository', () => {
  it('mantiene disponibles los snapshots mientras se recalculan', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PostgresRatingRepository({ query } as unknown as Pool);

    await repository.getPlayerHistory('player-1');

    const statement = String(query.mock.calls[0][0]);
    expect(statement).not.toContain("rating_periods.status = 'completed'");
    expect(statement).toContain('ORDER BY rating_periods.ends_at DESC');
  });
});
