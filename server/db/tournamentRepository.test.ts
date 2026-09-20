import { describe, expect, it, vi } from 'vitest';
import { PostgresTournamentRepository } from './tournamentRepository.ts';

describe('PostgresTournamentRepository', () => {
  it('lista torneos aplicando la modalidad seleccionada', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          startgg_tournament_id: '10',
          name: 'Test Tournament',
          slug: 'tournament/test',
          country_code: 'ES',
          starts_at: new Date('2024-01-02T12:00:00Z'),
          is_online: true,
          tier: 'B',
        },
      ],
    });
    const repository = new PostgresTournamentRepository({ query } as never);

    await expect(repository.list('1354812', 1386, 'online')).resolves.toEqual([
      {
        id: '10',
        name: 'Test Tournament',
        slug: 'tournament/test',
        countryCode: 'ES',
        startsAt: '2024-01-02T12:00:00.000Z',
        isOnline: true,
        tier: 'B',
      },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('players.startgg_player_id'), [
      '1354812',
      1386,
      'online',
    ]);
  });
});
