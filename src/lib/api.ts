import { ClientError, GraphQLClient } from 'graphql-request';

const API_ENDPOINT = 'https://api.start.gg/gql/alpha';
const API_KEY = import.meta.env.VITE_STARTGG_API_KEY;

export type StartggErrorCode =
  | 'missing_key'
  | 'expired_token'
  | 'network'
  | 'api'
  | 'unknown';

export class StartggApiError extends Error {
  constructor(
    public code: StartggErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'StartggApiError';
  }
}

export const client = new GraphQLClient(API_ENDPOINT, {
  headers: {
    Authorization: `Bearer ${API_KEY}`,
  },
});

export const hasConfiguredApiKey = Boolean(API_KEY);

export function getStartggErrorMessage(error: unknown) {
  if (error instanceof StartggApiError) {
    return error.message;
  }

  return 'No pude completar la consulta en Start.gg.';
}

export async function requestStartgg<TResponse>(
  query: string,
  variables?: Record<string, unknown>
) {
  if (!API_KEY) {
    throw new StartggApiError(
      'missing_key',
      'Falta configurar `VITE_STARTGG_API_KEY` para consultar Start.gg.'
    );
  }

  try {
    return await client.request<TResponse>(query, variables);
  } catch (error) {
    if (error instanceof ClientError) {
      const message =
        error.response.errors?.map((entry) => entry.message).join(' ') ??
        error.message;

      if (message.toLowerCase().includes('token has expired')) {
        throw new StartggApiError(
          'expired_token',
          'La API key de Start.gg ha caducado. Actualízala en `.env` para volver a consultar datos en vivo.'
        );
      }

      throw new StartggApiError('api', `Start.gg respondió con un error: ${message}`);
    }

    if (error instanceof Error) {
      throw new StartggApiError(
        'network',
        `No pude conectar con Start.gg: ${error.message}`
      );
    }

    throw new StartggApiError('unknown', 'Error inesperado al consultar Start.gg.');
  }
}

export const resolvePlayerByIdQuery = `
  query ResolvePlayerById($playerId: ID!) {
    player(id: $playerId) {
      id
      gamerTag
      user {
        bio
        slug
        images {
          url
        }
      }
    }
  }
`;

export const resolvePlayerByUserSlugQuery = `
  query ResolvePlayerByUserSlug($slug: String!) {
    user(slug: $slug) {
      slug
      bio
      images {
        url
      }
      player {
        id
        gamerTag
      }
    }
  }
`;

export const currentUserPlayerQuery = `
  query CurrentUserPlayer {
    currentUser {
      slug
      bio
      images {
        url
      }
      player {
        id
        gamerTag
      }
    }
  }
`;

export const getPlayerStatsQuery = `
  query PlayerStats($playerId: ID!, $videogameId: ID!) {
    player(id: $playerId) {
      id
      gamerTag
      user {
        bio
        slug
        images {
          url
        }
      }
      rankings(videogameId: $videogameId, limit: 6) {
        rank
        title
      }
      recentStandings(videogameId: $videogameId, limit: 20) {
        placement
        entrant {
          event {
            name
            videogame {
              id
              displayName
            }
            tournament {
              name
              startAt
            }
          }
        }
      }
    }
  }
`;

export const headToHeadQuery = `
  query HeadToHead($player1Id: ID!, $player2Id: ID!) {
    player1: player(id: $player1Id) {
      id
      gamerTag
      user {
        images {
          url
        }
      }
      sets(
        perPage: 50
        filters: {
          playerIds: [$player2Id]
          hideEmpty: true
        }
      ) {
        nodes {
          id
          winnerId
          fullRoundText
          displayScore
          event {
            name
            videogame {
              id
              displayName
            }
            tournament {
              name
              startAt
            }
          }
        }
      }
    }
    player2: player(id: $player2Id) {
      id
      gamerTag
      user {
        images {
          url
        }
      }
    }
  }
`;
