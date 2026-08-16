import { describe, expect, it, vi } from 'vitest';
import type { HistoryImportRepository } from './historyImporter.ts';
import { importPlayerHistory } from './playerHistoryImporter.ts';
import type { PlayerHistorySource } from './playerHistoryImporter.ts';

function tournament(id: string, countryCode: string, startAt: number, eventId = `event-${id}`) {
  return {
    id,
    name: `Tournament ${id}`,
    slug: `tournament/${id}`,
    countryCode,
    startAt,
    endAt: startAt + 3_600,
    events: [{ id: eventId, name: 'Ultimate Singles', entrantCount: 2 }],
  };
}

describe('importPlayerHistory', () => {
  it('deduplica, filtra por región e importa cronológicamente', async () => {
    const source: PlayerHistorySource = {
      getPlayerTournamentPage: vi
        .fn()
        .mockResolvedValueOnce({
          totalPages: 2,
          tournaments: [tournament('2', 'US', 1_710_000_000)],
        })
        .mockResolvedValueOnce({
          totalPages: 2,
          tournaments: [
            tournament('1', 'ES', 1_700_000_000),
            tournament('2', 'US', 1_710_000_000, 'event-2-extra'),
            tournament('3', 'JP', 1_690_000_000),
          ],
        }),
      getTournamentPage: vi.fn(),
      getSetPage: vi.fn().mockResolvedValue({ totalPages: 0, sets: [] }),
    };
    const repository: HistoryImportRepository = { saveTournament: vi.fn() };

    const result = await importPlayerHistory(source, repository, {
      playerId: '1354812',
      from: new Date('2023-01-01T00:00:00Z'),
      to: new Date('2025-01-01T00:00:00Z'),
      regions: ['EU', 'US'],
    });

    expect(result).toEqual({
      candidateTournaments: 3,
      selectedTournaments: 2,
      tournamentsByRegion: { EU: 1, US: 1 },
      tournamentsSeen: 2,
      tournamentsSaved: 0,
      setsSaved: 0,
    });
    expect(source.getSetPage).toHaveBeenNthCalledWith(1, 'event-1', 1);
    expect(source.getSetPage).toHaveBeenNthCalledWith(2, 'event-2', 1);
    expect(source.getSetPage).toHaveBeenNthCalledWith(3, 'event-2-extra', 1);
  });
});
