import type { Pool, QueryResultRow } from 'pg';
import type { PlayerCharacterStats } from '../characters/characterStats.ts';

export interface StoredCharacterStats {
  stats: PlayerCharacterStats;
  calculatedAt: Date;
  expiresAt: Date;
}

interface CharacterStatsRow extends QueryResultRow {
  stats: PlayerCharacterStats;
  calculated_at: Date;
  expires_at: Date;
}

export interface CharacterStatsRepository {
  get(
    playerId: string,
    videogameId: string,
    lookbackMonths: number
  ): Promise<StoredCharacterStats | null>;
  upsert(
    playerId: string,
    videogameId: string,
    lookbackMonths: number,
    entry: StoredCharacterStats
  ): Promise<void>;
}

export class PostgresCharacterStatsRepository implements CharacterStatsRepository {
  constructor(private readonly pool: Pool) {}

  async get(playerId: string, videogameId: string, lookbackMonths: number) {
    const result = await this.pool.query<CharacterStatsRow>(
      `
        SELECT stats, calculated_at, expires_at
        FROM player_character_stats
        WHERE player_id = $1
          AND videogame_id = $2
          AND lookback_months = $3
      `,
      [playerId, videogameId, lookbackMonths]
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      stats: row.stats,
      calculatedAt: new Date(row.calculated_at),
      expiresAt: new Date(row.expires_at),
    };
  }

  async upsert(
    playerId: string,
    videogameId: string,
    lookbackMonths: number,
    entry: StoredCharacterStats
  ) {
    await this.pool.query(
      `
        INSERT INTO player_character_stats (
          player_id,
          videogame_id,
          lookback_months,
          stats,
          calculated_at,
          expires_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        ON CONFLICT (player_id, videogame_id, lookback_months)
        DO UPDATE SET
          stats = EXCLUDED.stats,
          calculated_at = EXCLUDED.calculated_at,
          expires_at = EXCLUDED.expires_at
      `,
      [
        playerId,
        videogameId,
        lookbackMonths,
        JSON.stringify(entry.stats),
        entry.calculatedAt,
        entry.expiresAt,
      ]
    );
  }

  async listCandidates(videogameId: string, lookbackMonths: number, limit: number) {
    const result = await this.pool.query<{ startgg_player_id: string }>(
      `
        WITH player_activity AS (
          SELECT winner_player_id AS player_id, MAX(completed_at) AS last_activity
          FROM sets
          WHERE videogame_id = $1::bigint
          GROUP BY winner_player_id
          UNION ALL
          SELECT loser_player_id AS player_id, MAX(completed_at) AS last_activity
          FROM sets
          WHERE videogame_id = $1::bigint
          GROUP BY loser_player_id
        ),
        latest_activity AS (
          SELECT player_id, MAX(last_activity) AS last_activity
          FROM player_activity
          GROUP BY player_id
        )
        SELECT players.startgg_player_id
        FROM latest_activity
        INNER JOIN players ON players.id = latest_activity.player_id
        LEFT JOIN player_character_stats ON
          player_character_stats.player_id = players.startgg_player_id
          AND player_character_stats.videogame_id = $1::text
          AND player_character_stats.lookback_months = $2
        WHERE player_character_stats.player_id IS NULL
        ORDER BY latest_activity.last_activity DESC, players.startgg_player_id ASC
        LIMIT $3
      `,
      [videogameId, lookbackMonths, limit]
    );

    return result.rows.map((row) => row.startgg_player_id);
  }
}
