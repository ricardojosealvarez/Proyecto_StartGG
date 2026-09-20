import type { IncomingMessage, ServerResponse } from 'node:http';
import { Pool } from 'pg';
import type { Plugin } from 'vite';
import {
  PlayerAnalyticsRepository,
  PostgresPlayerAnalyticsRepository,
} from '../db/playerAnalyticsRepository.ts';
import { logger } from '../utils/logger.ts';

const PLAYER_ANALYTICS_ROUTE = '/api/player-analytics';

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export function createPlayerAnalyticsHandler(repository: PlayerAnalyticsRepository | null) {
  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (!request.url?.startsWith(PLAYER_ANALYTICS_ROUTE)) {
      next();
      return;
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method Not Allowed' });
      return;
    }
    if (!repository) {
      sendJson(response, 503, { error: 'Falta configurar `DATABASE_URL`.' });
      return;
    }

    const url = new URL(request.url, 'http://localhost');
    const playerId = url.searchParams.get('playerId');
    const videogameId = Number(url.searchParams.get('videogameId'));
    const tournamentMode = url.searchParams.get('tournamentMode') ?? 'all';
    if (
      !playerId ||
      !Number.isInteger(videogameId) ||
      !['all', 'online', 'offline'].includes(tournamentMode)
    ) {
      sendJson(response, 400, { error: 'Parámetros de estadísticas no válidos.' });
      return;
    }

    try {
      sendJson(response, 200, {
        years: await repository.getYearStats(
          playerId,
          videogameId,
          tournamentMode as 'all' | 'online' | 'offline'
        ),
        source: 'database',
      });
    } catch (error) {
      logger.error('No se pudieron consultar las estadísticas locales del jugador.', error);
      sendJson(response, 500, { error: 'No se pudieron consultar las estadísticas locales.' });
    }
  };
}

export function playerAnalyticsProxy(databaseUrl: string | undefined): Plugin {
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  const handler = createPlayerAnalyticsHandler(
    pool ? new PostgresPlayerAnalyticsRepository(pool) : null
  );
  return {
    name: 'local-player-analytics-proxy',
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
