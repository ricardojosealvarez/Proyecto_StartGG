import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import { calculateRatingPeriod, inflateRatingDeviation } from './glicko2.ts';
import type { CompletedMatch, PlayerRating } from './glicko2.ts';
import { lockRatingData, RATING_LOCK_NAMESPACE, RATING_WORKER_LOCK } from './ratingLocks.ts';

interface RatingPeriodRow extends QueryResultRow {
  id: string;
  external_key: string;
  starts_at: Date;
}

interface PlayerRatingRow extends QueryResultRow {
  player_id: string;
  rating: number;
  deviation: number;
  volatility: number;
  matches_played: number;
  inactive_periods: number;
}

interface CompletedMatchRow extends QueryResultRow {
  winner_player_id: string;
  loser_player_id: string;
}

interface PersistedRating extends PlayerRating {
  periodMatches: number;
}

export interface ProcessedRatingPeriod {
  externalKey: string;
  playerCount: number;
  setCount: number;
  timings: { loadMs: number; calculateMs: number; persistMs: number; totalMs: number };
}

export interface RatingProcessingOptions {
  maxPeriods?: number;
  onPeriod?: (period: ProcessedRatingPeriod) => void;
}

async function loadNextPendingPeriod(client: PoolClient) {
  const result = await client.query<RatingPeriodRow>(`
    SELECT id, external_key, starts_at
    FROM rating_periods
    WHERE status = 'pending'
    ORDER BY starts_at ASC, id ASC
    LIMIT 1
    FOR UPDATE
  `);

  return result.rows[0] ?? null;
}

async function loadRatingsBeforePeriod(
  client: PoolClient,
  period: RatingPeriodRow,
  playerIds: string[]
) {
  if (playerIds.length === 0) return [];
  const result = await client.query<PlayerRatingRow>(
    `
      WITH requested_players AS (
        SELECT UNNEST($1::text[]) AS player_id
      ), available_snapshots AS (
        SELECT
          rating_snapshots.player_id,
          rating_snapshots.rating,
          rating_snapshots.deviation,
          rating_snapshots.volatility,
          rating_snapshots.matches_played,
          rating_periods.starts_at AS period_starts_at,
          rating_periods.id AS period_id
        FROM rating_snapshots
        INNER JOIN rating_periods ON rating_periods.id = rating_snapshots.rating_period_id
        WHERE rating_periods.status = 'completed'
          AND rating_periods.snapshot_mode = 'dense'
        UNION ALL
        SELECT
          rating_checkpoints.player_id,
          rating_checkpoints.rating,
          rating_checkpoints.deviation,
          rating_checkpoints.volatility,
          rating_checkpoints.matches_played,
          rating_periods.starts_at,
          rating_periods.id
        FROM rating_checkpoints
        INNER JOIN rating_periods ON rating_periods.id = rating_checkpoints.rating_period_id
          AND rating_periods.calculation_id = rating_checkpoints.calculation_id
        WHERE rating_periods.status = 'completed'
          AND rating_periods.snapshot_mode = 'sparse'
      )
      SELECT
        requested_players.player_id,
        latest.rating,
        latest.deviation,
        latest.volatility,
        latest.matches_played,
        (
          SELECT COUNT(*)::int
          FROM rating_periods AS inactive_period
          WHERE inactive_period.status = 'completed'
            AND (inactive_period.starts_at, inactive_period.id)
              > (latest.period_starts_at, latest.period_id)
            AND (inactive_period.starts_at, inactive_period.id) < ($2, $3)
        ) AS inactive_periods
      FROM requested_players
      INNER JOIN players ON players.startgg_player_id = requested_players.player_id
      INNER JOIN LATERAL (
        SELECT available_snapshots.*
        FROM available_snapshots
        WHERE available_snapshots.player_id = players.id
          AND (available_snapshots.period_starts_at, available_snapshots.period_id) < ($2, $3)
        ORDER BY available_snapshots.period_starts_at DESC, available_snapshots.period_id DESC
        LIMIT 1
      ) AS latest ON TRUE
    `,
    [playerIds, period.starts_at, period.id]
  );

  return result.rows.map((row): PlayerRating => ({
    playerId: row.player_id,
    rating: Number(row.rating),
    deviation: inflateRatingDeviation(
      Number(row.deviation),
      Number(row.volatility),
      Number(row.inactive_periods)
    ),
    volatility: Number(row.volatility),
    matchesPlayed: Number(row.matches_played),
  }));
}

async function loadPeriodMatches(client: PoolClient, ratingPeriodId: string) {
  const result = await client.query<CompletedMatchRow>(
    `
      SELECT
        winner.startgg_player_id AS winner_player_id,
        loser.startgg_player_id AS loser_player_id
      FROM rating_period_sets
      INNER JOIN sets ON sets.id = rating_period_sets.set_id
      INNER JOIN players AS winner ON winner.id = sets.winner_player_id
      INNER JOIN players AS loser ON loser.id = sets.loser_player_id
      WHERE rating_period_sets.rating_period_id = $1
      ORDER BY sets.completed_at ASC, sets.id ASC
    `,
    [ratingPeriodId]
  );

  return result.rows.map((row): CompletedMatch => ({
    winnerPlayerId: row.winner_player_id,
    loserPlayerId: row.loser_player_id,
  }));
}

