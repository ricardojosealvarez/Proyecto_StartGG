import { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { rebuildRatings } from './rebuildRatings.ts';

vi.mock('./ratingPeriodProcessor.ts', () => ({
  processPendingRatingPeriods: vi
    .fn()
    .mockResolvedValue([{ externalKey: 'tournament:1', playerCount: 2, setCount: 1 }]),
}));

describe('rebuildRatings', () => {
  it('recrea los periodos y snapshots desde los sets consolidados', async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    const client = { query: clientQuery, release } as unknown as PoolClient;
    const poolQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      query: poolQuery,
    } as unknown as Pool;

    const summary = await rebuildRatings(pool);

    expect(summary).toEqual({
      periodsPrepared: 1,
      periodsProcessed: 1,
      snapshotsCreated: 2,
    });
    expect(clientQuery).toHaveBeenCalledWith('BEGIN');
    expect(clientQuery).toHaveBeenCalledWith('DELETE FROM rating_snapshots');
    expect(clientQuery).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });
});
