import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { TournamentTierRecord } from './tournamentTierImporter.ts';
import { TournamentTierRepository } from './tournamentTierRepository.ts';

const records: TournamentTierRecord[] = [
  {
    rowNumber: 2,
    slug: 'tournament/updated',
    startggUrl: 'https://start.gg/tournament/updated',
    tierPoints: 600,
    tier: 'A',
  },
  {
    rowNumber: 3,
    slug: 'tournament/unchanged',
    startggUrl: 'https://start.gg/tournament/unchanged',
    tierPoints: 200,
    tier: 'C',
  },
  {
    rowNumber: 4,
    slug: 'tournament/missing',
    startggUrl: 'https://start.gg/tournament/missing',
    tierPoints: 400,
    tier: 'B',
  },
];

function createPool(failUpdate = false) {
  const query = vi.fn(async (statement: string, parameters?: unknown[]) => {
    if (statement.includes('SELECT id')) {
      const slug = parameters?.[0];
      if (slug === 'tournament/missing') return { rows: [] };
      if (slug === 'tournament/unchanged') {
        return {
          rows: [
            {
              id: '2',
              startgg_url: records[1].startggUrl,
              tier_points: records[1].tierPoints,
              tier: records[1].tier,
            },
          ],
        };
      }
      return { rows: [{ id: '1', startgg_url: null, tier_points: null, tier: null }] };
    }
    if (failUpdate && statement.includes('UPDATE tournaments')) throw new Error('update failed');
    return { rows: [] };
  });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
  return { pool, query, release };
}

describe('TournamentTierRepository', () => {
  it('actualiza, conserva y reporta torneos ausentes', async () => {
    const { pool, query, release } = createPool();
    const result = await new TournamentTierRepository(pool).import(records);

    expect(result).toEqual({
      updated: 1,
      unchanged: 1,
      notFound: ['tournament/missing'],
    });
    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(
      query.mock.calls.filter(([statement]) => String(statement).includes('UPDATE tournaments'))
    ).toHaveLength(1);
    expect(release).toHaveBeenCalledOnce();
  });

  it('revierte la transacción cuando falla una actualización', async () => {
    const { pool, query, release } = createPool(true);
    await expect(new TournamentTierRepository(pool).import([records[0]])).rejects.toThrow(
      'update failed'
    );

    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });
});
