import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import type { HistoryImportRepository } from './historyImporter.ts';
import { ULTIMATE_VIDEOGAME_ID } from './historyTypes.ts';
import type { ImportedPlayer, ImportedSet, ImportedTournament } from './historyTypes.ts';

interface IdRow extends QueryResultRow {
  id: string;
}

interface PlayerIdRow extends IdRow {
  startgg_player_id: string;
}

interface EventIdRow extends IdRow {
  startgg_event_id: string;
}

interface PeriodRow extends IdRow {
  starts_at: Date;
  invalidation_starts_at: Date;
  changed: boolean;
}

function uniquePlayers(sets: ImportedSet[]) {
  const players = new Map<string, ImportedPlayer>();

  for (const set of sets) {
    players.set(set.winner.id, set.winner);
    players.set(set.loser.id, set.loser);
  }

  return [...players.values()];
}

async function upsertTournament(client: PoolClient, tournament: ImportedTournament) {
  const result = await client.query<IdRow>(
    `
      INSERT INTO tournaments (
        startgg_tournament_id,
        name,
        slug,
        country_code,
        starts_at,
        completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (startgg_tournament_id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        country_code = EXCLUDED.country_code,
        starts_at = EXCLUDED.starts_at,
        completed_at = EXCLUDED.completed_at,
        updated_at = NOW()
      RETURNING id
    `,
    [
      tournament.id,
      tournament.name,
      tournament.slug,
      tournament.countryCode,
      new Date(tournament.startAt * 1000),
      tournament.completedAt,
    ]
  );

  return result.rows[0].id;
}

async function upsertEvents(
  client: PoolClient,
  tournamentId: string,
  tournament: ImportedTournament
) {
  const eventIds = new Map<string, string>();

  for (const event of tournament.events) {
    const result = await client.query<EventIdRow>(
      `
        INSERT INTO events (
          startgg_event_id,
          tournament_id,
          name,
          videogame_id,
          entrant_count
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (startgg_event_id) DO UPDATE SET
          tournament_id = EXCLUDED.tournament_id,
          name = EXCLUDED.name,
          videogame_id = EXCLUDED.videogame_id,
          entrant_count = EXCLUDED.entrant_count,
          updated_at = NOW()
        RETURNING id, startgg_event_id
      `,
      [event.id, tournamentId, event.name, ULTIMATE_VIDEOGAME_ID, event.entrantCount]
    );

    eventIds.set(result.rows[0].startgg_event_id, result.rows[0].id);
  }

  return eventIds;
}

async function upsertPlayers(client: PoolClient, players: ImportedPlayer[]) {
  await client.query(
    `
      INSERT INTO players (startgg_player_id, gamer_tag)
      SELECT source.id, source.gamer_tag
      FROM jsonb_to_recordset($1::jsonb) AS source(id TEXT, gamer_tag TEXT)
      ON CONFLICT (startgg_player_id) DO UPDATE SET
        gamer_tag = EXCLUDED.gamer_tag,
        updated_at = NOW()
      WHERE players.gamer_tag IS DISTINCT FROM EXCLUDED.gamer_tag
    `,
    [JSON.stringify(players.map((player) => ({ id: player.id, gamer_tag: player.gamerTag })))]
  );

  const result = await client.query<PlayerIdRow>(
    `
      SELECT id, startgg_player_id
      FROM players
      WHERE startgg_player_id = ANY($1::text[])
    `,
    [players.map((player) => player.id)]
  );

  return new Map(result.rows.map((row) => [row.startgg_player_id, row.id]));
}

async function upsertPeriod(
  client: PoolClient,
  tournamentId: string,
  tournament: ImportedTournament
) {
  const result = await client.query<PeriodRow>(
    `
      WITH existing AS (
        SELECT starts_at
        FROM rating_periods
        WHERE external_key = $1
      ),
      updated AS (
        INSERT INTO rating_periods (
          external_key,
          period_type,
          starts_at,
          ends_at,
          source_tournament_id
        )
        VALUES ($1, 'tournament', $2, $2, $3)
        ON CONFLICT (external_key) DO UPDATE SET
          starts_at = EXCLUDED.starts_at,
          ends_at = EXCLUDED.ends_at,
          source_tournament_id = EXCLUDED.source_tournament_id
        WHERE rating_periods.starts_at IS DISTINCT FROM EXCLUDED.starts_at
           OR rating_periods.ends_at IS DISTINCT FROM EXCLUDED.ends_at
           OR rating_periods.source_tournament_id IS DISTINCT FROM EXCLUDED.source_tournament_id
        RETURNING id, starts_at, TRUE AS changed
      )
      SELECT
        id,
        starts_at,
        LEAST(starts_at, COALESCE((SELECT starts_at FROM existing), starts_at))
          AS invalidation_starts_at,
        changed
      FROM updated
      UNION ALL
      SELECT id, starts_at, starts_at AS invalidation_starts_at, FALSE AS changed
      FROM rating_periods
      WHERE external_key = $1
        AND NOT EXISTS (SELECT 1 FROM updated)
    `,
    [`tournament:${tournament.id}`, tournament.completedAt, tournamentId]
  );

  return result.rows[0];
}

