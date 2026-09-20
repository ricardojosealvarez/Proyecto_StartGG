import { describe, expect, it, vi } from 'vitest';
import { StartggClient } from '../startgg/startggClient.ts';
import { StartggHistorySource } from './startggHistorySource.ts';

describe('StartggHistorySource.getPlayerTournamentPage', () => {
  it('deduplica eventos de Ultimate y normaliza el país', async () => {
    const client = new StartggClient('token', {
      minimumRequestIntervalMs: 0,
      fetcher: vi.fn().mockResolvedValue(
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
      ),
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
  });
});
