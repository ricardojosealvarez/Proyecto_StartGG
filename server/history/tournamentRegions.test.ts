import { describe, expect, it } from 'vitest';
import { getTournamentRegion } from './tournamentRegions.ts';

describe('getTournamentRegion', () => {
  it.each([
    ['ES', 'EU'],
    ['GB', 'EU'],
    ['us', 'US'],
    ['JP', null],
    [null, null],
  ])('clasifica %s como %s', (countryCode, expected) => {
    expect(getTournamentRegion(countryCode)).toBe(expected);
  });
});
