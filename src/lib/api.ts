import { ClientError, GraphQLClient } from 'graphql-request';
import {
  HeadToHeadResponse,
  HeadToHeadSet,
  LocalHeadToHeadResponse,
  PlayerSearchResponse,
  PlayerCharacterStats,
  PlayerImage,
  PlayerSummary,
  PlayerAnalyticsResponse,
  ResolveUserResponse,
  TournamentListResponse,
  PlayerHistoryRefreshResponse,
} from './types';
import { getRecentHeadToHeadSets, HEAD_TO_HEAD_HISTORY_LIMIT } from './headToHead';
import type { TournamentMode } from './tournamentMode';

const API_ENDPOINT = 'https://api.start.gg/gql/alpha';
const API_KEY = import.meta.env.VITE_STARTGG_API_KEY;

export type StartggErrorCode = 'missing_key' | 'expired_token' | 'network' | 'api' | 'unknown';

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

export function getPlayerSearchErrorMessage(error: unknown) {
  if (error instanceof StartggApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'No pude buscar jugadores por nombre.';
}

export function normalizeStartggUserSlug(slug?: string | null): string | null {
  if (!slug) return null;

  const trimmedSlug = slug.trim();
  if (!trimmedSlug) return null;

  if (trimmedSlug.includes('start.gg/user/')) {
    const normalizedFromUrl = trimmedSlug.split('start.gg/')[1]?.trim();
    return normalizedFromUrl ? normalizeStartggUserSlug(normalizedFromUrl) : null;
  }

  if (trimmedSlug.startsWith('user/')) {
    return trimmedSlug;
  }

  return `user/${trimmedSlug.replace(/^\/+/, '')}`;
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
        error.response.errors?.map((entry) => entry.message).join(' ') ?? error.message;

      if (message.toLowerCase().includes('token has expired')) {
        throw new StartggApiError(
          'expired_token',
          'La API key de Start.gg ha caducado. Actualízala en `.env` para volver a consultar datos en vivo.'
        );
      }

      throw new StartggApiError('api', `Start.gg respondió con un error: ${message}`);
    }

    if (error instanceof Error) {
      throw new StartggApiError('network', `No pude conectar con Start.gg: ${error.message}`);
    }

    throw new StartggApiError('unknown', 'Error inesperado al consultar Start.gg.');
  }
}

function mapResolvedUserToPlayer(response: ResolveUserResponse, fallbackSlug: string) {
  if (!response.user?.player) {
    return null;
  }

  return {
    ...response.user.player,
    id: String(response.user.player.id),
    user: {
      bio: response.user.bio ?? null,
      images: response.user.images ?? null,
      slug: normalizeStartggUserSlug(response.user.slug ?? fallbackSlug),
    },
  } satisfies PlayerSummary;
}

export async function resolvePlayerByUserSlug(slug: string) {
  const normalizedSlug = normalizeStartggUserSlug(slug) ?? slug;
  const response = await requestStartgg<ResolveUserResponse>(resolvePlayerByUserSlugQuery, {
    slug: normalizedSlug,
  });

  return mapResolvedUserToPlayer(response, normalizedSlug);
}

