import { Pool } from 'pg';
import type { QueryResultRow } from 'pg';
import type { RatingSnapshot } from '../predictions/playerPrediction.ts';
import type { PlayerRating } from '../ratings/glicko2.ts';

interface RatingSnapshotRow extends QueryResultRow {
  player_id: string;
  rating: number;
  deviation: number;
  volatility: number;
  matches_played: number;
  period_end_at: Date;
}

function mapRatingSnapshot(row: RatingSnapshotRow): RatingSnapshot {
  return {
    playerId: row.player_id,
    rating: Number(row.rating),
    deviation: Number(row.deviation),
    volatility: Number(row.volatility),
    matchesPlayed: Number(row.matches_played),
    periodEndAt: new Date(row.period_end_at),
  };
}

export interface RatingHistoryRepository {
  getPlayerHistory(playerId: string, limit?: number): Promise<RatingSnapshot[]>;
  getLatestRating(playerId: string): Promise<PlayerRating | null>;
}

export class PostgresRatingRepository implements RatingHistoryRepository {
  constructor(private readonly pool: Pool) {}

  async getPlayerHistory(playerId: string, limit = 8) {
    const result = await this.pool.query<RatingSnapshotRow>(
      `
        WITH target_player AS (
          SELECT id FROM players WHERE startgg_player_id = $1
        ), target_periods AS (
          SELECT id, starts_at, ends_at
          FROM rating_periods
          WHERE status = 'completed'
          ORDER BY starts_at DESC, id DESC
          LIMIT $2
        ), available_snapshots AS (
          SELECT
            rating_snapshots.player_id,
            rating_snapshots.rating,
            rating_snapshots.deviation,
            rating_snapshots.volatility,
            rating_snapshots.matches_played,
            rating_periods.starts_at,
            rating_periods.id
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
          $1 AS player_id,
          latest.rating,
          SQRT(
            POWER(latest.deviation / 173.7178, 2)
            + COUNT(inactive_period.id) * POWER(latest.volatility, 2)
          ) * 173.7178 AS deviation,
          latest.volatility,
          latest.matches_played,
          target_periods.ends_at AS period_end_at
        FROM target_periods
        CROSS JOIN target_player
        INNER JOIN LATERAL (
          SELECT available_snapshots.*
          FROM available_snapshots
          WHERE available_snapshots.player_id = target_player.id
            AND (available_snapshots.starts_at, available_snapshots.id)
              <= (target_periods.starts_at, target_periods.id)
          ORDER BY available_snapshots.starts_at DESC, available_snapshots.id DESC
          LIMIT 1
        ) AS latest ON TRUE
        LEFT JOIN rating_periods AS inactive_period
          ON inactive_period.status = 'completed'
          AND (inactive_period.starts_at, inactive_period.id) > (latest.starts_at, latest.id)
          AND (inactive_period.starts_at, inactive_period.id)
            <= (target_periods.starts_at, target_periods.id)
        GROUP BY
          target_periods.starts_at,
          target_periods.id,
          target_periods.ends_at,
          latest.rating,
          latest.deviation,
          latest.volatility,
          latest.matches_played
        ORDER BY target_periods.starts_at DESC, target_periods.id DESC
      `,
      [playerId, limit]
    );

    return result.rows.map(mapRatingSnapshot);
  }

  async getLatestRating(playerId: string) {
    const [latest] = await this.getPlayerHistory(playerId, 1);

    if (!latest) return null;

    return {
      playerId: latest.playerId,
      rating: latest.rating,
      deviation: latest.deviation,
      volatility: latest.volatility,
      matchesPlayed: latest.matchesPlayed,
    };
  }
}
