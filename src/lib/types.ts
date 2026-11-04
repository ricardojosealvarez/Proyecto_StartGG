export interface Ranking {
  rank: number;
  title: string;
}

export interface PlayerImage {
  url: string;
  type?: string | null;
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

export interface PlayerSearchResponse {
  query: string;
  players: PlayerSummary[];
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
        isOnline: boolean;
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

export interface PlayerYearStats {
  year: number;
  tournaments: number;
  wins: number;
  setsPlayed: number;
  averageScore: number | null;
  bestScore: number | null;
}

export interface PlayerAnalyticsResponse {
  years: PlayerYearStats[];
  summary: {
    tournaments: number;
    setWins: number;
  };
  source: 'database';
}

export interface TournamentListItem {
  id: string;
  name: string;
  slug: string | null;
  countryCode: string | null;
  startsAt: string;
  isOnline: boolean;
  tier: string | null;
}

export interface TournamentListResponse {
  tournaments: TournamentListItem[];
  source: 'database';
}

export interface PlayerHistoryRefreshResponse {
  candidateTournaments: number;
  tournamentsSeen: number;
  tournamentsSaved: number;
  setsSaved: number;
  ratingPeriodsProcessed: number;
}

export interface CharacterUsage {
  characterId: string;
  name: string;
  imageUrl: string | null;
  games: number;
  usage: number;
}

export interface PlayerCharacterStats {
  primaryCharacter: CharacterUsage | null;
  secondaryCharacters: CharacterUsage[];
  characterUsage: CharacterUsage[];
  gamesWithCharacterData: number;
  gamesAnalyzed: number;
  characterDataCoverage: number;
  characterConfidence: 'none' | 'low' | 'medium' | 'high';
}

export interface HeadToHeadPlayer {
  id: string;
  gamerTag: string;
  user?: PlayerUser | null;
  sets?: {
    nodes: HeadToHeadSet[];
    pageInfo?: {
      totalPages: number;
    } | null;
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
      id: string | number;
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

export interface LocalHeadToHeadSet {
  id: string;
  winnerPlayerId: string;
  displayScore: string | null;
  completedAt: string;
  eventName: string;
  tournamentName: string;
  player1Tag: string;
  player2Tag: string;
}

export interface LocalHeadToHeadResponse {
  sets: LocalHeadToHeadSet[];
  tournaments: Array<{ id: string; name: string; startsAt: string }>;
}
