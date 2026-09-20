import { describe, expect, it } from 'vitest';
import type { RecentStanding } from './types';
import { filterStandingsByMode } from './tournamentMode';

const standings = [
  {
    placement: 1,
    entrant: {
      event: {
        name: 'Online event',
        tournament: { name: 'Online tournament', startAt: 2, isOnline: true },
      },
    },
  },
  {
    placement: 2,
    entrant: {
      event: {
        name: 'Offline event',
        tournament: { name: 'Offline tournament', startAt: 1, isOnline: false },
      },
    },
  },
] satisfies RecentStanding[];

describe('filterStandingsByMode', () => {
  it('filtra los torneos online y offline', () => {
    expect(filterStandingsByMode(standings, 'online')).toEqual([standings[0]]);
    expect(filterStandingsByMode(standings, 'offline')).toEqual([standings[1]]);
  });

  it('conserva todos los torneos en el filtro general', () => {
    expect(filterStandingsByMode(standings, 'all')).toEqual(standings);
  });
});
