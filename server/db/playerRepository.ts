import type { Pool, QueryResultRow } from 'pg';

export interface SearchPlayer {
  id: string;
  gamerTag: string;
  user?: null;
}

interface PlayerRow extends QueryResultRow {
  startgg_player_id: string;
  gamer_tag: string;
}

export interface PlayerSearchRepository {
  searchByGamerTag(query: string, limit?: number): Promise<SearchPlayer[]>;
}

export class PostgresPlayerRepository implements PlayerSearchRepository {
  constructor(private readonly pool: Pool) {}

  async searchByGamerTag(query: string, limit = 20) {
    const normalizedQuery = query.trim();
    const result = await this.pool.query<PlayerRow>(
      `
        SELECT startgg_player_id, gamer_tag
        FROM players
        WHERE gamer_tag ILIKE '%' || $1 || '%'
        ORDER BY
          CASE
            WHEN LOWER(gamer_tag) = LOWER($1) THEN 0
            WHEN LOWER(gamer_tag) LIKE LOWER($1) || '%' THEN 1
            ELSE 2
          END,
          gamer_tag ASC
        LIMIT $2
      `,
      [normalizedQuery, limit]
    );

    return result.rows.map((row) => ({
      id: row.startgg_player_id,
      gamerTag: row.gamer_tag,
      user: null,
    }));
  }
}
