import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PostgresRatingRepository } from './ratingRepository.ts';

describe('PostgresRatingRepository', () => {
  it('excluye los snapshots invalidados mientras se recalculan', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PostgresRatingRepository({ query } as unknown as Pool);

    await repository.getPlayerHistory('player-1');

    const statement = String(query.mock.calls[0][0]);
    expect(statement).toContain("rating_periods.status = 'completed'");
    expect(statement).toContain("rating_periods.snapshot_mode = 'dense'");
    expect(statement).toContain('FROM rating_checkpoints');
    expect(statement).toContain('ORDER BY target_periods.starts_at DESC');
  });
});
