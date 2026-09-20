import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createTournamentListHandler } from './tournamentListPlugin.ts';

describe('createTournamentListHandler', () => {
  it('devuelve los torneos filtrados desde PostgreSQL', async () => {
    const repository = { list: vi.fn().mockResolvedValue([]) };
    const response = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    await createTournamentListHandler(repository)(
      {
        method: 'GET',
        url: '/api/tournaments?playerId=10&videogameId=1386&tournamentMode=offline',
      } as IncomingMessage,
      response,
      vi.fn()
    );

    expect(response.statusCode).toBe(200);
    expect(repository.list).toHaveBeenCalledWith('10', 1386, 'offline');
  });
});
