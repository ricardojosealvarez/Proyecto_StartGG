import type { IncomingMessage, ServerResponse } from 'node:http';
import { Pool } from 'pg';
import type { Plugin } from 'vite';
import { HeadToHeadRepository, PostgresHeadToHeadRepository } from '../db/headToHeadRepository.ts';
import { logger } from '../utils/logger.ts';

const HEAD_TO_HEAD_ROUTE = '/api/head-to-head';

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export function createHeadToHeadHandler(repository: HeadToHeadRepository | null) {
  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (!request.url?.startsWith(HEAD_TO_HEAD_ROUTE)) {
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
    const player1Id = url.searchParams.get('player1Id');
    const player2Id = url.searchParams.get('player2Id');
    const videogameId = Number(url.searchParams.get('videogameId'));

    if (!player1Id || !player2Id || !Number.isInteger(videogameId)) {
      sendJson(response, 400, { error: 'Parámetros de Head to Head no válidos.' });
      return;
    }

    try {
      const [sets, tournaments] = await Promise.all([
        repository.getHistory(player1Id, player2Id, videogameId),
        repository.getSharedTournaments(player1Id, player2Id, videogameId),
      ]);
      sendJson(response, 200, { sets, tournaments });
    } catch (error) {
      logger.error('No se pudo consultar el Head to Head local.', error);
      sendJson(response, 500, { error: 'No se pudo consultar el historial local.' });
    }
  };
}

export function headToHeadProxy(databaseUrl: string | undefined): Plugin {
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  const handler = createHeadToHeadHandler(pool ? new PostgresHeadToHeadRepository(pool) : null);

  return {
    name: 'local-head-to-head-proxy',
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
