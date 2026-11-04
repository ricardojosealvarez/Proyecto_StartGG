import { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { processNextRatingPeriod, processPendingRatingPeriods } from './ratingPeriodProcessor';

function createDatabaseDouble(
  hasPendingPeriod = true,
  options: {
    lockAvailable?: boolean;
    periodCount?: number;
    failPersist?: boolean;
    priorRating?: boolean;
  } = {}
) {
  let completed = 0;
  const query = vi.fn(async (statement: string, parameters?: unknown[]) => {
    void parameters;
    if (statement.includes('pg_try_advisory_lock')) {
      return { rows: [{ acquired: options.lockAvailable !== false }] };
    }
    if (statement.includes("SET status = 'completed'")) completed += 1;
    if (options.failPersist && statement.includes('INSERT INTO rating_checkpoints')) {
      throw new Error('snapshot write failed');
    }

    if (statement.includes('FROM rating_periods') && statement.includes('FOR UPDATE')) {
      return {
        rows:
          hasPendingPeriod && completed < (options.periodCount ?? 1)
            ? [
                {
                  id: String(completed + 1),
                  external_key: 'tournament:test',
                  starts_at: new Date('2026-01-01T00:00:00Z'),
                },
              ]
            : [],
      };
    }

    if (statement.includes('WITH requested_players')) {
      return {
        rows: options.priorRating
          ? [{
              player_id: '100', rating: 1500, deviation: 200,
              volatility: 0.06, matches_played: 4, inactive_periods: 2,
            }]
          : [],
      };
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
      timings: expect.objectContaining({ totalMs: expect.any(Number) }),
    });
    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(
      query.mock.calls.some(([statement]) =>
        String(statement).includes('INSERT INTO rating_checkpoints')
      )
    ).toBe(true);
    const snapshotCall = query.mock.calls.find(([statement]) =>
      String(statement).includes('INSERT INTO rating_checkpoints')
    );
    const persistedRatings = JSON.parse(String(snapshotCall?.[1]?.[2])) as Array<
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

  it('rechaza un segundo procesador antes de abrir una transacción', async () => {
    const { pool, query, release } = createDatabaseDouble(true, { lockAvailable: false });
    await expect(processNextRatingPeriod(pool)).rejects.toThrow('procesador Glicko-2 activo');
    expect(query).not.toHaveBeenCalledWith('BEGIN');
    expect(release).toHaveBeenCalledOnce();
  });

  it('limita el lote y carga solo los jugadores activos en cada periodo', async () => {
    const { pool, query } = createDatabaseDouble(true, { periodCount: 3 });
    const onPeriod = vi.fn();
    const processed = await processPendingRatingPeriods(pool, { maxPeriods: 2, onPeriod });
    expect(processed).toHaveLength(2);
    expect(onPeriod).toHaveBeenCalledTimes(2);
    const ratingLoads = query.mock.calls.filter(([sql]) => sql.includes('WITH requested_players'));
    expect(ratingLoads).toHaveLength(2);
    expect(ratingLoads[0][1]?.[0]).toEqual(['100', '200']);
    expect(query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, $2)', [1386, 2]);
  });

  it('persiste únicamente checkpoints de participantes', async () => {
    const { pool, query } = createDatabaseDouble(true, { priorRating: true });
    await processNextRatingPeriod(pool);
    const checkpoint = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO rating_checkpoints')
    );
    const ratings = JSON.parse(String(checkpoint?.[1]?.[2])) as Array<{ player_id: string }>;
    expect(ratings.map((rating) => rating.player_id).sort()).toEqual(['100', '200']);
    expect(query.mock.calls.some(([sql]) => sql.includes("snapshot_mode = 'sparse'"))).toBe(true);
  });

  it('revierte un fallo al guardar y libera el procesador', async () => {
    const { pool, query, release } = createDatabaseDouble(true, { failPersist: true });
    await expect(processNextRatingPeriod(pool)).rejects.toThrow('snapshot write failed');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, $2)', [1386, 2]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('rechaza límites inválidos antes de conectar', async () => {
    const { pool } = createDatabaseDouble();
    await expect(processPendingRatingPeriods(pool, { maxPeriods: 0 })).rejects.toThrow(
      'entero positivo'
    );
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