export async function searchPlayersByName(query: string) {
  const response = await fetch(`/api/player-search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    let errorMessage = 'No pude buscar jugadores por nombre.';

    try {
      const errorPayload = await response.json();
      if (typeof errorPayload?.error === 'string') {
        errorMessage = errorPayload.error;
      }
    } catch {
      // Ignore invalid JSON and keep the generic message.
    }

    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as PlayerSearchResponse;
  return payload.players.map((player) => ({
    ...player,
    id: String(player.id),
    user: player.user
      ? {
          ...player.user,
          slug: normalizeStartggUserSlug(player.user.slug),
        }
      : player.user,
  }));
}

export function getPlayerAvatarUrl(images?: PlayerImage[] | null): string | null {
  return images?.find((image) => image.type?.toLowerCase() === 'profile')?.url ?? null;
}

export async function getPlayerAnalytics(
  playerId: string,
  videogameId: number,
  tournamentMode: TournamentMode
) {
  const params = new URLSearchParams({
    playerId,
    videogameId: String(videogameId),
    tournamentMode,
  });
  const response = await fetch(`/api/player-analytics?${params}`);
  if (!response.ok) throw new Error('No se pudieron cargar las estadísticas del jugador.');
  return (await response.json()) as PlayerAnalyticsResponse;
}

export async function getTournaments(
  playerId: string,
  videogameId: number,
  tournamentMode: TournamentMode
) {
  const params = new URLSearchParams({
    playerId,
    videogameId: String(videogameId),
    tournamentMode,
  });
  const response = await fetch(`/api/tournaments?${params}`);
  if (!response.ok) throw new Error('No se pudieron cargar los torneos.');
  return (await response.json()) as TournamentListResponse;
}

export async function refreshPlayerHistory(playerId: string) {
  const params = new URLSearchParams({ playerId });
  const response = await fetch(`/api/player-history/refresh?${params}`, { method: 'POST' });
  if (!response.ok) {
    const responseText = await response.text();
    let errorMessage: string | null = null;
    try {
      const payload = JSON.parse(responseText) as { error?: string };
      errorMessage = payload.error ?? null;
    } catch {
      errorMessage = null;
    }
    throw new Error(
      errorMessage ?? `No se pudo refrescar el historial del jugador (${response.status}).`
    );
  }

  const responseText = await response.text();
  try {
    return JSON.parse(responseText) as PlayerHistoryRefreshResponse;
  } catch {
    throw new Error('El servidor devolvió una respuesta no válida al actualizar el jugador.');
  }
}

export async function getHeadToHead(player1Id: string, player2Id: string, videogameId: number) {
  const allSets: HeadToHeadSet[] = [];
  let page = 1;
  let totalPages = 1;
  let latestResponse: HeadToHeadResponse | null = null;

  do {
    latestResponse = await requestStartgg<HeadToHeadResponse>(headToHeadQuery, {
      player1Id,
      player2Id,
      page,
    });
    const sets = latestResponse.player1?.sets;
    allSets.push(...(sets?.nodes ?? []));
    totalPages = sets?.pageInfo?.totalPages ?? page;
    page += 1;
  } while (
    page <= totalPages &&
    getRecentHeadToHeadSets(allSets, player1Id, player2Id, videogameId).length <
      HEAD_TO_HEAD_HISTORY_LIMIT
  );

  if (!latestResponse?.player1) return latestResponse;

  return {
    ...latestResponse,
    player1: {
      ...latestResponse.player1,
      sets: {
        ...latestResponse.player1.sets,
        nodes: allSets,
      },
    },
  };
}

export async function getLocalHeadToHead(
  player1Id: string,
  player2Id: string,
  videogameId: number
) {
  const params = new URLSearchParams({
    player1Id,
    player2Id,
    videogameId: String(videogameId),
  });
  const response = await fetch(`/api/head-to-head?${params}`);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'No se pudo consultar el historial local.');
  }

  return (await response.json()) as LocalHeadToHeadResponse;
}

export async function getPlayerCharacterStats(playerId: string, videogameId: number) {
  const params = new URLSearchParams({ playerId, videogameId: String(videogameId) });
  const response = await fetch(`/api/player-character-stats?${params}`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'No se pudieron calcular los personajes del jugador.');
  }
  return (await response.json()) as PlayerCharacterStats;
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
          type
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
        type
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
        type
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
          type
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
              isOnline
            }
          }
        }
      }
    }
  }
`;

export const headToHeadQuery = `
  query HeadToHead($player1Id: ID!, $player2Id: ID!, $page: Int!) {
    player1: player(id: $player1Id) {
      id
      gamerTag
      user {
        images {
          url
          type
        }
      }
      sets(
        page: $page
        perPage: 50
        filters: {
          playerIds: [$player2Id]
          hideEmpty: true
        }
      ) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          winnerId
          fullRoundText
          displayScore
          slots {
            entrant {
              id
              name
              participants {
                player {
                  id
                  gamerTag
                }
              }
            }
          }
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
          type
        }
      }
    }
  }
`;
