import type { Pool, QueryResultRow } from 'pg';

export interface PlayerYearStats {
  year: number;
  tournaments: number;
  wins: number;
  averageScore: number | null;
  bestScore: number | null;
}

interface PlayerYearStatsRow extends QueryResultRow {
  year: number;
  tournaments: number;
  wins: number;
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
            COUNT(*) FILTER (WHERE sets.winner_player_id = target_player.id)::int AS wins
          FROM sets
          INNER JOIN tournaments ON tournaments.id = sets.tournament_id
          CROSS JOIN target_player
          WHERE sets.videogame_id = $2
            AND (sets.winner_player_id = target_player.id OR sets.loser_player_id = target_player.id)
            AND ($3 = 'all' OR tournaments.is_online = ($3 = 'online'))
          GROUP BY 1
        ),
        scores AS (
          SELECT
            EXTRACT(YEAR FROM rating_periods.ends_at)::int AS year,
            ROUND(AVG(rating_snapshots.rating)::numeric, 2)::float8 AS average_score,
            ROUND(MAX(rating_snapshots.rating)::numeric, 2)::float8 AS best_score
          FROM rating_snapshots
          INNER JOIN rating_periods ON rating_periods.id = rating_snapshots.rating_period_id
          LEFT JOIN tournaments ON tournaments.id = rating_periods.source_tournament_id
          CROSS JOIN target_player
          WHERE rating_snapshots.player_id = target_player.id
            AND ($3 = 'all' OR tournaments.is_online = ($3 = 'online'))
          GROUP BY 1
        )
        SELECT
          COALESCE(activity.year, scores.year)::int AS year,
          COALESCE(activity.tournaments, 0)::int AS tournaments,
          COALESCE(activity.wins, 0)::int AS wins,
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
      averageScore: row.average_score === null ? null : Number(row.average_score),
      bestScore: row.best_score === null ? null : Number(row.best_score),
    }));
  }
}
