import { describe, expect, it } from 'vitest';
import {
  getRecentHeadToHeadSets,
  getSetWinnerPlayerId,
  isHeadToHeadSet,
} from './headToHead';
import type { HeadToHeadSet } from './types';

function createSet(): HeadToHeadSet {
  return {
    id: 'set-1',
    winnerId: 'entrant-2',
    event: {
      name: 'Singles',
      videogame: { id: '1386', displayName: 'Ultimate' },
      tournament: { name: 'Tournament', startAt: 1 },
    },
    slots: [
      {
        entrant: {
          id: 'entrant-1',
          participants: [{ player: { id: '100' } }],
        },
      },
      {
        entrant: {
          id: 'entrant-2',
          participants: [{ player: { id: '200' } }],
        },
      },
    ],
  };
}

describe('head-to-head sets', () => {
  it('acepta el videogame ID textual devuelto por GraphQL', () => {
    expect(isHeadToHeadSet(createSet(), '100', '200', 1386)).toBe(true);
  });

  it('resuelve el jugador ganador mediante el entrant ganador', () => {
    expect(getSetWinnerPlayerId(createSet())).toBe('200');
  });

  it('devuelve los 10 enfrentamientos más recientes', () => {
    const sets = Array.from({ length: 12 }, (_, index) => ({
      ...createSet(),
      id: `set-${index}`,
      event: {
        ...createSet().event,
        tournament: {
          ...createSet().event.tournament,
          startAt: index,
        },
      },
    }));

    const results = getRecentHeadToHeadSets(sets, '100', '200', 1386);

    expect(results).toHaveLength(10);
    expect(results[0]?.id).toBe('set-11');
    expect(results[9]?.id).toBe('set-2');
  });
});
