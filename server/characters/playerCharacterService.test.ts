import { describe, expect, it, vi } from 'vitest';
import { StartggClient } from '../startgg/startggClient.ts';
import type { CharacterStatsRepository } from '../db/characterStatsRepository.ts';
import {
  getCharacterCutoff,
  mapSetToCharacterGames,
  PlayerCharacterService,
} from './playerCharacterService.ts';

const cutoff = 1_700_000_000;

function singlesSet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'set-1',
    state: 3,
    event: { videogame: { id: '1386' }, tournament: { startAt: cutoff + 1 } },
    slots: [
      { entrant: { id: 'entrant-1', participants: [{ player: { id: 'player-1' } }] } },
      { entrant: { id: 'entrant-2', participants: [{ player: { id: 'player-2' } }] } },
    ],
    games: [
      {
        id: 'game-1',
        selections: [
          {
            id: 'selection-2',
            entrant: { id: 'entrant-2' },
            character: { id: '1', name: 'Mario' },
          },
          {
            id: 'selection-1',
            entrant: { id: 'entrant-1' },
            character: {
              id: '155',
              name: 'Byleth',
              images: [{ url: 'https://images.start.gg/byleth.png' }],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('mapSetToCharacterGames', () => {
  it('asocia por entrant.id sin depender del orden de selections', () => {
    expect(mapSetToCharacterGames(singlesSet(), 'player-1', '1386', cutoff)).toEqual([
      {
        gameId: 'game-1',
        playerId: 'player-1',
        character: {
          id: '155',
          name: 'Byleth',
          imageUrl: 'https://images.start.gg/byleth.png',
        },
      },
    ]);
  });

  it('ignora una selection sin character', () => {
    const set = singlesSet({
      games: [{ id: 'game-1', selections: [{ id: 'selection-1', entrant: { id: 'entrant-1' } }] }],
    });

    expect(mapSetToCharacterGames(set, 'player-1', '1386', cutoff)[0]?.character).toBeNull();
  });

  it('filtra videojuegos distintos y sets fuera del periodo', () => {
    const otherGame = singlesSet({
      event: { videogame: { id: '1' }, tournament: { startAt: cutoff + 1 } },
    });
    const oldSet = singlesSet({
      event: { videogame: { id: '1386' }, tournament: { startAt: cutoff - 1 } },
    });

    expect(mapSetToCharacterGames(otherGame, 'player-1', '1386', cutoff)).toEqual([]);
    expect(mapSetToCharacterGames(oldSet, 'player-1', '1386', cutoff)).toEqual([]);
  });

  it('ignora sets si el jugador no está en slots', () => {
    expect(mapSetToCharacterGames(singlesSet(), 'missing-player', '1386', cutoff)).toEqual([]);
  });

  it('ignora doubles y eventos de equipos', () => {
    const doubles = singlesSet({
      slots: [
        {
          entrant: {
            id: 'team-1',
            participants: [{ player: { id: 'player-1' } }, { player: { id: 'player-3' } }],
          },
        },
        {
          entrant: {
            id: 'team-2',
            participants: [{ player: { id: 'player-2' } }, { player: { id: 'player-4' } }],
          },
        },
      ],
    });

    expect(mapSetToCharacterGames(doubles, 'player-1', '1386', cutoff)).toEqual([]);
  });
});

describe('PlayerCharacterService', () => {
  it('responde desde PostgreSQL sin consultar Start.gg', async () => {
    const storedStats = {
      primaryCharacter: {
        characterId: '155',
        name: 'Byleth',
        imageUrl: null,
        games: 20,
        usage: 0.8,
      },
      secondaryCharacters: [],
      characterUsage: [],
      gamesWithCharacterData: 20,
      gamesAnalyzed: 20,
      characterDataCoverage: 1,
      characterConfidence: 'high' as const,
    };
    const repository = {
      get: vi.fn().mockResolvedValue({
        stats: storedStats,
        calculatedAt: new Date('2026-08-18T00:00:00Z'),
        expiresAt: new Date('2026-08-19T00:00:00Z'),
      }),
      upsert: vi.fn(),
    } satisfies CharacterStatsRepository;
    const service = new PlayerCharacterService(
      null,
      () => new Date('2026-08-18T12:00:00Z'),
      undefined,
      repository
    );

    await expect(service.getPlayerCharacterStats('player-1', '1386')).resolves.toEqual(storedStats);
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('pagina, agrega resultados y reutiliza la cache', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        player: { sets: { pageInfo: { totalPages: 2 }, nodes: [singlesSet()] } },
      })
      .mockResolvedValueOnce({ player: { sets: { pageInfo: { totalPages: 2 }, nodes: [] } } });
    const client = { request } as unknown as StartggClient;
    const repository = {
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
    } satisfies CharacterStatsRepository;
    const now = () => new Date('2026-08-16T00:00:00Z');
    const service = new PlayerCharacterService(client, now, undefined, repository);

    const first = await service.getPlayerCharacterStats('player-1', '1386', {
      lookbackMonths: 120,
    });
    const second = await service.getPlayerCharacterStats('player-1', '1386', {
      lookbackMonths: 120,
    });

    expect(first.primaryCharacter?.name).toBe('Byleth');
    expect(second).toEqual(first);
    expect(request).toHaveBeenCalledTimes(2);
    expect(repository.upsert).toHaveBeenCalledWith(
      'player-1',
      '1386',
      120,
      expect.objectContaining({ stats: first })
    );
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('updatedAfter: $updatedAfter'),
      expect.objectContaining({ updatedAfter: expect.any(Number) })
    );
  });

  it('calcula el corte temporal sin hardcodear meses', () => {
    expect(getCharacterCutoff(new Date('2026-08-16T00:00:00Z'), 6)).toBe(
      Math.floor(new Date('2026-02-16T00:00:00Z').getTime() / 1000)
    );
  });

  it('detiene la paginación cuando una página completa supera el corte', async () => {
    const request = vi.fn().mockResolvedValue({
      player: {
        sets: {
          pageInfo: { totalPages: 100 },
          nodes: [
            singlesSet({
              event: { videogame: { id: '1386' }, tournament: { startAt: cutoff - 1 } },
            }),
          ],
        },
      },
    });
    const service = new PlayerCharacterService(
      { request } as unknown as StartggClient,
      () => new Date((cutoff + 1) * 1000)
    );

    await service.getPlayerCharacterStats('player-1', '1386', { lookbackMonths: 0 });

    expect(request).toHaveBeenCalledTimes(1);
  });
});
