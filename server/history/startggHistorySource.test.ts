import { describe, expect, it, vi } from 'vitest';
import { StartggClient } from '../startgg/startggClient.ts';
import { StartggHistorySource } from './startggHistorySource.ts';

describe('StartggHistorySource.getPlayerTournamentPage', () => {
  it('deduplica eventos de Ultimate y normaliza el país', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            player: {
              sets: {
                pageInfo: { totalPages: 2 },
                nodes: [
                  {
                    event: {
                      id: 10,
                      name: 'Ultimate Singles',
                      numEntrants: 64,
                      videogame: { id: 1386 },
                      tournament: {
                        id: 20,
                        name: 'Tournament',
                        slug: 'tournament/test',
                        countryCode: 'es',
                        isOnline: true,
                        startAt: 1_700_000_000,
                        endAt: 1_700_003_600,
                      },
                    },
                  },
                  {
                    event: {
                      id: 10,
                      name: 'Ultimate Singles',
                      numEntrants: 64,
                      videogame: { id: 1386 },
                      tournament: {
                        id: 20,
                        name: 'Tournament',
                        slug: 'tournament/test',
                        countryCode: 'es',
                        isOnline: true,
                        startAt: 1_700_000_000,
                        endAt: 1_700_003_600,
                      },
                    },
                  },
                  {
                    event: {
                      id: 30,
                      name: 'Melee Singles',
                      videogame: { id: 1 },
                      tournament: {
                        id: 20,
                        name: 'Tournament',
                        slug: 'tournament/test',
                        countryCode: 'es',
                        isOnline: true,
                        startAt: 1_700_000_000,
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const client = new StartggClient('token', {
      minimumRequestIntervalMs: 0,
      fetcher,
    });

    await expect(
      new StartggHistorySource(client).getPlayerTournamentPage('1354812', 1)
    ).resolves.toEqual({
      totalPages: 2,
      tournaments: [
        {
          id: '20',
          name: 'Tournament',
          slug: 'tournament/test',
          countryCode: 'ES',
          isOnline: true,
          startAt: 1_700_000_000,
          endAt: 1_700_003_600,
          events: [{ id: '10', name: 'Ultimate Singles', entrantCount: 64 }],
        },
      ],
    });

    const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(request.variables.perPage).toBe(100);
  });

  it('solicita 80 sets por página de evento', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { event: { sets: { pageInfo: { totalPages: 1 }, nodes: [] } } },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const client = new StartggClient('token', { minimumRequestIntervalMs: 0, fetcher });

    await new StartggHistorySource(client).getSetPage('event-1', 1);

    const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(request.variables.perPage).toBe(80);
  });
});
