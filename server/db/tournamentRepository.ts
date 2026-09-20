import type { Pool, QueryResultRow } from 'pg';

export type TournamentMode = 'all' | 'online' | 'offline';

export interface TournamentListItem {
  id: string;
  name: string;
  slug: string | null;
  countryCode: string | null;
  startsAt: string;
  isOnline: boolean;
  tier: string | null;
}

interface TournamentRow extends QueryResultRow {
  startgg_tournament_id: string;
  name: string;
  slug: string | null;
  country_code: string | null;
  starts_at: Date;
  is_online: boolean;
  tier: string | null;
}

export interface TournamentRepository {
  list(
    playerId: string,
    videogameId: number,
    tournamentMode: TournamentMode
  ): Promise<TournamentListItem[]>;
}

export class PostgresTournamentRepository implements TournamentRepository {
  constructor(private readonly pool: Pool) {}

  async list(playerId: string, videogameId: number, tournamentMode: TournamentMode) {
    const result = await this.pool.query<TournamentRow>(
      `
        SELECT
          startgg_tournament_id,
          name,
          slug,
          country_code,
          starts_at,
          is_online,
          tier
        FROM tournaments
        INNER JOIN sets ON sets.tournament_id = tournaments.id
        INNER JOIN players ON
          players.id = sets.winner_player_id OR players.id = sets.loser_player_id
        WHERE players.startgg_player_id = $1
          AND sets.videogame_id = $2
          AND tournaments.is_online IS NOT NULL
          AND ($3 = 'all' OR tournaments.is_online = ($3 = 'online'))
        GROUP BY tournaments.id
        ORDER BY tournaments.starts_at DESC, tournaments.name
      `,
      [playerId, videogameId, tournamentMode]
    );

    return result.rows.map((row) => ({
      id: row.startgg_tournament_id,
      name: row.name,
      slug: row.slug,
      countryCode: row.country_code,
      startsAt: row.starts_at.toISOString(),
      isOnline: row.is_online,
      tier: row.tier,
    }));
  }
}
