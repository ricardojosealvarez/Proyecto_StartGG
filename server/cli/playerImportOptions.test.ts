import { describe, expect, it } from 'vitest';
import { parsePlayerImportOptions } from './playerImportOptions.ts';

describe('parsePlayerImportOptions', () => {
  it('usa todo el historial de Ultimate y ambas regiones por defecto', () => {
    expect(
      parsePlayerImportOptions(['--player-id=1354812'], new Date('2026-08-13T12:00:00Z'))
    ).toEqual({
      playerId: '1354812',
      from: new Date('2018-12-07T00:00:00.000Z'),
      to: new Date('2026-08-13T12:00:00.000Z'),
      regions: ['EU', 'US'],
      maxTournaments: 25,
    });
  });

  it('permite seleccionar una región e importar sin límite', () => {
    expect(
      parsePlayerImportOptions(['--player-id=1354812', '--regions=us', '--max-tournaments=all'])
    ).toEqual(expect.objectContaining({ regions: ['US'], maxTournaments: undefined }));
  });

  it('rechaza regiones no admitidas', () => {
    expect(() => parsePlayerImportOptions(['--player-id=1354812', '--regions=EU,JP'])).toThrow(
      '`--regions` solo admite EU y US.'
    );
  });
});
