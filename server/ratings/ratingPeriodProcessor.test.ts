import { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { processNextRatingPeriod } from './ratingPeriodProcessor';

function createDatabaseDouble(hasPendingPeriod = true) {
  const query = vi.fn(async (statement: string, parameters?: unknown[]) => {
    void parameters;

    if (statement.includes('FROM rating_periods') && statement.includes('FOR UPDATE')) {
      return {
        rows: hasPendingPeriod
          ? [
              {
                id: '1',
                external_key: 'tournament:test',
                starts_at: new Date('2026-01-01T00:00:00Z'),
              },
            ]
          : [],
      };
    }

    if (statement.includes('SELECT DISTINCT ON')) {
      return { rows: [] };
    }

    if (statement.includes('FROM rating_period_sets')) {
      return {
        rows: [
          {
            winner_player_id: '100',
            loser_player_id: '200',
          },
        ],
      };
    }

    return { rows: [] };
  });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool;

  return { pool, query, release };
}

describe('processNextRatingPeriod', () => {
  it('procesa y consolida el periodo pendiente más antiguo', async () => {
    const { pool, query, release } = createDatabaseDouble();

    const result = await processNextRatingPeriod(pool);

    expect(result).toEqual({
      externalKey: 'tournament:test',
      playerCount: 2,
      setCount: 1,
    });
    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(
      query.mock.calls.some(([statement]) =>
        String(statement).includes('INSERT INTO rating_snapshots')
      )
    ).toBe(true);
    const snapshotCall = query.mock.calls.find(([statement]) =>
      String(statement).includes('INSERT INTO rating_snapshots')
    );
    const persistedRatings = JSON.parse(String(snapshotCall?.[1]?.[1])) as Array<
      Record<string, unknown>
    >;

    expect(persistedRatings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          player_id: '100',
          matches_played: 1,
          period_matches: 1,
        }),
      ])
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it('finaliza sin cambios cuando no quedan periodos pendientes', async () => {
    const { pool, query, release } = createDatabaseDouble(false);

    const result = await processNextRatingPeriod(pool);

    expect(result).toBeNull();
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });
});
