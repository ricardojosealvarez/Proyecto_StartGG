import { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { ImportedTournament } from './historyTypes.ts';
import { PostgresHistoryRepository } from './postgresHistoryRepository.ts';

const tournament: ImportedTournament = {
  id: 'tournament-1',
  name: 'Tournament 1',
  slug: 'tournament/tournament-1',
  countryCode: 'ES',
  isOnline: false,
  startAt: 1_700_000_000,
  endAt: 1_700_086_400,
  completedAt: new Date('2023-11-15T12:00:00Z'),
  events: [
    {
      id: 'event-1',
      name: 'Ultimate Singles',
      entrantCount: 2,
      sets: [
        {
          id: 'set-1',
          eventId: 'event-1',
          winner: { id: 'player-1', gamerTag: 'Winner' },
          loser: { id: 'player-2', gamerTag: 'Loser' },
          completedAt: new Date('2023-11-15T11:00:00Z'),
          rawPayload: { displayScore: 'Winner 3 - Loser 0' },
        },
      ],
    },
  ],
};

function createPool() {
  const query = vi.fn(async (statement: string) => {
    if (statement.includes('INSERT INTO tournaments')) return { rows: [{ id: '10' }], rowCount: 1 };
    if (statement.includes('INSERT INTO events')) {
      return { rows: [{ id: '20', startgg_event_id: 'event-1' }], rowCount: 1 };
    }
    if (statement.includes('SELECT id, startgg_player_id')) {
      return {
        rows: [
          { id: '30', startgg_player_id: 'player-1' },
          { id: '31', startgg_player_id: 'player-2' },
        ],
        rowCount: 2,
      };
    }
    if (statement.includes('INSERT INTO rating_periods')) {
      return {
        rows: [
          {
            id: '40',
            starts_at: tournament.completedAt,
            invalidation_starts_at: tournament.completedAt,
            changed: true,
          },
        ],
        rowCount: 1,
      };
    }
    if (statement.includes('INSERT INTO sets')) return { rows: [{ id: '50' }], rowCount: 1 };
    if (statement.includes('SELECT id') && statement.includes('FROM sets')) {
      return { rows: [], rowCount: 0 };
    }
    if (statement.includes('INSERT INTO rating_period_sets')) {
      return { rows: [{ id: '50' }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

  return { pool, query, release };
}

describe('PostgresHistoryRepository', () => {
  it('persiste un torneo y marca ratings posteriores sin eliminarlos', async () => {
    const { pool, query, release } = createPool();
    const repository = new PostgresHistoryRepository(pool);

    const result = await repository.saveTournament(tournament);

    expect(result).toEqual({ changed: true, setsSaved: 1 });
    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(
      query.mock.calls.some(([statement]) => String(statement).includes("SET status = 'pending'"))
    ).toBe(true);
    expect(
      query.mock.calls.some(([statement]) =>
        String(statement).includes('DELETE FROM rating_snapshots')
      )
    ).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

  it('deduplica sets repetidos dentro del mismo torneo antes del upsert', async () => {
    const { pool, query } = createPool();
    const repository = new PostgresHistoryRepository(pool);
    const duplicateTournament = {
      ...tournament,
      events: [
        {
          ...tournament.events[0],
          sets: [...tournament.events[0].sets, tournament.events[0].sets[0]],
        },
      ],
    };

    await repository.saveTournament(duplicateTournament);

    const setInsert = query.mock.calls.find(([statement]) =>
      String(statement).includes('INSERT INTO sets')
    );
    expect(setInsert?.[1]?.[2]).toBe(
      '[{"startgg_set_id":"set-1","event_id":20,"winner_player_id":30,"loser_player_id":31,"completed_at":"2023-11-15T11:00:00.000Z","raw_payload":{"displayScore":"Winner 3 - Loser 0"}}]'
    );
  });
});
