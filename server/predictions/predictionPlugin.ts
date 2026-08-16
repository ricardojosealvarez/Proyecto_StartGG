import type { IncomingMessage, ServerResponse } from 'node:http';
import { Pool } from 'pg';
import type { Plugin } from 'vite';
import { PostgresRatingRepository } from '../db/ratingRepository.ts';
import type { RatingHistoryRepository } from '../db/ratingRepository.ts';
import { logger } from '../utils/logger.ts';
import { buildPlayerPrediction } from './playerPrediction.ts';

const PREDICTION_ROUTE = '/api/player-predictions';
const HISTORY_LIMIT = 8;

type NextFunction = () => void;

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function isPlayerId(value: string | null): value is string {
  return Boolean(value && /^\d+$/.test(value));
}

export function createPlayerPredictionHandler(repository: RatingHistoryRepository | null) {
  return async (request: IncomingMessage, response: ServerResponse, next: NextFunction) => {
    if (!request.url?.startsWith(PREDICTION_ROUTE)) {
      next();
      return;
    }

    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method Not Allowed' });
      return;
    }

    if (!repository) {
      sendJson(response, 503, {
        error: 'Falta configurar `DATABASE_URL` para consultar predicciones.',
      });
      return;
    }

    const requestUrl = new URL(request.url, 'http://localhost');
    const playerId = requestUrl.searchParams.get('playerId');
    const opponentId = requestUrl.searchParams.get('opponentId');

    if (!isPlayerId(playerId) || (opponentId && !isPlayerId(opponentId))) {
      sendJson(response, 400, { error: 'Los playerId deben ser numéricos.' });
      return;
    }

    try {
      const [history, opponent] = await Promise.all([
        repository.getPlayerHistory(playerId, HISTORY_LIMIT),
        opponentId ? repository.getLatestRating(opponentId) : Promise.resolve(null),
      ]);
      const prediction = buildPlayerPrediction(playerId, history, opponent ?? undefined);

      sendJson(response, 200, prediction);
    } catch (error) {
      logger.error('No se pudo calcular la predicción del jugador.', error);
      sendJson(response, 500, {
        error: 'No se pudo calcular la predicción del jugador.',
      });
    }
  };
}

export function playerPredictionProxy(databaseUrl: string | undefined): Plugin {
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  const repository = pool ? new PostgresRatingRepository(pool) : null;
  const handler = createPlayerPredictionHandler(repository);

  return {
    name: 'glicko2-player-prediction-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
      server.httpServer?.once('close', () => {
        void pool?.end();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
      server.httpServer?.once('close', () => {
        void pool?.end();
      });
    },
  };
}
