import { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { RatingHistoryRepository } from '../db/ratingRepository';
import { RatingSnapshot } from './playerPrediction';
import { createPlayerPredictionHandler } from './predictionPlugin';

function createSnapshot(rating: number, period: number): RatingSnapshot {
  return {
    playerId: '123',
    rating,
    deviation: 80,
    volatility: 0.06,
    matchesPlayed: period * 3,
    periodEndAt: new Date(Date.UTC(2026, period, 1)),
  };
}

function createResponse() {
  let body = '';
  const response = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: vi.fn((value?: string) => {
      body = value ?? '';
    }),
  } as unknown as ServerResponse;

  return {
    response,
    readBody: () => JSON.parse(body) as Record<string, unknown>,
  };
}

describe('createPlayerPredictionHandler', () => {
  it('rechaza identificadores no numéricos', async () => {
    const repository: RatingHistoryRepository = {
      getPlayerHistory: vi.fn(),
      getLatestRating: vi.fn(),
    };
    const handler = createPlayerPredictionHandler(repository);
    const { response, readBody } = createResponse();

    await handler(
      {
        method: 'GET',
        url: '/api/player-predictions?playerId=invalid',
      } as IncomingMessage,
      response,
      vi.fn()
    );

    expect(response.statusCode).toBe(400);
    expect(readBody()).toEqual({ error: 'Los playerId deben ser numéricos.' });
  });

  it('devuelve una predicción basada en el historial persistido', async () => {
    const repository: RatingHistoryRepository = {
      getPlayerHistory: vi
        .fn()
        .mockResolvedValue([
          createSnapshot(1500, 1),
          createSnapshot(1520, 2),
          createSnapshot(1550, 3),
        ]),
      getLatestRating: vi.fn().mockResolvedValue(null),
    };
    const handler = createPlayerPredictionHandler(repository);
    const { response, readBody } = createResponse();

    await handler(
      {
        method: 'GET',
        url: '/api/player-predictions?playerId=123',
      } as IncomingMessage,
      response,
      vi.fn()
    );

    expect(response.statusCode).toBe(200);
    expect(readBody()).toMatchObject({
      status: 'ready',
      playerId: '123',
      currentRating: 1550,
      trend: 'rising',
    });
  });

  it('informa cuando PostgreSQL no está configurado', async () => {
    const handler = createPlayerPredictionHandler(null);
    const { response, readBody } = createResponse();

    await handler(
      {
        method: 'GET',
        url: '/api/player-predictions?playerId=123',
      } as IncomingMessage,
      response,
      vi.fn()
    );

    expect(response.statusCode).toBe(503);
    expect(readBody()).toEqual({
      error: 'Falta configurar `DATABASE_URL` para consultar predicciones.',
    });
  });
});
