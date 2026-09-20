import { describe, expect, it } from 'vitest';
import { parseTournamentTierImportOptions } from './tournamentTierImportOptions.ts';

describe('parseTournamentTierImportOptions', () => {
  it('usa Index como hoja predeterminada', () => {
    expect(parseTournamentTierImportOptions(['--file=C:\\tmp\\tiers.xlsx'])).toEqual({
      filePath: 'C:\\tmp\\tiers.xlsx',
      sheetName: 'Index',
    });
  });

  it('admite una hoja explícita', () => {
    expect(parseTournamentTierImportOptions(['--file=tiers.xlsx', '--sheet=Spring'])).toEqual({
      filePath: 'tiers.xlsx',
      sheetName: 'Spring',
    });
  });

  it('requiere el archivo', () => {
    expect(() => parseTournamentTierImportOptions([])).toThrow(
      'Falta el parámetro obligatorio `--file=<ruta>`.'
    );
  });
});
