import type { IncomingMessage, ServerResponse } from 'node:http';
import { Pool } from 'pg';
import type { Plugin } from 'vite';
import { PostgresHistoryRepository } from './postgresHistoryRepository.ts';
import { refreshPlayerHistory } from './playerHistoryImporter.ts';
import type { PlayerHistoryRefreshSummary } from './playerHistoryImporter.ts';
import { StartggHistorySource } from './startggHistorySource.ts';
import { StartggClient } from '../startgg/startggClient.ts';
import { PostgresStartggRateLimiter } from '../startgg/postgresRateLimiter.ts';
import { logger } from '../utils/logger.ts';

const PLAYER_HISTORY_REFRESH_ROUTE = '/api/player-history/refresh';

export interface PlayerHistoryRefresher {
  refresh(
    playerId: string
  ): Promise<PlayerHistoryRefreshSummary & { ratingPeriodsProcessed: number }>;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export function createPlayerHistoryRefreshHandler(refresher: PlayerHistoryRefresher | null) {
  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (!request.url?.startsWith(PLAYER_HISTORY_REFRESH_ROUTE)) {
      next();
      return;
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method Not Allowed' });
      return;
    }
    if (!refresher) {
      sendJson(response, 503, {
        error: 'Falta configurar `STARTGG_API_KEY` y `DATABASE_URL`.',
      });
      return;
    }

    const url = new URL(request.url, 'http://localhost');
    const playerId = url.searchParams.get('playerId')?.trim() ?? '';
    if (!playerId) {
      sendJson(response, 400, { error: 'El identificador del jugador es obligatorio.' });
      return;
    }

    try {
      sendJson(response, 200, await refresher.refresh(playerId));
    } catch (error) {
      logger.error(`No se pudo refrescar el historial del jugador ${playerId}.`, error);
      const message = error instanceof Error ? error.message : '';
      sendJson(response, message.toLowerCase().includes('rate limit') ? 429 : 502, {
        error: message || 'No se pudo refrescar el historial del jugador.',
      });
    }
  };
}

export function playerHistoryRefreshProxy(
  apiKey: string | undefined,
  databaseUrl: string | undefined
): Plugin {
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  const runningRefreshes = new Map<
    string,
    Promise<PlayerHistoryRefreshSummary & { ratingPeriodsProcessed: number }>
  >();
  const source = apiKey
    ? new StartggHistorySource(
        new StartggClient(apiKey, {
          rateLimiter: pool ? new PostgresStartggRateLimiter(pool, apiKey) : undefined,
        })
      )
    : null;
  const repository = pool ? new PostgresHistoryRepository(pool) : null;
  const refresher: PlayerHistoryRefresher | null =
    source && repository && pool
      ? {
          refresh(playerId) {
            const running = runningRefreshes.get(playerId);
            if (running) return running;

            const refresh = (async () => {
              const summary = await refreshPlayerHistory(source, repository, playerId);
              return { ...summary, ratingPeriodsProcessed: 0 };
            })().finally(() => runningRefreshes.delete(playerId));
            runningRefreshes.set(playerId, refresh);
            return refresh;
          },
        }
      : null;
  const handler = createPlayerHistoryRefreshHandler(refresher);

  return {
    name: 'player-history-refresh-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
      server.httpServer?.once('close', () => void pool?.end());
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
      server.httpServer?.once('close', () => void pool?.end());
    },
  };
}
