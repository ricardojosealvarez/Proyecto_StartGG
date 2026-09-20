import { describe, expect, it } from 'vitest';
import {
  groupHeadToHeadSetsByTournament,
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
  it('agrupa todos los sets del torneo y conserva torneos sin H2H', () => {
    const rows = groupHeadToHeadSetsByTournament(
      [
        { id: 't-1', name: 'Coincidencia', startsAt: '2026-01-01' },
        { id: 't-2', name: 'Sin duelo', startsAt: '2025-01-01' },
      ],
      [
        {
          id: 'set-1',
          winnerPlayerId: '100',
          displayScore: 'Vidad 3 - Sisqui 1',
          completedAt: '2026-01-01',
          eventName: 'Singles',
          tournamentName: 'Coincidencia',
          player1Tag: 'Vidad',
          player2Tag: 'Sisqui',
        },
        {
          id: 'set-2',
          winnerPlayerId: '200',
          displayScore: 'Vidad 0 - Sisqui 3',
          completedAt: '2026-01-01',
          eventName: 'Doubles',
          tournamentName: 'Coincidencia',
          player1Tag: 'Vidad',
          player2Tag: 'Sisqui',
        },
      ]
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.results).toHaveLength(2);
    expect(rows[1]?.results).toHaveLength(0);
  });

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
