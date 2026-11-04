import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import { ULTIMATE_VIDEOGAME_ID } from '../history/historyTypes.ts';
import { processPendingRatingPeriods } from './ratingPeriodProcessor.ts';
import { lockRatingData } from './ratingLocks.ts';

interface CountRow extends QueryResultRow {
  count: string;
}

export interface RebuildRatingsSummary {
  periodsPrepared: number;
  periodsProcessed: number;
  snapshotsCreated: number;
}

async function prepareRatingPeriods(client: PoolClient) {
  await client.query(
    `
      INSERT INTO rating_periods (
        external_key,
        period_type,
        starts_at,
        ends_at,
        source_tournament_id
      )
      SELECT
        'tournament:' || tournaments.startgg_tournament_id,
        'tournament',
        COALESCE(tournaments.completed_at, MAX(sets.completed_at), tournaments.starts_at),
        COALESCE(tournaments.completed_at, MAX(sets.completed_at), tournaments.starts_at),
        tournaments.id
      FROM tournaments
      INNER JOIN sets ON sets.tournament_id = tournaments.id
      WHERE sets.videogame_id = $1
      GROUP BY tournaments.id
      ON CONFLICT (external_key) DO UPDATE SET
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        source_tournament_id = EXCLUDED.source_tournament_id
    `,
    [ULTIMATE_VIDEOGAME_ID]
  );

  await client.query(
    `
      INSERT INTO rating_period_sets (rating_period_id, set_id)
      SELECT rating_periods.id, sets.id
      FROM sets
      INNER JOIN rating_periods
        ON rating_periods.source_tournament_id = sets.tournament_id
      WHERE sets.videogame_id = $1
      ON CONFLICT DO NOTHING
    `,
    [ULTIMATE_VIDEOGAME_ID]
  );

  await client.query(`
    UPDATE rating_periods
    SET status = 'pending', calculated_at = NULL
  `);
}

async function countCompletedPeriods(pool: Pool) {
  const result = await pool.query<CountRow>(
    "SELECT COUNT(*) AS count FROM rating_periods WHERE status = 'completed'"
  );
  return Number(result.rows[0].count);
}

async function countCurrentSnapshots(pool: Pool) {
  const result = await pool.query<CountRow>(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT rating_snapshots.player_id
      FROM rating_snapshots
      INNER JOIN rating_periods ON rating_periods.id = rating_snapshots.rating_period_id
      WHERE rating_periods.status = 'completed'
        AND rating_periods.snapshot_mode = 'dense'
      UNION ALL
      SELECT rating_checkpoints.player_id
      FROM rating_checkpoints
      INNER JOIN rating_periods ON rating_periods.id = rating_checkpoints.rating_period_id
        AND rating_periods.calculation_id = rating_checkpoints.calculation_id
      WHERE rating_periods.status = 'completed'
        AND rating_periods.snapshot_mode = 'sparse'
    ) AS current_snapshots
  `);
  return Number(result.rows[0].count);
}

export async function rebuildRatings(pool: Pool): Promise<RebuildRatingsSummary> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await lockRatingData(client);
    await prepareRatingPeriods(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const processedPeriods = await processPendingRatingPeriods(pool);

  return {
    periodsPrepared: await countCompletedPeriods(pool),
    periodsProcessed: processedPeriods.length,
    snapshotsCreated: await countCurrentSnapshots(pool),
  };
}
