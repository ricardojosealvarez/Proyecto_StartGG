import { describe, expect, it } from 'vitest';
import { StartggSet, TournamentSummary } from './historyTypes.ts';
import { mapCompletedSinglesSet } from './setMapper.ts';

const tournament: TournamentSummary = {
  id: '10',
  name: 'Ultimate Test',
  slug: 'tournament/ultimate-test',
  countryCode: 'ES',
  startAt: 1_700_000_000,
  endAt: 1_700_086_400,
  events: [],
};

function createSet(participantsPerEntrant = 1): StartggSet {
  return {
    id: 'set-1',
    state: 3,
    winnerId: 'entrant-2',
    completedAt: 1_700_043_200,
    displayScore: 'Winner 3 - Loser 1',
    slots: [
      {
        entrant: {
          id: 'entrant-1',
          name: 'Loser',
          participants: Array.from({ length: participantsPerEntrant }, (_, index) => ({
            gamerTag: `Loser ${index}`,
            player: { id: `player-${index + 1}`, gamerTag: `Loser ${index}` },
          })),
        },
      },
      {
        entrant: {
          id: 'entrant-2',
          name: 'Winner',
          participants: [
            {
              gamerTag: 'Winner',
              player: { id: 'player-2', gamerTag: 'Winner' },
            },
          ],
        },
      },
    ],
  };
}

describe('mapCompletedSinglesSet', () => {
  it('resuelve el ganador mediante el entrantId y conserva los playerId', () => {
    const result = mapCompletedSinglesSet(createSet(), 'event-1', tournament);

    expect(result).toMatchObject({
      id: 'set-1',
      eventId: 'event-1',
      winner: { id: 'player-2', gamerTag: 'Winner' },
      loser: { id: 'player-1', gamerTag: 'Loser 0' },
    });
  });

  it('descarta sets de dobles', () => {
    expect(mapCompletedSinglesSet(createSet(2), 'event-1', tournament)).toBeNull();
  });

  it('descarta sets incompletos o sin ganador', () => {
    expect(mapCompletedSinglesSet({ ...createSet(), state: 2 }, 'event-1', tournament)).toBeNull();
    expect(
      mapCompletedSinglesSet({ ...createSet(), winnerId: null }, 'event-1', tournament)
    ).toBeNull();
  });
});
