import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const ERROR_CACHE_TTL_MS = 2 * 60 * 1000;
const SMASH_GAME_IDS = [1386, 1, 5, 3, 4];
const TOURNAMENT_PAGES_PER_GAME = 6;
const TOURNAMENTS_PER_GAME = 4;
const ENTRANTS_PER_EVENT = 64;
const STARTGG_ALPHA_URL = 'https://api.start.gg/gql/alpha';
const REQUEST_DELAY_MS = 250;
const MAX_REQUEST_RETRIES = 2;

type SearchPlayer = {
  id: string;
  gamerTag: string;
  user?: {
    slug?: string | null;
    images?: Array<{ url: string }> | null;
  } | null;
};

type SearchCacheEntry = {
  expiresAt: number;
  players: SearchPlayer[];
  errorMessage?: string;
};

const playerSearchCache = new Map<string, SearchCacheEntry>();

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function scorePlayerMatch(player: SearchPlayer, normalizedQuery: string) {
  const gamerTag = player.gamerTag.toLowerCase();

  if (gamerTag === normalizedQuery) return 4;
  if (gamerTag.startsWith(normalizedQuery)) return 3;
  if (gamerTag.includes(normalizedQuery)) return 2;
  return 0;
}

async function requestStartggFromServer<TResponse>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
) {
  for (let attempt = 0; attempt <= MAX_REQUEST_RETRIES; attempt += 1) {
    const response = await fetch(STARTGG_ALPHA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429 && attempt < MAX_REQUEST_RETRIES) {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Start.gg respondió con ${response.status}.`);
    }

    const payload = (await response.json()) as {
      data?: TResponse;
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      const message = payload.errors
        .map((entry) => entry.message)
        .filter(Boolean)
        .join(' ');

      throw new Error(message || 'Start.gg devolvió un error al construir el índice de jugadores.');
    }

    if (!payload.data) {
      throw new Error('Start.gg no devolvió datos para construir el índice de jugadores.');
    }

    return payload.data;
  }

  throw new Error('Start.gg respondió con 429.');
}

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function fetchRecentSmashPlayers(apiKey: string) {
  const cacheKey = 'official-smash-player-index';
  const cachedEntry = playerSearchCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    if (cachedEntry.errorMessage && cachedEntry.players.length === 0) {
      throw new Error(cachedEntry.errorMessage);
    }

    return cachedEntry.players;
  }

  const tournamentQuery = `
    query SmashPlayerIndex(
      $videogameId: ID!
      $page: Int!
      $perPage: Int!
      $entrantsPerEvent: Int!
    ) {
      tournaments(
        query: {
          page: $page
          perPage: $perPage
          filter: {
            published: true
            past: true
            videogameIds: [$videogameId]
          }
        }
      ) {
        nodes {
          events {
            videogame {
              id
            }
            entrants(query: { page: 1, perPage: $entrantsPerEvent }) {
              nodes {
                participants {
                  player {
                    id
                    gamerTag
                    user {
                      slug
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const results: Array<{
    tournaments: {
      nodes: Array<{
        events?: Array<{
          videogame?: { id: number } | null;
          entrants?: {
            nodes?: Array<{
              participants?: Array<{
                player?: SearchPlayer | null;
              }> | null;
            }> | null;
          } | null;
        }> | null;
      }>;
    };
  }> = [];
  let hitRateLimit = false;

  for (const videogameId of SMASH_GAME_IDS) {
    for (let page = 1; page <= TOURNAMENT_PAGES_PER_GAME; page += 1) {
      try {
        const result = await requestStartggFromServer<{
          tournaments: {
            nodes: Array<{
              events?: Array<{
                videogame?: { id: number } | null;
                entrants?: {
                  nodes?: Array<{
                    participants?: Array<{
                      player?: SearchPlayer | null;
                    }> | null;
                  }> | null;
                } | null;
              }> | null;
            }>;
          };
        }>(apiKey, tournamentQuery, {
          videogameId,
          page,
          perPage: TOURNAMENTS_PER_GAME,
          entrantsPerEvent: ENTRANTS_PER_EVENT,
        });

        results.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido.';

        if (message.includes('429')) {
          hitRateLimit = true;
          break;
        }

        throw error;
      }

      await sleep(REQUEST_DELAY_MS);
    }

    if (hitRateLimit) {
      break;
    }
  }

  const playersById = new Map<string, SearchPlayer>();

  for (const result of results) {
    for (const tournament of result.tournaments.nodes ?? []) {
      for (const event of tournament.events ?? []) {
        for (const entrant of event.entrants?.nodes ?? []) {
          for (const participant of entrant.participants ?? []) {
            const player = participant.player;

            if (!player?.id || !player.gamerTag) {
              continue;
            }

            playersById.set(String(player.id), {
              ...player,
              id: String(player.id),
            });
          }
        }
      }
    }
  }

  const players = [...playersById.values()];

  if (players.length === 0 && hitRateLimit) {
    throw new Error('Start.gg respondió con 429.');
  }

  playerSearchCache.set(cacheKey, {
    expiresAt: Date.now() + (hitRateLimit ? ERROR_CACHE_TTL_MS : SEARCH_CACHE_TTL_MS),
    players,
    errorMessage: hitRateLimit
      ? 'Start.gg está limitando temporalmente parte de la indexación. Se muestran resultados parciales.'
      : undefined,
  });

  return players;
}

function playerSearchProxy(apiKey: string | undefined): Plugin {
  const handler = async (
    req: { method?: string; url?: string },
    res: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: (body?: string) => void;
    },
    next: () => void
  ) => {
    if (!req.url?.startsWith('/api/player-search')) {
      next();
      return;
    }

    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: 'Falta configurar `VITE_STARTGG_API_KEY` para buscar jugadores.',
        })
      );
      return;
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    const query = requestUrl.searchParams.get('q')?.trim() ?? '';

    if (query.length < 2) {
      res.end(JSON.stringify({ query, players: [] }));
      return;
    }

    try {
      const normalizedQuery = normalizeSearchValue(query);
      const players = await fetchRecentSmashPlayers(apiKey);

      const matchingPlayers = players
        .map((player) => ({
          player,
          score: scorePlayerMatch(player, normalizedQuery),
        }))
        .filter((entry) => entry.score > 0)
        .sort((entryA, entryB) => {
          if (entryA.score !== entryB.score) {
            return entryB.score - entryA.score;
          }

          return entryA.player.gamerTag.localeCompare(entryB.player.gamerTag);
        })
        .slice(0, 8)
        .map((entry) => entry.player);

      res.end(JSON.stringify({ query, players: matchingPlayers }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pude construir el índice oficial de jugadores Smash.';

      if (message.includes('429')) {
        const cachedEntry = playerSearchCache.get('official-smash-player-index');

        if (cachedEntry?.players.length) {
          const normalizedQuery = normalizeSearchValue(query);
          const fallbackPlayers = cachedEntry.players
            .map((player) => ({
              player,
              score: scorePlayerMatch(player, normalizedQuery),
            }))
            .filter((entry) => entry.score > 0)
            .sort((entryA, entryB) => {
              if (entryA.score !== entryB.score) {
                return entryB.score - entryA.score;
              }

              return entryA.player.gamerTag.localeCompare(entryB.player.gamerTag);
            })
            .slice(0, 8)
            .map((entry) => entry.player);

          res.end(JSON.stringify({ query, players: fallbackPlayers }));
          return;
        }

        playerSearchCache.set('official-smash-player-index', {
          expiresAt: Date.now() + ERROR_CACHE_TTL_MS,
          players: [],
          errorMessage:
            'Start.gg está limitando temporalmente la indexación. Espera un par de minutos y vuelve a probar.',
        });
      }

      res.statusCode = 502;
      res.end(
        JSON.stringify({
          error: message.includes('429')
            ? 'Start.gg está limitando temporalmente la indexación. Espera un par de minutos y vuelve a probar.'
            : message,
        })
      );
    }
  };

  return {
    name: 'startgg-player-search-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), playerSearchProxy(env.VITE_STARTGG_API_KEY)],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