async function upsertSets(
  client: PoolClient,
  tournamentId: string,
  sets: ImportedSet[],
  eventIds: Map<string, string>,
  playerIds: Map<string, string>
) {
  const serializedSets = sets.map((set) => ({
    startgg_set_id: set.id,
    event_id: eventIds.get(set.eventId),
    winner_player_id: playerIds.get(set.winner.id),
    loser_player_id: playerIds.get(set.loser.id),
    completed_at: set.completedAt.toISOString(),
    raw_payload: set.rawPayload,
  }));

  if (
    serializedSets.some((set) => !set.event_id || !set.winner_player_id || !set.loser_player_id)
  ) {
    throw new Error('No se pudieron resolver todos los identificadores de los sets.');
  }

  const result = await client.query<IdRow>(
    `
      INSERT INTO sets (
        startgg_set_id,
        tournament_id,
        event_id,
        videogame_id,
        winner_player_id,
        loser_player_id,
        completed_at,
        raw_payload
      )
      SELECT
        source.startgg_set_id,
        $1,
        source.event_id,
        $2,
        source.winner_player_id,
        source.loser_player_id,
        source.completed_at,
        source.raw_payload
      FROM jsonb_to_recordset($3::jsonb) AS source(
        startgg_set_id TEXT,
        event_id BIGINT,
        winner_player_id BIGINT,
        loser_player_id BIGINT,
        completed_at TIMESTAMPTZ,
        raw_payload JSONB
      )
      ON CONFLICT (startgg_set_id) DO UPDATE SET
        tournament_id = EXCLUDED.tournament_id,
        event_id = EXCLUDED.event_id,
        videogame_id = EXCLUDED.videogame_id,
        winner_player_id = EXCLUDED.winner_player_id,
        loser_player_id = EXCLUDED.loser_player_id,
        completed_at = EXCLUDED.completed_at,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
      WHERE sets.tournament_id IS DISTINCT FROM EXCLUDED.tournament_id
         OR sets.event_id IS DISTINCT FROM EXCLUDED.event_id
         OR sets.winner_player_id IS DISTINCT FROM EXCLUDED.winner_player_id
         OR sets.loser_player_id IS DISTINCT FROM EXCLUDED.loser_player_id
         OR sets.completed_at IS DISTINCT FROM EXCLUDED.completed_at
         OR sets.raw_payload IS DISTINCT FROM EXCLUDED.raw_payload
      RETURNING id
    `,
    [tournamentId, ULTIMATE_VIDEOGAME_ID, JSON.stringify(serializedSets)]
  );

  return result.rowCount ?? 0;
}

async function synchronizePeriodSets(
  client: PoolClient,
  tournamentId: string,
  periodId: string,
  sourceSetIds: string[]
) {
  const staleResult = await client.query<IdRow>(
    `
      SELECT id
      FROM sets
      WHERE tournament_id = $1
        AND videogame_id = $2
        AND NOT (startgg_set_id = ANY($3::text[]))
    `,
    [tournamentId, ULTIMATE_VIDEOGAME_ID, sourceSetIds]
  );
  const staleIds = staleResult.rows.map((row) => row.id);

  if (staleIds.length > 0) {
    await client.query('DELETE FROM rating_period_sets WHERE set_id = ANY($1::bigint[])', [
      staleIds,
    ]);
    await client.query('DELETE FROM sets WHERE id = ANY($1::bigint[])', [staleIds]);
  }

  const linkedResult = await client.query<IdRow>(
    `
      INSERT INTO rating_period_sets (rating_period_id, set_id)
      SELECT $1, sets.id
      FROM sets
      WHERE sets.startgg_set_id = ANY($2::text[])
      ON CONFLICT DO NOTHING
      RETURNING set_id AS id
    `,
    [periodId, sourceSetIds]
  );

  return {
    staleCount: staleIds.length,
    linkedCount: linkedResult.rowCount ?? 0,
  };
}

async function invalidateRatings(client: PoolClient, startsAt: Date) {
  await client.query(
    `
      DELETE FROM rating_snapshots
      WHERE rating_period_id IN (
        SELECT id FROM rating_periods WHERE starts_at >= $1
      )
    `,
    [startsAt]
  );
  await client.query(
    `
      UPDATE rating_periods
      SET status = 'pending', calculated_at = NULL
      WHERE starts_at >= $1
    `,
    [startsAt]
  );
}

export class PostgresHistoryRepository implements HistoryImportRepository {
  constructor(private readonly pool: Pool) {}

  async saveTournament(tournament: ImportedTournament) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const sets = tournament.events.flatMap((event) => event.sets);
      const tournamentId = await upsertTournament(client, tournament);
      const eventIds = await upsertEvents(client, tournamentId, tournament);
      const playerIds = await upsertPlayers(client, uniquePlayers(sets));
      const period = await upsertPeriod(client, tournamentId, tournament);
      const changedSetCount = await upsertSets(client, tournamentId, sets, eventIds, playerIds);
      const synchronization = await synchronizePeriodSets(
        client,
        tournamentId,
        period.id,
        sets.map((set) => set.id)
      );
      const changed =
        period.changed ||
        changedSetCount > 0 ||
        synchronization.staleCount > 0 ||
        synchronization.linkedCount > 0;

      if (changed) await invalidateRatings(client, period.invalidation_starts_at);

      await client.query('COMMIT');

      return { changed, setsSaved: sets.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
