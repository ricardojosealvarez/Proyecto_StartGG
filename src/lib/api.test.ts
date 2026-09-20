import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPlayerAvatarUrl, refreshPlayerHistory } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getPlayerAvatarUrl', () => {
  it('selecciona la foto de perfil aunque el banner aparezca primero', () => {
    expect(
      getPlayerAvatarUrl([
        { type: 'banner', url: 'https://images.start.gg/banner.png' },
        { type: 'profile', url: 'https://images.start.gg/avatar.png' },
      ])
    ).toBe('https://images.start.gg/avatar.png');
  });

  it('no usa el banner como avatar cuando no existe foto de perfil', () => {
    expect(
      getPlayerAvatarUrl([{ type: 'banner', url: 'https://images.start.gg/banner.png' }])
    ).toBeNull();
  });
});

describe('refreshPlayerHistory', () => {
  it('solicita la sincronización del jugador', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidateTournaments: 2,
          tournamentsSeen: 2,
          tournamentsSaved: 2,
          setsSaved: 8,
          ratingPeriodsProcessed: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshPlayerHistory('1354812');

    expect(fetchMock).toHaveBeenCalledWith('/api/player-history/refresh?playerId=1354812', {
      method: 'POST',
    });
    expect(result.tournamentsSaved).toBe(2);
  });

  it('propaga el error devuelto por el servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Start.gg limitó la petición.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(refreshPlayerHistory('1354812')).rejects.toThrow(
      'Start.gg limitó la petición.'
    );
  });
});
