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
  slug?: string | null;
}

export interface PlayerSummary {
  id: string;
  gamerTag: string;
  user?: PlayerUser | null;
}

export interface PlayerSearchCandidate {
  slug: string;
  url: string;
}

export interface PlayerSearchResponse {
  query: string;
  candidates: PlayerSearchCandidate[];
}

export interface ResolvePlayerResponse {
  player: PlayerSummary | null;
}

export interface ResolveUserResponse {
  user: {
    player: PlayerSummary | null;
    images?: PlayerImage[] | null;
    bio?: string | null;
    slug?: string | null;
  } | null;
}

export interface CurrentUserResponse {
  currentUser: {
    slug?: string | null;
    bio?: string | null;
    images?: PlayerImage[] | null;
    player: PlayerSummary | null;
  } | null;
}

export interface RecentStanding {
  placement: number;
  entrant: {
    event: {
      name: string;
      videogame?: {
        id: number;
        displayName: string;
      } | null;
      tournament: {
        name: string;
        startAt: number;
      };
    };
  };
}

export interface PlayerDetails {
  id: string;
  gamerTag: string;
  user?: PlayerUser | null;
  rankings?: Ranking[] | null;
  recentStandings?: RecentStanding[] | null;
}

export interface PlayerStatsResponse {
  player: PlayerDetails | null;
}

export interface HeadToHeadPlayer {
  id: string;
  gamerTag: string;
  user?: PlayerUser | null;
  sets?: {
    nodes: HeadToHeadSet[];
  } | null;
}

export interface HeadToHeadSet {
  id: string;
  winnerId: string | number | null;
  displayScore?: string | null;
  fullRoundText?: string | null;
  slots?: Array<{
    entrant?: {
      id: string;
      name?: string | null;
      participants?: Array<{
        player?: {
          id: string;
          gamerTag?: string | null;
        } | null;
      }> | null;
    } | null;
  }> | null;
  event: {
    name: string;
    videogame?: {
      id: number;
      displayName: string;
    } | null;
    tournament: {
      name: string;
      startAt: number;
    };
  };
}

export interface HeadToHeadResponse {
  player1: HeadToHeadPlayer | null;
  player2: HeadToHeadPlayer | null;
}
