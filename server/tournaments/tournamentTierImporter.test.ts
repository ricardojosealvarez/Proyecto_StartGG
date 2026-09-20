import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { normalizeStartggSlug, parseTournamentTierWorksheet } from './tournamentTierImporter.ts';

function createWorksheet(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Index');
  worksheet.addRows(rows);
  return worksheet;
}

describe('normalizeStartggSlug', () => {
  it('normaliza enlaces start.gg y smash.gg', () => {
    expect(normalizeStartggSlug('https://start.gg/tournament/genesis-6/events/ultimate')).toBe(
      'tournament/genesis-6'
    );
    expect(normalizeStartggSlug('https://www.smash.gg/tournament/frostbite-2019')).toBe(
      'tournament/frostbite-2019'
    );
  });

  it('rechaza otros hosts y URLs inválidas', () => {
    expect(normalizeStartggSlug('https://challonge.com/test')).toBeNull();
    expect(normalizeStartggSlug('no-es-url')).toBeNull();
  });
});

describe('parseTournamentTierWorksheet', () => {
  it('resuelve encabezados y clasifica filas', () => {
    const worksheet = createWorksheet([
      ['Tournament', 'Link', 'Other', 'Points', 'Tier'],
      ['Genesis', 'https://smash.gg/tournament/genesis-6/events/ultimate', '', 2105, 's'],
      ['External', 'https://challonge.com/test', '', 200, 'C'],
      ['Invalid points', 'https://start.gg/tournament/invalid', '', 1.5, 'B'],
      ['Empty'],
    ]);

    expect(parseTournamentTierWorksheet(worksheet)).toEqual({
      rowsRead: 3,
      records: [
        {
          rowNumber: 2,
          slug: 'tournament/genesis-6',
          startggUrl: 'https://smash.gg/tournament/genesis-6/events/ultimate',
          tierPoints: 2105,
          tier: 'S',
        },
      ],
      unsupportedLinks: ['https://challonge.com/test'],
      rejected: [{ rowNumber: 4, reason: 'Points debe ser un entero no negativo.' }],
    });
  });

  it('acepta duplicados idénticos y rechaza datos contradictorios', () => {
    const worksheet = createWorksheet([
      ['Link', 'Points', 'Tier'],
      ['https://start.gg/tournament/same', 200, 'C'],
      ['https://start.gg/tournament/same', 200, 'C'],
      ['https://start.gg/tournament/conflict', 200, 'C'],
      ['https://start.gg/tournament/conflict', 400, 'B'],
    ]);
    const result = parseTournamentTierWorksheet(worksheet);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].slug).toBe('tournament/same');
    expect(result.rejected).toEqual([
      {
        rowNumber: 5,
        reason: 'Datos contradictorios para tournament/conflict (primera fila: 4).',
      },
    ]);
  });

  it('falla cuando faltan encabezados obligatorios', () => {
    const worksheet = createWorksheet([['Tournament', 'URL']]);
    expect(() => parseTournamentTierWorksheet(worksheet)).toThrow(
      'No se encontraron los encabezados Link, Points y Tier.'
    );
  });
});
