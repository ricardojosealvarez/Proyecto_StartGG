export interface Ranking {
  rank: number;
  title: string;
}

export interface PlayerImage {
  url: string;
}

export interface PlayerUser {
  bio?: string | null;
  images?: PlayerImage[] | null;
}

export interface PlayerSummary {
  id: string;
  gamerTag: string;
  user?: PlayerUser | null;
  rankings?: Ranking[] | null;
}

export interface SearchPlayersResponse {
  players: {
    nodes: PlayerSummary[];
  };
}

export interface PlayerResult {
  placement: number;
  entrant: {
    event: {
      name: string;
      tournament: {
        name: string;
        startAt: number;
      };
    };
  };
}

export interface PlayerDetails {
  gamerTag: string;
  user?: PlayerUser | null;
  rankings?: Ranking[] | null;
  results?: {
    nodes: PlayerResult[];
  } | null;
}

export interface PlayerStatsResponse {
  player: PlayerDetails | null;
}

export interface HeadToHeadPlayer {
  gamerTag: string;
  user?: PlayerUser | null;
}

export interface HeadToHeadSet {
  winnerId: string | number | null;
  displayScore?: string | null;
  event: {
    name: string;
    tournament: {
      name: string;
      startAt: number;
    };
  };
}

export interface HeadToHeadResponse {
  player1: HeadToHeadPlayer | null;
  player2: HeadToHeadPlayer | null;
  sets: {
    nodes: HeadToHeadSet[];
  };
}
