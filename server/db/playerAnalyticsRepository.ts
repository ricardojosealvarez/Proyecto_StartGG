import type { Pool, QueryResultRow } from 'pg';

export interface PlayerYearStats {
  year: number;
  tournaments: number;
  wins: number;
  setsPlayed: number;
  averageScore: number | null;
  bestScore: number | null;
}

interface PlayerYearStatsRow extends QueryResultRow {
  year: number;
  tournaments: number;
  wins: number;
  sets_played: number;
  average_score: number | null;
  best_score: number | null;
}

export interface PlayerAnalyticsRepository {
  getYearStats(
    playerId: string,
    videogameId: number,
    tournamentMode: 'all' | 'online' | 'offline'
  ): Promise<PlayerYearStats[]>;
}

export class PostgresPlayerAnalyticsRepository implements PlayerAnalyticsRepository {
  constructor(private readonly pool: Pool) {}

  async getYearStats(
    playerId: string,
    videogameId: number,
    tournamentMode: 'all' | 'online' | 'offline'
  ) {
    const result = await this.pool.query<PlayerYearStatsRow>(
      `
        WITH target_player AS (
          SELECT id FROM players WHERE startgg_player_id = $1
        ),
        activity AS (
          SELECT
            EXTRACT(YEAR FROM sets.completed_at)::int AS year,
            COUNT(DISTINCT sets.tournament_id)::int AS tournaments,
            COUNT(*) FILTER (WHERE sets.winner_player_id = target_player.id)::int AS wins,
            COUNT(*)::int AS sets_played
          FROM sets
          INNER JOIN tournaments ON tournaments.id = sets.tournament_id
          CROSS JOIN target_player
          WHERE sets.videogame_id = $2
            AND (sets.winner_player_id = target_player.id OR sets.loser_player_id = target_player.id)
            AND ($3 = 'all' OR tournaments.is_online = ($3 = 'online'))
          GROUP BY 1
        ),
        available_snapshots AS (
          SELECT
            rating_snapshots.player_id,
            rating_snapshots.rating,
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
            rating_periods.starts_at,
            rating_periods.id
          FROM rating_checkpoints
          INNER JOIN rating_periods ON rating_periods.id = rating_checkpoints.rating_period_id
            AND rating_periods.calculation_id = rating_checkpoints.calculation_id
          WHERE rating_periods.status = 'completed'
            AND rating_periods.snapshot_mode = 'sparse'
        ), scores AS (
          SELECT
            EXTRACT(YEAR FROM rating_periods.ends_at)::int AS year,
            ROUND(AVG(latest.rating)::numeric, 2)::float8 AS average_score,
            ROUND(MAX(latest.rating)::numeric, 2)::float8 AS best_score
          FROM rating_periods
          LEFT JOIN tournaments ON tournaments.id = rating_periods.source_tournament_id
          CROSS JOIN target_player
          INNER JOIN LATERAL (
            SELECT available_snapshots.rating
            FROM available_snapshots
            WHERE available_snapshots.player_id = target_player.id
              AND (available_snapshots.starts_at, available_snapshots.id)
                <= (rating_periods.starts_at, rating_periods.id)
            ORDER BY available_snapshots.starts_at DESC, available_snapshots.id DESC
            LIMIT 1
          ) AS latest ON TRUE
          WHERE rating_periods.status = 'completed'
            AND ($3 = 'all' OR tournaments.is_online = ($3 = 'online'))
          GROUP BY 1
        )
        SELECT
          COALESCE(activity.year, scores.year)::int AS year,
          COALESCE(activity.tournaments, 0)::int AS tournaments,
          COALESCE(activity.wins, 0)::int AS wins,
          COALESCE(activity.sets_played, 0)::int AS sets_played,
          scores.average_score,
          scores.best_score
        FROM activity
        FULL OUTER JOIN scores ON scores.year = activity.year
        ORDER BY year
      `,
      [playerId, videogameId, tournamentMode]
    );

    return result.rows.map((row) => ({
      year: Number(row.year),
      tournaments: Number(row.tournaments),
      wins: Number(row.wins),
      setsPlayed: Number(row.sets_played),
      averageScore: row.average_score === null ? null : Number(row.average_score),
      bestScore: row.best_score === null ? null : Number(row.best_score),
    }));
  }

}
