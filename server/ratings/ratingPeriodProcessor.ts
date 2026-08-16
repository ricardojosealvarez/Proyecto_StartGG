import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import { calculateRatingPeriod } from './glicko2.ts';
import type { CompletedMatch, PlayerRating } from './glicko2.ts';

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
}

async function loadNextPendingPeriod(client: PoolClient) {
  const result = await client.query<RatingPeriodRow>(`
    SELECT id, external_key, starts_at
    FROM rating_periods
    WHERE status = 'pending'
    ORDER BY starts_at ASC, id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);

  return result.rows[0] ?? null;
}

async function loadRatingsBeforePeriod(client: PoolClient, startsAt: Date) {
  const result = await client.query<PlayerRatingRow>(
    `
      SELECT DISTINCT ON (players.id)
        players.startgg_player_id AS player_id,
        rating_snapshots.rating,
        rating_snapshots.deviation,
        rating_snapshots.volatility,
        rating_snapshots.matches_played
      FROM players
      INNER JOIN rating_snapshots ON rating_snapshots.player_id = players.id
      INNER JOIN rating_periods ON rating_periods.id = rating_snapshots.rating_period_id
      WHERE rating_periods.status = 'completed'
        AND rating_periods.ends_at <= $1
      ORDER BY players.id, rating_periods.ends_at DESC
    `,
    [startsAt]
  );

  return result.rows.map((row): PlayerRating => ({
    playerId: row.player_id,
    rating: Number(row.rating),
    deviation: Number(row.deviation),
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
      INSERT INTO rating_snapshots (
        rating_period_id,
        player_id,
        rating,
        deviation,
        volatility,
        matches_played,
        period_matches
      )
      SELECT
        $1,
        players.id,
        updates.rating,
        updates.deviation,
        updates.volatility,
        updates.matches_played,
        updates.period_matches
      FROM jsonb_to_recordset($2::jsonb) AS updates(
        player_id TEXT,
        rating DOUBLE PRECISION,
        deviation DOUBLE PRECISION,
        volatility DOUBLE PRECISION,
        matches_played INTEGER,
        period_matches INTEGER
      )
      INNER JOIN players ON players.startgg_player_id = updates.player_id
      ON CONFLICT (rating_period_id, player_id) DO UPDATE SET
        rating = EXCLUDED.rating,
        deviation = EXCLUDED.deviation,
        volatility = EXCLUDED.volatility,
        matches_played = EXCLUDED.matches_played,
        period_matches = EXCLUDED.period_matches,
        created_at = NOW()
    `,
    [ratingPeriodId, JSON.stringify(serializedRatings)]
  );
}

export async function processNextRatingPeriod(pool: Pool): Promise<ProcessedRatingPeriod | null> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const period = await loadNextPendingPeriod(client);
    if (!period) {
      await client.query('COMMIT');
      return null;
    }

    const [currentRatings, matches] = await Promise.all([
      loadRatingsBeforePeriod(client, period.starts_at),
      loadPeriodMatches(client, period.id),
    ]);
    const updatedRatings = addPeriodMatchCounts(
      calculateRatingPeriod(currentRatings, matches),
      matches
    );

    await persistSnapshots(client, period.id, updatedRatings);
    await client.query(
      `
        UPDATE rating_periods
        SET status = 'completed', calculated_at = NOW()
        WHERE id = $1
      `,
      [period.id]
    );
    await client.query('COMMIT');

    return {
      externalKey: period.external_key,
      playerCount: updatedRatings.length,
      setCount: matches.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function processPendingRatingPeriods(pool: Pool) {
  const processedPeriods: ProcessedRatingPeriod[] = [];

  while (true) {
    const processedPeriod = await processNextRatingPeriod(pool);
    if (!processedPeriod) return processedPeriods;
    processedPeriods.push(processedPeriod);
  }
}
