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
        SELECT
          players.startgg_player_id AS player_id,
          rating_snapshots.rating,
          rating_snapshots.deviation,
          rating_snapshots.volatility,
          rating_snapshots.matches_played,
          rating_periods.ends_at AS period_end_at
        FROM rating_snapshots
        INNER JOIN players ON players.id = rating_snapshots.player_id
        INNER JOIN rating_periods ON rating_periods.id = rating_snapshots.rating_period_id
        WHERE players.startgg_player_id = $1
        ORDER BY rating_periods.ends_at DESC
        LIMIT $2
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
