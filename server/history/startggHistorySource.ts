import { StartggClient } from '../startgg/startggClient.ts';
import { ULTIMATE_VIDEOGAME_ID } from './historyTypes.ts';
import type {
  EventSummary,
  PlayerTournamentPage,
  SetPage,
  StartggSet,
  TournamentPage,
  TournamentSummary,
} from './historyTypes.ts';

const TOURNAMENTS_PER_PAGE = 15;
const PLAYER_SETS_PER_PAGE = 100;
const SETS_PER_PAGE = 40;

const TOURNAMENT_HISTORY_QUERY = `
  query UltimateTournamentHistory(
    $page: Int!
    $perPage: Int!
    $videogameId: ID!
    $afterDate: Timestamp!
    $beforeDate: Timestamp!
  ) {
    tournaments(
      query: {
        page: $page
        perPage: $perPage
        sortBy: "startAt asc"
        filter: {
          afterDate: $afterDate
          beforeDate: $beforeDate
          past: true
          published: true
          videogameIds: [$videogameId]
        }
      }
    ) {
      pageInfo {
        totalPages
      }
      nodes {
        id
        name
        slug
        countryCode
        isOnline
        startAt
        endAt
        events(filter: { videogameId: [$videogameId] }) {
          id
          name
          numEntrants
        }
      }
    }
  }
`;

const PLAYER_TOURNAMENT_HISTORY_QUERY = `
  query PlayerUltimateTournamentHistory($playerId: ID!, $page: Int!, $perPage: Int!) {
    player(id: $playerId) {
      sets(page: $page, perPage: $perPage) {
        pageInfo {
          totalPages
        }
        nodes {
          event {
            id
            name
            numEntrants
            videogame {
              id
            }
            tournament {
              id
              name
              slug
              countryCode
              isOnline
              startAt
              endAt
            }
          }
        }
      }
    }
  }
`;

const EVENT_SETS_QUERY = `
  query UltimateEventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      sets(page: $page, perPage: $perPage, sortType: STANDARD) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          state
          winnerId
          completedAt
          displayScore
          slots {
            entrant {
              id
              name
              participants {
                gamerTag
                player {
                  id
                  gamerTag
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface TournamentEventNode {
  id: string | number;
  name: string;
  numEntrants?: number | null;
}

interface TournamentNode {
  id: string | number;
  name: string;
  slug: string;
  countryCode?: string | null;
  isOnline: boolean;
  startAt: number;
  endAt?: number | null;
  events?: TournamentEventNode[] | null;
}

interface TournamentHistoryResponse {
  tournaments: {
    pageInfo: { totalPages: number };
    nodes: TournamentNode[];
  };
}

interface PlayerTournamentHistoryResponse {
  player: {
    sets: {
      pageInfo: { totalPages: number };
      nodes: Array<{
        event?:
          | (TournamentEventNode & {
              videogame?: { id: string | number } | null;
              tournament?: Omit<TournamentNode, 'events'> | null;
            })
          | null;
      }>;
    };
  } | null;
}

interface EventSetsResponse {
  event: {
    sets: {
      pageInfo: { totalPages: number };
      nodes: Array<{
        id: string | number;
        state: number;
        winnerId?: string | number | null;
        completedAt?: number | null;
        displayScore?: string | null;
        slots?: StartggSet['slots'] | null;
      }>;
    };
  } | null;
}

function mapEvent(event: TournamentEventNode): EventSummary {
  return {
    id: String(event.id),
    name: event.name,
    entrantCount: event.numEntrants ?? null,
  };
}

function mapTournament(tournament: TournamentNode): TournamentSummary {
  return {
    id: String(tournament.id),
    name: tournament.name,
    slug: tournament.slug,
    countryCode: tournament.countryCode?.toUpperCase() ?? null,
    isOnline: tournament.isOnline,
    startAt: tournament.startAt,
    endAt: tournament.endAt ?? null,
    events: (tournament.events ?? []).map(mapEvent),
  };
}

function mapSet(set: NonNullable<EventSetsResponse['event']>['sets']['nodes'][number]): StartggSet {
  return {
    id: String(set.id),
    state: set.state,
    winnerId: set.winnerId ?? null,
    completedAt: set.completedAt ?? null,
    displayScore: set.displayScore ?? null,
    slots: set.slots ?? [],
  };
}

export class StartggHistorySource {
  constructor(private readonly client: StartggClient) {}

  async getTournamentPage(
    page: number,
    afterDate: number,
    beforeDate: number
  ): Promise<TournamentPage> {
    const response = await this.client.request<TournamentHistoryResponse>(
      TOURNAMENT_HISTORY_QUERY,
      {
        page,
        perPage: TOURNAMENTS_PER_PAGE,
        videogameId: ULTIMATE_VIDEOGAME_ID,
        afterDate,
        beforeDate,
      }
    );

    return {
      tournaments: response.tournaments.nodes.map(mapTournament),
      totalPages: response.tournaments.pageInfo.totalPages,
    };
  }

  async getPlayerTournamentPage(playerId: string, page: number): Promise<PlayerTournamentPage> {
    const response = await this.client.request<PlayerTournamentHistoryResponse>(
      PLAYER_TOURNAMENT_HISTORY_QUERY,
      {
        playerId,
        page,
        perPage: PLAYER_SETS_PER_PAGE,
      }
    );
    const sets = response.player?.sets;
    const tournaments = new Map<string, TournamentSummary>();

    for (const node of sets?.nodes ?? []) {
      const event = node.event;
      const tournament = event?.tournament;
      if (!event || !tournament || Number(event.videogame?.id) !== ULTIMATE_VIDEOGAME_ID) {
        continue;
      }

      const tournamentId = String(tournament.id);
      const mappedEvent = mapEvent(event);
      const existing = tournaments.get(tournamentId);
      if (existing) {
        if (!existing.events.some((candidate) => candidate.id === mappedEvent.id)) {
          existing.events.push(mappedEvent);
        }
        continue;
      }

      tournaments.set(tournamentId, mapTournament({ ...tournament, events: [event] }));
    }

    return {
      tournaments: [...tournaments.values()],
      totalPages: sets?.pageInfo.totalPages ?? 0,
    };
  }

  async getSetPage(eventId: string, page: number): Promise<SetPage> {
    const response = await this.client.request<EventSetsResponse>(EVENT_SETS_QUERY, {
      eventId,
      page,
      perPage: SETS_PER_PAGE,
    });

    return {
      sets: response.event?.sets.nodes.map(mapSet) ?? [],
      totalPages: response.event?.sets.pageInfo.totalPages ?? 0,
    };
  }
}
