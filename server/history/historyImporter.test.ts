import { describe, expect, it, vi } from 'vitest';
import {
  HistoryImportRepository,
  HistorySource,
  importUltimateHistory,
} from './historyImporter.ts';

function createSource(): HistorySource {
  return {
    getTournamentPage: vi.fn().mockResolvedValue({
      totalPages: 1,
      tournaments: [
        {
          id: 'tournament-1',
          name: 'Tournament 1',
          slug: 'tournament/tournament-1',
          countryCode: 'ES',
          isOnline: false,
          startAt: 1_700_000_000,
          endAt: 1_700_086_400,
          events: [{ id: 'event-1', name: 'Ultimate Singles', entrantCount: 2 }],
        },
      ],
    }),
    getSetPage: vi.fn().mockResolvedValue({
      totalPages: 1,
      sets: [
        {
          id: 'set-1',
          state: 3,
          winnerId: 'entrant-1',
          completedAt: 1_700_043_200,
          displayScore: 'Player 1 3 - Player 2 0',
          slots: [
            {
              entrant: {
                id: 'entrant-1',
                name: 'Player 1',
                participants: [{ gamerTag: 'Player 1', player: { id: '1', gamerTag: 'Player 1' } }],
              },
            },
            {
              entrant: {
                id: 'entrant-2',
                name: 'Player 2',
                participants: [{ gamerTag: 'Player 2', player: { id: '2', gamerTag: 'Player 2' } }],
              },
            },
          ],
        },
      ],
    }),
  };
}

describe('importUltimateHistory', () => {
  it('recorre las páginas y guarda torneos con sets válidos', async () => {
    const source = createSource();
    const repository: HistoryImportRepository = {
      saveTournament: vi.fn().mockResolvedValue({ changed: true, setsSaved: 1 }),
    };

    const result = await importUltimateHistory(source, repository, {
      from: new Date('2023-11-01T00:00:00Z'),
      to: new Date('2023-12-01T00:00:00Z'),
    });

    expect(result).toEqual({ tournamentsSeen: 1, tournamentsSaved: 1, setsSaved: 1, completed: true });
    expect(repository.saveTournament).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tournament-1',
        events: [expect.objectContaining({ sets: [expect.objectContaining({ id: 'set-1' })] })],
      })
    );
  });

  it('reanuda el intervalo desde el cursor persistido', async () => {
    const source = createSource();
    const repository: HistoryImportRepository = {
      saveTournament: vi.fn().mockResolvedValue({ changed: true, setsSaved: 1 }),
      loadImportProgress: vi.fn().mockResolvedValue({
        page: 1, tournamentIndex: 1, status: 'running',
      }),
      saveImportProgress: vi.fn(),
    };
    const result = await importUltimateHistory(source, repository, {
      from: new Date('2023-11-01T00:00:00Z'),
      to: new Date('2023-12-01T00:00:00Z'),
    });
    expect(result.tournamentsSeen).toBe(0);
    expect(result.completed).toBe(true);
    expect(repository.saveTournament).not.toHaveBeenCalled();
    expect(repository.saveImportProgress).toHaveBeenLastCalledWith(
      expect.stringMatching(/^ultimate:/),
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('omite intervalos ya completados salvo refresco explícito', async () => {
    const source = createSource();
    const repository: HistoryImportRepository = {
      saveTournament: vi.fn(),
      loadImportProgress: vi.fn().mockResolvedValue({
        page: 1, tournamentIndex: 0, status: 'completed',
      }),
    };
    await expect(importUltimateHistory(source, repository, {
      from: new Date('2023-11-01T00:00:00Z'),
      to: new Date('2023-12-01T00:00:00Z'),
    })).resolves.toEqual({ tournamentsSeen: 0, tournamentsSaved: 0, setsSaved: 0, completed: true });
    expect(source.getTournamentPage).not.toHaveBeenCalled();
  });

  it('rechaza intervalos invertidos', async () => {
    const repository: HistoryImportRepository = {
      saveTournament: vi.fn(),
    };

    await expect(
      importUltimateHistory(createSource(), repository, {
        from: new Date('2023-12-01T00:00:00Z'),
        to: new Date('2023-11-01T00:00:00Z'),
      })
    ).rejects.toThrow('La fecha `from` debe ser anterior a `to`.');
  });
});
