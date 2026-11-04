import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import type { ViteDevServer } from 'vite';
import {
  createPlayerHistoryRefreshHandler,
  playerHistoryRefreshProxy,
} from './playerHistoryRefreshPlugin.ts';
import { refreshPlayerHistory } from './playerHistoryImporter.ts';
import { processPendingRatingPeriods } from '../ratings/ratingPeriodProcessor.ts';

vi.mock('./playerHistoryImporter.ts', () => ({ refreshPlayerHistory: vi.fn() }));
vi.mock('../ratings/ratingPeriodProcessor.ts', () => ({ processPendingRatingPeriods: vi.fn() }));

function createResponse() {
  return {
    statusCode: 0,
    setHeader: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse;
}

describe('createPlayerHistoryRefreshHandler', () => {
  it('refresca el jugador indicado', async () => {
    const refresher = {
      refresh: vi.fn().mockResolvedValue({
        candidateTournaments: 3,
        tournamentsSeen: 3,
        tournamentsSaved: 3,
        setsSaved: 12,
        ratingPeriodsProcessed: 2,
      }),
    };
    const response = createResponse();

    await createPlayerHistoryRefreshHandler(refresher)(
      { method: 'POST', url: '/api/player-history/refresh?playerId=1354812' } as IncomingMessage,
      response,
      vi.fn()
    );

    expect(response.statusCode).toBe(200);
    expect(refresher.refresh).toHaveBeenCalledWith('1354812');
  });

  it('rechaza peticiones sin jugador', async () => {
    const refresher = { refresh: vi.fn() };
    const response = createResponse();

    await createPlayerHistoryRefreshHandler(refresher)(
      { method: 'POST', url: '/api/player-history/refresh' } as IncomingMessage,
      response,
      vi.fn()
    );

    expect(response.statusCode).toBe(400);
    expect(refresher.refresh).not.toHaveBeenCalled();
  });

  it('guarda el historial sin ejecutar Glicko-2 desde el endpoint', async () => {
    vi.mocked(refreshPlayerHistory).mockResolvedValue({
      candidateTournaments: 1,
      tournamentsSeen: 1,
      tournamentsSaved: 1,
      setsSaved: 3,
    });
    const use = vi.fn();
    const once = vi.fn();
    const plugin = playerHistoryRefreshProxy('test-token', 'postgres://localhost/test');
    if (typeof plugin.configureServer !== 'function') throw new Error('Falta configureServer');
    await plugin.configureServer.call(
      {} as never,
      {
        middlewares: { use },
        httpServer: { once },
      } as unknown as ViteDevServer
    );
    const response = createResponse();
    const handler = use.mock.calls[0][0] as ReturnType<typeof createPlayerHistoryRefreshHandler>;
    await handler(
      { method: 'POST', url: '/api/player-history/refresh?playerId=100' } as IncomingMessage,
      response,
      vi.fn()
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(String(vi.mocked(response.end).mock.calls[0][0]))).toMatchObject({
      setsSaved: 3,
      ratingPeriodsProcessed: 0,
    });
    expect(processPendingRatingPeriods).not.toHaveBeenCalled();
    const close = once.mock.calls[0][1] as () => void;
    close();
  });
});