function addPeriodMatchCounts(
  ratings: PlayerRating[],
  matches: CompletedMatch[]
): PersistedRating[] {
  const counts = new Map<string, number>();

  for (const match of matches) {
    counts.set(match.winnerPlayerId, (counts.get(match.winnerPlayerId) ?? 0) + 1);
    counts.set(match.loserPlayerId, (counts.get(match.loserPlayerId) ?? 0) + 1);
  }

  return ratings.map((rating) => ({
    ...rating,
    periodMatches: counts.get(rating.playerId) ?? 0,
  }));
}

async function persistSnapshots(
  client: PoolClient,
  ratingPeriodId: string,
  calculationId: string,
  ratings: PersistedRating[]
) {
  const serializedRatings = ratings.map((rating) => ({
    player_id: rating.playerId,
    rating: rating.rating,
    deviation: rating.deviation,
    volatility: rating.volatility,
    matches_played: rating.matchesPlayed,
    period_matches: rating.periodMatches,
  }));

  await client.query(
    `
      INSERT INTO rating_checkpoints (
        rating_period_id,
        player_id,
        calculation_id,
        rating,
        deviation,
        volatility,
        matches_played,
        period_matches
      )
      SELECT
        $1,
        players.id,
        $2,
        updates.rating,
        updates.deviation,
        updates.volatility,
        updates.matches_played,
        updates.period_matches
      FROM jsonb_to_recordset($3::jsonb) AS updates(
        player_id TEXT,
        rating DOUBLE PRECISION,
        deviation DOUBLE PRECISION,
        volatility DOUBLE PRECISION,
        matches_played INTEGER,
        period_matches INTEGER
      )
      INNER JOIN players ON players.startgg_player_id = updates.player_id
      ON CONFLICT (rating_period_id, player_id, calculation_id) DO NOTHING
    `,
    [ratingPeriodId, calculationId, JSON.stringify(serializedRatings)]
  );
}

async function processPeriod(client: PoolClient): Promise<ProcessedRatingPeriod | null> {
  const startedAt = performance.now();

  try {
    await client.query('BEGIN');
    await lockRatingData(client);

    const period = await loadNextPendingPeriod(client);
    if (!period) {
      await client.query('COMMIT');
      return null;
    }

    const matches = await loadPeriodMatches(client, period.id);
    const activePlayerIds = [
      ...new Set(matches.flatMap((match) => [match.winnerPlayerId, match.loserPlayerId])),
    ];
    const currentRatings = await loadRatingsBeforePeriod(client, period, activePlayerIds);
    const loadedAt = performance.now();
    const updatedRatings = addPeriodMatchCounts(
      calculateRatingPeriod(currentRatings, matches),
      matches
    );
    const calculatedAt = performance.now();

    const calculationId = randomUUID();
    await persistSnapshots(client, period.id, calculationId, updatedRatings);
    await client.query(
      `
        UPDATE rating_periods
        SET status = 'completed',
            calculated_at = NOW(),
            snapshot_mode = 'sparse',
            calculation_id = $2
        WHERE id = $1
      `,
      [period.id, calculationId]
    );
    await client.query('COMMIT');

    const finishedAt = performance.now();

    return {
      externalKey: period.external_key,
      playerCount: updatedRatings.length,
      setCount: matches.length,
      timings: {
        loadMs: Math.round(loadedAt - startedAt),
        calculateMs: Math.round(calculatedAt - loadedAt),
        persistMs: Math.round(finishedAt - calculatedAt),
        totalMs: Math.round(finishedAt - startedAt),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function processNextRatingPeriod(pool: Pool): Promise<ProcessedRatingPeriod | null> {
  return (await processPendingRatingPeriods(pool, { maxPeriods: 1 }))[0] ?? null;
}

export async function processPendingRatingPeriods(
  pool: Pool,
  options: RatingProcessingOptions = {}
) {
  if (
    options.maxPeriods !== undefined &&
    (!Number.isInteger(options.maxPeriods) || options.maxPeriods < 1)
  ) {
    throw new Error('`maxPeriods` debe ser un entero positivo.');
  }
  const processedPeriods: ProcessedRatingPeriod[] = [];
  const client = await pool.connect();
  let locked = false;
  let discardConnection = false;

  try {
    const lock = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS acquired',
      [RATING_LOCK_NAMESPACE, RATING_WORKER_LOCK]
    );
    locked = lock.rows[0]?.acquired === true;
    if (!locked) throw new Error('Ya hay un procesador Glicko-2 activo.');

    while (options.maxPeriods === undefined || processedPeriods.length < options.maxPeriods) {
      const processedPeriod = await processPeriod(client);
      if (!processedPeriod) break;
      processedPeriods.push(processedPeriod);
      options.onPeriod?.(processedPeriod);
    }
    return processedPeriods;
  } finally {
    try {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [
          RATING_LOCK_NAMESPACE,
          RATING_WORKER_LOCK,
        ]);
      }
    } catch {
      discardConnection = true;
    } finally {
      client.release(discardConnection);
    }
  }
}
