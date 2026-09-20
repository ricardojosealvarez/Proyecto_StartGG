import type { Pool, QueryResultRow } from 'pg';

export interface LocalHeadToHeadSet {
  id: string;
  winnerPlayerId: string;
  displayScore: string | null;
  completedAt: Date;
  eventName: string;
  tournamentName: string;
  player1Tag: string;
  player2Tag: string;
}

export interface LocalHeadToHeadTournament {
  id: string;
  name: string;
  startsAt: Date;
}

interface HeadToHeadRow extends QueryResultRow {
  startgg_set_id: string;
  winner_player_id: string;
  display_score: string | null;
  completed_at: Date;
  event_name: string;
  tournament_name: string;
  player1_tag: string;
  player2_tag: string;
}

interface HeadToHeadTournamentRow extends QueryResultRow {
  tournament_id: string;
  tournament_name: string;
  starts_at: Date;
}

export interface HeadToHeadRepository {
  getHistory(
    player1Id: string,
    player2Id: string,
    videogameId: number
  ): Promise<LocalHeadToHeadSet[]>;
  getSharedTournaments(
    player1Id: string,
    player2Id: string,
    videogameId: number
  ): Promise<LocalHeadToHeadTournament[]>;
}

export class PostgresHeadToHeadRepository implements HeadToHeadRepository {
  constructor(private readonly pool: Pool) {}

  async getHistory(player1Id: string, player2Id: string, videogameId: number) {
    const result = await this.pool.query<HeadToHeadRow>(
      `
        SELECT
          sets.startgg_set_id,
          winner.startgg_player_id AS winner_player_id,
          sets.raw_payload->>'displayScore' AS display_score,
          sets.completed_at,
          COALESCE(events.name, 'Evento') AS event_name,
          tournaments.name AS tournament_name,
          player1.gamer_tag AS player1_tag,
          player2.gamer_tag AS player2_tag
        FROM sets
        INNER JOIN players AS winner ON winner.id = sets.winner_player_id
        INNER JOIN players AS player1 ON player1.startgg_player_id = $1
        INNER JOIN players AS player2 ON player2.startgg_player_id = $2
        INNER JOIN tournaments ON tournaments.id = sets.tournament_id
        LEFT JOIN events ON events.id = sets.event_id
        WHERE sets.videogame_id = $3
          AND (
            (sets.winner_player_id = player1.id AND sets.loser_player_id = player2.id)
            OR
            (sets.winner_player_id = player2.id AND sets.loser_player_id = player1.id)
          )
        ORDER BY sets.completed_at DESC
      `,
      [player1Id, player2Id, videogameId]
    );

    return result.rows.map((row) => ({
      id: row.startgg_set_id,
      winnerPlayerId: row.winner_player_id,
      displayScore: row.display_score,
      completedAt: new Date(row.completed_at),
      eventName: row.event_name,
      tournamentName: row.tournament_name,
      player1Tag: row.player1_tag,
      player2Tag: row.player2_tag,
    }));
  }

  async getSharedTournaments(player1Id: string, player2Id: string, videogameId: number) {
    const result = await this.pool.query<HeadToHeadTournamentRow>(
      `
        SELECT tournaments.id AS tournament_id, tournaments.name AS tournament_name, tournaments.starts_at
        FROM tournaments
        INNER JOIN sets ON sets.tournament_id = tournaments.id
        WHERE sets.videogame_id = $3
          AND (
            sets.winner_player_id IN (
            (SELECT id FROM players WHERE startgg_player_id = $1),
            (SELECT id FROM players WHERE startgg_player_id = $2)
            )
            OR sets.loser_player_id IN (
            (SELECT id FROM players WHERE startgg_player_id = $1),
            (SELECT id FROM players WHERE startgg_player_id = $2)
            )
          )
        GROUP BY tournaments.id, tournaments.name, tournaments.starts_at
        HAVING COUNT(DISTINCT CASE
          WHEN sets.winner_player_id = (SELECT id FROM players WHERE startgg_player_id = $1)
            OR sets.loser_player_id = (SELECT id FROM players WHERE startgg_player_id = $1) THEN $1
          WHEN sets.winner_player_id = (SELECT id FROM players WHERE startgg_player_id = $2)
            OR sets.loser_player_id = (SELECT id FROM players WHERE startgg_player_id = $2) THEN $2
        END) = 2
        ORDER BY tournaments.starts_at DESC
      `,
      [player1Id, player2Id, videogameId]
    );

    return result.rows.map((row) => ({
      id: row.tournament_id,
      name: row.tournament_name,
      startsAt: new Date(row.starts_at),
    }));
  }
}
