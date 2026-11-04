import type { Plugin } from 'vite';
import { Pool } from 'pg';
import { PostgresCharacterStatsRepository } from '../db/characterStatsRepository.ts';
import { StartggClient } from '../startgg/startggClient.ts';
import { PostgresStartggRateLimiter } from '../startgg/postgresRateLimiter.ts';
import { logger } from '../utils/logger.ts';
import { PlayerCharacterService } from './playerCharacterService.ts';

export function characterStatsProxy(
  apiKey: string | undefined,
  databaseUrl: string | undefined
): Plugin {
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  const repository = pool ? new PostgresCharacterStatsRepository(pool) : null;
  const client = apiKey
    ? new StartggClient(apiKey, {
        rateLimiter: pool ? new PostgresStartggRateLimiter(pool, apiKey) : undefined,
      })
    : null;
  const service =
    client || repository
      ? new PlayerCharacterService(client, undefined, undefined, repository)
      : null;

  const handler = async (
    req: { method?: string; url?: string },
    res: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: (body?: string) => void;
    },
    next: () => void
  ) => {
    if (!req.url?.startsWith('/api/player-character-stats')) {
      next();
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    if (!service) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Falta configurar PostgreSQL o la API key de Start.gg.' }));
      return;
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    const playerId = requestUrl.searchParams.get('playerId')?.trim();
    const videogameId = requestUrl.searchParams.get('videogameId')?.trim();
    if (!playerId || !videogameId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: '`playerId` y `videogameId` son obligatorios.' }));
      return;
    }

    try {
      const stats = await service.getPlayerCharacterStats(playerId, videogameId);
      res.end(JSON.stringify(stats));
    } catch (error) {
      logger.error('No se pudieron calcular los personajes del jugador.', error);
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'No se pudieron consultar los personajes en Start.gg.' }));
    }
  };

  return {
    name: 'startgg-character-stats-proxy',
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
