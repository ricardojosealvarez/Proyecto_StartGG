import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createPlayerHistoryRefreshHandler } from './playerHistoryRefreshPlugin.ts';

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
});
